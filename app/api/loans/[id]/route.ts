import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canManageAllLoans, getSessionUser, hasRole, isSuperAdmin, normalizeRoles } from '@/lib/auth'
import { ensureDatabaseSetup } from '@/lib/database-setup'
import { dashboardLoanInclude, fullLoanInclude } from '@/lib/loan-selects'
import { notifyLoanReviewed, notifyNewLoan } from '@/lib/notifications'
import { validateLoanRequestFiles } from '@/lib/loan-form-options'
import { syncClosureElementFromPrint } from '@/lib/closure-integration'

async function getEditableLoan(id: string) {
  await ensureDatabaseSetup()
  const currentUser = getSessionUser()
  if (!currentUser) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const loan = await prisma.loan.findUnique({
    where: { id },
    include: dashboardLoanInclude,
  })

  if (!loan) {
    return { error: NextResponse.json({ error: 'Loan not found' }, { status: 404 }) }
  }

  if (!canManageAllLoans(currentUser) && loan.userId !== currentUser.userId) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { currentUser, loan }
}

// المدير يستطيع الاعتماد "بالنيابة عن" مراجع آخر (يُستخدم توقيع ذلك المراجع في النماذج)
async function resolveReviewerOnBehalf(
  currentUser: NonNullable<ReturnType<typeof getSessionUser>>,
  onBehalfOfUserId: unknown,
): Promise<{ reviewerId: string } | { error: NextResponse }> {
  if (isSuperAdmin(currentUser) && typeof onBehalfOfUserId === 'string' && onBehalfOfUserId) {
    const targetReviewer = await prisma.user.findUnique({
      where: { id: onBehalfOfUserId },
      select: { id: true, role: true, roles: true },
    })

    const role = targetReviewer?.role as 'EMPLOYEE' | 'ADMIN' | 'REVIEWER' | undefined
    if (!targetReviewer || !hasRole({ role: role!, roles: normalizeRoles(targetReviewer.roles, role!) }, 'REVIEWER')) {
      return { error: NextResponse.json({ error: 'المستخدم المحدد لا يملك صلاحية مراجع.' }, { status: 400 }) }
    }

    return { reviewerId: targetReviewer.id }
  }

  return { reviewerId: currentUser.userId }
}

function canEmployeeControlLoan(
  currentUser: NonNullable<ReturnType<typeof getSessionUser>>,
  loan: { userId: string | null; reviewStatus: string; isSettled: boolean },
) {
  return loan.userId === currentUser.userId && loan.reviewStatus !== 'REVIEWED' && !loan.isSettled
}

export async function GET(
  _: Request,
  { params }: { params: { id: string } },
) {
  try {
    await ensureDatabaseSetup()
    const currentUser = getSessionUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const loan = await prisma.loan.findUnique({
      where: { id: params.id },
      include: fullLoanInclude,
    })

    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 })
    }

    if (!canManageAllLoans(currentUser) && loan.userId !== currentUser.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(loan)
  } catch {
    return NextResponse.json({ error: 'Failed to load loan' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const result = await getEditableLoan(params.id)
    if ('error' in result) return result.error

    const { loan, currentUser } = result

    if (!canManageAllLoans(currentUser) && !canEmployeeControlLoan(currentUser, loan)) {
      return NextResponse.json(
        { error: 'لا يمكن تعديل المعاملة بعد اعتماد المراجع.' },
        { status: 409 },
      )
    }

    const body = await request.json()

    // تعليق / رفع تعليق السلفة (للمدير فقط)
    if ('isOnHold' in body && canManageAllLoans(currentUser)) {
      await prisma.loan.update({
        where: { id: loan.id },
        data: { isOnHold: Boolean(body.isOnHold), holdReason: body.holdReason ?? null },
      })
      return NextResponse.json({ ok: true })
    }

    if (
      typeof body.reviewStatus === 'string' &&
      !('activity' in body) &&
      !('startDate' in body) &&
      canManageAllLoans(currentUser)
    ) {
      const nextStatus = body.reviewStatus as 'PENDING' | 'REVIEWED' | 'RETURNED'
      const closureType = body.closureType === 'settlement' ? 'settlement' : 'advance_req'

      if (nextStatus === 'REVIEWED' && closureType === 'settlement' && !loan.settlement) {
        return NextResponse.json({ error: 'لا توجد تسوية محفوظة لاعتماد نموذج ١٩.' }, { status: 409 })
      }

      if (nextStatus === 'PENDING') {
        if (closureType === 'settlement') {
          if (!loan.settlement) {
            return NextResponse.json({ error: 'لا توجد تسوية محفوظة لإلغاء اعتماد نموذج ١٩.' }, { status: 409 })
          }

          const pendingSettlementLoan = await prisma.loan.update({
            where: { id: loan.id },
            data: {
              settlementStatus: 'SUBMITTED',
              settlementReviewedById: null,
              secondSettlementReviewedById: null,
              reviewNote: String(body.reviewNote ?? '').trim() || null,
            },
            include: dashboardLoanInclude,
          })

          return NextResponse.json(pendingSettlementLoan)
        }

        if (loan.settlementStatus === 'APPROVED') {
          return NextResponse.json(
            { error: 'ألغ اعتماد نموذج ١٩ قبل إلغاء اعتماد نموذج ١٨.' },
            { status: 409 },
          )
        }

        const pendingLoan = await prisma.loan.update({
          where: { id: loan.id },
          data: {
            reviewStatus: 'PENDING',
            reviewedById: null,
            secondReviewedById: null,
            reviewNote: String(body.reviewNote ?? '').trim() || null,
          },
          include: dashboardLoanInclude,
        })

        return NextResponse.json(pendingLoan)
      }

      if (nextStatus === 'RETURNED' && closureType === 'settlement') {
        if (!loan.settlement) {
          return NextResponse.json({ error: 'لا توجد تسوية محفوظة لإعادتها للموظف.' }, { status: 409 })
        }

        const returnedSettlementLoan = await prisma.loan.update({
          where: { id: loan.id },
          data: {
            isSettled: false,
            settlementStatus: 'IN_PROGRESS',
            settlementReviewedById: null,
            secondSettlementReviewedById: null,
            reviewNote: String(body.reviewNote ?? '').trim() || null,
          },
          include: dashboardLoanInclude,
        })

        if (loan.userId) {
          const owner = await prisma.user.findUnique({
            where: { id: loan.userId },
            select: { email: true },
          })

          if (owner?.email) {
            void notifyLoanReviewed({
              userId: loan.userId,
              userEmail: owner.email,
              refNumber: loan.refNumber,
              loanId: loan.id,
              status: 'RETURNED',
              note: String(body.reviewNote ?? '').trim() || undefined,
            }).catch(console.error)
          }
        }

        return NextResponse.json(returnedSettlementLoan)
      }

      if (nextStatus === 'RETURNED') {
        const returnedLoan = await prisma.loan.update({
          where: { id: loan.id },
          data: {
            reviewStatus: 'RETURNED',
            reviewedById: null,
            secondReviewedById: null,
            reviewNote: String(body.reviewNote ?? '').trim() || null,
          },
          include: dashboardLoanInclude,
        })

        if (loan.userId) {
          const owner = await prisma.user.findUnique({ where: { id: loan.userId }, select: { email: true } })
          if (owner?.email) {
            void notifyLoanReviewed({
              userId: loan.userId,
              userEmail: owner.email,
              refNumber: loan.refNumber,
              loanId: loan.id,
              status: 'RETURNED',
              note: String(body.reviewNote ?? '').trim() || undefined,
            }).catch(console.error)
          }
        }

        return NextResponse.json(returnedLoan)
      }

      // nextStatus === 'REVIEWED' — تتطلب كل معاملة تأشيرة مراجعين اثنين مختلفين قبل اعتبارها معتمدة نهائياً
      // المدير لا يعتمد بنفسه — يجب تحديد مراجع بالنيابة عنه
      if (isSuperAdmin(currentUser) && !body.onBehalfOfUserId) {
        return NextResponse.json(
          { error: 'المدير لا يمكنه الاعتماد المباشر — استخدم أداة تثبيت توقيع المراجع وحدد المراجع بالاسم.' },
          { status: 403 },
        )
      }
      const resolved = await resolveReviewerOnBehalf(currentUser, body.onBehalfOfUserId)
      if ('error' in resolved) return resolved.error
      const reviewerId = resolved.reviewerId
      const reviewNote = String(body.reviewNote ?? '').trim() || null

      if (closureType === 'settlement') {
        if (loan.settlementStatus === 'AWAITING_SECOND_REVIEW') {
          if (loan.settlementReviewedById === reviewerId) {
            return NextResponse.json(
              { error: 'لا يمكن إكمال اعتماد نموذج ١٩ بنفس توقيع المراجع الأول — يلزم تأشيرة مراجع ثانٍ مختلف.' },
              { status: 409 },
            )
          }

          const finalizedSettlement = await prisma.loan.update({
            where: { id: loan.id },
            data: { settlementStatus: 'APPROVED', secondSettlementReviewedById: reviewerId, reviewNote },
            include: dashboardLoanInclude,
          })

          if (loan.userId) {
            const owner = await prisma.user.findUnique({ where: { id: loan.userId }, select: { email: true } })
            if (owner?.email) {
              void notifyLoanReviewed({
                userId: loan.userId,
                userEmail: owner.email,
                refNumber: loan.refNumber,
                loanId: loan.id,
                status: 'REVIEWED',
                note: reviewNote ?? undefined,
              }).catch(console.error)
            }
          }

          const linkedSettlementLoan = await prisma.loan.findUnique({ where: { id: loan.id }, include: fullLoanInclude })
          if (linkedSettlementLoan?.courseId) {
            await syncClosureElementFromPrint('settlement', linkedSettlementLoan)
          }

          return NextResponse.json(finalizedSettlement)
        }

        const firstApprovedSettlement = await prisma.loan.update({
          where: { id: loan.id },
          data: { settlementStatus: 'AWAITING_SECOND_REVIEW', settlementReviewedById: reviewerId, reviewNote },
          include: dashboardLoanInclude,
        })

        return NextResponse.json(firstApprovedSettlement)
      }

      if (loan.reviewStatus === 'AWAITING_SECOND_REVIEW') {
        if (loan.reviewedById === reviewerId) {
          return NextResponse.json(
            { error: 'لا يمكن إكمال اعتماد نموذج ١٨ بنفس توقيع المراجع الأول — يلزم تأشيرة مراجع ثانٍ مختلف.' },
            { status: 409 },
          )
        }

        const finalizedLoan = await prisma.loan.update({
          where: { id: loan.id },
          data: { reviewStatus: 'REVIEWED', secondReviewedById: reviewerId, reviewNote },
          include: dashboardLoanInclude,
        })

        if (loan.userId) {
          const owner = await prisma.user.findUnique({ where: { id: loan.userId }, select: { email: true } })
          if (owner?.email) {
            void notifyLoanReviewed({
              userId: loan.userId,
              userEmail: owner.email,
              refNumber: loan.refNumber,
              loanId: loan.id,
              status: 'REVIEWED',
              note: reviewNote ?? undefined,
            }).catch(console.error)
          }
        }

        const linkedLoan = await prisma.loan.findUnique({ where: { id: loan.id }, include: fullLoanInclude })
        if (linkedLoan?.courseId) {
          await syncClosureElementFromPrint('advance_req', linkedLoan)
        }

        return NextResponse.json(finalizedLoan)
      }

      const firstApprovedLoan = await prisma.loan.update({
        where: { id: loan.id },
        data: { reviewStatus: 'AWAITING_SECOND_REVIEW', reviewedById: reviewerId, reviewNote },
        include: dashboardLoanInclude,
      })

      return NextResponse.json(firstApprovedLoan)
    }

    const isDraft = typeof body.isDraft === 'boolean' ? body.isDraft : loan.isDraft
    const wasDraft = loan.isDraft
    const items = Array.isArray(body.items) ? body.items : []
    const filesError = isDraft ? null : validateLoanRequestFiles(body.files ?? {})
    if (filesError) return NextResponse.json({ error: filesError }, { status: 400 })

    if (isDraft && (!body.activity || !body.startDate || !body.endDate)) {
      return NextResponse.json(
        { error: 'أدخل النشاط وتاريخ البداية والنهاية على الأقل قبل حفظ المسودة.' },
        { status: 400 },
      )
    }

    // أي تعديل في محتوى المعاملة يُلغي توقيعات المراجعين السابقة تلقائياً
    const hadReviewerSignature = !!loan.reviewedById || !!loan.secondReviewedById

    const updateData: Record<string, unknown> = {
      activity: String(body.activity ?? '').trim(),
      location: String(body.location ?? '').trim(),
      amount: Number(body.amount ?? 0),
      budgetApproved:
        typeof body.budgetApproved === 'boolean' ? body.budgetApproved : null,
      isDraft,
      reviewStatus: 'PENDING',
      reviewedById: null,
      secondReviewedById: null,
      reviewNote: canManageAllLoans(currentUser)
        ? String(body.reviewNote ?? '').trim() || null
        : null,
      files: body.files ?? undefined,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      items: {
        create: items.map((item: { category: string; amount: number }) => ({
          category: item.category,
          amount: item.amount,
        })),
      },
    }

    if (isSuperAdmin(currentUser) && typeof body.refNumber === 'string') {
      const refNumber = body.refNumber.trim()
      if (refNumber) updateData.refNumber = refNumber
    }

    const updatedLoan = await prisma.$transaction(async (tx) => {
      await tx.loanItem.deleteMany({
        where: { loanId: loan.id },
      })

      return tx.loan.update({
        where: { id: loan.id },
        data: updateData,
        include: dashboardLoanInclude,
      })
    }, { timeout: 20000 })

    if (wasDraft && !isDraft) {
      void notifyNewLoan({
        id: updatedLoan.id,
        refNumber: updatedLoan.refNumber,
        employee: updatedLoan.employee,
        amount: updatedLoan.amount,
        activity: updatedLoan.activity,
      }).catch(() => {})
    }

    // إشعار الموظف إذا أُلغي توقيع المراجع بسبب التعديل
    if (hadReviewerSignature && updatedLoan.userId) {
      const owner = await prisma.user.findUnique({ where: { id: updatedLoan.userId }, select: { email: true } })
      if (owner?.email) {
        void notifyLoanReviewed({
          userId: updatedLoan.userId,
          userEmail: owner.email,
          refNumber: updatedLoan.refNumber,
          loanId: updatedLoan.id,
          status: 'RETURNED',
          note: 'تم تعديل بيانات المعاملة من قِبل المدير — يرجى مراجعتها وانتظار إعادة الاعتماد.',
        }).catch(console.error)
      }
    }

    return NextResponse.json(updatedLoan)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update loan' },
      { status: 500 },
    )
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: { id: string } },
) {
  try {
    const result = await getEditableLoan(params.id)
    if ('error' in result) return result.error

    const { loan, currentUser } = result

    if (!isSuperAdmin(currentUser) && !canEmployeeControlLoan(currentUser, loan)) {
      return NextResponse.json(
        { error: 'لا يمكن حذف المعاملة بعد اعتماد المراجع.' },
        { status: 409 },
      )
    }

    await prisma.loan.delete({
      where: { id: loan.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete loan' },
      { status: 500 },
    )
  }
}


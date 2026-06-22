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

      let reviewerId: string | null = null
      if (nextStatus === 'REVIEWED') {
        const resolved = await resolveReviewerOnBehalf(currentUser, body.onBehalfOfUserId)
        if ('error' in resolved) return resolved.error
        reviewerId = resolved.reviewerId
      }

      const reviewedLoan = await prisma.loan.update({
        where: { id: loan.id },
        data: {
          reviewStatus: nextStatus,
          reviewNote: String(body.reviewNote ?? '').trim() || null,
          settlementStatus: nextStatus === 'REVIEWED' && closureType === 'settlement' ? 'APPROVED' : undefined,
        },
        include: dashboardLoanInclude,
      })

      if (loan.userId && (nextStatus === 'REVIEWED' || nextStatus === 'RETURNED')) {
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
            status: nextStatus,
            note: String(body.reviewNote ?? '').trim() || undefined,
          }).catch(console.error)
        }
      }

      if (nextStatus === 'REVIEWED') {
        const linkedLoan = await prisma.loan.findUnique({
          where: { id: loan.id },
          include: fullLoanInclude,
        })
        if (linkedLoan?.courseId) {
          await syncClosureElementFromPrint(closureType, linkedLoan)
        }
      }

      return NextResponse.json(reviewedLoan)
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

    const updateData: Record<string, unknown> = {
      activity: String(body.activity ?? '').trim(),
      location: String(body.location ?? '').trim(),
      amount: Number(body.amount ?? 0),
      budgetApproved:
        typeof body.budgetApproved === 'boolean' ? body.budgetApproved : null,
      isDraft,
      reviewStatus: canManageAllLoans(currentUser)
        ? ((body.reviewStatus ?? loan.reviewStatus) as 'PENDING' | 'REVIEWED' | 'RETURNED')
        : 'PENDING',
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


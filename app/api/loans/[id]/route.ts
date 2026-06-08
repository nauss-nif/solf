import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canManageAllLoans, getSessionUser, isSuperAdmin } from '@/lib/auth'
import { ensureDatabaseSetup } from '@/lib/database-setup'
import { dashboardLoanInclude } from '@/lib/loan-selects'
import { notifyLoanReviewed } from '@/lib/notifications'

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

function canEmployeeControlLoan(
  currentUser: NonNullable<ReturnType<typeof getSessionUser>>,
  loan: { userId: string | null; reviewStatus: string; isSettled: boolean },
) {
  return loan.userId === currentUser.userId && loan.reviewStatus !== 'REVIEWED' && !loan.isSettled
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
      const nextStatus = body.reviewStatus as 'REVIEWED' | 'RETURNED'
      const reviewedLoan = await prisma.loan.update({
        where: { id: loan.id },
        data: {
          reviewStatus: nextStatus,
          reviewNote: String(body.reviewNote ?? '').trim() || null,
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

      return NextResponse.json(reviewedLoan)
    }

    const items = Array.isArray(body.items) ? body.items : []

    const updateData: Record<string, unknown> = {
      activity: String(body.activity ?? '').trim(),
      location: String(body.location ?? '').trim(),
      amount: Number(body.amount ?? 0),
      budgetApproved:
        typeof body.budgetApproved === 'boolean' ? body.budgetApproved : null,
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
    })

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

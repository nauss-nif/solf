import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canManageAllLoans, getSessionUser } from '@/lib/auth'
import { ensureDatabaseSetup } from '@/lib/database-setup'
import { dashboardLoanInclude } from '@/lib/loan-selects'

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

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const result = await getEditableLoan(params.id)
    if ('error' in result) return result.error

    const { loan, currentUser } = result

    if (loan.printedAt && !canManageAllLoans(currentUser)) {
      return NextResponse.json(
        { error: 'لا يمكن تعديل الطلب بعد طباعته أو تصديره.' },
        { status: 409 },
      )
    }

    if (loan.isSettled && !canManageAllLoans(currentUser)) {
      return NextResponse.json(
        { error: 'لا يمكن تعديل الطلب بعد تسويته.' },
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
      const reviewedLoan = await prisma.loan.update({
        where: { id: loan.id },
        data: {
          reviewStatus: body.reviewStatus,
          reviewNote: String(body.reviewNote ?? '').trim() || null,
        },
        include: dashboardLoanInclude,
      })

      return NextResponse.json(reviewedLoan)
    }

    const items = Array.isArray(body.items) ? body.items : []

    const updatedLoan = await prisma.$transaction(async (tx) => {
      await tx.loanItem.deleteMany({
        where: { loanId: loan.id },
      })

      return tx.loan.update({
        where: { id: loan.id },
        data: {
          activity: String(body.activity ?? '').trim(),
          location: String(body.location ?? '').trim(),
          amount: Number(body.amount ?? 0),
          budgetApproved:
            typeof body.budgetApproved === 'boolean' ? body.budgetApproved : null,
          reviewStatus: String(body.reviewStatus ?? loan.reviewStatus),
          reviewNote: String(body.reviewNote ?? '').trim() || null,
          files: body.files ?? undefined,
          startDate: new Date(body.startDate),
          endDate: new Date(body.endDate),
          items: {
            create: items.map((item: { category: string; amount: number }) => ({
              category: item.category,
              amount: item.amount,
            })),
          },
        },
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

    if (loan.printedAt && !canManageAllLoans(currentUser)) {
      return NextResponse.json(
        { error: 'لا يمكن حذف الطلب بعد طباعته أو تصديره.' },
        { status: 409 },
      )
    }

    if (loan.isSettled && !canManageAllLoans(currentUser)) {
      return NextResponse.json(
        { error: 'لا يمكن حذف الطلب بعد تسويته.' },
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

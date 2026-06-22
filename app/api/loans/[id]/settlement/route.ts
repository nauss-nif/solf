import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canManageAllLoans, getSessionUser } from '@/lib/auth'
import { ensureDatabaseSetup } from '@/lib/database-setup'
import { dashboardLoanInclude } from '@/lib/loan-selects'

// ─────────────────────────────────────────────────────────────
// DELETE /api/loans/[id]/settlement — حذف تسوية مُقدَّمة (قبل اعتمادها فقط)
// يعيد السلفة لحالة "قيد التسوية" للسماح بإعادة التقديم
// ─────────────────────────────────────────────────────────────
export async function DELETE(
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
      select: { id: true, userId: true, isSettled: true, settlementStatus: true },
    })

    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 })
    }

    if (!canManageAllLoans(currentUser) && loan.userId !== currentUser.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!loan.isSettled) {
      return NextResponse.json({ error: 'لا توجد تسوية مرفوعة لحذفها.' }, { status: 409 })
    }

    if (loan.settlementStatus === 'APPROVED') {
      return NextResponse.json({ error: 'لا يمكن حذف التسوية بعد اعتمادها.' }, { status: 409 })
    }

    const updatedLoan = await prisma.$transaction(async (tx) => {
      await tx.settlement.deleteMany({ where: { loanId: loan.id } })
      return tx.loan.update({
        where: { id: loan.id },
        data: { isSettled: false, settlementStatus: 'NOT_STARTED' },
        include: dashboardLoanInclude,
      })
    })

    return NextResponse.json(updatedLoan)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete settlement' },
      { status: 500 },
    )
  }
}

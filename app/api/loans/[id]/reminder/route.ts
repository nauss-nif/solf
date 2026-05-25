import { NextResponse } from 'next/server'
import { canManageAllLoans, requireSessionUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notifyLoanFollowUpRequest } from '@/lib/notifications'

export async function POST(
  _: Request,
  { params }: { params: { id: string } },
) {
  try {
    const currentUser = requireSessionUser()
    const loan = await prisma.loan.findUnique({ where: { id: params.id } })

    if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 })
    if (!canManageAllLoans(currentUser) && loan.userId !== currentUser.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (loan.reviewStatus === 'REVIEWED') {
      return NextResponse.json({ error: 'تمت مراجعة هذا الطلب بالفعل' }, { status: 400 })
    }

    await notifyLoanFollowUpRequest({
      id: loan.id,
      refNumber: loan.refNumber,
      employee: loan.employee,
      amount: loan.amount,
      activity: loan.activity,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send reminder' },
      { status: 500 },
    )
  }
}

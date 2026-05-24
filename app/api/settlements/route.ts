import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canManageAllLoans, getSessionUser } from '@/lib/auth'
import { ensureDatabaseSetup } from '@/lib/database-setup'
import { dashboardLoanInclude } from '@/lib/loan-selects'

export async function POST(request: Request) {
  try {
    await ensureDatabaseSetup()
    const currentUser = getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const loan = await prisma.loan.findUnique({
      where: { id: body.loanId },
      select: { id: true, userId: true },
    })

    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 })
    }

    if (!canManageAllLoans(currentUser) && loan.userId !== currentUser.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const savings = Number(body.savings ?? 0)
    const receiptNumber = String(body.receiptNumber ?? '').trim()
    const receiptDate = String(body.receiptDate ?? '').trim()

    if (savings > 0 && (!receiptNumber || receiptNumber === '-' || !receiptDate)) {
      return NextResponse.json(
        { error: 'يجب إدخال رقم سند قبض صحيح وتاريخه عند وجود وفر في السلفة النقدية.' },
        { status: 400 },
      )
    }

    await prisma.$transaction([
      prisma.settlement.create({
        data: {
          loanId: body.loanId,
          supported: body.supported,
          unsupported: body.unsupported,
          total: body.total,
          savings,
          overage: body.overage,
          invoices: {
            settlementDate: new Date().toISOString(),
            currencyRates: Array.isArray(body.currencyRates) ? body.currencyRates : [],
            details: Array.isArray(body.details) ? body.details : [],
            receiptNumber,
            receiptDate,
            overageReason: String(body.overageReason ?? '').trim(),
            pettyCashApproval: body.pettyCashApproval ?? null,
          },
        },
      }),
      prisma.loan.update({
        where: { id: body.loanId },
        data: { isSettled: true },
      }),
    ])

    const updatedLoan = await prisma.loan.findUnique({
      where: { id: body.loanId },
      include: dashboardLoanInclude,
    })

    return NextResponse.json(updatedLoan)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Settlement failed' },
      { status: 500 },
    )
  }
}

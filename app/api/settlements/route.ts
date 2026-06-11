import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canManageAllLoans, getSessionUser } from '@/lib/auth'
import { ensureDatabaseSetup } from '@/lib/database-setup'
import { dashboardLoanInclude, fullLoanInclude } from '@/lib/loan-selects'
import { validateSettlementAttachments } from '@/lib/loan-form-options'
import { syncClosureElementFromPrint } from '@/lib/closure-integration'

export async function POST(request: Request) {
  try {
    await ensureDatabaseSetup()
    const currentUser = getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const attachmentsError = validateSettlementAttachments(body.details, body.pettyCashApproval)
    if (attachmentsError) return NextResponse.json({ error: attachmentsError }, { status: 400 })

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

    const receiptNumber = String(body.receiptNumber ?? '').trim()
    const receiptDate = String(body.receiptDate ?? '').trim()

    await prisma.$transaction([
      prisma.settlement.create({
        data: {
          loanId: body.loanId,
          supported: body.supported,
          unsupported: body.unsupported,
          total: body.total,
          savings: body.savings,
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
        data: { isSettled: true, settlementStatus: 'SUBMITTED' },
      }),
    ])

    const updatedLoan = await prisma.loan.findUnique({
      where: { id: body.loanId },
      include: dashboardLoanInclude,
    })

    if (updatedLoan?.reviewStatus === 'REVIEWED' && updatedLoan.courseId) {
      const linkedLoan = await prisma.loan.findUnique({
        where: { id: body.loanId },
        include: fullLoanInclude,
      })
      if (linkedLoan) void syncClosureElementFromPrint('settlement', linkedLoan).catch(console.error)
    }

    return NextResponse.json(updatedLoan)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Settlement failed' },
      { status: 500 },
    )
  }
}

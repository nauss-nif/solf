import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { canManageAllLoans, getSessionUser } from '@/lib/auth'
import { ensureDatabaseSetup } from '@/lib/database-setup'
import { dashboardLoanInclude } from '@/lib/loan-selects'
import { validateSettlementAttachments } from '@/lib/loan-form-options'

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
      select: { id: true, userId: true, reviewStatus: true, settlementStatus: true },
    })

    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 })
    }

    if (!canManageAllLoans(currentUser) && loan.userId !== currentUser.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (loan.reviewStatus !== 'REVIEWED') {
      return NextResponse.json(
        { error: 'لا يمكن رفع تسوية السلفة قبل اعتماد نموذج ١٨.' },
        { status: 409 },
      )
    }

    if (loan.settlementStatus === 'APPROVED') {
      return NextResponse.json(
        { error: 'لا يمكن تعديل التسوية بعد اعتمادها.' },
        { status: 409 },
      )
    }

    const receiptNumber = String(body.receiptNumber ?? '').trim()
    const receiptDate = String(body.receiptDate ?? '').trim()

    const invoicesData = {
      settlementDate: new Date().toISOString(),
      currencyRates: Array.isArray(body.currencyRates) ? body.currencyRates : [],
      details: Array.isArray(body.details) ? body.details : [],
      receiptNumber,
      receiptDate,
      overageReason: String(body.overageReason ?? '').trim(),
      pettyCashApproval: body.pettyCashApproval ?? null,
      receiptAttachment: body.receiptAttachment ?? null,
    }

    await prisma.$transaction(async (tx) => {
      await tx.settlement.upsert({
        where: { loanId: body.loanId },
        create: {
          loanId: body.loanId,
          supported: body.supported,
          unsupported: body.unsupported,
          total: body.total,
          savings: body.savings,
          overage: body.overage,
          invoices: invoicesData,
        },
        update: {
          supported: body.supported,
          unsupported: body.unsupported,
          total: body.total,
          savings: body.savings,
          overage: body.overage,
          invoices: invoicesData,
        },
      })

      await tx.loan.update({
        where: { id: body.loanId },
        data: { isSettled: true, settlementStatus: 'SUBMITTED', settlementDraft: Prisma.JsonNull },
      })
    }, { timeout: 20000 })

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

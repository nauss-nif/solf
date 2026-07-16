import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canManageAllLoans, requireSessionUser } from '@/lib/auth'
import { ensureDatabaseSetup } from '@/lib/database-setup'
import { fullLoanInclude } from '@/lib/loan-selects'
import { getReviewerSignatures } from '@/lib/loan-records'
import { buildLoanRequestWordHtml } from '@/lib/document-templates'
import { getSystemSettings } from '@/lib/system-settings'
import { renderHtmlToPdf } from '@/lib/pdf'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    await ensureDatabaseSetup()
    const currentUser = requireSessionUser()

    let loan = await prisma.loan.findUnique({
      where: { id: params.id },
      include: fullLoanInclude,
    })

    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 })
    }

    if (!canManageAllLoans(currentUser) && loan.userId !== currentUser.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const settings = await getSystemSettings()
    // المراجع والمدير العام يطبعان النموذج في أي مرحلة لأغراض المراجعة، بصرف النظر عن إعداد السماح بالطباعة قبل الاعتماد
    if (!canManageAllLoans(currentUser) && !settings.allowPrintBeforeReview && loan.reviewStatus !== 'REVIEWED') {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
    }

    if (settings.allowPrintBeforeReview && !loan.printedAt) {
      loan = await prisma.loan.update({
        where: { id: loan.id },
        data: { printedAt: new Date() },
        include: fullLoanInclude,
      })
    }

    const loanWithReviewers = loan as any
    const reviewerSignatures =
      loan.reviewStatus === 'REVIEWED'
        ? await getReviewerSignatures(loanWithReviewers.reviewedBy?.id, loanWithReviewers.secondReviewedBy?.id)
        : undefined
    const applicantSignature = !loan.isDraft ? loanWithReviewers.user?.signatureImage ?? null : null

    const html = buildLoanRequestWordHtml(loan, { settings, reviewerSignatures, applicantSignature })
    const pdf = await renderHtmlToPdf(html)

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="loan-${loan.refNumber || loan.id}.pdf"`,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to render PDF' },
      { status: 500 },
    )
  }
}

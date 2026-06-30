import PrintActions from '@/app/print/PrintActions'
import { canManageAllLoans, requireSessionUser } from '@/lib/auth'
import { syncClosureElementFromPrint } from '@/lib/closure-integration'
import { buildLoanRequestWordHtml } from '@/lib/document-templates'
import { getAuthorizedLoan, getReviewerSignatures } from '@/lib/loan-records'
import { getSystemSettings } from '@/lib/system-settings'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function LoanPrintPage({
  params,
}: {
  params: { id: string }
}) {
  const currentUser = requireSessionUser()
  const settings = await getSystemSettings()
  let loan = await getAuthorizedLoan(params.id, { markPrinted: settings.allowPrintBeforeReview })

  // المراجع والمدير العام يطبعان النموذج في أي مرحلة لأغراض المراجعة
  if (!canManageAllLoans(currentUser) && !settings.allowPrintBeforeReview && loan.reviewStatus !== 'REVIEWED') {
    notFound()
  }

  if (!settings.allowPrintBeforeReview) {
    loan = await getAuthorizedLoan(params.id, { markPrinted: true })
  }

  if (loan.reviewStatus === 'REVIEWED') {
    await syncClosureElementFromPrint('advance_req', loan)
  }

  const loanWithReviewers = loan as any
  const hasAnyReviewerSigned = ['AWAITING_SECOND_REVIEW', 'REVIEWED'].includes(loan.reviewStatus as string)
  const reviewerSignatures = hasAnyReviewerSigned ? await getReviewerSignatures(loanWithReviewers.reviewedBy?.id, loanWithReviewers.secondReviewedBy?.id) : undefined
  const applicantSignature = !loan.isDraft ? loanWithReviewers.user?.signatureImage ?? null : null
  const html = buildLoanRequestWordHtml(loan, { settings, reviewerSignatures, applicantSignature })

  return (
    <main className="min-h-screen bg-slate-100 px-2 py-4 print:bg-white print:p-0">
      <div className="mx-auto max-w-[210mm]">
        <PrintActions pdfHref={`/api/print/loans/${params.id}`} />
        <div className="bg-white p-2 print:p-0" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </main>
  )
}

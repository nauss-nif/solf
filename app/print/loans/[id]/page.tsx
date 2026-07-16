import PrintActions from '@/app/print/PrintActions'
import { canManageAllLoans, requireSessionUser } from '@/lib/auth'
import { buildLoanRequestWordHtml } from '@/lib/document-templates'
import { getAuthorizedLoan, getReviewerSignatures } from '@/lib/loan-records'
import { getSystemSettings } from '@/lib/system-settings'

export const dynamic = 'force-dynamic'

export default async function LoanPrintPage({
  params,
}: {
  params: { id: string }
}) {
  const currentUser = requireSessionUser()
  const settings = await getSystemSettings()
  const loan = await getAuthorizedLoan(params.id)

  if (loan.reviewStatus === 'REVIEWED' && !settings.allowPrintBeforeReview) {
    await getAuthorizedLoan(params.id, { markPrinted: true })
  }

  // الموظف يستطيع المعاينة دائماً — الطباعة محجوبة حتى يوقّع المراجعان الاثنان
  const isFullyReviewed = loan.reviewStatus === 'REVIEWED'
  const printBlocked = !canManageAllLoans(currentUser) && !isFullyReviewed

  const printBlockedReason = loan.reviewStatus === 'AWAITING_SECOND_REVIEW'
    ? 'بانتظار توقيع المراجع الثاني — ستُتاح الطباعة بعد اعتماده'
    : 'لم يعتمد أي مراجع هذا الطلب بعد — ستُتاح الطباعة بعد توقيع المراجعَين'

  const loanWithReviewers = loan as any
  const hasAnyReviewerSigned = ['AWAITING_SECOND_REVIEW', 'REVIEWED'].includes(loan.reviewStatus as string)
  const reviewerSignatures = hasAnyReviewerSigned ? await getReviewerSignatures(loanWithReviewers.reviewedBy?.id, loanWithReviewers.secondReviewedBy?.id) : undefined
  const applicantSignature = !loan.isDraft ? loanWithReviewers.user?.signatureImage ?? null : null
  const html = buildLoanRequestWordHtml(loan, { settings, reviewerSignatures, applicantSignature })

  return (
    <main className="min-h-screen bg-slate-100 px-2 py-4 print:bg-white print:p-0">
      <div className="mx-auto max-w-[210mm]">
        <PrintActions
          pdfHref={`/api/print/loans/${params.id}`}
          printBlocked={printBlocked}
          printBlockedReason={printBlocked ? printBlockedReason : undefined}
        />
        <div className="bg-white p-2 print:p-0" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </main>
  )
}

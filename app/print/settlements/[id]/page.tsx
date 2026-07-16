import { notFound } from 'next/navigation'
import PrintActions from '@/app/print/PrintActions'
import { canManageAllLoans, requireSessionUser } from '@/lib/auth'
import { syncClosureElementFromPrint } from '@/lib/closure-integration'
import { buildSettlementWordHtml } from '@/lib/document-templates'
import { getAuthorizedLoan, getReviewerSignatures } from '@/lib/loan-records'
import { getSystemSettings } from '@/lib/system-settings'

export const dynamic = 'force-dynamic'

export default async function SettlementPrintPage({
  params,
}: {
  params: { id: string }
}) {
  const currentUser = requireSessionUser()
  const settings = await getSystemSettings()
  const loan = await getAuthorizedLoan(params.id)

  // المراجع والمدير العام يطبعان النموذج في أي مرحلة لأغراض المراجعة
  if (!canManageAllLoans(currentUser) && !settings.allowPrintBeforeReview && loan.reviewStatus !== 'REVIEWED') {
    notFound()
  }

  if (!loan.settlement) {
    notFound()
  }

  const loanWithReviewers = loan as any
  const settlementStatus = loanWithReviewers.settlementStatus as string

  // الموظف يستطيع المعاينة دائماً — الطباعة محجوبة حتى يوقّع المراجعان الاثنان
  const isFullyApproved = settlementStatus === 'APPROVED'
  const printBlocked = !canManageAllLoans(currentUser) && !isFullyApproved

  // تحديد سبب الحجب بدقة
  const printBlockedReason = settlementStatus === 'AWAITING_SECOND_REVIEW'
    ? 'بانتظار توقيع المراجع الثاني — ستُتاح الطباعة بعد اعتماده'
    : 'لم يعتمد أي مراجع هذه التسوية بعد — ستُتاح الطباعة بعد توقيع المراجعَين'

  if (isFullyApproved) {
    await syncClosureElementFromPrint('settlement', loan)
  }

  const hasAnyReviewerSigned = ['AWAITING_SECOND_REVIEW', 'APPROVED'].includes(settlementStatus)
  const reviewerSignatures = hasAnyReviewerSigned ? await getReviewerSignatures(loanWithReviewers.settlementReviewedBy?.id, loanWithReviewers.secondSettlementReviewedBy?.id) : undefined
  const applicantSignature = loan.settlement ? loanWithReviewers.user?.signatureImage ?? null : null
  const html = buildSettlementWordHtml(loan, { settings, reviewerSignatures, applicantSignature })

  return (
    <main className="min-h-screen bg-slate-100 px-2 py-4 print:bg-white print:p-0">
      <div className="mx-auto max-w-[210mm]">
        <PrintActions
          pdfHref={`/api/print/settlements/${params.id}`}
          printBlocked={printBlocked}
          printBlockedReason={printBlocked ? printBlockedReason : undefined}
        />
        <div className="bg-white p-2 print:p-0" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </main>
  )
}

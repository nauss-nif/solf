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

  // لا يُسمح للموظف بطباعة التسوية حتى تكتمل جميع التواقيع (APPROVED)
  if (!canManageAllLoans(currentUser) && (loan as any).settlementStatus !== 'APPROVED') {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center p-8" dir="rtl">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-xl font-bold text-slate-800 mb-3">لا يمكن طباعة النموذج بعد</h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            لم تكتمل جميع التواقيع المطلوبة على نموذج التسوية بعد.<br />
            يُسمح بالطباعة فقط بعد اعتماد المراجع المالي ووكيل الجامعة.
          </p>
        </div>
      </main>
    )
  }

  if (loan.settlementStatus === 'APPROVED') {
    await syncClosureElementFromPrint('settlement', loan)
  }

  const loanWithReviewers = loan as any
  const hasAnyReviewerSigned = ['AWAITING_SECOND_REVIEW', 'APPROVED'].includes(loan.settlementStatus as string)
  const reviewerSignatures = hasAnyReviewerSigned ? await getReviewerSignatures(loanWithReviewers.settlementReviewedBy?.id, loanWithReviewers.secondSettlementReviewedBy?.id) : undefined
  const applicantSignature = loan.isSettled ? loanWithReviewers.user?.signatureImage ?? null : null
  const html = buildSettlementWordHtml(loan, { settings, reviewerSignatures, applicantSignature })

  return (
    <main className="min-h-screen bg-slate-100 px-2 py-4 print:bg-white print:p-0">
      <div className="mx-auto max-w-[210mm]">
        <PrintActions pdfHref={`/api/print/settlements/${params.id}`} />
        <div className="bg-white p-2 print:p-0" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </main>
  )
}

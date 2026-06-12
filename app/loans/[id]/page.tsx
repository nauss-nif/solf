import { canManageAllLoans, requireSessionUser } from '@/lib/auth'
import { buildLoanRequestWordHtml, buildSettlementWordHtml } from '@/lib/document-templates'
import { getAuthorizedLoan, getReviewerSignatures } from '@/lib/loan-records'
import { getSystemSettings } from '@/lib/system-settings'
import PreviewToolbar from './PreviewToolbar'

export const dynamic = 'force-dynamic'

export default async function LoanDetailPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams?: { form?: string }
}) {
  const currentUser = requireSessionUser()
  const settings = await getSystemSettings()
  const loan = await getAuthorizedLoan(params.id)
  const canReview = canManageAllLoans(currentUser)
  const requestedForm = searchParams?.form === '19' ? '19' : '18'
  const hasSettlement = Boolean(loan.settlement)
  const activeForm = requestedForm === '19' && hasSettlement ? '19' : '18'
  const isActiveFormApproved = activeForm === '19'
    ? loan.settlementStatus === 'APPROVED'
    : loan.reviewStatus === 'REVIEWED'
  const reviewerSignatures = isActiveFormApproved ? await getReviewerSignatures() : undefined
  const html = activeForm === '19' && hasSettlement
    ? buildSettlementWordHtml(loan, { settings, reviewerSignatures })
    : buildLoanRequestWordHtml(loan, { settings, reviewerSignatures })

  return (
    <main className="min-h-screen bg-slate-100 px-2 py-4">
      <div className="mx-auto max-w-[210mm] space-y-4">
        <div className="rounded-3xl bg-white p-4 shadow-sm print:hidden">
          <PreviewToolbar loanId={loan.id} activeForm={activeForm} hasSettlement={hasSettlement} canReview={canReview} isApproved={isActiveFormApproved} />
          {requestedForm === '19' && !hasSettlement && (
            <div className="alert alert-warning mt-3">لم تُرفع التسوية بعد، لذلك لا تتوفر معاينة نموذج ١٩ لهذه المعاملة.</div>
          )}
        </div>

        <div className="bg-white p-2 print:p-0" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </main>
  )
}

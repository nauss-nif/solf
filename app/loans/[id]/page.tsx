import { canManageAllLoans, requireSessionUser } from '@/lib/auth'
import { buildLoanRequestWordHtml, buildSettlementWordHtml } from '@/lib/document-templates'
import { getAuthorizedLoan } from '@/lib/loan-records'
import { getSystemSettings } from '@/lib/system-settings'
import Link from 'next/link'
import ReviewActions from './ReviewActions'

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
  const activeForm = searchParams?.form === '19' ? '19' : '18'
  const hasSettlement = Boolean(loan.settlement)
  const html = activeForm === '19' && hasSettlement
    ? buildSettlementWordHtml(loan, { settings })
    : buildLoanRequestWordHtml(loan, { settings })

  return (
    <main className="min-h-screen bg-slate-100 px-2 py-4">
      <div className="mx-auto max-w-[210mm] space-y-4">
        <div className="rounded-3xl bg-white p-4 shadow-sm print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/" className="btn btn-outline btn-sm">العودة للوحة</Link>
              <Link href={`/loans/${loan.id}?form=18`} className={`btn btn-sm ${activeForm === '18' ? 'btn-primary' : 'btn-outline'}`}>معاينة نموذج ١٨</Link>
              <Link href={`/loans/${loan.id}?form=19`} className={`btn btn-sm ${activeForm === '19' ? 'btn-primary' : 'btn-outline'}`}>معاينة نموذج ١٩</Link>
            </div>
            {canReview && (
              <ReviewActions
                loanId={loan.id}
                form={activeForm}
                disabled={activeForm === '19' && !hasSettlement}
              />
            )}
          </div>
          {activeForm === '19' && !hasSettlement && (
            <div className="alert alert-warning mt-3">لا توجد تسوية محفوظة لهذه السلفة، لذلك تظهر معاينة نموذج ١٨ حالياً.</div>
          )}
        </div>

        <div className="bg-white p-2 print:p-0" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </main>
  )
}

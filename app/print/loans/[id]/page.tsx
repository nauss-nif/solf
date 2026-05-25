import PrintActions from '@/app/print/PrintActions'
import { buildLoanRequestWordHtml } from '@/lib/document-templates'
import { getAuthorizedLoan } from '@/lib/loan-records'
import { getSystemSettings } from '@/lib/system-settings'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function LoanPrintPage({
  params,
}: {
  params: { id: string }
}) {
  const settings = await getSystemSettings()
  let loan = await getAuthorizedLoan(params.id, { markPrinted: settings.allowPrintBeforeReview })

  if (!settings.allowPrintBeforeReview && loan.reviewStatus !== 'REVIEWED') {
    notFound()
  }

  if (!settings.allowPrintBeforeReview) {
    loan = await getAuthorizedLoan(params.id, { markPrinted: true })
  }

  const html = buildLoanRequestWordHtml(loan, { settings })

  return (
    <main className="min-h-screen bg-slate-100 px-2 py-4 print:bg-white print:p-0">
      <div className="mx-auto max-w-[210mm]">
        <PrintActions wordHref={`/api/loans/${loan.id}/word`} />
        <div className="bg-white p-2 print:p-0" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </main>
  )
}

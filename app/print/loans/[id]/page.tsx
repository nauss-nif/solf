import PrintActions from '@/app/print/PrintActions'
import { buildLoanRequestWordHtml } from '@/lib/document-templates'
import { getAuthorizedLoan } from '@/lib/loan-records'

export const dynamic = 'force-dynamic'

export default async function LoanPrintPage({
  params,
}: {
  params: { id: string }
}) {
  const loan = await getAuthorizedLoan(params.id, { markPrinted: true })
  const html = buildLoanRequestWordHtml(loan)

  return (
    <main className="min-h-screen bg-slate-100 px-2 py-4 print:bg-white print:p-0">
      <div className="mx-auto max-w-[210mm]">
        <PrintActions wordHref={`/api/loans/${loan.id}/word`} />
        <div className="bg-white p-2 print:p-0" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </main>
  )
}

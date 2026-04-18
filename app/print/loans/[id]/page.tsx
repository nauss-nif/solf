import PrintActions from '@/app/print/PrintActions'
import { buildLoanRequestWordHtml } from '@/lib/document-templates'
import { getAuthorizedLoan } from '@/lib/loan-records'

export const dynamic = 'force-dynamic'

export default async function LoanPrintPage({
  params,
}: {
  params: { id: string }
}) {
  const loan = await getAuthorizedLoan(params.id)
  const html = buildLoanRequestWordHtml(loan)

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto max-w-5xl">
        <PrintActions wordHref={`/api/loans/${loan.id}/word`} />
        <div
          className="rounded-3xl bg-white p-4 shadow-soft"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </main>
  )
}

import { notFound } from 'next/navigation'
import PrintActions from '@/app/print/PrintActions'
import { syncClosureElementFromPrint } from '@/lib/closure-integration'
import { buildSettlementWordHtml } from '@/lib/document-templates'
import { getAuthorizedLoan } from '@/lib/loan-records'
import { getSystemSettings } from '@/lib/system-settings'

export const dynamic = 'force-dynamic'

export default async function SettlementPrintPage({
  params,
}: {
  params: { id: string }
}) {
  const settings = await getSystemSettings()
  const loan = await getAuthorizedLoan(params.id)

  if (!settings.allowPrintBeforeReview && loan.reviewStatus !== 'REVIEWED') {
    notFound()
  }

  if (!loan.settlement) {
    notFound()
  }

  if (loan.reviewStatus === 'REVIEWED') {
    await syncClosureElementFromPrint('settlement', loan)
  }

  const html = buildSettlementWordHtml(loan, { settings })

  return (
    <main className="min-h-screen bg-slate-100 px-2 py-4 print:bg-white print:p-0">
      <div className="mx-auto max-w-[210mm]">
        <PrintActions />
        <div className="bg-white p-2 print:p-0" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </main>
  )
}

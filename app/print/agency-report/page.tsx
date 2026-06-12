import { redirect } from 'next/navigation'
import PrintActions from '@/app/print/PrintActions'
import { canManageAllLoans, requireSessionUser } from '@/lib/auth'
import { ensureDatabaseSetup } from '@/lib/database-setup'
import { getAgencyReportData } from '@/lib/reports'
import { formatCurrencySar, formatEnglishNumber } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const REVIEW_STATUS_LABEL: Record<string, string> = {
  PENDING: 'بانتظار الاعتماد',
  REVIEWED: 'معتمد',
  RETURNED: 'معاد للموظف',
}

export default async function AgencyReportPrintPage() {
  await ensureDatabaseSetup()
  const currentUser = requireSessionUser()
  if (!canManageAllLoans(currentUser)) redirect('/')

  const data = await getAgencyReportData()
  const itemUsage = [...data.itemUsage].sort((a, b) => b.requestTotal - a.requestTotal)
  const mostUsedSettlement = [...data.itemUsage].filter((i) => i.settlementCount > 0).sort((a, b) => b.settlementCount - a.settlementCount).slice(0, 5)
  const leastUsedSettlement = [...data.itemUsage].filter((i) => i.settlementCount > 0).sort((a, b) => a.settlementCount - b.settlementCount).slice(0, 5)

  return (
    <main className="min-h-screen bg-slate-100 px-2 py-4 print:bg-white print:p-0">
      <div className="mx-auto max-w-[210mm]">
        <PrintActions />
        <div className="bg-white p-8 print:p-4 text-sm" dir="rtl" style={{ fontFamily: 'Cairo, Tahoma, Arial, sans-serif', color: '#1F2A2A' }}>
          <header className="mb-6 border-b-2 pb-4 text-center" style={{ borderColor: '#2A6364' }}>
            <h1 className="text-xl font-bold" style={{ color: '#1F3F40' }}>التقرير الشامل لطلبات السلف والتسويات</h1>
            <p className="mt-1 text-xs" style={{ color: '#5A5A5A' }}>وكالة التدريب — جامعة نايف العربية للعلوم الأمنية</p>
            <p className="mt-1 text-xs" style={{ color: '#5A5A5A' }}>تاريخ الإصدار: {data.generatedAt.toLocaleDateString('en-GB')}</p>
          </header>

          <section className="mb-6">
            <h2 className="mb-2 text-sm font-bold" style={{ color: '#1F3F40' }}>الملخص العام</h2>
            <table className="w-full border-collapse text-xs">
              <tbody>
                <tr>
                  <th className="report-th">إجمالي عدد الطلبات</th>
                  <td className="report-td">{formatEnglishNumber(data.summary.loanCount)}</td>
                  <th className="report-th">إجمالي مبالغ السلف المطلوبة</th>
                  <td className="report-td">{formatCurrencySar(data.summary.totalRequested)}</td>
                </tr>
                <tr>
                  <th className="report-th">الطلبات المسوّاة</th>
                  <td className="report-td">{formatEnglishNumber(data.summary.settledCount)}</td>
                  <th className="report-th">إجمالي المصروفات المسوّاة</th>
                  <td className="report-td">{formatCurrencySar(data.summary.totalSettled)}</td>
                </tr>
                <tr>
                  <th className="report-th">الطلبات قيد التسوية</th>
                  <td className="report-td">{formatEnglishNumber(data.summary.pendingCount)}</td>
                  <th className="report-th">إجمالي الوفورات</th>
                  <td className="report-td">{formatCurrencySar(data.summary.totalSavings)}</td>
                </tr>
                <tr>
                  <th className="report-th">إجمالي الزيادة عن المعتمد</th>
                  <td className="report-td">{formatCurrencySar(data.summary.totalOverage)}</td>
                  <th className="report-th">صافي الوفر</th>
                  <td className="report-td">{formatCurrencySar(data.summary.totalSavings - data.summary.totalOverage)}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="mb-6">
            <h2 className="mb-2 text-sm font-bold" style={{ color: '#1F3F40' }}>أكثر الموظفين طلباً للسلف</h2>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr><th className="report-th">الموظف</th><th className="report-th">عدد الطلبات</th><th className="report-th">إجمالي الطلب</th><th className="report-th">إجمالي التسوية</th><th className="report-th">صافي الوفر</th></tr>
              </thead>
              <tbody>
                {data.requesters.slice(0, 10).map((r) => (
                  <tr key={r.employee}>
                    <td className="report-td">{r.employee}</td>
                    <td className="report-td">{formatEnglishNumber(r.count)}</td>
                    <td className="report-td">{formatCurrencySar(r.totalAmount)}</td>
                    <td className="report-td">{formatCurrencySar(r.totalSettlement)}</td>
                    <td className="report-td">{formatCurrencySar(r.totalSavings)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="mb-6">
            <h2 className="mb-2 text-sm font-bold" style={{ color: '#1F3F40' }}>تحليل بنود الصرف</h2>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <h3 className="mb-1 text-xs font-bold" style={{ color: '#2D4D40' }}>أعلى البنود طلباً (حسب المبلغ)</h3>
                <table className="w-full border-collapse text-xs">
                  <thead><tr><th className="report-th">البند</th><th className="report-th">الإجمالي</th></tr></thead>
                  <tbody>
                    {itemUsage.slice(0, 5).map((i) => (
                      <tr key={i.category}><td className="report-td">{i.category}</td><td className="report-td">{formatCurrencySar(i.requestTotal)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <h3 className="mb-1 text-xs font-bold" style={{ color: '#2D4D40' }}>أكثر البنود استخداماً في التسويات</h3>
                <table className="w-full border-collapse text-xs">
                  <thead><tr><th className="report-th">البند</th><th className="report-th">عدد المرات</th></tr></thead>
                  <tbody>
                    {mostUsedSettlement.map((i) => (
                      <tr key={i.category}><td className="report-td">{i.category}</td><td className="report-td">{formatEnglishNumber(i.settlementCount)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <h3 className="mb-1 text-xs font-bold" style={{ color: '#2D4D40' }}>أقل البنود استخداماً في التسويات</h3>
                <table className="w-full border-collapse text-xs">
                  <thead><tr><th className="report-th">البند</th><th className="report-th">عدد المرات</th></tr></thead>
                  <tbody>
                    {leastUsedSettlement.map((i) => (
                      <tr key={i.category}><td className="report-td">{i.category}</td><td className="report-td">{formatEnglishNumber(i.settlementCount)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-bold" style={{ color: '#1F3F40' }}>كافة الطلبات</h2>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="report-th">الرقم المرجعي</th>
                  <th className="report-th">الموظف</th>
                  <th className="report-th">النشاط</th>
                  <th className="report-th">المبلغ المطلوب</th>
                  <th className="report-th">الحالة</th>
                  <th className="report-th">التسوية</th>
                  <th className="report-th">الوفر</th>
                </tr>
              </thead>
              <tbody>
                {data.loans.map((loan) => (
                  <tr key={loan.refNumber}>
                    <td className="report-td">{loan.refNumber}</td>
                    <td className="report-td">{loan.employee}</td>
                    <td className="report-td">{loan.activity}</td>
                    <td className="report-td">{formatCurrencySar(loan.amount)}</td>
                    <td className="report-td">{loan.isSettled ? 'مسوّاة' : REVIEW_STATUS_LABEL[loan.reviewStatus] ?? loan.reviewStatus}</td>
                    <td className="report-td">{loan.isSettled ? formatCurrencySar(loan.settlementTotal) : '—'}</td>
                    <td className="report-td">{loan.isSettled ? formatCurrencySar(loan.savings - loan.overage) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </div>

      <style>{`
        .report-th, .report-td {
          border: 1px solid #C8D9D0;
          padding: 4px 6px;
          text-align: right;
        }
        .report-th {
          background: #E7F3EE;
          font-weight: 700;
          color: #1F3F40;
        }
        @media print {
          html, body { background: #fff; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
        }
      `}</style>
    </main>
  )
}

import { redirect } from 'next/navigation'
import PrintActions from '@/app/print/PrintActions'
import { canManageAllLoans, requireSessionUser } from '@/lib/auth'
import { ensureDatabaseSetup } from '@/lib/database-setup'
import { getAgencyReportData } from '@/lib/reports'
import { formatCurrencySar, formatEnglishNumber } from '@/lib/utils'

export const dynamic = 'force-dynamic'

function Bar({ pct, color }: { pct: number; color: string }) {
  const w = Math.min(100, Math.max(0, pct))
  return (
    <div style={{ background: '#E8F0EF', borderRadius: 6, height: 10, width: '100%', overflow: 'hidden' }}>
      <div style={{ width: `${w}%`, height: '100%', background: color, borderRadius: 6, transition: 'width .3s' }} />
    </div>
  )
}

function Donut({ pct, color, size = 80 }: { pct: number; color: string; size?: number }) {
  const r = 28; const c = 2 * Math.PI * r
  const dash = (Math.min(100, Math.max(0, pct)) / 100) * c
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx="32" cy="32" r={r} fill="none" stroke="#E8F0EF" strokeWidth="8" />
      <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={`${dash} ${c}`} strokeLinecap="round" />
    </svg>
  )
}

function KpiCard({ label, value, sub, color, pct }: { label: string; value: string; sub?: string; color: string; pct?: number }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #DCE8E7', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <p style={{ fontSize: 10, color: '#7A9494', fontWeight: 700, margin: 0 }}>{label}</p>
      <p style={{ fontSize: 20, fontWeight: 900, color, margin: 0 }}>{value}</p>
      {sub && <p style={{ fontSize: 10, color: '#9CA3AF', margin: 0 }}>{sub}</p>}
      {pct !== undefined && <Bar pct={pct} color={color} />}
    </div>
  )
}

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return <span style={{ fontSize: 9, fontWeight: 800, color, background: bg, borderRadius: 99, padding: '2px 8px', display: 'inline-block' }}>{label}</span>
}

function speedBadge(days: number | null) {
  if (days === null) return <Badge label="لا بيانات" color="#9CA3AF" bg="#F3F4F6" />
  if (days <= 7)  return <Badge label={`${days} يوم ⚡ ممتاز`}   color="#065F46" bg="#D1FAE5" />
  if (days <= 14) return <Badge label={`${days} يوم ✓ جيد`}      color="#1E40AF" bg="#DBEAFE" />
  if (days <= 30) return <Badge label={`${days} يوم ⚠ متوسط`}    color="#92400E" bg="#FEF3C7" />
  return               <Badge label={`${days} يوم ✗ بطيء`}      color="#991B1B" bg="#FEE2E2" />
}

export default async function ExecutiveReportPage() {
  await ensureDatabaseSetup()
  const currentUser = requireSessionUser()
  if (!canManageAllLoans(currentUser)) redirect('/')

  const data = await getAgencyReportData()
  const { summary, requesters, loans, itemUsage } = data

  const settlementRate = summary.loanCount ? Math.round((summary.settledCount / summary.loanCount) * 100) : 0
  const savingsRate    = summary.totalRequested > 0 ? ((summary.totalSavings / summary.totalRequested) * 100).toFixed(1) : '0'
  const overageRate    = summary.totalRequested > 0 ? ((summary.totalOverage / summary.totalRequested) * 100).toFixed(1) : '0'
  const netPosition    = summary.totalSavings - summary.totalOverage

  const topByAmount    = [...requesters].sort((a, b) => b.totalAmount - a.totalAmount).slice(0, 8)
  const topBySpeed     = [...requesters].filter((r) => r.avgDaysToSettle !== null).sort((a, b) => (a.avgDaysToSettle ?? 999) - (b.avgDaysToSettle ?? 999)).slice(0, 8)
  const topByOverdue   = [...requesters].filter((r) => r.overdueCount > 0).sort((a, b) => b.overdueCount - a.overdueCount).slice(0, 8)
  const topCategories  = [...itemUsage].sort((a, b) => b.requestTotal - a.requestTotal).slice(0, 6)
  const maxCatAmount   = topCategories[0]?.requestTotal ?? 1

  const overdueLoans   = loans.filter((l) => {
    if (l.isSettled) return false
    const deadline = l.settlementDeadline ? new Date(l.settlementDeadline) : null
    return deadline ? Date.now() > deadline.getTime() : false
  }).sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime())

  const now = new Date()
  const dateStr = now.toLocaleDateString('ar-SA-u-ca-gregory', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <main style={{ minHeight: '100vh', background: '#F0F4F4', padding: '16px 8px', fontFamily: 'Cairo, Tahoma, Arial, sans-serif' }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <PrintActions />

        <div style={{ background: '#fff', padding: '32px 36px', borderRadius: 16, boxShadow: '0 2px 16px #0001' }} dir="rtl">

          {/* ── HEADER ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '3px solid #2A6364', paddingBottom: 16, marginBottom: 24 }}>
            <div>
              <p style={{ margin: 0, fontSize: 10, color: '#7A9494', fontWeight: 700 }}>وكالة التدريب — جامعة نايف العربية للعلوم الأمنية</p>
              <h1 style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 900, color: '#1F3F40' }}>التقرير التنفيذي — أداء السلف والتسويات</h1>
              <p style={{ margin: '4px 0 0', fontSize: 10, color: '#9CA3AF' }}>تاريخ الإصدار: {dateStr}</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <Donut pct={settlementRate} color="#2A6364" size={72} />
              <p style={{ margin: '4px 0 0', fontSize: 10, fontWeight: 800, color: '#2A6364' }}>{settlementRate}% تسوية</p>
            </div>
          </div>

          {/* ── KPI CARDS ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 24 }}>
            <KpiCard label="إجمالي الطلبات" value={formatEnglishNumber(summary.loanCount)} color="#1F3F40"
              sub={`${formatEnglishNumber(summary.settledCount)} مسوّى / ${formatEnglishNumber(summary.pendingCount)} مفتوح`}
              pct={settlementRate} />
            <KpiCard label="إجمالي مبالغ السلف" value={formatCurrencySar(summary.totalRequested)} color="#2A6364"
              sub="إجمالي ما طُلب" />
            <KpiCard label="إجمالي المصروفات" value={formatCurrencySar(summary.totalSettled)} color="#2E6F8E"
              sub={`وفورات: ${formatCurrencySar(summary.totalSavings)}`} pct={summary.totalRequested > 0 ? (summary.totalSettled / summary.totalRequested) * 100 : 0} />
            <KpiCard label="صافي الوضع المالي" value={formatCurrencySar(Math.abs(netPosition))}
              color={netPosition >= 0 ? '#065F46' : '#991B1B'}
              sub={netPosition >= 0 ? `وفر صافٍ ${savingsRate}%` : `زيادة صافية ${overageRate}%`} />
          </div>

          {/* ── TWO COLUMNS ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>

            {/* نسب الأداء */}
            <div style={{ background: '#F8FAFA', border: '1px solid #DCE8E7', borderRadius: 12, padding: 16 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 800, color: '#1F3F40' }}>مؤشرات الأداء العام</h3>
              {[
                { label: 'نسبة إتمام التسوية',  pct: settlementRate,               color: '#2A6364' },
                { label: 'نسبة الوفورات',        pct: Number(savingsRate),           color: '#065F46' },
                { label: 'نسبة الزيادة',         pct: Number(overageRate),           color: '#991B1B' },
                { label: 'معدل الطلبات المتأخرة', pct: summary.loanCount > 0 ? (overdueLoans.length / summary.loanCount) * 100 : 0, color: '#B45309' },
              ].map((item) => (
                <div key={item.label} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: '#374151' }}>{item.label}</span>
                    <span style={{ fontSize: 10, fontWeight: 800, color: item.color }}>{formatEnglishNumber(Math.round(item.pct))}%</span>
                  </div>
                  <Bar pct={item.pct} color={item.color} />
                </div>
              ))}
            </div>

            {/* أعلى البنود */}
            <div style={{ background: '#F8FAFA', border: '1px solid #DCE8E7', borderRadius: 12, padding: 16 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 800, color: '#1F3F40' }}>أعلى بنود الصرف</h3>
              {topCategories.map((cat) => (
                <div key={cat.category} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 10, color: '#374151' }}>{cat.category}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#2A6364' }}>{formatCurrencySar(cat.requestTotal)}</span>
                  </div>
                  <Bar pct={(cat.requestTotal / maxCatAmount) * 100} color="#2E6F8E" />
                </div>
              ))}
            </div>
          </div>

          {/* ── EMPLOYEE PERFORMANCE TABLE ── */}
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 900, color: '#1F3F40', borderRight: '4px solid #2A6364', paddingRight: 10 }}>
              أداء الموظفين في التسويات
            </h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
              <thead>
                <tr style={{ background: '#1F3F40', color: '#fff' }}>
                  {['الموظف','الطلبات','المسوّى','نسبة التسوية','إجمالي السلف','الوفر / الزيادة','متوسط سرعة التسوية','متأخرة'].map((h) => (
                    <th key={h} style={{ padding: '7px 8px', fontWeight: 700, textAlign: 'right' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topByAmount.map((r, i) => {
                  const rate = r.count > 0 ? Math.round((r.settledCount / r.count) * 100) : 0
                  return (
                    <tr key={r.employee} style={{ background: i % 2 === 0 ? '#F8FAFA' : '#fff', borderBottom: '1px solid #E5EEED' }}>
                      <td style={{ padding: '7px 8px', fontWeight: 700, color: '#1F3F40' }}>{r.employee}</td>
                      <td style={{ padding: '7px 8px', textAlign: 'center' }}>{formatEnglishNumber(r.count)}</td>
                      <td style={{ padding: '7px 8px', textAlign: 'center' }}>{formatEnglishNumber(r.settledCount)}</td>
                      <td style={{ padding: '7px 8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Bar pct={rate} color={rate >= 70 ? '#065F46' : rate >= 40 ? '#B45309' : '#991B1B'} />
                          <span style={{ fontWeight: 800, color: rate >= 70 ? '#065F46' : rate >= 40 ? '#B45309' : '#991B1B', minWidth: 28 }}>{formatEnglishNumber(rate)}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '7px 8px' }}>{formatCurrencySar(r.totalAmount)}</td>
                      <td style={{ padding: '7px 8px', color: r.totalSavings >= 0 ? '#065F46' : '#991B1B', fontWeight: 700 }}>
                        {r.totalSavings >= 0 ? '+' : ''}{formatCurrencySar(r.totalSavings)}
                      </td>
                      <td style={{ padding: '7px 8px' }}>{speedBadge(r.avgDaysToSettle)}</td>
                      <td style={{ padding: '7px 8px', textAlign: 'center' }}>
                        {r.overdueCount > 0
                          ? <span style={{ color: '#991B1B', fontWeight: 800 }}>{formatEnglishNumber(r.overdueCount)}</span>
                          : <span style={{ color: '#065F46' }}>—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* ── SPEED RANKING ── */}
          {topBySpeed.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 900, color: '#1F3F40', borderRight: '4px solid #4F8F7A', paddingRight: 10 }}>
                ترتيب الموظفين حسب سرعة التسوية
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {topBySpeed.map((r, i) => (
                  <div key={r.employee} style={{ background: i === 0 ? '#D1FAE5' : i === 1 ? '#DBEAFE' : '#F8FAFA', border: `1px solid ${i === 0 ? '#6EE7B7' : i === 1 ? '#93C5FD' : '#DCE8E7'}`, borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 9, fontWeight: 900, color: '#7A9494' }}>#{formatEnglishNumber(i + 1)}</span>
                      {i === 0 && <span style={{ fontSize: 9 }}>🏆</span>}
                      {i === 1 && <span style={{ fontSize: 9 }}>🥈</span>}
                      {i === 2 && <span style={{ fontSize: 9 }}>🥉</span>}
                    </div>
                    <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 800, color: '#1F3F40' }}>{r.employee}</p>
                    <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: i === 0 ? '#065F46' : '#1F3F40' }}>{formatEnglishNumber(r.avgDaysToSettle ?? 0)}</p>
                    <p style={{ margin: 0, fontSize: 9, color: '#7A9494' }}>يوم متوسط</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── OVERDUE TABLE ── */}
          {overdueLoans.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 900, color: '#991B1B', borderRight: '4px solid #991B1B', paddingRight: 10 }}>
                ⚠ الطلبات المتأخرة عن التسوية
              </h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                <thead>
                  <tr style={{ background: '#FEE2E2', color: '#991B1B' }}>
                    {['الرقم المرجعي','الموظف','النشاط','تاريخ الانتهاء','أيام التأخر','المبلغ'].map((h) => (
                      <th key={h} style={{ padding: '6px 8px', fontWeight: 700, textAlign: 'right' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {overdueLoans.slice(0, 10).map((loan, i) => {
                    const deadline = loan.settlementDeadline ? new Date(loan.settlementDeadline) : new Date(loan.endDate)
                    const days = Math.round((Date.now() - deadline.getTime()) / (1000 * 60 * 60 * 24))
                    return (
                      <tr key={loan.refNumber} style={{ background: i % 2 === 0 ? '#FFF5F5' : '#fff', borderBottom: '1px solid #FECACA' }}>
                        <td style={{ padding: '6px 8px', fontWeight: 700 }}>{loan.refNumber}</td>
                        <td style={{ padding: '6px 8px' }}>{loan.employee}</td>
                        <td style={{ padding: '6px 8px' }}>{loan.activity}</td>
                        <td style={{ padding: '6px 8px' }}>{new Date(loan.endDate).toLocaleDateString('en-GB')}</td>
                        <td style={{ padding: '6px 8px', fontWeight: 900, color: days > 30 ? '#991B1B' : '#B45309' }}>{formatEnglishNumber(days)} يوم</td>
                        <td style={{ padding: '6px 8px', fontWeight: 700 }}>{formatCurrencySar(loan.amount)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── FOOTER ── */}
          <div style={{ borderTop: '1px solid #DCE8E7', paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ margin: 0, fontSize: 9, color: '#9CA3AF' }}>تقرير سري — للاستخدام الإداري الداخلي فقط</p>
            <p style={{ margin: 0, fontSize: 9, color: '#9CA3AF' }}>منصة السلف المؤقتة — وكالة التدريب | جامعة نايف العربية للعلوم الأمنية</p>
          </div>

        </div>
      </div>

      <style>{`
        @media print {
          body { background: white !important; }
          main { padding: 0 !important; background: white !important; }
          .no-print { display: none !important; }
        }
        @page { size: A4 landscape; margin: 10mm; }
      `}</style>
    </main>
  )
}

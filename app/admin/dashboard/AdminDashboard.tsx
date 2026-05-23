'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatCurrencySar } from '@/lib/utils'

type Role = 'EMPLOYEE' | 'ADMIN' | 'REVIEWER'

type CurrentUser = {
  userId: string
  fullName: string
  email: string
  role: Role
  roles: Role[]
}

type Stats = {
  total: number
  active: number
  settled: number
  overdue: number
  pendingReview: number
  totalAmount: number
  totalSettled: number
  totalSavings: number
}

type MonthlyData = {
  month: string
  loans: number
  amount: number
  settled: number
}

type LoanRow = {
  id: string
  refNumber: string
  employee: string
  activity: string
  amount: number
  reviewStatus: string
  isSettled: boolean
  settlementStatus: string
  settlementDeadline: string | null
  createdAt: string
}

type OverdueLoan = {
  id: string
  refNumber: string
  employee: string
  activity: string
  amount: number
  settlementDeadline: string | null
  user: { id: string; fullName: string; email: string } | null
}

type UserRow = {
  id: string
  fullName: string
  email: string
  role: string
  roles: string[]
  status: string
  createdAt: string
}

// ─────────────────────────────────────────────────────────────
// Mini Bar Chart (CSS only — no external library)
// ─────────────────────────────────────────────────────────────
function BarChart({ data, valueKey, label }: {
  data: MonthlyData[]
  valueKey: 'loans' | 'amount'
  label: string
}) {
  const max = Math.max(...data.map(d => d[valueKey] || 0), 1)
  return (
    <div className="chart-wrap">
      <p className="chart-label">{label}</p>
      <div className="bar-chart">
        {data.map((d, i) => (
          <div key={i} className="bar-col">
            <div className="bar-val">
              {valueKey === 'amount'
                ? `${(d[valueKey] / 1000).toFixed(0)}k`
                : d[valueKey]}
            </div>
            <div
              className="bar"
              style={{ height: `${Math.round((d[valueKey] / max) * 100)}%` }}
            />
            <div className="bar-month">{d.month}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Donut Chart (SVG)
// ─────────────────────────────────────────────────────────────
function DonutChart({ settled, active, overdue }: { settled: number; active: number; overdue: number }) {
  const total = settled + active + overdue || 1
  const settledPct = (settled / total) * 100
  const activePct = (active / total) * 100
  const overduePct = (overdue / total) * 100

  const r = 40
  const circ = 2 * Math.PI * r
  let offset = 0

  const segments = [
    { pct: settledPct, color: '#059669', label: 'مسواة' },
    { pct: activePct, color: '#016564', label: 'نشطة' },
    { pct: overduePct, color: '#dc2626', label: 'متأخرة' },
  ]

  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 100 100" className="donut-svg">
        {segments.map((seg, i) => {
          const dashArray = (seg.pct / 100) * circ
          const dashOffset = -offset * circ / 100
          offset += seg.pct
          return (
            <circle
              key={i}
              cx="50" cy="50" r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth="18"
              strokeDasharray={`${dashArray} ${circ - dashArray}`}
              strokeDashoffset={dashOffset}
              style={{ transformOrigin: '50px 50px', transform: 'rotate(-90deg)' }}
            />
          )
        })}
        <text x="50" y="46" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#0f172a">{total}</text>
        <text x="50" y="58" textAnchor="middle" fontSize="7" fill="#64748b">إجمالي</text>
      </svg>
      <div className="donut-legend">
        {segments.map((seg, i) => (
          <div key={i} className="legend-item">
            <span className="legend-dot" style={{ background: seg.color }} />
            <span>{seg.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main Admin Dashboard
// ─────────────────────────────────────────────────────────────
export default function AdminDashboard({
  currentUser,
  isAdmin,
  stats,
  monthlyData,
  recentLoans,
  overdueLoans,
  users,
}: {
  currentUser: CurrentUser
  isAdmin: boolean
  stats: Stats
  monthlyData: MonthlyData[]
  recentLoans: LoanRow[]
  overdueLoans: OverdueLoan[]
  users: UserRow[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState<'overview' | 'loans' | 'overdue' | 'users'>('overview')
  const [alertLoanId, setAlertLoanId] = useState<string | null>(null)
  const [alertMsg, setAlertMsg] = useState('')
  const [toast, setToast] = useState('')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  async function sendAlert(loanId: string, customMessage?: string) {
    startTransition(async () => {
      const res = await fetch('/api/admin/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loanId, customMessage }),
      })
      if (res.ok) showToast('تم إرسال الإنذار بنجاح')
      else showToast('تعذر إرسال الإنذار')
      setAlertLoanId(null)
      setAlertMsg('')
    })
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const reviewBadge = (status: string) => ({
    PENDING:  { label: 'بانتظار المراجعة', cls: 'badge-neutral' },
    REVIEWED: { label: 'معتمدة', cls: 'badge-primary' },
    RETURNED: { label: 'معادة', cls: 'badge-warning' },
  }[status] ?? { label: status, cls: 'badge-neutral' })

  return (
    <div className="admin-root" dir="rtl">

      {/* Header */}
      <header className="app-header">
        <div className="app-header__inner">
          <div className="app-header__brand">
            <div className="header-title-block">
              <span className="header-title">
                {isAdmin ? 'لوحة مدير النظام' : 'لوحة المراجع'}
              </span>
              <span className="header-subtitle">{currentUser.fullName}</span>
            </div>
          </div>
          <nav className="app-header__nav">
            <Link href="/" className="header-nav-link">منصة السلف</Link>
            {isAdmin && (
              <Link href="/admin" className="header-nav-link">إدارة المستخدمين</Link>
            )}
            <button type="button" onClick={handleLogout} className="btn btn--ghost btn--sm">خروج</button>
          </nav>
        </div>
      </header>

      <main className="admin-main">

        {/* Toast */}
        {toast && <div className="toast toast--success" style={{ position: 'fixed', top: 80, left: 20, zIndex: 100 }}>{toast}</div>}

        {/* Alert Modal */}
        {alertLoanId && (
          <div className="modal-backdrop">
            <div className="modal-card">
              <h3 className="modal-card__title">إرسال إنذار للموظف</h3>
              <textarea
                value={alertMsg}
                onChange={e => setAlertMsg(e.target.value)}
                rows={4}
                className="form-input"
                placeholder="رسالة مخصصة (اختياري — سيُستخدم النص الافتراضي إذا تركت فارغاً)"
              />
              <div className="action-row" style={{ marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => sendAlert(alertLoanId, alertMsg || undefined)}
                  disabled={isPending}
                  className="btn btn--warning btn--md"
                >
                  {isPending ? 'جاري الإرسال...' : 'إرسال الإنذار'}
                </button>
                <button type="button" onClick={() => { setAlertLoanId(null); setAlertMsg('') }} className="btn btn--ghost btn--md">
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="admin-stats">
          <StatCard value={stats.total} label="إجمالي السلف" color="primary" />
          <StatCard value={stats.active} label="نشطة" color="primary" />
          <StatCard value={stats.settled} label="مسواة" color="success" />
          <StatCard value={stats.overdue} label="متأخرة" color="danger" />
          <StatCard value={stats.pendingReview} label="بانتظار المراجعة" color="warning" />
          <StatCard value={formatCurrencySar(stats.totalAmount)} label="إجمالي السلف" color="primary" small />
          <StatCard value={formatCurrencySar(stats.totalSettled)} label="إجمالي المصروفات" color="primary" small />
          <StatCard value={formatCurrencySar(stats.totalSavings)} label="إجمالي الوفورات" color="success" small />
        </div>

        {/* Tabs */}
        <div className="admin-tabs">
          {[
            { key: 'overview', label: 'نظرة عامة' },
            { key: 'loans', label: 'جميع الطلبات' },
            { key: 'overdue', label: `المتأخرون (${overdueLoans.length})` },
            ...(isAdmin ? [{ key: 'users', label: 'المستخدمون' }] : []),
          ].map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as any)}
              className={`filter-tab ${activeTab === tab.key ? 'filter-tab--active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── نظرة عامة ── */}
        {activeTab === 'overview' && (
          <div className="admin-overview">
            <div className="charts-grid">
              <div className="chart-card">
                <h3 className="chart-card__title">توزيع السلف</h3>
                <DonutChart
                  settled={stats.settled}
                  active={stats.active - stats.overdue}
                  overdue={stats.overdue}
                />
              </div>
              <div className="chart-card">
                <h3 className="chart-card__title">السلف الشهرية</h3>
                <BarChart data={monthlyData} valueKey="loans" label="عدد الطلبات" />
              </div>
              <div className="chart-card chart-card--wide">
                <h3 className="chart-card__title">المبالغ الشهرية (ريال)</h3>
                <BarChart data={monthlyData} valueKey="amount" label="إجمالي المبالغ" />
              </div>
            </div>

            {/* آخر الطلبات */}
            <div className="admin-table-card">
              <h3 className="admin-table-card__title">آخر الطلبات</h3>
              <div className="admin-table">
                <div className="admin-table__head">
                  <span>الرقم المرجعي</span>
                  <span>الموظف</span>
                  <span>المبلغ</span>
                  <span>الحالة</span>
                  <span>إجراء</span>
                </div>
                {recentLoans.slice(0, 10).map(loan => {
                  const badge = reviewBadge(loan.reviewStatus)
                  return (
                    <div key={loan.id} className="admin-table__row">
                      <span className="admin-table__ref">{loan.refNumber}</span>
                      <span>{loan.employee}</span>
                      <span>{formatCurrencySar(loan.amount)}</span>
                      <span><span className={`badge ${badge.cls}`}>{badge.label}</span></span>
                      <span>
                        <Link href={`/loans/${loan.id}`} className="btn btn--ghost btn--sm">عرض</Link>
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── جميع الطلبات ── */}
        {activeTab === 'loans' && (
          <div className="admin-table-card">
            <h3 className="admin-table-card__title">جميع طلبات السلف ({recentLoans.length})</h3>
            <div className="admin-table">
              <div className="admin-table__head admin-table__head--loans">
                <span>الرقم المرجعي</span>
                <span>الموظف</span>
                <span>النشاط</span>
                <span>المبلغ</span>
                <span>الحالة</span>
                <span>إجراء</span>
              </div>
              {recentLoans.map(loan => {
                const badge = reviewBadge(loan.reviewStatus)
                return (
                  <div key={loan.id} className="admin-table__row admin-table__row--loans">
                    <span className="admin-table__ref">{loan.refNumber}</span>
                    <span>{loan.employee}</span>
                    <span className="admin-table__activity">{loan.activity}</span>
                    <span>{formatCurrencySar(loan.amount)}</span>
                    <span>
                      <span className={`badge ${loan.isSettled ? 'badge-success' : badge.cls}`}>
                        {loan.isSettled ? 'مسواة' : badge.label}
                      </span>
                    </span>
                    <span>
                      <Link href={`/loans/${loan.id}`} className="btn btn--ghost btn--sm">عرض</Link>
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── المتأخرون ── */}
        {activeTab === 'overdue' && (
          <div className="admin-table-card">
            <h3 className="admin-table-card__title">
              الموظفون المتأخرون في التسوية
              {overdueLoans.length > 0 && <span className="overdue-count">{overdueLoans.length}</span>}
            </h3>

            {overdueLoans.length === 0 ? (
              <div className="empty-state" style={{ border: 'none', padding: '40px' }}>
                <p>🎉 لا يوجد موظفون متأخرون</p>
              </div>
            ) : (
              <div className="admin-table">
                <div className="admin-table__head admin-table__head--overdue">
                  <span>الرقم المرجعي</span>
                  <span>الموظف</span>
                  <span>المبلغ</span>
                  <span>المهلة كانت</span>
                  <span>إجراءات</span>
                </div>
                {overdueLoans.map(loan => (
                  <div key={loan.id} className="admin-table__row admin-table__row--overdue">
                    <span className="admin-table__ref">{loan.refNumber}</span>
                    <span>
                      <div>{loan.employee}</div>
                      {loan.user?.email && <div className="admin-table__email">{loan.user.email}</div>}
                    </span>
                    <span>{formatCurrencySar(loan.amount)}</span>
                    <span className="text-danger">
                      {loan.settlementDeadline
                        ? new Date(loan.settlementDeadline).toLocaleDateString('ar-SA')
                        : '—'}
                    </span>
                    <span className="admin-table__actions">
                      <Link href={`/loans/${loan.id}`} className="btn btn--ghost btn--sm">عرض</Link>
                      <button
                        type="button"
                        onClick={() => setAlertLoanId(loan.id)}
                        className="btn btn--warning btn--sm"
                      >
                        إنذار
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── المستخدمون (مدير فقط) ── */}
        {activeTab === 'users' && isAdmin && (
          <div className="admin-table-card">
            <div className="admin-table-card__head">
              <h3 className="admin-table-card__title">المستخدمون ({users.length})</h3>
              <Link href="/admin" className="btn btn--primary btn--sm">إدارة المستخدمين</Link>
            </div>
            <div className="admin-table">
              <div className="admin-table__head admin-table__head--users">
                <span>الاسم</span>
                <span>البريد</span>
                <span>الدور</span>
                <span>الحالة</span>
              </div>
              {users.map(user => (
                <div key={user.id} className="admin-table__row admin-table__row--users">
                  <span>{user.fullName}</span>
                  <span className="admin-table__email">{user.email}</span>
                  <span>
                    {(Array.isArray(user.roles) ? user.roles : [user.role]).map((r: string) => (
                      <span key={r} className={`badge ${r === 'ADMIN' ? 'badge-danger' : r === 'REVIEWER' ? 'badge-primary' : 'badge-neutral'}`} style={{ marginLeft: 4 }}>
                        {r === 'ADMIN' ? 'مدير' : r === 'REVIEWER' ? 'مراجع' : 'موظف'}
                      </span>
                    ))}
                  </span>
                  <span>
                    <span className={`badge ${user.status === 'ACTIVE' ? 'badge-success' : 'badge-neutral'}`}>
                      {user.status === 'ACTIVE' ? 'نشط' : 'معطل'}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  )
}

// Sub-components
function StatCard({ value, label, color, small }: {
  value: number | string
  label: string
  color: 'primary' | 'success' | 'danger' | 'warning'
  small?: boolean
}) {
  const colors = {
    primary: 'text-primary',
    success: 'text-success',
    danger: 'text-danger',
    warning: 'text-warning',
  }
  return (
    <div className="admin-stat-card">
      <span className={`admin-stat-card__value ${colors[color]} ${small ? 'admin-stat-card__value--sm' : ''}`}>
        {value}
      </span>
      <span className="admin-stat-card__label">{label}</span>
    </div>
  )
}

'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { formatCurrencySar } from '@/lib/utils'
import { getDeadlineStatus, workingDaysUntilDeadline, DEADLINE_STATUS_CONFIG } from '@/lib/settlement-deadline'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
type Role = 'EMPLOYEE' | 'ADMIN' | 'REVIEWER'

type CurrentUser = {
  userId: string
  fullName: string
  email: string
  role: Role
  roles: Role[]
}

type LoanRecord = {
  id: string
  refNumber: string
  employee: string
  activity: string
  location: string
  amount: number
  budgetApproved: boolean | null
  reviewStatus: 'PENDING' | 'REVIEWED' | 'RETURNED'
  reviewNote?: string
  settlementDeadline?: string | null
  destinationCategory?: string
  isSettled: boolean
  settlementStatus?: string
  printedAt: string | null
  startDate: string
  endDate: string
  createdAt: string
  exceptionGrantedById?: string | null
  items: Array<{ id: string; category: string; amount: number }>
  settlement: {
    id: string
    total: number
    savings: number
    overage: number
    supported: number
    unsupported: number
    createdAt: string
  } | null
}

type Notification = {
  id: string
  type: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
  metadata?: { loanId?: string; refNumber?: string }
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function formatDate(value: string) {
  return new Date(value).toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function getStatusBadge(loan: LoanRecord) {
  if (loan.isSettled) {
    return { label: 'مسواة', color: 'badge-success' }
  }
  if (loan.settlementStatus === 'OVERDUE') {
    return { label: 'متأخرة', color: 'badge-danger' }
  }
  if (loan.reviewStatus === 'RETURNED') {
    return { label: 'معادة للمراجعة', color: 'badge-warning' }
  }
  if (loan.reviewStatus === 'REVIEWED') {
    return { label: 'معتمدة', color: 'badge-primary' }
  }
  return { label: 'بانتظار المراجعة', color: 'badge-neutral' }
}

function getNextAction(loan: LoanRecord, canReview: boolean) {
  if (loan.isSettled) return null

  if (!loan.isSettled && loan.reviewStatus === 'REVIEWED') {
    return { label: 'تسوية السلفة', href: `/loans/${loan.id}/settle`, variant: 'primary' }
  }

  if (loan.reviewStatus === 'RETURNED') {
    return { label: 'تعديل الطلب', href: `/loans/${loan.id}/edit`, variant: 'warning' }
  }

  if (canReview && loan.reviewStatus === 'PENDING') {
    return { label: 'مراجعة الطلب', href: `/loans/${loan.id}`, variant: 'secondary' }
  }

  return { label: 'عرض التفاصيل', href: `/loans/${loan.id}`, variant: 'neutral' }
}

// ─────────────────────────────────────────────────────────────
// Component: LoanCard
// ─────────────────────────────────────────────────────────────
function LoanCard({
  loan,
  canReview,
  onPrintLoan,
  onPrintSettlement,
}: {
  loan: LoanRecord
  canReview: boolean
  onPrintLoan: (id: string) => void
  onPrintSettlement: (id: string) => void
}) {
  const status = getStatusBadge(loan)
  const nextAction = getNextAction(loan, canReview)
  const deadline = loan.settlementDeadline ? new Date(loan.settlementDeadline) : null
  const deadlineStatus = getDeadlineStatus(deadline, loan.isSettled)
  const daysLeft = deadline ? workingDaysUntilDeadline(deadline) : null

  return (
    <div className={`loan-card ${deadlineStatus === 'overdue' ? 'loan-card--overdue' : deadlineStatus === 'critical' ? 'loan-card--critical' : ''}`}>
      {/* رأس البطاقة */}
      <div className="loan-card__header">
        <div className="loan-card__ref">
          <span className="loan-card__ref-number">{loan.refNumber}</span>
          <span className={`badge ${status.color}`}>{status.label}</span>
          {loan.printedAt && (
            <span className="badge badge-neutral">مطبوع</span>
          )}
        </div>

        {/* مؤشر المهلة */}
        {deadline && !loan.isSettled && deadlineStatus && (
          <div className={`deadline-pill ${DEADLINE_STATUS_CONFIG[deadlineStatus].color} ${DEADLINE_STATUS_CONFIG[deadlineStatus].bg}`}>
            {daysLeft !== null && daysLeft >= 0
              ? `${daysLeft} أيام عمل للتسوية`
              : `تأخر ${Math.abs(daysLeft ?? 0)} أيام عمل`
            }
          </div>
        )}
      </div>

      {/* معلومات السلفة */}
      <div className="loan-card__body">
        <div className="loan-card__info">
          <h3 className="loan-card__activity">{loan.activity}</h3>
          <p className="loan-card__meta">
            {loan.location && <span>{loan.location}</span>}
            {loan.location && <span className="separator">·</span>}
            <span>{formatDate(loan.startDate)} — {formatDate(loan.endDate)}</span>
          </p>
          {loan.reviewNote && (
            <p className="loan-card__note">
              <span className="note-icon">⚠</span> {loan.reviewNote}
            </p>
          )}
        </div>

        <div className="loan-card__amount">
          <span className="amount-value">{formatCurrencySar(loan.amount)}</span>
          {loan.settlement && (
            <span className="amount-settled">
              صُرف: {formatCurrencySar(loan.settlement.total)}
            </span>
          )}
        </div>
      </div>

      {/* الإجراءات */}
      <div className="loan-card__actions">
        {/* الزر الرئيسي — إجراء واحد واضح */}
        {nextAction && (
          <Link href={nextAction.href} className={`btn btn--${nextAction.variant} btn--md`}>
            {nextAction.label}
          </Link>
        )}

        {/* أزرار الطباعة */}
        <div className="loan-card__print">
          <button
            type="button"
            onClick={() => onPrintLoan(loan.id)}
            className="btn btn--ghost btn--sm"
          >
            <PrintIcon />
            نموذج 18
          </button>
          {loan.isSettled && (
            <button
              type="button"
              onClick={() => onPrintSettlement(loan.id)}
              className="btn btn--ghost btn--sm"
            >
              <PrintIcon />
              نموذج 19
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Component: NotificationPanel
// ─────────────────────────────────────────────────────────────
function NotificationPanel({
  onClose,
}: {
  onClose: () => void
}) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/notifications')
      .then(r => r.json())
      .then(data => {
        setNotifications(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  async function markAllRead() {
    await fetch('/api/notifications/read-all', { method: 'POST' })
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
  }

  return (
    <div className="notif-panel">
      <div className="notif-panel__header">
        <h3>الإشعارات</h3>
        <button type="button" onClick={markAllRead} className="notif-mark-read">
          تحديد الكل كمقروء
        </button>
      </div>
      <div className="notif-panel__body">
        {loading && (
          <div className="notif-empty">جاري التحميل...</div>
        )}
        {!loading && notifications.length === 0 && (
          <div className="notif-empty">لا توجد إشعارات</div>
        )}
        {notifications.map(n => (
          <div key={n.id} className={`notif-item ${!n.isRead ? 'notif-item--unread' : ''}`}>
            <div className="notif-item__title">{n.title}</div>
            <div className="notif-item__msg">{n.message}</div>
            <div className="notif-item__time">
              {new Date(n.createdAt).toLocaleDateString('ar-SA')}
            </div>
          </div>
        ))}
      </div>
      <button type="button" onClick={onClose} className="notif-panel__close">
        إغلاق
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Component: StatsBar
// ─────────────────────────────────────────────────────────────
function StatsBar({ loans }: { loans: LoanRecord[] }) {
  const stats = useMemo(() => {
    const active = loans.filter(l => !l.isSettled)
    const settled = loans.filter(l => l.isSettled)
    const overdue = active.filter(l => l.settlementStatus === 'OVERDUE')
    const totalAmount = loans.reduce((s, l) => s + l.amount, 0)
    return { active: active.length, settled: settled.length, overdue: overdue.length, totalAmount }
  }, [loans])

  return (
    <div className="stats-bar">
      <div className="stat-item">
        <span className="stat-value text-primary">{stats.active}</span>
        <span className="stat-label">نشطة</span>
      </div>
      <div className="stat-divider" />
      <div className="stat-item">
        <span className="stat-value text-success">{stats.settled}</span>
        <span className="stat-label">مسواة</span>
      </div>
      <div className="stat-divider" />
      <div className="stat-item">
        <span className="stat-value text-danger">{stats.overdue}</span>
        <span className="stat-label">متأخرة</span>
      </div>
      <div className="stat-divider" />
      <div className="stat-item">
        <span className="stat-value text-primary" style={{ fontSize: '14px' }}>
          {formatCurrencySar(stats.totalAmount)}
        </span>
        <span className="stat-label">إجمالي السلف</span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main Component: DashboardHome
// ─────────────────────────────────────────────────────────────
export default function DashboardHome({
  currentUser,
  initialLoans,
  unreadNotifications,
}: {
  currentUser: CurrentUser
  initialLoans: LoanRecord[]
  unreadNotifications: number
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [loans, setLoans] = useState<LoanRecord[]>(initialLoans)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'settled' | 'overdue'>('all')
  const [showNotifications, setShowNotifications] = useState(false)
  const [unread, setUnread] = useState(unreadNotifications)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const canReview = currentUser.roles.some(r => r === 'ADMIN' || r === 'REVIEWER')
  const isAdmin = currentUser.roles.includes('ADMIN')

  // هل للموظف سلفة نشطة؟
  const hasActiveLoan = useMemo(
    () => loans.some(l => !l.isSettled && l.userId === currentUser.userId),
    [loans, currentUser.userId],
  )

  const filteredLoans = useMemo(() => {
    let list = [...loans]

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(l =>
        l.refNumber.toLowerCase().includes(q) ||
        l.activity.toLowerCase().includes(q) ||
        l.employee.toLowerCase().includes(q) ||
        (l.location ?? '').toLowerCase().includes(q),
      )
    }

    switch (filter) {
      case 'active':
        list = list.filter(l => !l.isSettled)
        break
      case 'settled':
        list = list.filter(l => l.isSettled)
        break
      case 'overdue':
        list = list.filter(l => l.settlementStatus === 'OVERDUE')
        break
    }

    return list
  }, [loans, search, filter])

  async function refreshLoans() {
    setIsRefreshing(true)
    try {
      const res = await fetch('/api/loans', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setLoans(data)
      }
    } finally {
      setIsRefreshing(false)
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  function openPrint(kind: 'loan' | 'settlement', id: string) {
    const url = kind === 'loan' ? `/print/loans/${id}` : `/print/settlements/${id}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="dashboard-root" dir="rtl">

      {/* ── Header ── */}
      <header className="app-header">
        <div className="app-header__inner">
          <div className="app-header__brand">
            <Image
              src="/logo-footer.png"
              alt="جامعة نايف"
              width={160}
              height={40}
              className="header-logo"
              priority
            />
            <div className="header-title-block">
              <span className="header-title">منصة السلف المؤقتة</span>
              <span className="header-subtitle">وكالة التدريب</span>
            </div>
          </div>

          <nav className="app-header__nav">
            {isAdmin && (
              <Link href="/admin" className="header-nav-link">
                إدارة النظام
              </Link>
            )}

            {/* زر الإشعارات */}
            <button
              type="button"
              className="notif-btn"
              onClick={() => {
                setShowNotifications(v => !v)
                if (unread > 0) setUnread(0)
              }}
            >
              <BellIcon />
              {unread > 0 && (
                <span className="notif-badge">{unread > 9 ? '9+' : unread}</span>
              )}
            </button>

            <div className="header-user">
              <span className="header-user__name">{currentUser.fullName}</span>
              <button
                type="button"
                onClick={handleLogout}
                className="btn btn--ghost btn--sm"
              >
                خروج
              </button>
            </div>
          </nav>
        </div>

        {/* لوحة الإشعارات */}
        {showNotifications && (
          <>
            <div
              className="notif-overlay"
              onClick={() => setShowNotifications(false)}
            />
            <NotificationPanel onClose={() => setShowNotifications(false)} />
          </>
        )}
      </header>

      {/* ── Main ── */}
      <main className="dashboard-main">

        {/* إحصائيات سريعة */}
        <StatsBar loans={loans} />

        {/* CTA — طلب سلفة جديدة */}
        <div className="cta-section">
          {!canReview && (
            hasActiveLoan ? (
              <div className="active-loan-warning">
                <span className="warning-icon">⚠</span>
                <span>لديك سلفة نشطة غير مسواة. يجب تسويتها قبل طلب سلفة جديدة.</span>
              </div>
            ) : (
              <Link href="/loans/new" className="btn btn--primary btn--lg cta-btn">
                <PlusIcon />
                طلب سلفة جديدة
              </Link>
            )
          )}

          <button
            type="button"
            onClick={refreshLoans}
            disabled={isRefreshing}
            className="btn btn--ghost btn--sm"
          >
            {isRefreshing ? 'جاري التحديث...' : 'تحديث'}
          </button>
        </div>

        {/* شريط البحث والفلترة */}
        <div className="search-filter-bar">
          <div className="search-box">
            <SearchIcon />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ابحث برقم مرجعي أو نشاط أو موظف..."
              className="search-input"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="search-clear"
              >
                ×
              </button>
            )}
          </div>

          <div className="filter-tabs">
            {[
              { key: 'all', label: 'الكل' },
              { key: 'active', label: 'النشطة' },
              { key: 'overdue', label: 'المتأخرة' },
              { key: 'settled', label: 'المسواة' },
            ].map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key as any)}
                className={`filter-tab ${filter === tab.key ? 'filter-tab--active' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* قائمة السلف */}
        <div className="loans-list">
          {filteredLoans.length === 0 ? (
            <div className="empty-state">
              <EmptyIcon />
              <p>
                {search
                  ? 'لا توجد نتائج للبحث'
                  : filter === 'active'
                  ? 'لا توجد سلف نشطة'
                  : filter === 'overdue'
                  ? 'لا توجد سلف متأخرة'
                  : 'لا توجد سلف بعد'}
              </p>
              {!canReview && !hasActiveLoan && !search && (
                <Link href="/loans/new" className="btn btn--primary btn--md">
                  اطلب سلفتك الأولى
                </Link>
              )}
            </div>
          ) : (
            filteredLoans.map(loan => (
              <LoanCard
                key={loan.id}
                loan={loan}
                canReview={canReview}
                onPrintLoan={id => openPrint('loan', id)}
                onPrintSettlement={id => openPrint('settlement', id)}
              />
            ))
          )}
        </div>
      </main>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────
function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

function PrintIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function EmptyIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  )
}

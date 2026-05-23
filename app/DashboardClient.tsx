'use client'

// ═══════════════════════════════════════════════════════════════════════
// DashboardClient.tsx — واجهة الموظف المُعاد بناؤها بالكامل (المرحلة ٢)
// Next.js 14 + Tailwind CSS
// الألوان: primary=#016564 | secondary=#d0b284 | danger=#dc2626
//          warning=#d97706 | success=#059669
// ═══════════════════════════════════════════════════════════════════════

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  Fragment,
} from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { ar } from 'date-fns/locale'

// ─── Types ────────────────────────────────────────────────────────────

type DestinationCategory =
  | 'DOMESTIC'
  | 'ARAB'
  | 'EUROPE_MAGHREB'
  | 'AMERICAS_FAR'

type ReviewStatus = 'PENDING' | 'REVIEWED' | 'RETURNED'
type SettlementStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'OVERDUE'

type NotificationType =
  | 'LOAN_CREATED'
  | 'LOAN_REVIEWED'
  | 'LOAN_RETURNED'
  | 'SETTLEMENT_REMINDER'
  | 'SETTLEMENT_OVERDUE'
  | 'SETTLEMENT_APPROVED'
  | 'EXCEPTION_GRANTED'
  | 'SYSTEM'

interface LoanItem {
  id: string
  category: string
  amount: number
}

interface Settlement {
  id: string
  supported: number
  unsupported: number
  total: number
  savings: number
  overage: number
  invoices?: unknown
}

interface Loan {
  id: string
  refNumber: string
  employee: string
  activity: string
  location?: string
  amount: number
  budgetApproved?: boolean
  startDate: string
  endDate: string
  destinationCategory: DestinationCategory
  settlementDeadline?: string
  reviewStatus: ReviewStatus
  reviewNote?: string
  printedAt?: string
  isSettled: boolean
  settlementStatus: SettlementStatus
  exceptionGrantedById?: string
  exceptionNote?: string
  createdAt: string
  items: LoanItem[]
  settlement?: Settlement
}

interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  isRead: boolean
  metadata?: { loanId?: string; refNumber?: string }
  createdAt: string
}

// ─── Constants ────────────────────────────────────────────────────────

const DESTINATION_CATEGORIES = [
  {
    value: 'DOMESTIC' as DestinationCategory,
    label: 'داخل المملكة',
    badge: 'محلي',
    daysAfter: 1,
    examples: 'الرياض، جدة، الدمام، مكة، المدينة...',
    deadline: '١١ يوم عمل',
    color: '#059669',
  },
  {
    value: 'ARAB' as DestinationCategory,
    label: 'الدول العربية',
    badge: 'عربي',
    daysAfter: 2,
    examples: 'الإمارات، مصر، الأردن، المغرب، تونس...',
    deadline: '١٢ يوم عمل',
    color: '#d97706',
  },
  {
    value: 'EUROPE_MAGHREB' as DestinationCategory,
    label: 'أوروبا والمغرب العربي',
    badge: 'أوروبا',
    daysAfter: 3,
    examples: 'فرنسا، ألمانيا، إسبانيا، إيطاليا...',
    deadline: '١٣ يوم عمل',
    color: '#7c3aed',
  },
  {
    value: 'AMERICAS_FAR' as DestinationCategory,
    label: 'أمريكا، كندا، أستراليا، آسيا البعيدة',
    badge: 'بعيد',
    daysAfter: 4,
    examples: 'الولايات المتحدة، كندا، أستراليا، كوريا...',
    deadline: '١٤ يوم عمل',
    color: '#dc2626',
  },
]

const EXPENSE_CATEGORIES = [
  'تذاكر السفر',
  'الإقامة والفندقة',
  'المواصلات الداخلية',
  'التغذية والوجبات',
  'رسوم التسجيل',
  'الاتصالات والإنترنت',
  'الطوارئ والمتنوع',
]

const REVIEW_STATUS_CONFIG: Record<
  ReviewStatus,
  { label: string; color: string; bg: string; icon: string }
> = {
  PENDING: {
    label: 'قيد المراجعة',
    color: '#d97706',
    bg: 'rgba(217,119,6,0.1)',
    icon: '⏳',
  },
  REVIEWED: {
    label: 'تمت المراجعة',
    color: '#059669',
    bg: 'rgba(5,150,105,0.1)',
    icon: '✅',
  },
  RETURNED: {
    label: 'أُعيدت للتعديل',
    color: '#dc2626',
    bg: 'rgba(220,38,38,0.1)',
    icon: '↩️',
  },
}

const SETTLEMENT_STATUS_CONFIG: Record<
  SettlementStatus,
  { label: string; color: string; bg: string }
> = {
  NOT_STARTED: { label: 'لم تبدأ', color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
  IN_PROGRESS: { label: 'جارية', color: '#d97706', bg: 'rgba(217,119,6,0.1)' },
  SUBMITTED: { label: 'مرسلة للمراجعة', color: '#016564', bg: 'rgba(1,101,100,0.1)' },
  APPROVED: { label: 'معتمدة', color: '#059669', bg: 'rgba(5,150,105,0.1)' },
  OVERDUE: { label: 'متأخرة', color: '#dc2626', bg: 'rgba(220,38,38,0.1)' },
}

// ─── Utility helpers ──────────────────────────────────────────────────

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('ar-SA', {
    style: 'currency',
    currency: 'SAR',
    minimumFractionDigits: 0,
  }).format(amount)
}

function isWorkingDay(date: Date) {
  const d = date.getDay()
  return d !== 5 && d !== 6
}

function addWorkingDays(start: Date, days: number): Date {
  const result = new Date(start)
  let added = 0
  while (added < days) {
    result.setDate(result.getDate() + 1)
    if (isWorkingDay(result)) added++
  }
  return result
}

function calcDeadlinePreview(endDate: string, cat: DestinationCategory): Date | null {
  if (!endDate) return null
  const meta = DESTINATION_CATEGORIES.find((c) => c.value === cat)
  const daysAfter = meta?.daysAfter ?? 1
  const start = new Date(endDate)
  start.setDate(start.getDate() + daysAfter)
  return addWorkingDays(start, 10)
}

function workingDaysLeft(deadline: Date): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dl = new Date(deadline)
  dl.setHours(0, 0, 0, 0)
  if (dl <= today) {
    let c = 0
    const cur = new Date(dl)
    while (cur < today) {
      cur.setDate(cur.getDate() + 1)
      if (isWorkingDay(cur)) c++
    }
    return -c
  }
  let c = 0
  const cur = new Date(today)
  while (cur < dl) {
    cur.setDate(cur.getDate() + 1)
    if (isWorkingDay(cur)) c++
  }
  return c
}

function deadlineStatus(loan: Loan): 'safe' | 'warning' | 'critical' | 'overdue' | null {
  if (loan.isSettled || !loan.settlementDeadline) return null
  const days = workingDaysLeft(new Date(loan.settlementDeadline))
  if (days < 0) return 'overdue'
  if (days <= 1) return 'critical'
  if (days <= 3) return 'warning'
  return 'safe'
}

const DEADLINE_COLORS = {
  safe: { text: '#059669', bg: 'rgba(5,150,105,0.1)', label: 'ضمن المهلة' },
  warning: { text: '#d97706', bg: 'rgba(217,119,6,0.1)', label: 'قارب المهلة' },
  critical: { text: '#ea580c', bg: 'rgba(234,88,12,0.1)', label: 'المهلة وشيكة' },
  overdue: { text: '#dc2626', bg: 'rgba(220,38,38,0.1)', label: 'تجاوز المهلة' },
}

// ─── Icon components ──────────────────────────────────────────────────

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  )
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function PrinterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
    </svg>
  )
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
  )
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  )
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

// ─── Notification Bell ────────────────────────────────────────────────

function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const unread = notifications.filter((n) => !n.isRead).length

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?limit=15')
      if (res.ok) setNotifications(await res.json())
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [load])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  async function markAllRead() {
    setLoading(true)
    try {
      await fetch('/api/notifications/read-all', { method: 'POST' })
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    } finally {
      setLoading(false)
    }
  }

  async function markRead(id: string) {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'POST' })
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      )
    } catch { /* silent */ }
  }

  const notifIcon: Record<NotificationType, string> = {
    LOAN_CREATED: '📋',
    LOAN_REVIEWED: '✅',
    LOAN_RETURNED: '↩️',
    SETTLEMENT_REMINDER: '⏰',
    SETTLEMENT_OVERDUE: '🚨',
    SETTLEMENT_APPROVED: '🎉',
    EXCEPTION_GRANTED: '🔑',
    SYSTEM: 'ℹ️',
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          position: 'relative',
          padding: '8px',
          borderRadius: '10px',
          background: open ? 'rgba(1,101,100,0.12)' : 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: open ? '#016564' : '#374151',
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-label="الإشعارات"
      >
        <BellIcon className="w-6 h-6" style={{ width: 24, height: 24 }} />
        {unread > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 2,
              right: 2,
              minWidth: 18,
              height: 18,
              background: '#dc2626',
              color: '#fff',
              borderRadius: 9,
              fontSize: 11,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              border: '2px solid #fff',
              lineHeight: 1,
            }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 8,
            width: 360,
            background: '#fff',
            borderRadius: 16,
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
            border: '1px solid #e5e7eb',
            overflow: 'hidden',
            zIndex: 1000,
            direction: 'rtl',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '14px 16px',
              borderBottom: '1px solid #f3f4f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>
              الإشعارات {unread > 0 && <span style={{ color: '#dc2626' }}>({unread})</span>}
            </span>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                disabled={loading}
                style={{
                  fontSize: 12,
                  color: '#016564',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                  padding: '4px 8px',
                  borderRadius: 6,
                  opacity: loading ? 0.6 : 1,
                }}
              >
                قراءة الكل
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div
                style={{
                  padding: '32px 16px',
                  textAlign: 'center',
                  color: '#9ca3af',
                  fontSize: 13,
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 8 }}>🔔</div>
                لا توجد إشعارات
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => !n.isRead && markRead(n.id)}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid #f9fafb',
                    background: n.isRead ? '#fff' : 'rgba(1,101,100,0.04)',
                    cursor: n.isRead ? 'default' : 'pointer',
                    transition: 'background 0.2s',
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-start',
                  }}
                >
                  <span style={{ fontSize: 20, flexShrink: 0 }}>
                    {notifIcon[n.type] ?? 'ℹ️'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: n.isRead ? 500 : 700,
                        color: '#111827',
                        marginBottom: 2,
                      }}
                    >
                      {n.title}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: '#6b7280',
                        lineHeight: 1.5,
                        marginBottom: 4,
                      }}
                    >
                      {n.message}
                    </div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>
                      {formatDistanceToNow(new Date(n.createdAt), {
                        addSuffix: true,
                        locale: ar,
                      })}
                    </div>
                  </div>
                  {!n.isRead && (
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        background: '#016564',
                        borderRadius: 4,
                        flexShrink: 0,
                        marginTop: 4,
                      }}
                    />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Step Tracker ─────────────────────────────────────────────────────

function StepTracker({ currentStep }: { currentStep: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: 'طلب السلفة', icon: '📋' },
    { n: 2, label: 'تسوية الحساب', icon: '🧾' },
    { n: 3, label: 'طباعة الوثيقة', icon: '🖨️' },
  ]
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        direction: 'rtl',
        marginBottom: 24,
      }}
    >
      {steps.map((step, i) => {
        const done = currentStep > step.n
        const active = currentStep === step.n
        return (
          <Fragment key={step.n}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                flex: 1,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: done ? 18 : 20,
                  fontWeight: 700,
                  background: done
                    ? '#059669'
                    : active
                    ? '#016564'
                    : '#e5e7eb',
                  color: done || active ? '#fff' : '#9ca3af',
                  boxShadow: active
                    ? '0 0 0 4px rgba(1,101,100,0.2)'
                    : 'none',
                  transition: 'all 0.3s',
                  position: 'relative',
                }}
              >
                {done ? '✓' : step.icon}
              </div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: active ? 700 : 500,
                  color: done
                    ? '#059669'
                    : active
                    ? '#016564'
                    : '#9ca3af',
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                }}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  background:
                    currentStep > step.n
                      ? '#059669'
                      : '#e5e7eb',
                  marginBottom: 22,
                  transition: 'background 0.3s',
                }}
              />
            )}
          </Fragment>
        )
      })}
    </div>
  )
}

// ─── Active Loan Blocker ──────────────────────────────────────────────

function ActiveLoanBanner({
  loan,
  onSettle,
}: {
  loan: Loan
  onSettle: () => void
}) {
  const ds = deadlineStatus(loan)
  const dsConfig = ds ? DEADLINE_COLORS[ds] : null
  const daysLeft = loan.settlementDeadline
    ? workingDaysLeft(new Date(loan.settlementDeadline))
    : null

  return (
    <div
      style={{
        background: 'rgba(220,38,38,0.06)',
        border: '1.5px solid rgba(220,38,38,0.3)',
        borderRadius: 14,
        padding: '16px 20px',
        marginBottom: 20,
        direction: 'rtl',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <AlertIcon
          className=""
          style={{ width: 22, height: 22, color: '#dc2626', flexShrink: 0 }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, color: '#991b1b', fontSize: 14, marginBottom: 4 }}>
            لديك سلفة نشطة — لا يمكن تقديم طلب جديد
          </div>
          <div style={{ fontSize: 13, color: '#374151', marginBottom: 10 }}>
            السلفة{' '}
            <span
              style={{
                fontWeight: 700,
                color: '#016564',
                background: 'rgba(1,101,100,0.1)',
                padding: '1px 6px',
                borderRadius: 4,
              }}
            >
              {loan.refNumber}
            </span>{' '}
            بمبلغ{' '}
            <strong>{formatCurrency(loan.amount)}</strong> لنشاط «{loan.activity}»
            يجب تسويتها أولاً.
          </div>
          {dsConfig && daysLeft !== null && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: dsConfig.bg,
                color: dsConfig.text,
                borderRadius: 8,
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 600,
                marginBottom: 10,
              }}
            >
              <ClockIcon style={{ width: 14, height: 14 }} />
              {daysLeft < 0
                ? `متأخر ${Math.abs(daysLeft)} يوم عمل`
                : daysLeft === 0
                ? 'اليوم آخر موعد!'
                : `${daysLeft} يوم عمل متبقي`}
              {' — '}{dsConfig.label}
            </div>
          )}
          <div>
            <button
              onClick={onSettle}
              style={{
                background: '#016564',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                padding: '8px 18px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              بدء تسوية السلفة ←
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Loan Request Form ────────────────────────────────────────────────

interface LoanFormData {
  activity: string
  location: string
  amount: string
  startDate: string
  endDate: string
  destinationCategory: DestinationCategory
  budgetApproved: boolean
  items: Array<{ category: string; amount: string }>
  files: Array<{ name: string; data: string; type: string }>
}

function LoanRequestForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: (loan: Loan) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<LoanFormData>({
    activity: '',
    location: '',
    amount: '',
    startDate: '',
    endDate: '',
    destinationCategory: 'DOMESTIC',
    budgetApproved: true,
    items: [],
    files: [],
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selectedCat = DESTINATION_CATEGORIES.find(
    (c) => c.value === form.destinationCategory
  )!

  const deadlinePreview =
    form.endDate
      ? calcDeadlinePreview(form.endDate, form.destinationCategory)
      : null

  function addItem() {
    setForm((f) => ({
      ...f,
      items: [...f.items, { category: EXPENSE_CATEGORIES[0], amount: '' }],
    }))
  }

  function removeItem(i: number) {
    setForm((f) => ({ ...f, items: f.items.filter((_, j) => j !== i) }))
  }

  function updateItem(i: number, field: 'category' | 'amount', val: string) {
    setForm((f) => {
      const items = [...f.items]
      items[i] = { ...items[i], [field]: val }
      return { ...f, items }
    })
  }

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    const processed = await Promise.all(
      files.map(
        (file) =>
          new Promise<{ name: string; data: string; type: string }>((res) => {
            const reader = new FileReader()
            reader.onload = () =>
              res({
                name: file.name,
                data: (reader.result as string).split(',')[1],
                type: file.type,
              })
            reader.readAsDataURL(file)
          })
      )
    )
    setForm((f) => ({ ...f, files: [...f.files, ...processed] }))
  }

  async function submit() {
    setError(null)
    if (!form.activity.trim()) return setError('يرجى إدخال اسم النشاط')
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0)
      return setError('يرجى إدخال مبلغ صحيح')
    if (!form.startDate || !form.endDate)
      return setError('يرجى تحديد تواريخ السفر')
    if (new Date(form.startDate) > new Date(form.endDate))
      return setError('تاريخ البداية يجب أن يكون قبل تاريخ النهاية')

    setSubmitting(true)
    try {
      const res = await fetch('/api/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activity: form.activity,
          location: form.location,
          amount: Number(form.amount),
          startDate: form.startDate,
          endDate: form.endDate,
          destinationCategory: form.destinationCategory,
          budgetApproved: form.budgetApproved,
          items: form.items
            .filter((it) => it.amount && Number(it.amount) > 0)
            .map((it) => ({ category: it.category, amount: Number(it.amount) })),
          files: form.files.length > 0 ? form.files : undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'حدث خطأ غير متوقع')
        return
      }
      onSuccess(data)
    } catch {
      setError('تعذّر الاتصال بالخادم. يرجى المحاولة مرة أخرى.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ direction: 'rtl' }}>
      <StepTracker currentStep={1} />

      {error && (
        <div
          style={{
            background: 'rgba(220,38,38,0.08)',
            border: '1px solid rgba(220,38,38,0.3)',
            color: '#991b1b',
            borderRadius: 10,
            padding: '12px 16px',
            marginBottom: 20,
            fontSize: 13,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <AlertIcon style={{ width: 18, height: 18, flexShrink: 0 }} />
          {error}
        </div>
      )}

      {/* Section: بيانات النشاط */}
      <SectionTitle>بيانات النشاط</SectionTitle>

      <FormGroup label="اسم النشاط / المهمة" required>
        <input
          type="text"
          value={form.activity}
          onChange={(e) => setForm({ ...form, activity: e.target.value })}
          placeholder="مثال: حضور مؤتمر التدريب الأمني"
          style={inputStyle}
        />
      </FormGroup>

      <FormGroup label="الموقع / المدينة">
        <input
          type="text"
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
          placeholder="مثال: دبي، الإمارات"
          style={inputStyle}
        />
      </FormGroup>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <FormGroup label="تاريخ المغادرة" required>
          <input
            type="date"
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            style={inputStyle}
          />
        </FormGroup>
        <FormGroup label="تاريخ العودة" required>
          <input
            type="date"
            value={form.endDate}
            min={form.startDate}
            onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            style={inputStyle}
          />
        </FormGroup>
      </div>

      {/* Destination Category */}
      <SectionTitle>تصنيف الوجهة</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        {DESTINATION_CATEGORIES.map((cat) => {
          const selected = form.destinationCategory === cat.value
          return (
            <button
              key={cat.value}
              type="button"
              onClick={() =>
                setForm({ ...form, destinationCategory: cat.value })
              }
              style={{
                padding: '12px 14px',
                borderRadius: 12,
                border: `2px solid ${selected ? cat.color : '#e5e7eb'}`,
                background: selected
                  ? `${cat.color}15`
                  : '#fff',
                cursor: 'pointer',
                textAlign: 'right',
                transition: 'all 0.2s',
                direction: 'rtl',
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: selected ? cat.color : '#374151',
                  marginBottom: 2,
                }}
              >
                {cat.label}
              </div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>
                مهلة التسوية: {cat.deadline}
              </div>
            </button>
          )
        })}
      </div>

      {/* Deadline Preview */}
      {deadlinePreview && (
        <div
          style={{
            background: 'rgba(1,101,100,0.06)',
            border: '1px solid rgba(1,101,100,0.2)',
            borderRadius: 10,
            padding: '12px 16px',
            marginBottom: 16,
            fontSize: 13,
            color: '#016564',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <ClockIcon style={{ width: 18, height: 18, flexShrink: 0 }} />
          <span>
            مهلة التسوية المتوقعة:{' '}
            <strong>
              {format(deadlinePreview, 'EEEE، d MMMM yyyy', { locale: ar })}
            </strong>
            {' '}(بعد العودة بـ {selectedCat.daysAfter} يوم + ١٠ أيام عمل)
          </span>
        </div>
      )}

      {/* Amount */}
      <SectionTitle>المبلغ المطلوب</SectionTitle>
      <FormGroup label="إجمالي المبلغ (ريال سعودي)" required>
        <div style={{ position: 'relative' }}>
          <input
            type="number"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            placeholder="0.00"
            min={0}
            style={{ ...inputStyle, paddingLeft: 60 }}
          />
          <span
            style={{
              position: 'absolute',
              left: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: 13,
              color: '#9ca3af',
              fontWeight: 600,
            }}
          >
            ر.س
          </span>
        </div>
      </FormGroup>

      {/* بنود الصرف */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <SectionTitle style={{ margin: 0 }}>بنود الصرف (اختياري)</SectionTitle>
        <button
          type="button"
          onClick={addItem}
          style={{
            fontSize: 12,
            color: '#016564',
            background: 'rgba(1,101,100,0.08)',
            border: 'none',
            borderRadius: 8,
            padding: '6px 12px',
            cursor: 'pointer',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <PlusIcon style={{ width: 14, height: 14 }} />
          إضافة بند
        </button>
      </div>

      {form.items.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <select
            value={item.category}
            onChange={(e) => updateItem(i, 'category', e.target.value)}
            style={{ ...inputStyle, flex: 2 }}
          >
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input
            type="number"
            value={item.amount}
            onChange={(e) => updateItem(i, 'amount', e.target.value)}
            placeholder="المبلغ"
            min={0}
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            type="button"
            onClick={() => removeItem(i)}
            style={{
              background: 'rgba(220,38,38,0.08)',
              border: 'none',
              borderRadius: 8,
              padding: '0 10px',
              cursor: 'pointer',
              color: '#dc2626',
            }}
          >
            <XIcon style={{ width: 16, height: 16 }} />
          </button>
        </div>
      ))}

      {/* File Upload */}
      <SectionTitle>المرفقات (اختياري)</SectionTitle>
      <div
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: '2px dashed #d0b284',
          borderRadius: 12,
          padding: '20px',
          textAlign: 'center',
          cursor: 'pointer',
          background: 'rgba(208,178,132,0.05)',
          marginBottom: 8,
          transition: 'all 0.2s',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 8 }}>
          <CameraIcon style={{ width: 28, height: 28, color: '#d0b284' }} />
          <UploadIcon style={{ width: 28, height: 28, color: '#d0b284' }} />
        </div>
        <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 600 }}>
          اضغط للرفع أو التقاط صورة بالكاميرا
        </div>
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
          PDF، JPG، PNG — يدعم الكاميرا على الجوال
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,application/pdf"
        capture="environment"
        onChange={handleFiles}
        style={{ display: 'none' }}
      />
      {form.files.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {form.files.map((f, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                background: '#f9fafb',
                borderRadius: 8,
                marginBottom: 4,
                fontSize: 12,
              }}
            >
              <span style={{ color: '#374151' }}>📎 {f.name}</span>
              <button
                type="button"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    files: prev.files.filter((_, j) => j !== i),
                  }))
                }
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#dc2626',
                  cursor: 'pointer',
                }}
              >
                <XIcon style={{ width: 14, height: 14 }} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* موافقة الميزانية */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 24,
          padding: '12px 14px',
          background: '#f9fafb',
          borderRadius: 10,
          cursor: 'pointer',
        }}
        onClick={() => setForm({ ...form, budgetApproved: !form.budgetApproved })}
      >
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: 5,
            border: `2px solid ${form.budgetApproved ? '#016564' : '#d1d5db'}`,
            background: form.budgetApproved ? '#016564' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'all 0.2s',
          }}
        >
          {form.budgetApproved && (
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>✓</span>
          )}
        </div>
        <span style={{ fontSize: 13, color: '#374151', userSelect: 'none' }}>
          تم اعتماد الميزانية من الجهة المختصة
        </span>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={submit}
          disabled={submitting}
          style={{
            flex: 1,
            background: submitting ? '#9ca3af' : '#016564',
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            padding: '14px',
            fontSize: 15,
            fontWeight: 700,
            cursor: submitting ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            transition: 'all 0.2s',
          }}
        >
          {submitting ? (
            <>
              <span
                style={{
                  width: 18,
                  height: 18,
                  border: '2.5px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#fff',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  display: 'inline-block',
                }}
              />
              جارٍ الإرسال...
            </>
          ) : (
            'إرسال الطلب ←'
          )}
        </button>
        <button
          onClick={onCancel}
          disabled={submitting}
          style={{
            padding: '14px 20px',
            background: '#f3f4f6',
            color: '#374151',
            border: 'none',
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          إلغاء
        </button>
      </div>
    </div>
  )
}

// ─── Settlement Form ──────────────────────────────────────────────────

interface InvoiceRow {
  description: string
  amount: string
  supported: boolean
  file?: { name: string; data: string; type: string }
}

function SettlementForm({
  loan,
  onSuccess,
  onCancel,
}: {
  loan: Loan
  onSuccess: () => void
  onCancel: () => void
}) {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([
    { description: '', amount: '', supported: true },
  ])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRefs = useRef<(HTMLInputElement | null)[]>([])

  function addRow() {
    setInvoices((prev) => [...prev, { description: '', amount: '', supported: true }])
  }

  function removeRow(i: number) {
    setInvoices((prev) => prev.filter((_, j) => j !== i))
  }

  function updateRow(i: number, field: keyof InvoiceRow, val: unknown) {
    setInvoices((prev) => {
      const rows = [...prev]
      rows[i] = { ...rows[i], [field]: val } as InvoiceRow
      return rows
    })
  }

  async function handleRowFile(i: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const data = await new Promise<string>((res) => {
      const r = new FileReader()
      r.onload = () => res((r.result as string).split(',')[1])
      r.readAsDataURL(file)
    })
    updateRow(i, 'file', { name: file.name, data, type: file.type })
  }

  const totalSupported = invoices
    .filter((r) => r.supported && r.amount)
    .reduce((s, r) => s + Number(r.amount), 0)

  const totalUnsupported = invoices
    .filter((r) => !r.supported && r.amount)
    .reduce((s, r) => s + Number(r.amount), 0)

  const total = totalSupported + totalUnsupported
  const savings = Math.max(0, loan.amount - total)
  const overage = Math.max(0, total - loan.amount)

  async function submit() {
    setError(null)
    if (invoices.some((r) => !r.description.trim()))
      return setError('يرجى إدخال وصف لكل فاتورة')
    if (invoices.some((r) => !r.amount || isNaN(Number(r.amount)) || Number(r.amount) <= 0))
      return setError('يرجى إدخال مبلغ صحيح لكل فاتورة')

    setSubmitting(true)
    try {
      const res = await fetch(`/api/loans/${loan.id}/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoices: invoices.map((r) => ({
            description: r.description,
            amount: Number(r.amount),
            supported: r.supported,
            file: r.file,
          })),
          supported: totalSupported,
          unsupported: totalUnsupported,
          total,
          savings,
          overage,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'حدث خطأ')
        return
      }
      onSuccess()
    } catch {
      setError('تعذّر الاتصال بالخادم')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ direction: 'rtl' }}>
      <StepTracker currentStep={2} />

      {/* Loan Summary */}
      <div
        style={{
          background: 'rgba(1,101,100,0.06)',
          borderRadius: 12,
          padding: '14px 16px',
          marginBottom: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>السلفة</div>
          <div style={{ fontWeight: 700, color: '#016564', fontSize: 15 }}>
            {loan.refNumber}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>المبلغ الممنوح</div>
          <div style={{ fontWeight: 700, color: '#111827', fontSize: 15 }}>
            {formatCurrency(loan.amount)}
          </div>
        </div>
        {loan.settlementDeadline && (
          <div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>آخر موعد للتسوية</div>
            <div style={{ fontWeight: 700, color: '#dc2626', fontSize: 14 }}>
              {format(new Date(loan.settlementDeadline), 'd MMM yyyy', { locale: ar })}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div
          style={{
            background: 'rgba(220,38,38,0.08)',
            border: '1px solid rgba(220,38,38,0.3)',
            color: '#991b1b',
            borderRadius: 10,
            padding: '10px 14px',
            marginBottom: 16,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}

      <SectionTitle>الفواتير والمصروفات</SectionTitle>

      {invoices.map((row, i) => (
        <div
          key={i}
          style={{
            background: '#f9fafb',
            borderRadius: 12,
            padding: '14px',
            marginBottom: 10,
            border: '1px solid #e5e7eb',
          }}
        >
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              type="text"
              value={row.description}
              onChange={(e) => updateRow(i, 'description', e.target.value)}
              placeholder="وصف الفاتورة / المصروف"
              style={{ ...inputStyle, flex: 2, background: '#fff' }}
            />
            <input
              type="number"
              value={row.amount}
              onChange={(e) => updateRow(i, 'amount', e.target.value)}
              placeholder="المبلغ"
              min={0}
              style={{ ...inputStyle, flex: 1, background: '#fff' }}
            />
            {invoices.length > 1 && (
              <button
                type="button"
                onClick={() => removeRow(i)}
                style={{
                  background: 'rgba(220,38,38,0.08)',
                  border: 'none',
                  borderRadius: 8,
                  padding: '0 10px',
                  cursor: 'pointer',
                  color: '#dc2626',
                }}
              >
                <XIcon style={{ width: 16, height: 16 }} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Supported toggle */}
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={() => updateRow(i, 'supported', true)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 7,
                  border: `1.5px solid ${row.supported ? '#059669' : '#e5e7eb'}`,
                  background: row.supported ? 'rgba(5,150,105,0.1)' : '#fff',
                  color: row.supported ? '#059669' : '#6b7280',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                مؤيد بمستند
              </button>
              <button
                type="button"
                onClick={() => updateRow(i, 'supported', false)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 7,
                  border: `1.5px solid ${!row.supported ? '#d97706' : '#e5e7eb'}`,
                  background: !row.supported ? 'rgba(217,119,6,0.1)' : '#fff',
                  color: !row.supported ? '#d97706' : '#6b7280',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                غير مؤيد
              </button>
            </div>

            {/* Photo upload */}
            <button
              type="button"
              onClick={() => fileRefs.current[i]?.click()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 10px',
                borderRadius: 7,
                border: `1.5px solid ${row.file ? '#016564' : '#e5e7eb'}`,
                background: row.file ? 'rgba(1,101,100,0.08)' : '#fff',
                color: row.file ? '#016564' : '#6b7280',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <CameraIcon style={{ width: 14, height: 14 }} />
              {row.file ? row.file.name.slice(0, 12) + '…' : 'إرفاق صورة'}
            </button>
            <input
              ref={(el) => { fileRefs.current[i] = el }}
              type="file"
              accept="image/*,application/pdf"
              capture="environment"
              onChange={(e) => handleRowFile(i, e)}
              style={{ display: 'none' }}
            />
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addRow}
        style={{
          width: '100%',
          padding: '10px',
          border: '2px dashed #d0b284',
          borderRadius: 10,
          background: 'transparent',
          color: '#d0b284',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        <PlusIcon style={{ width: 16, height: 16 }} />
        إضافة فاتورة
      </button>

      {/* Summary */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          overflow: 'hidden',
          marginBottom: 20,
        }}
      >
        <div style={{ padding: '10px 14px', background: '#f9fafb', fontWeight: 700, fontSize: 13, color: '#374151' }}>
          ملخص التسوية
        </div>
        {[
          { label: 'مؤيد بمستندات', value: totalSupported, color: '#059669' },
          { label: 'غير مؤيد', value: totalUnsupported, color: '#d97706' },
          { label: 'الإجمالي', value: total, color: '#111827', bold: true },
          { label: 'المبلغ الممنوح', value: loan.amount, color: '#016564' },
          ...(savings > 0 ? [{ label: 'الوفر (يُعاد)', value: savings, color: '#059669', bold: true }] : []),
          ...(overage > 0 ? [{ label: 'الزيادة (مطلوبة)', value: overage, color: '#dc2626', bold: true }] : []),
        ].map((row) => (
          <div
            key={row.label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '9px 14px',
              borderBottom: '1px solid #f3f4f6',
              fontSize: 13,
            }}
          >
            <span style={{ color: '#6b7280' }}>{row.label}</span>
            <span style={{ fontWeight: row.bold ? 700 : 500, color: row.color }}>
              {formatCurrency(row.value)}
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={submit}
          disabled={submitting}
          style={{
            flex: 1,
            background: submitting ? '#9ca3af' : '#016564',
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            padding: '14px',
            fontSize: 15,
            fontWeight: 700,
            cursor: submitting ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? 'جارٍ الإرسال...' : 'إرسال التسوية للمراجعة ←'}
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: '14px 20px',
            background: '#f3f4f6',
            color: '#374151',
            border: 'none',
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          رجوع
        </button>
      </div>
    </div>
  )
}

// ─── Loan Card ────────────────────────────────────────────────────────

function LoanCard({
  loan,
  onSettle,
  onPrint,
}: {
  loan: Loan
  onSettle: (loan: Loan) => void
  onPrint: (loan: Loan) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const rs = REVIEW_STATUS_CONFIG[loan.reviewStatus]
  const ss = SETTLEMENT_STATUS_CONFIG[loan.settlementStatus]
  const ds = deadlineStatus(loan)
  const dsConfig = ds ? DEADLINE_COLORS[ds] : null
  const daysLeft = loan.settlementDeadline
    ? workingDaysLeft(new Date(loan.settlementDeadline))
    : null

  const destCat = DESTINATION_CATEGORIES.find(
    (c) => c.value === loan.destinationCategory
  )

  // Determine the ONE available action
  type Action = {
    label: string
    color: string
    bg: string
    onClick: () => void
    icon: string
  } | null

  let action: Action = null

  if (
    loan.reviewStatus === 'REVIEWED' &&
    !loan.isSettled &&
    loan.settlementStatus === 'NOT_STARTED'
  ) {
    action = {
      label: 'بدء التسوية',
      color: '#016564',
      bg: 'rgba(1,101,100,0.1)',
      onClick: () => onSettle(loan),
      icon: '🧾',
    }
  } else if (
    loan.reviewStatus === 'REVIEWED' &&
    !loan.isSettled &&
    loan.settlementStatus === 'IN_PROGRESS'
  ) {
    action = {
      label: 'متابعة التسوية',
      color: '#d97706',
      bg: 'rgba(217,119,6,0.1)',
      onClick: () => onSettle(loan),
      icon: '📝',
    }
  } else if (loan.reviewStatus === 'REVIEWED' && !loan.printedAt) {
    action = {
      label: 'طباعة النموذج',
      color: '#016564',
      bg: 'rgba(1,101,100,0.1)',
      onClick: () => onPrint(loan),
      icon: '🖨️',
    }
  } else if (loan.reviewStatus === 'RETURNED') {
    action = {
      label: 'تعديل الطلب',
      color: '#dc2626',
      bg: 'rgba(220,38,38,0.1)',
      onClick: () => { /* TODO: open edit modal */ },
      icon: '✏️',
    }
  } else if (loan.isSettled && loan.settlementStatus === 'APPROVED') {
    action = {
      label: 'طباعة وثيقة التسوية',
      color: '#059669',
      bg: 'rgba(5,150,105,0.1)',
      onClick: () => onPrint(loan),
      icon: '🖨️',
    }
  }

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 16,
        border: `1.5px solid ${ds === 'overdue' ? 'rgba(220,38,38,0.3)' : '#e5e7eb'}`,
        overflow: 'hidden',
        transition: 'box-shadow 0.2s',
        boxShadow: ds === 'overdue'
          ? '0 0 0 2px rgba(220,38,38,0.1)'
          : '0 1px 4px rgba(0,0,0,0.06)',
        direction: 'rtl',
      }}
    >
      {/* Card Top Bar */}
      <div
        style={{
          height: 4,
          background: loan.isSettled
            ? '#059669'
            : loan.reviewStatus === 'RETURNED'
            ? '#dc2626'
            : loan.reviewStatus === 'REVIEWED'
            ? '#016564'
            : '#d0b284',
        }}
      />

      <div style={{ padding: '16px' }}>
        {/* Header Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>رقم السلفة</div>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#016564', letterSpacing: '-0.5px' }}>
              {loan.refNumber}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                background: rs.bg,
                color: rs.color,
                padding: '3px 9px',
                borderRadius: 20,
              }}
            >
              {rs.icon} {rs.label}
            </span>
            {!loan.isSettled && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  background: ss.bg,
                  color: ss.color,
                  padding: '3px 9px',
                  borderRadius: 20,
                }}
              >
                {ss.label}
              </span>
            )}
            {loan.isSettled && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  background: 'rgba(5,150,105,0.1)',
                  color: '#059669',
                  padding: '3px 9px',
                  borderRadius: 20,
                }}
              >
                ✅ مُسوَّاة
              </span>
            )}
          </div>
        </div>

        {/* Main Info */}
        <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 4 }}>
          {loan.activity}
        </div>
        {loan.location && (
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
            📍 {loan.location}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>المبلغ</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>
              {formatCurrency(loan.amount)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>تاريخ السفر</div>
            <div style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>
              {format(new Date(loan.startDate), 'd MMM', { locale: ar })}
              {' — '}
              {format(new Date(loan.endDate), 'd MMM yyyy', { locale: ar })}
            </div>
          </div>
          {destCat && (
            <div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>الوجهة</div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: destCat.color,
                  background: `${destCat.color}15`,
                  padding: '2px 8px',
                  borderRadius: 6,
                  display: 'inline-block',
                }}
              >
                {destCat.badge}
              </div>
            </div>
          )}
        </div>

        {/* Deadline Badge */}
        {dsConfig && daysLeft !== null && !loan.isSettled && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              background: dsConfig.bg,
              color: dsConfig.text,
              borderRadius: 8,
              padding: '5px 10px',
              fontSize: 12,
              fontWeight: 700,
              marginBottom: 12,
            }}
          >
            <ClockIcon style={{ width: 14, height: 14 }} />
            {daysLeft < 0
              ? `متأخر ${Math.abs(daysLeft)} يوم عمل — ${dsConfig.label}`
              : daysLeft === 0
              ? `اليوم آخر موعد — ${dsConfig.label}`
              : `${daysLeft} أيام عمل متبقية — ${dsConfig.label}`}
          </div>
        )}

        {/* Review Note */}
        {loan.reviewNote && loan.reviewStatus === 'RETURNED' && (
          <div
            style={{
              background: 'rgba(220,38,38,0.06)',
              border: '1px solid rgba(220,38,38,0.2)',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 12,
              color: '#991b1b',
              marginBottom: 12,
            }}
          >
            <strong>ملاحظة المراجع:</strong> {loan.reviewNote}
          </div>
        )}

        {/* THE ONE ACTION BUTTON */}
        {action && (
          <button
            onClick={action.onClick}
            style={{
              width: '100%',
              padding: '11px',
              background: action.bg,
              color: action.color,
              border: `1.5px solid ${action.color}40`,
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 0.2s',
              marginBottom: 6,
            }}
          >
            <span>{action.icon}</span>
            {action.label}
          </button>
        )}

        {/* Expand Toggle */}
        <button
          onClick={() => setExpanded((e) => !e)}
          style={{
            width: '100%',
            padding: '6px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 12,
            color: '#9ca3af',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
          }}
        >
          {expanded ? 'إخفاء التفاصيل ↑' : 'عرض التفاصيل ↓'}
        </button>

        {/* Expanded Details */}
        {expanded && (
          <div
            style={{
              marginTop: 12,
              borderTop: '1px solid #f3f4f6',
              paddingTop: 12,
            }}
          >
            {loan.items.length > 0 && (
              <>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                  بنود الصرف
                </div>
                {loan.items.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 12,
                      color: '#6b7280',
                      padding: '4px 0',
                      borderBottom: '1px dotted #f3f4f6',
                    }}
                  >
                    <span>{item.category}</span>
                    <span style={{ fontWeight: 600 }}>{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </>
            )}

            {loan.settlement && (
              <>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginTop: 10, marginBottom: 6 }}>
                  ملخص التسوية
                </div>
                {[
                  { l: 'مؤيد بمستندات', v: loan.settlement.supported, c: '#059669' },
                  { l: 'غير مؤيد', v: loan.settlement.unsupported, c: '#d97706' },
                  ...(loan.settlement.savings > 0 ? [{ l: 'الوفر', v: loan.settlement.savings, c: '#059669' }] : []),
                  ...(loan.settlement.overage > 0 ? [{ l: 'الزيادة', v: loan.settlement.overage, c: '#dc2626' }] : []),
                ].map((row) => (
                  <div
                    key={row.l}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 12,
                      padding: '3px 0',
                    }}
                  >
                    <span style={{ color: '#6b7280' }}>{row.l}</span>
                    <span style={{ fontWeight: 700, color: row.c }}>
                      {formatCurrency(row.v)}
                    </span>
                  </div>
                ))}
              </>
            )}

            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 10 }}>
              أُنشئ في{' '}
              {format(new Date(loan.createdAt), 'EEEE d MMMM yyyy', { locale: ar })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Print Modal ──────────────────────────────────────────────────────

function PrintModal({
  loan,
  onClose,
}: {
  loan: Loan
  onClose: () => void
}) {
  const [printing, setPrinting] = useState(false)

  async function markPrinted() {
    try {
      await fetch(`/api/loans/${loan.id}/print`, { method: 'POST' })
    } catch { /* silent */ }
  }

  function handlePrint() {
    setPrinting(true)
    markPrinted()
    window.print()
    setTimeout(() => setPrinting(false), 1000)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 20,
          maxWidth: 480,
          width: '100%',
          overflow: 'hidden',
          direction: 'rtl',
        }}
      >
        <div
          style={{
            background: '#016564',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>طباعة الوثيقة</div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>{loan.refNumber}</div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: 8,
              padding: '6px',
              cursor: 'pointer',
              color: '#fff',
            }}
          >
            <XIcon style={{ width: 18, height: 18 }} />
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          <StepTracker currentStep={3} />

          <div
            style={{
              background: '#f9fafb',
              borderRadius: 12,
              padding: '16px',
              marginBottom: 20,
            }}
          >
            <div
              style={{
                fontSize: 12,
                color: '#9ca3af',
                marginBottom: 8,
                textAlign: 'center',
              }}
            >
              ستُطبع الوثيقة التالية
            </div>
            {[
              ['النشاط', loan.activity],
              ['المبلغ', formatCurrency(loan.amount)],
              ['تاريخ السفر',
                `${format(new Date(loan.startDate), 'd MMM', { locale: ar })} — ${format(new Date(loan.endDate), 'd MMM yyyy', { locale: ar })}`],
              ...(loan.settlement
                ? [
                    ['إجمالي المصروف', formatCurrency(loan.settlement.total)],
                    ...(loan.settlement.savings > 0
                      ? [['الوفر', formatCurrency(loan.settlement.savings)]]
                      : []),
                    ...(loan.settlement.overage > 0
                      ? [['الزيادة', formatCurrency(loan.settlement.overage)]]
                      : []),
                  ]
                : []),
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '6px 0',
                  borderBottom: '1px solid #f3f4f6',
                  fontSize: 13,
                }}
              >
                <span style={{ color: '#6b7280' }}>{label}</span>
                <span style={{ fontWeight: 600, color: '#111827' }}>{value}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handlePrint}
              disabled={printing}
              style={{
                flex: 1,
                background: '#016564',
                color: '#fff',
                border: 'none',
                borderRadius: 12,
                padding: '13px',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <PrinterIcon style={{ width: 18, height: 18 }} />
              {printing ? 'جارٍ الطباعة...' : 'طباعة الوثيقة'}
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '13px 18px',
                background: '#f3f4f6',
                color: '#374151',
                border: 'none',
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Shared UI helpers ────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1.5px solid #e5e7eb',
  borderRadius: 10,
  fontSize: 14,
  color: '#111827',
  background: '#fff',
  outline: 'none',
  transition: 'border-color 0.2s',
  boxSizing: 'border-box',
  direction: 'rtl',
  fontFamily: 'inherit',
}

function SectionTitle({
  children,
  style,
}: {
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 800,
        color: '#016564',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: 10,
        marginTop: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        ...style,
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: 3,
          height: 14,
          background: '#016564',
          borderRadius: 2,
        }}
      />
      {children}
    </div>
  )
}

function FormGroup({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label
        style={{
          display: 'block',
          fontSize: 12,
          fontWeight: 700,
          color: '#374151',
          marginBottom: 5,
        }}
      >
        {label}
        {required && <span style={{ color: '#dc2626', marginRight: 3 }}>*</span>}
      </label>
      {children}
    </div>
  )
}

// ─── Success Toast ────────────────────────────────────────────────────

function SuccessToast({
  message,
  onClose,
}: {
  message: string
  onClose: () => void
}) {
  useEffect(() => {
    const id = setTimeout(onClose, 4000)
    return () => clearTimeout(id)
  }, [onClose])

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        background: '#059669',
        color: '#fff',
        borderRadius: 14,
        padding: '12px 20px',
        boxShadow: '0 8px 32px rgba(5,150,105,0.4)',
        zIndex: 3000,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontSize: 14,
        fontWeight: 700,
        direction: 'rtl',
        animation: 'slideUp 0.3s ease',
        whiteSpace: 'nowrap',
      }}
    >
      <CheckCircleIcon style={{ width: 20, height: 20 }} />
      {message}
    </div>
  )
}

// ─── Main DashboardClient ─────────────────────────────────────────────

type View = 'list' | 'new-loan' | 'settle' | 'print'

interface DashboardClientProps {
  initialLoans?: Loan[]
  userName?: string
}

export default function DashboardClient({
  initialLoans = [],
  userName = 'الموظف',
}: DashboardClientProps) {
  const [loans, setLoans] = useState<Loan[]>(initialLoans)
  const [view, setView] = useState<View>('list')
  const [activeLoan, setActiveLoan] = useState<Loan | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const loadLoans = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/loans')
      if (res.ok) setLoans(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (initialLoans.length === 0) loadLoans()
  }, [loadLoans, initialLoans.length])

  // Find if there's any active (unsettled) loan to block new requests
  const blockingLoan = loans.find(
    (l) => !l.isSettled && !l.exceptionGrantedById
  ) ?? null

  function showToast(msg: string) {
    setToast(msg)
  }

  function goList() {
    setView('list')
    setActiveLoan(null)
    loadLoans()
  }

  function handleNewLoanSuccess(loan: Loan) {
    setLoans((prev) => [loan, ...prev])
    showToast(`تم إرسال طلب السلفة ${loan.refNumber} بنجاح ✓`)
    goList()
  }

  function handleSettleSuccess() {
    showToast('تم إرسال طلب التسوية للمراجعة بنجاح ✓')
    goList()
  }

  // Stats
  const activeCount = loans.filter((l) => !l.isSettled).length
  const overdueCount = loans.filter(
    (l) => !l.isSettled && deadlineStatus(l) === 'overdue'
  ).length
  const totalAmount = loans
    .filter((l) => !l.isSettled)
    .reduce((s, l) => s + l.amount, 0)

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'صباح الخير'
    if (h < 17) return 'مساء الخير'
    return 'مساء النور'
  })()

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(20px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0);    }
        }
        input:focus, select:focus, textarea:focus {
          outline: none;
          border-color: #016564 !important;
          box-shadow: 0 0 0 3px rgba(1,101,100,0.12);
        }
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
        }
        .print-only { display: none; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #f9fafb; }
        ::-webkit-scrollbar-thumb { background: #d0b284; border-radius: 2px; }
      `}</style>

      <div
        style={{
          minHeight: '100vh',
          background: '#f8fafc',
          fontFamily:
            "'IBM Plex Sans Arabic', 'Noto Kufi Arabic', Tahoma, Arial, sans-serif",
          direction: 'rtl',
        }}
      >
        {/* ── Top Navigation ─────────────────────────────────── */}
        <div
          className="no-print"
          style={{
            background: '#fff',
            borderBottom: '1px solid #e5e7eb',
            padding: '0 16px',
            position: 'sticky',
            top: 0,
            zIndex: 100,
          }}
        >
          <div
            style={{
              maxWidth: 720,
              margin: '0 auto',
              height: 60,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            {/* Logo + Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  background: '#016564',
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                }}
              >
                💼
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14, color: '#111827', lineHeight: 1.2 }}>
                  السلف النقدية
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>وكالة التدريب</div>
              </div>
            </div>

            {/* Right: Bell + Avatar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <NotificationBell />
              <div
                style={{
                  width: 34,
                  height: 34,
                  background: 'linear-gradient(135deg, #016564, #d0b284)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                {userName.charAt(0)}
              </div>
            </div>
          </div>
        </div>

        {/* ── Main Content ────────────────────────────────────── */}
        <div
          style={{
            maxWidth: 720,
            margin: '0 auto',
            padding: '20px 16px 80px',
          }}
        >

          {/* ══ LIST VIEW ══════════════════════════════════════ */}
          {view === 'list' && (
            <>
              {/* Greeting */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#111827' }}>
                  {greeting}، {userName} 👋
                </div>
                <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
                  {new Date().toLocaleDateString('ar-SA', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </div>
              </div>

              {/* Stats Cards */}
              {loans.length > 0 && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 10,
                    marginBottom: 20,
                  }}
                >
                  {[
                    {
                      label: 'نشطة',
                      value: activeCount,
                      color: '#016564',
                      bg: 'rgba(1,101,100,0.08)',
                    },
                    {
                      label: 'متأخرة',
                      value: overdueCount,
                      color: overdueCount > 0 ? '#dc2626' : '#9ca3af',
                      bg:
                        overdueCount > 0
                          ? 'rgba(220,38,38,0.08)'
                          : '#f9fafb',
                    },
                    {
                      label: 'إجمالي مفتوح',
                      value: totalAmount > 0 ? formatCurrency(totalAmount) : '٠',
                      color: '#d0b284',
                      bg: 'rgba(208,178,132,0.1)',
                      small: true,
                    },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      style={{
                        background: stat.bg,
                        borderRadius: 12,
                        padding: '12px',
                        textAlign: 'center',
                      }}
                    >
                      <div
                        style={{
                          fontSize: stat.small ? 13 : 22,
                          fontWeight: 800,
                          color: stat.color,
                          lineHeight: 1.2,
                        }}
                      >
                        {stat.value}
                      </div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                        {stat.label}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Active Loan Blocker Banner */}
              {blockingLoan && (
                <ActiveLoanBanner
                  loan={blockingLoan}
                  onSettle={() => {
                    setActiveLoan(blockingLoan)
                    setView('settle')
                  }}
                />
              )}

              {/* New Loan Button */}
              {!blockingLoan && (
                <button
                  onClick={() => setView('new-loan')}
                  style={{
                    width: '100%',
                    padding: '14px',
                    background: '#016564',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 14,
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    marginBottom: 20,
                    boxShadow: '0 4px 16px rgba(1,101,100,0.3)',
                    transition: 'transform 0.15s',
                  }}
                >
                  <PlusIcon style={{ width: 20, height: 20 }} />
                  طلب سلفة جديدة
                </button>
              )}

              {/* Loans List */}
              {loading && loans.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      border: '3px solid #e5e7eb',
                      borderTopColor: '#016564',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite',
                      margin: '0 auto 12px',
                    }}
                  />
                  جارٍ التحميل...
                </div>
              ) : loans.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '48px 16px',
                    color: '#9ca3af',
                    border: '2px dashed #e5e7eb',
                    borderRadius: 16,
                  }}
                >
                  <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#374151', marginBottom: 4 }}>
                    لا توجد سلف بعد
                  </div>
                  <div style={{ fontSize: 13 }}>
                    ابدأ بتقديم طلب سلفة جديدة للسفر والمهام الرسمية
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {loans.map((loan) => (
                    <LoanCard
                      key={loan.id}
                      loan={loan}
                      onSettle={(l) => {
                        setActiveLoan(l)
                        setView('settle')
                      }}
                      onPrint={(l) => {
                        setActiveLoan(l)
                        setView('print')
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* ══ NEW LOAN VIEW ════════════════════════════════════ */}
          {view === 'new-loan' && (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 24,
                }}
              >
                <button
                  onClick={() => setView('list')}
                  style={{
                    background: '#f3f4f6',
                    border: 'none',
                    borderRadius: 10,
                    padding: '8px 12px',
                    cursor: 'pointer',
                    color: '#374151',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  → رجوع
                </button>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18, color: '#111827' }}>
                    طلب سلفة جديدة
                  </div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>
                    أدخل بيانات النشاط والمبلغ المطلوب
                  </div>
                </div>
              </div>
              <LoanRequestForm
                onSuccess={handleNewLoanSuccess}
                onCancel={() => setView('list')}
              />
            </div>
          )}

          {/* ══ SETTLE VIEW ══════════════════════════════════════ */}
          {view === 'settle' && activeLoan && (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 24,
                }}
              >
                <button
                  onClick={() => setView('list')}
                  style={{
                    background: '#f3f4f6',
                    border: 'none',
                    borderRadius: 10,
                    padding: '8px 12px',
                    cursor: 'pointer',
                    color: '#374151',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  → رجوع
                </button>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18, color: '#111827' }}>
                    تسوية السلفة
                  </div>
                  <div style={{ fontSize: 12, color: '#016564', fontWeight: 600 }}>
                    {activeLoan.refNumber}
                  </div>
                </div>
              </div>
              <SettlementForm
                loan={activeLoan}
                onSuccess={handleSettleSuccess}
                onCancel={() => setView('list')}
              />
            </div>
          )}
        </div>

        {/* ── Print Modal ─────────────────────────────────────── */}
        {view === 'print' && activeLoan && (
          <PrintModal
            loan={activeLoan}
            onClose={() => {
              setView('list')
              setActiveLoan(null)
            }}
          />
        )}

        {/* ── Toast ───────────────────────────────────────────── */}
        {toast && (
          <SuccessToast message={toast} onClose={() => setToast(null)} />
        )}
      </div>
    </>
  )
}

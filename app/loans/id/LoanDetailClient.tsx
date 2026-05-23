'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { formatCurrencySar } from '@/lib/utils'
import {
  getDeadlineStatus,
  workingDaysUntilDeadline,
  DEADLINE_STATUS_CONFIG,
  DESTINATION_CATEGORIES,
} from '@/lib/settlement-deadline'

type Role = 'EMPLOYEE' | 'ADMIN' | 'REVIEWER'

type CurrentUser = {
  userId: string
  fullName: string
  email: string
  role: Role
  roles: Role[]
}

type LoanItem = { id: string; category: string; amount: number }

type Settlement = {
  id: string
  supported: number
  unsupported: number
  total: number
  savings: number
  overage: number
  createdAt: string
}

type Loan = {
  id: string
  refNumber: string
  employee: string
  activity: string
  location: string | null
  amount: number
  budgetApproved: boolean | null
  reviewStatus: 'PENDING' | 'REVIEWED' | 'RETURNED'
  reviewNote: string | null
  settlementDeadline: string | null
  destinationCategory: string
  isSettled: boolean
  settlementStatus: string
  printedAt: string | null
  startDate: string
  endDate: string
  createdAt: string
  exceptionGrantedById: string | null
  courseId: string | null
  courseCode: string | null
  items: LoanItem[]
  settlement: Settlement | null
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('ar-SA', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

export default function LoanDetailClient({
  loan,
  currentUser,
  successMessage,
}: {
  loan: Loan
  currentUser: CurrentUser
  successMessage?: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [reviewNote, setReviewNote] = useState(loan.reviewNote ?? '')
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState(successMessage ?? '')

  const canReview = currentUser.roles.some(r => r === 'ADMIN' || r === 'REVIEWER')
  const isOwner = loan.userId === currentUser.userId || loan.employee === currentUser.fullName
  const canEdit = !loan.printedAt && !loan.isSettled && isOwner

  const deadline = loan.settlementDeadline ? new Date(loan.settlementDeadline) : null
  const deadlineStatus = getDeadlineStatus(deadline, loan.isSettled)
  const daysLeft = deadline ? workingDaysUntilDeadline(deadline) : null
  const destMeta = DESTINATION_CATEGORIES.find(d => d.value === loan.destinationCategory)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

  async function handleReview(status: 'REVIEWED' | 'RETURNED') {
    startTransition(async () => {
      const res = await fetch(`/api/loans/${loan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewStatus: status, reviewNote: reviewNote.trim() }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? 'تعذر تحديث حالة المراجعة')
        return
      }
      setShowReviewForm(false)
      showToast(status === 'REVIEWED' ? 'تمت المراجعة والاعتماد' : 'أُعيد الطلب للمراجعة')
      router.refresh()
    })
  }

  async function handleDelete() {
    if (!confirm('سيتم حذف طلب السلفة نهائياً. هل تريد المتابعة؟')) return
    startTransition(async () => {
      const res = await fetch(`/api/loans/${loan.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? 'تعذر حذف الطلب')
        return
      }
      router.push('/')
    })
  }

  async function handleSendAlert() {
    startTransition(async () => {
      const res = await fetch('/api/admin/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loanId: loan.id }),
      })
      if (res.ok) showToast('تم إرسال الإنذار بنجاح')
      else showToast('تعذر إرسال الإنذار')
    })
  }

  function openPrint(kind: 'loan' | 'settlement') {
    const url = kind === 'loan' ? `/print/loans/${loan.id}` : `/print/settlements/${loan.id}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  function openWord(kind: 'loan' | 'settlement') {
    const url = kind === 'loan' ? `/api/loans/${loan.id}/word` : `/api/settlements/${loan.id}/word`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const reviewBadge = {
    PENDING:  { label: 'بانتظار المراجعة', cls: 'badge-neutral' },
    REVIEWED: { label: 'معتمدة',            cls: 'badge-primary' },
    RETURNED: { label: 'معادة للمراجعة',    cls: 'badge-warning' },
  }[loan.reviewStatus]

  return (
    <div className="form-page" dir="rtl">

      {/* Header */}
      <div className="form-page__header">
        <Link href="/" className="back-btn">
          <ChevronIcon /> الرئيسية
        </Link>
        <div>
          <h1 className="form-page__title">{loan.refNumber}</h1>
          <p className="form-page__sub">{loan.activity}</p>
        </div>
        <span className={`badge ${reviewBadge.cls}`}>{reviewBadge.label}</span>
      </div>

      <div className="form-page__body">

        {/* Toast */}
        {toast && (
          <div className="toast toast--success">{toast}</div>
        )}

        {/* مؤشر المهلة */}
        {deadline && !loan.isSettled && deadlineStatus && (
          <div className={`deadline-banner ${DEADLINE_STATUS_CONFIG[deadlineStatus].bg} ${DEADLINE_STATUS_CONFIG[deadlineStatus].border}`}>
            <span className="deadline-banner__icon">
              {deadlineStatus === 'overdue' ? '🚨' : deadlineStatus === 'critical' ? '⚠️' : '📅'}
            </span>
            <div>
              <span className={`deadline-banner__status ${DEADLINE_STATUS_CONFIG[deadlineStatus].color}`}>
                {DEADLINE_STATUS_CONFIG[deadlineStatus].label}
              </span>
              <span className="deadline-banner__detail">
                {daysLeft !== null && daysLeft >= 0
                  ? `تبقى ${daysLeft} أيام عمل — المهلة: ${deadline.toLocaleDateString('ar-SA')}`
                  : `تأخر ${Math.abs(daysLeft ?? 0)} أيام عمل — كانت المهلة: ${deadline.toLocaleDateString('ar-SA')}`
                }
              </span>
            </div>
          </div>
        )}

        {/* بيانات السلفة */}
        <div className="detail-card">
          <h2 className="detail-card__title">بيانات السلفة</h2>
          <div className="detail-grid">
            <DetailRow label="الموظف"         value={loan.employee} />
            <DetailRow label="النشاط"          value={loan.activity} />
            <DetailRow label="مكان التنفيذ"    value={loan.location ?? '—'} />
            <DetailRow label="فترة التنفيذ"    value={`${formatDate(loan.startDate)} — ${formatDate(loan.endDate)}`} />
            <DetailRow label="اعتماد الموازنة" value={loan.budgetApproved === true ? 'معتمدة' : loan.budgetApproved === false ? 'غير معتمدة' : '—'} />
            <DetailRow label="تصنيف الوجهة"   value={destMeta?.label ?? loan.destinationCategory} />
            <DetailRow label="مبلغ السلفة"     value={formatCurrencySar(loan.amount)} highlight />
            <DetailRow label="تاريخ الطلب"     value={formatDate(loan.createdAt)} />
            {loan.courseCode && (
              <DetailRow label="رمز الدورة" value={loan.courseCode} />
            )}
          </div>
        </div>

        {/* بنود الصرف */}
        <div className="detail-card">
          <h2 className="detail-card__title">أوجه الصرف</h2>
          <div className="items-table">
            <div className="items-table__head">
              <span>البند</span>
              <span>المبلغ</span>
            </div>
            {loan.items.map(item => (
              <div key={item.id} className="items-table__row">
                <span>{item.category}</span>
                <span className="items-table__amount">{formatCurrencySar(item.amount)}</span>
              </div>
            ))}
            <div className="items-table__total">
              <span>الإجمالي</span>
              <span>{formatCurrencySar(loan.amount)}</span>
            </div>
          </div>
        </div>

        {/* نتيجة التسوية إن وجدت */}
        {loan.settlement && (
          <div className="detail-card detail-card--settled">
            <h2 className="detail-card__title">نتيجة التسوية ✓</h2>
            <div className="settlement-summary">
              <SummaryPill label="مؤيد بمستندات"    value={formatCurrencySar(loan.settlement.supported)} />
              <SummaryPill label="غير مؤيد"          value={formatCurrencySar(loan.settlement.unsupported)} />
              <SummaryPill label="إجمالي المصروفات"  value={formatCurrencySar(loan.settlement.total)} />
              <SummaryPill label="الوفر"             value={formatCurrencySar(loan.settlement.savings)} color="success" />
              <SummaryPill label="الزيادة"           value={formatCurrencySar(loan.settlement.overage)} color="danger" />
            </div>
          </div>
        )}

        {/* ملاحظة المراجع */}
        {loan.reviewNote && (
          <div className="review-note">
            <span className="review-note__label">ملاحظة المراجع:</span>
            <span className="review-note__text">{loan.reviewNote}</span>
          </div>
        )}

        {error && <div className="form-error"><span>⚠</span> {error}</div>}

        {/* أزرار المراجعة */}
        {canReview && !loan.isSettled && (
          <div className="detail-card">
            <h2 className="detail-card__title">المراجعة والاعتماد</h2>

            {!showReviewForm ? (
              <div className="action-row">
                <button
                  type="button"
                  onClick={() => { setShowReviewForm(true) }}
                  className="btn btn--primary btn--md"
                >
                  اعتماد / إعادة للمراجعة
                </button>
                {deadlineStatus === 'overdue' && (
                  <button
                    type="button"
                    onClick={handleSendAlert}
                    disabled={isPending}
                    className="btn btn--warning btn--md"
                  >
                    إرسال إنذار للموظف
                  </button>
                )}
              </div>
            ) : (
              <div className="review-form">
                <label className="form-field">
                  <span className="form-field__label">ملاحظة (اختيارية عند الاعتماد، إلزامية عند الإعادة)</span>
                  <textarea
                    value={reviewNote}
                    onChange={e => setReviewNote(e.target.value)}
                    rows={3}
                    className="form-input"
                    placeholder="أدخل ملاحظتك..."
                  />
                </label>
                <div className="action-row">
                  <button
                    type="button"
                    onClick={() => handleReview('REVIEWED')}
                    disabled={isPending}
                    className="btn btn--primary btn--md"
                  >
                    ✓ اعتماد
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!reviewNote.trim()) { setError('أدخل ملاحظة الإعادة'); return }
                      handleReview('RETURNED')
                    }}
                    disabled={isPending}
                    className="btn btn--warning btn--md"
                  >
                    ↩ إعادة للمراجعة
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowReviewForm(false); setError('') }}
                    className="btn btn--ghost btn--md"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* الإجراءات الرئيسية */}
        <div className="actions-panel">

          {/* تسوية السلفة */}
          {!loan.isSettled && loan.reviewStatus === 'REVIEWED' && (
            <Link href={`/loans/${loan.id}/settle`} className="btn btn--primary btn--lg actions-panel__main">
              بدء تسوية السلفة ←
            </Link>
          )}

          {!loan.isSettled && loan.reviewStatus !== 'REVIEWED' && (
            <div className="pending-notice">
              بانتظار اعتماد المراجع قبل التسوية
            </div>
          )}

          {/* طباعة */}
          <div className="print-actions">
            <button type="button" onClick={() => openPrint('loan')} className="btn btn--ghost btn--md">
              🖨 طباعة نموذج 18
            </button>
            <button type="button" onClick={() => openWord('loan')} className="btn btn--ghost btn--md">
              📄 Word نموذج 18
            </button>
            {loan.isSettled && (
              <>
                <button type="button" onClick={() => openPrint('settlement')} className="btn btn--ghost btn--md">
                  🖨 طباعة نموذج 19
                </button>
                <button type="button" onClick={() => openWord('settlement')} className="btn btn--ghost btn--md">
                  📄 Word نموذج 19
                </button>
              </>
            )}
          </div>

          {/* تعديل وحذف */}
          {canEdit && (
            <div className="danger-actions">
              <Link href={`/loans/${loan.id}/edit`} className="btn btn--ghost btn--sm">
                تعديل الطلب
              </Link>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="btn btn--danger-ghost btn--sm"
              >
                حذف الطلب
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────
function DetailRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="detail-row">
      <span className="detail-row__label">{label}</span>
      <span className={`detail-row__value ${highlight ? 'detail-row__value--highlight' : ''}`}>{value}</span>
    </div>
  )
}

function SummaryPill({ label, value, color }: { label: string; value: string; color?: 'success' | 'danger' }) {
  return (
    <div className={`summary-pill ${color === 'success' ? 'summary-pill--success' : color === 'danger' ? 'summary-pill--danger' : ''}`}>
      <span className="summary-pill__label">{label}</span>
      <span className="summary-pill__value">{value}</span>
    </div>
  )
}

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

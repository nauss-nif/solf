'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  EXPENSE_CATEGORIES,
  LOAN_ATTACHMENT_DEFINITIONS,
  FILE_SIZE_LIMIT_BYTES,
  IMAGE_MAX_DIMENSION,
  IMAGE_TARGET_MAX_BYTES,
  type StoredFile,
  type LoanRequestFiles,
} from '@/lib/loan-form-options'
import {
  DESTINATION_CATEGORIES,
  calcSettlementDeadline,
  type DestinationCategory,
} from '@/lib/settlement-deadline'
import { formatCurrencySar, numberToArabicWords, formatEnglishNumber } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────
// File helpers
// ─────────────────────────────────────────────────────────────
async function optimizeImage(file: File): Promise<StoredFile> {
  const src = await new Promise<string>((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result ?? ''))
    r.onerror = () => rej(new Error('تعذر قراءة الصورة'))
    r.readAsDataURL(file)
  })
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const el = new window.Image()
    el.onload = () => res(el)
    el.onerror = () => rej(new Error('تعذر معالجة الصورة'))
    el.src = src
  })
  const max = Math.max(img.width, img.height)
  const ratio = max > IMAGE_MAX_DIMENSION ? IMAGE_MAX_DIMENSION / max : 1
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * ratio)
  canvas.height = Math.round(img.height * ratio)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  let q = 0.92
  let dataUrl = canvas.toDataURL('image/jpeg', q)
  while (dataUrl.length > IMAGE_TARGET_MAX_BYTES * 1.37 && q > 0.45) {
    q -= 0.08
    dataUrl = canvas.toDataURL('image/jpeg', q)
  }
  return { name: file.name.replace(/\.[^.]+$/, '') + '.jpg', type: 'image/jpeg', size: Math.round(dataUrl.length * 3 / 4), dataUrl }
}

async function fileToStored(file: File): Promise<StoredFile> {
  if (file.size > FILE_SIZE_LIMIT_BYTES) throw new Error('حجم الملف يتجاوز 12 ميجابايت')
  if (file.type.startsWith('image/')) return optimizeImage(file)
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result ?? ''))
    r.onerror = () => rej(new Error('تعذر قراءة الملف'))
    r.readAsDataURL(file)
  })
  return { name: file.name, type: file.type || 'application/octet-stream', size: file.size, dataUrl }
}

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
type ExpenseItem = { category: string; amount: string }

// ─────────────────────────────────────────────────────────────
// Component: Step indicator
// ─────────────────────────────────────────────────────────────
function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="step-indicator">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`step-dot ${i < current ? 'step-dot--done' : i === current ? 'step-dot--active' : ''}`}
        />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────
export default function NewLoanPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState(0) // 0: بيانات، 1: بنود، 2: مرفقات
  const [error, setError] = useState('')

  // بيانات الطلب
  const [activity, setActivity] = useState('')
  const [location, setLocation] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [budgetApproved, setBudgetApproved] = useState<boolean | null>(null)
  const [destinationCategory, setDestinationCategory] = useState<DestinationCategory>('DOMESTIC')

  // بنود الصرف
  const [expenses, setExpenses] = useState<ExpenseItem[]>([{ category: '', amount: '' }])

  // المرفقات
  const [attachments, setAttachments] = useState<Record<string, StoredFile | null>>({
    grandApproval: null,
    nomineeAdjustment: null,
  })

  const totalAmount = expenses.reduce((s, e) => s + (parseFloat(e.amount || '0') || 0), 0)

  // حساب المهلة المتوقعة
  const expectedDeadline = endDate
    ? calcSettlementDeadline(new Date(endDate), destinationCategory)
    : null

  // ─── Step 0: البيانات الأساسية ─────────────────────────────
  function validateStep0() {
    if (!activity.trim()) return 'أدخل اسم النشاط'
    if (!location.trim()) return 'أدخل مكان التنفيذ'
    if (!startDate) return 'حدد تاريخ البداية'
    if (!endDate) return 'حدد تاريخ النهاية'
    if (new Date(endDate) < new Date(startDate)) return 'تاريخ النهاية قبل البداية'
    if (budgetApproved === null) return 'حدد حالة اعتماد الموازنة'
    return ''
  }

  // ─── Step 1: بنود الصرف ────────────────────────────────────
  function validateStep1() {
    const clean = expenses.filter(e => e.category && parseFloat(e.amount || '0') > 0)
    if (clean.length === 0) return 'أضف بنداً واحداً على الأقل'
    return ''
  }

  // ─── Step 2: المرفقات ──────────────────────────────────────
  function validateStep2() {
    if (!attachments.grandApproval) return 'أرفق موافقة المعالي على الانتداب'
    return ''
  }

  function nextStep() {
    setError('')
    const validators = [validateStep0, validateStep1, validateStep2]
    const err = validators[step]()
    if (err) { setError(err); return }
    setStep(s => s + 1)
  }

  function prevStep() {
    setError('')
    setStep(s => s - 1)
  }

  async function handleAttachment(key: string, files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    try {
      const stored = await fileToStored(file)
      setAttachments(prev => ({ ...prev, [key]: stored }))
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر رفع الملف')
    }
  }

  async function submit() {
    const err = validateStep2()
    if (err) { setError(err); return }

    const items = expenses
      .map(e => ({ category: e.category.trim(), amount: parseFloat(e.amount || '0') || 0 }))
      .filter(e => e.category && e.amount > 0)

    startTransition(async () => {
      const res = await fetch('/api/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activity: activity.trim(),
          location: location.trim(),
          startDate,
          endDate,
          budgetApproved,
          destinationCategory,
          amount: totalAmount,
          items,
          files: attachments,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'تعذر حفظ الطلب')
        // إذا كان الخطأ سلفة نشطة، ارجع للداشبورد
        if (data.code === 'ACTIVE_LOAN_EXISTS') {
          router.push('/')
        }
        return
      }

      router.push(`/loans/${data.id}?success=created`)
    })
  }

  const destMeta = DESTINATION_CATEGORIES.find(d => d.value === destinationCategory)

  return (
    <div className="form-page" dir="rtl">

      {/* Header */}
      <div className="form-page__header">
        <Link href="/" className="back-btn">
          <BackIcon /> الرئيسية
        </Link>
        <div>
          <h1 className="form-page__title">طلب سلفة مؤقتة</h1>
          <p className="form-page__sub">نموذج 18</p>
        </div>
        <StepIndicator current={step} total={3} />
      </div>

      {/* Form Body */}
      <div className="form-page__body">

        {/* ── الخطوة 0: البيانات الأساسية ── */}
        {step === 0 && (
          <div className="form-section">
            <h2 className="form-section__title">بيانات النشاط</h2>

            <Field label="اسم النشاط *">
              <input
                value={activity}
                onChange={e => setActivity(e.target.value)}
                className="form-input"
                placeholder="مثال: دورة تدريبية في إدارة المشاريع"
              />
            </Field>

            <Field label="مكان التنفيذ *">
              <input
                value={location}
                onChange={e => setLocation(e.target.value)}
                className="form-input"
                placeholder="مثال: الرياض / دبي / باريس"
              />
            </Field>

            <div className="field-row">
              <Field label="تاريخ البداية *">
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="form-input"
                />
              </Field>
              <Field label="تاريخ النهاية *">
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="form-input"
                />
              </Field>
            </div>

            <Field label="تصنيف الوجهة *">
              <div className="dest-cards">
                {DESTINATION_CATEGORIES.map(d => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => setDestinationCategory(d.value)}
                    className={`dest-card ${destinationCategory === d.value ? 'dest-card--active' : ''}`}
                  >
                    <span className="dest-card__label">{d.label}</span>
                    <span className="dest-card__days">+{d.daysAfter} يوم إقفال</span>
                    <span className="dest-card__ex">{d.examples}</span>
                  </button>
                ))}
              </div>
            </Field>

            {/* مؤشر المهلة المتوقعة */}
            {expectedDeadline && (
              <div className="deadline-preview">
                <span className="deadline-preview__icon">📅</span>
                <div>
                  <span className="deadline-preview__label">المهلة المتوقعة للتسوية:</span>
                  <span className="deadline-preview__date">
                    {expectedDeadline.toLocaleDateString('ar-SA', {
                      year: 'numeric', month: 'long', day: 'numeric',
                    })}
                  </span>
                  <span className="deadline-preview__note">
                    (بعد نهاية المهمة + {destMeta?.daysAfter} أيام + 10 أيام عمل)
                  </span>
                </div>
              </div>
            )}

            <Field label="اعتماد الموازنة *">
              <div className="radio-group">
                <label className={`radio-card ${budgetApproved === true ? 'radio-card--active' : ''}`}>
                  <input
                    type="radio"
                    checked={budgetApproved === true}
                    onChange={() => setBudgetApproved(true)}
                    className="sr-only"
                  />
                  <span>✓ معتمدة في الموازنة</span>
                </label>
                <label className={`radio-card ${budgetApproved === false ? 'radio-card--active' : ''}`}>
                  <input
                    type="radio"
                    checked={budgetApproved === false}
                    onChange={() => setBudgetApproved(false)}
                    className="sr-only"
                  />
                  <span>✗ غير معتمدة</span>
                </label>
              </div>
            </Field>
          </div>
        )}

        {/* ── الخطوة 1: بنود الصرف ── */}
        {step === 1 && (
          <div className="form-section">
            <div className="form-section__head">
              <h2 className="form-section__title">أوجه الصرف</h2>
              <button
                type="button"
                onClick={() => setExpenses(prev => [...prev, { category: '', amount: '' }])}
                className="btn btn--primary btn--sm"
              >
                + إضافة بند
              </button>
            </div>

            <div className="expenses-list">
              {expenses.map((exp, i) => (
                <div key={i} className="expense-row">
                  <select
                    value={exp.category}
                    onChange={e => setExpenses(prev => prev.map((x, j) => j === i ? { ...x, category: e.target.value } : x))}
                    className="form-input expense-cat"
                  >
                    <option value="">اختر البند...</option>
                    {EXPENSE_CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={exp.amount}
                    onChange={e => setExpenses(prev => prev.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))}
                    placeholder="المبلغ"
                    className="form-input expense-amt"
                  />
                  {expenses.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setExpenses(prev => prev.filter((_, j) => j !== i))}
                      className="expense-remove"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* ملخص */}
            {totalAmount > 0 && (
              <div className="amount-summary">
                <div className="amount-summary__row">
                  <span>الإجمالي رقماً</span>
                  <span className="amount-summary__val">
                    {formatEnglishNumber(totalAmount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س
                  </span>
                </div>
                <div className="amount-summary__row amount-summary__words">
                  <span>كتابة</span>
                  <span>{numberToArabicWords(totalAmount)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── الخطوة 2: المرفقات ── */}
        {step === 2 && (
          <div className="form-section">
            <h2 className="form-section__title">المرفقات</h2>
            <p className="form-section__hint">
              يمكنك التقاط صورة مباشرة من كاميرا جوالك
            </p>

            {LOAN_ATTACHMENT_DEFINITIONS.map(att => {
              const file = attachments[att.key]
              return (
                <div key={att.key} className="attachment-card">
                  <div className="attachment-card__info">
                    <span className={`attachment-card__label ${att.required ? 'required' : ''}`}>
                      {att.label}
                      {att.required && <span className="required-star"> *</span>}
                    </span>
                    {file ? (
                      <span className="attachment-card__file">
                        ✓ {file.name} ({Math.round(file.size / 1024)} KB)
                      </span>
                    ) : (
                      <span className="attachment-card__empty">لم يُرفق ملف</span>
                    )}
                  </div>

                  <div className="attachment-card__actions">
                    {/* زر الكاميرا — للجوال */}
                    <label className="btn btn--primary btn--sm attach-btn">
                      <CameraIcon />
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="sr-only"
                        onChange={e => void handleAttachment(att.key, e.target.files)}
                      />
                      كاميرا
                    </label>

                    {/* زر رفع ملف */}
                    <label className="btn btn--ghost btn--sm attach-btn">
                      <UploadIcon />
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        className="sr-only"
                        onChange={e => void handleAttachment(att.key, e.target.files)}
                      />
                      ملف
                    </label>

                    {file && (
                      <button
                        type="button"
                        onClick={() => setAttachments(prev => ({ ...prev, [att.key]: null }))}
                        className="btn btn--danger-ghost btn--sm"
                      >
                        إزالة
                      </button>
                    )}
                  </div>

                  {/* معاينة الصورة */}
                  {file?.type.startsWith('image/') && (
                    <img
                      src={file.dataUrl}
                      alt={att.label}
                      className="attachment-preview-img"
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* خطأ */}
        {error && (
          <div className="form-error">
            <span>⚠</span> {error}
          </div>
        )}

        {/* أزرار التنقل */}
        <div className="form-nav">
          {step > 0 && (
            <button type="button" onClick={prevStep} className="btn btn--ghost btn--md">
              السابق
            </button>
          )}
          {step < 2 ? (
            <button type="button" onClick={nextStep} className="btn btn--primary btn--md form-nav__next">
              التالي
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={isPending}
              className="btn btn--primary btn--md form-nav__next"
            >
              {isPending ? 'جاري الإرسال...' : 'إرسال الطلب'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="form-field">
      <span className="form-field__label">{label}</span>
      {children}
    </label>
  )
}

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function CameraIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}

function UploadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

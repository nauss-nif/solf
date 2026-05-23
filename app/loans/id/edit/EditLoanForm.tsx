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
} from '@/lib/loan-form-options'
import {
  DESTINATION_CATEGORIES,
  calcSettlementDeadline,
  type DestinationCategory,
} from '@/lib/settlement-deadline'
import { formatCurrencySar, numberToArabicWords, formatEnglishNumber } from '@/lib/utils'

type LoanItem = { id: string; category: string; amount: number }
type ExpenseItem = { category: string; amount: string }

type LoanData = {
  id: string
  refNumber: string
  activity: string
  location: string
  startDate: string
  endDate: string
  budgetApproved: boolean | null
  destinationCategory: DestinationCategory
  amount: number
  items: LoanItem[]
  files: Record<string, StoredFile | null> | null
}

async function optimizeImage(file: File): Promise<StoredFile> {
  const src = await new Promise<string>((res, rej) => {
    const r = new FileReader(); r.onload = () => res(String(r.result ?? '')); r.onerror = () => rej(new Error('خطأ')); r.readAsDataURL(file)
  })
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const el = new window.Image(); el.onload = () => res(el); el.onerror = () => rej(new Error('خطأ')); el.src = src
  })
  const max = Math.max(img.width, img.height)
  const ratio = max > IMAGE_MAX_DIMENSION ? IMAGE_MAX_DIMENSION / max : 1
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * ratio); canvas.height = Math.round(img.height * ratio)
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
  let q = 0.92; let dataUrl = canvas.toDataURL('image/jpeg', q)
  while (dataUrl.length > IMAGE_TARGET_MAX_BYTES * 1.37 && q > 0.45) { q -= 0.08; dataUrl = canvas.toDataURL('image/jpeg', q) }
  return { name: file.name.replace(/\.[^.]+$/, '') + '.jpg', type: 'image/jpeg', size: Math.round(dataUrl.length * 3 / 4), dataUrl }
}

async function fileToStored(file: File): Promise<StoredFile> {
  if (file.size > FILE_SIZE_LIMIT_BYTES) throw new Error('حجم الملف يتجاوز 12 ميجابايت')
  if (file.type.startsWith('image/')) return optimizeImage(file)
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader(); r.onload = () => res(String(r.result ?? '')); r.onerror = () => rej(new Error('خطأ')); r.readAsDataURL(file)
  })
  return { name: file.name, type: file.type || 'application/octet-stream', size: file.size, dataUrl }
}

export default function EditLoanForm({ loan }: { loan: LoanData }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const [activity, setActivity] = useState(loan.activity)
  const [location, setLocation] = useState(loan.location)
  const [startDate, setStartDate] = useState(loan.startDate)
  const [endDate, setEndDate] = useState(loan.endDate)
  const [budgetApproved, setBudgetApproved] = useState<boolean | null>(loan.budgetApproved)
  const [destinationCategory, setDestinationCategory] = useState<DestinationCategory>(loan.destinationCategory)
  const [expenses, setExpenses] = useState<ExpenseItem[]>(
    loan.items.length > 0
      ? loan.items.map(i => ({ category: i.category, amount: String(i.amount) }))
      : [{ category: '', amount: '' }]
  )
  const [attachments, setAttachments] = useState<Record<string, StoredFile | null>>({
    grandApproval: loan.files?.grandApproval ?? null,
    nomineeAdjustment: loan.files?.nomineeAdjustment ?? null,
  })

  const totalAmount = expenses.reduce((s, e) => s + (parseFloat(e.amount || '0') || 0), 0)

  const expectedDeadline = endDate
    ? calcSettlementDeadline(new Date(endDate), destinationCategory)
    : null

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
    if (!activity.trim()) { setError('أدخل اسم النشاط'); return }
    if (!location.trim()) { setError('أدخل مكان التنفيذ'); return }
    if (!startDate || !endDate) { setError('حدد تواريخ التنفيذ'); return }
    if (budgetApproved === null) { setError('حدد حالة اعتماد الموازنة'); return }
    if (!attachments.grandApproval) { setError('أرفق موافقة المعالي على الانتداب'); return }

    const items = expenses
      .map(e => ({ category: e.category.trim(), amount: parseFloat(e.amount || '0') || 0 }))
      .filter(e => e.category && e.amount > 0)

    if (items.length === 0) { setError('أضف بنداً واحداً على الأقل'); return }

    startTransition(async () => {
      const res = await fetch(`/api/loans/${loan.id}`, {
        method: 'PATCH',
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
      if (!res.ok) { setError(data.error ?? 'تعذر تحديث الطلب'); return }
      router.push(`/loans/${loan.id}?success=updated`)
    })
  }

  const destMeta = DESTINATION_CATEGORIES.find(d => d.value === destinationCategory)

  return (
    <div className="form-page" dir="rtl">
      <div className="form-page__header">
        <Link href={`/loans/${loan.id}`} className="back-btn">
          <ChevronIcon /> تفاصيل السلفة
        </Link>
        <div>
          <h1 className="form-page__title">تعديل السلفة</h1>
          <p className="form-page__sub">{loan.refNumber}</p>
        </div>
      </div>

      <div className="form-page__body">

        <div className="form-section">
          <h2 className="form-section__title">بيانات النشاط</h2>

          <Field label="اسم النشاط *">
            <input value={activity} onChange={e => setActivity(e.target.value)} className="form-input" />
          </Field>

          <Field label="مكان التنفيذ *">
            <input value={location} onChange={e => setLocation(e.target.value)} className="form-input" />
          </Field>

          <div className="field-row">
            <Field label="تاريخ البداية *">
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="form-input" />
            </Field>
            <Field label="تاريخ النهاية *">
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="form-input" />
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

          {expectedDeadline && (
            <div className="deadline-preview">
              <span className="deadline-preview__icon">📅</span>
              <div>
                <span className="deadline-preview__label">المهلة المتوقعة للتسوية:</span>
                <span className="deadline-preview__date">
                  {expectedDeadline.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}
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
                <input type="radio" checked={budgetApproved === true} onChange={() => setBudgetApproved(true)} className="sr-only" />
                <span>✓ معتمدة في الموازنة</span>
              </label>
              <label className={`radio-card ${budgetApproved === false ? 'radio-card--active' : ''}`}>
                <input type="radio" checked={budgetApproved === false} onChange={() => setBudgetApproved(false)} className="sr-only" />
                <span>✗ غير معتمدة</span>
              </label>
            </div>
          </Field>
        </div>

        {/* بنود الصرف */}
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
                  {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input
                  type="number" min="0" step="0.01"
                  value={exp.amount}
                  onChange={e => setExpenses(prev => prev.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))}
                  placeholder="المبلغ"
                  className="form-input expense-amt"
                />
                {expenses.length > 1 && (
                  <button type="button" onClick={() => setExpenses(prev => prev.filter((_, j) => j !== i))} className="expense-remove">×</button>
                )}
              </div>
            ))}
          </div>

          {totalAmount > 0 && (
            <div className="amount-summary">
              <div className="amount-summary__row">
                <span>الإجمالي رقماً</span>
                <span className="amount-summary__val">{formatEnglishNumber(totalAmount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س</span>
              </div>
              <div className="amount-summary__row amount-summary__words">
                <span>كتابة</span>
                <span>{numberToArabicWords(totalAmount)}</span>
              </div>
            </div>
          )}
        </div>

        {/* المرفقات */}
        <div className="form-section">
          <h2 className="form-section__title">المرفقات</h2>
          {LOAN_ATTACHMENT_DEFINITIONS.map(att => {
            const file = attachments[att.key]
            return (
              <div key={att.key} className="attachment-card">
                <div className="attachment-card__info">
                  <span className={`attachment-card__label ${att.required ? 'required' : ''}`}>
                    {att.label}{att.required && <span className="required-star"> *</span>}
                  </span>
                  {file
                    ? <span className="attachment-card__file">✓ {file.name} ({Math.round(file.size / 1024)} KB)</span>
                    : <span className="attachment-card__empty">لم يُرفق ملف</span>
                  }
                </div>
                <div className="attachment-card__actions">
                  <label className="btn btn--primary btn--sm attach-btn">
                    <CameraIcon />
                    <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={e => void handleAttachment(att.key, e.target.files)} />
                    كاميرا
                  </label>
                  <label className="btn btn--ghost btn--sm attach-btn">
                    <UploadIcon />
                    <input type="file" accept=".pdf,image/*" className="sr-only" onChange={e => void handleAttachment(att.key, e.target.files)} />
                    ملف
                  </label>
                  {file && (
                    <button type="button" onClick={() => setAttachments(prev => ({ ...prev, [att.key]: null }))} className="btn btn--danger-ghost btn--sm">
                      إزالة
                    </button>
                  )}
                </div>
                {file?.type.startsWith('image/') && (
                  <img src={file.dataUrl} alt={att.label} className="attachment-preview-img" />
                )}
              </div>
            )
          })}
        </div>

        {error && <div className="form-error"><span>⚠</span> {error}</div>}

        <div className="form-nav">
          <Link href={`/loans/${loan.id}`} className="btn btn--ghost btn--md">إلغاء</Link>
          <button type="button" onClick={submit} disabled={isPending} className="btn btn--primary btn--md form-nav__next">
            {isPending ? 'جاري الحفظ...' : 'حفظ التعديلات'}
          </button>
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

function ChevronIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
}
function CameraIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
}
function UploadIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
}

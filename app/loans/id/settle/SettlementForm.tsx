'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  EXPENSE_CATEGORIES,
  SETTLEMENT_DOCUMENT_TYPES,
  CURRENCY_OPTIONS,
  FILE_SIZE_LIMIT_BYTES,
  IMAGE_MAX_DIMENSION,
  IMAGE_TARGET_MAX_BYTES,
  type StoredFile,
  type CurrencyCode,
  type SettlementDocumentType,
  type SettlementCurrencyRate,
} from '@/lib/loan-form-options'
import { formatCurrencySar, formatEnglishNumber } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
type LoanItem = { id: string; category: string; amount: number }

type Loan = {
  id: string
  refNumber: string
  employee: string
  activity: string
  amount: number
  startDate: string
  endDate: string
  items: LoanItem[]
}

type InvoiceDraft = {
  amount: string
  currencyCode: CurrencyCode
  exchangeRate: string
  sarAmount: number
  documentType: SettlementDocumentType
  invoiceDate: string
  issuer: string
  attachment: StoredFile | null
}

type SettlementItem = {
  id: string
  category: string
  budget: number
  invoices: InvoiceDraft[]
  isAdditional: boolean
}

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
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
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
// Helpers
// ─────────────────────────────────────────────────────────────
function isPettyCash(category: string) { return category.includes('نثريات') }

function createInvoice(currency: CurrencyCode = 'SAR'): InvoiceDraft {
  return { amount: '', currencyCode: currency, exchangeRate: '1', sarAmount: 0, documentType: 'إيصال', invoiceDate: '', issuer: '', attachment: null }
}

function createItem(category: string, budget: number, isAdditional = false): SettlementItem {
  return { id: crypto.randomUUID(), category, budget, invoices: [createInvoice()], isAdditional }
}

function calcSar(amount: string, currencyCode: CurrencyCode, rateMap: Map<CurrencyCode, number>): number {
  const n = parseFloat(amount || '0') || 0
  const rate = currencyCode === 'SAR' ? 1 : (rateMap.get(currencyCode) ?? 0)
  return n * rate
}

// ─────────────────────────────────────────────────────────────
// Step Indicator
// ─────────────────────────────────────────────────────────────
function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="step-indicator">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`step-dot ${i < current ? 'step-dot--done' : i === current ? 'step-dot--active' : ''}`} />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main Settlement Form
// ─────────────────────────────────────────────────────────────
export default function SettlementForm({ loan }: { loan: Loan }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState(0) // 0: عملات، 1: فواتير، 2: ملخص
  const [error, setError] = useState('')

  // أسعار الصرف
  const [rates, setRates] = useState<SettlementCurrencyRate[]>([{ currencyCode: 'USD', rate: 3.75 }])

  // بنود التسوية
  const [items, setItems] = useState<SettlementItem[]>(
    loan.items.map(item => createItem(item.category, item.amount))
  )

  // بيانات إضافية
  const [receiptNumber, setReceiptNumber] = useState('')
  const [receiptDate, setReceiptDate] = useState('')
  const [overageReason, setOverageReason] = useState('')

  // rateMap
  const rateMap = useMemo(() => {
    const map = new Map<CurrencyCode, number>()
    map.set('SAR', 1)
    rates.forEach(r => { if (r.rate > 0) map.set(r.currencyCode, r.rate) })
    return map
  }, [rates])

  // ملخص الأرقام
  const summary = useMemo(() => {
    let supported = 0, unsupported = 0
    items.forEach(item => {
      const total = item.invoices.reduce((s, inv) => s + inv.sarAmount, 0)
      if (isPettyCash(item.category)) unsupported += total
      else supported += total
    })
    const total = supported + unsupported
    return {
      supported, unsupported, total,
      savings: Math.max(0, loan.amount - total),
      overage: Math.max(0, total - loan.amount),
    }
  }, [items, loan.amount])

  // ─── تحديث الفاتورة ────────────────────────────────────────
  function updateInvoice(itemIdx: number, invIdx: number, field: keyof InvoiceDraft, value: string) {
    setItems(prev => prev.map((item, i) => {
      if (i !== itemIdx) return item
      return {
        ...item,
        invoices: item.invoices.map((inv, j) => {
          if (j !== invIdx) return inv
          const next = { ...inv, [field]: value } as InvoiceDraft
          next.sarAmount = calcSar(
            field === 'amount' ? value : next.amount,
            field === 'currencyCode' ? value as CurrencyCode : next.currencyCode,
            rateMap,
          )
          return next
        }),
      }
    }))
  }

  async function uploadInvoiceFile(itemIdx: number, invIdx: number, files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    const item = items[itemIdx]
    if (item && isPettyCash(item.category) && !file.type.startsWith('image/')) {
      setError('في بند النثريات يجب إرفاق الموافقة كصورة فقط')
      return
    }
    try {
      const stored = await fileToStored(file)
      setItems(prev => prev.map((item, i) => {
        if (i !== itemIdx) return item
        return {
          ...item,
          invoices: item.invoices.map((inv, j) =>
            j === invIdx ? { ...inv, attachment: stored } : inv
          ),
        }
      }))
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر رفع الملف')
    }
  }

  // ─── Validation ────────────────────────────────────────────
  function validateStep0() {
    if (rates.some(r => r.rate <= 0)) return 'أكمل أسعار الصرف'
    return ''
  }

  function validateStep1() {
    for (const item of items) {
      for (const inv of item.invoices) {
        const amt = parseFloat(inv.amount || '0') || 0
        if (amt <= 0) continue
        if (!isPettyCash(item.category)) {
          if (!inv.invoiceDate) return `حدد تاريخ الفاتورة في بند "${item.category}"`
          if (!inv.issuer.trim()) return `أدخل الجهة المصدرة في بند "${item.category}"`
          if (!inv.attachment) return `أرفق صورة الفاتورة في بند "${item.category}"`
        }
      }
    }
    const hasContent = items.some(item =>
      item.invoices.some(inv => (parseFloat(inv.amount || '0') || 0) > 0)
    )
    if (!hasContent) return 'أضف فاتورة واحدة على الأقل'
    return ''
  }

  function validateStep2() {
    if (summary.overage > 0 && !overageReason.trim()) return 'أدخل مبرر الزيادة'
    if (summary.savings > 0 && !receiptNumber.trim()) return 'أدخل رقم سند القبض'
    if (summary.savings > 0 && !receiptDate) return 'أدخل تاريخ سند القبض'
    return ''
  }

  function nextStep() {
    setError('')
    const validators = [validateStep0, validateStep1, validateStep2]
    const err = validators[step]?.()
    if (err) { setError(err); return }
    setStep(s => s + 1)
  }

  // ─── Submit ─────────────────────────────────────────────────
  function submit() {
    const err = validateStep2()
    if (err) { setError(err); return }

    const details = items
      .filter(item => item.invoices.some(inv => (parseFloat(inv.amount || '0') || 0) > 0))
      .map(item => ({
        category: item.category,
        budget: item.budget,
        invoices: item.invoices
          .filter(inv => (parseFloat(inv.amount || '0') || 0) > 0)
          .map(inv => ({
            amount: parseFloat(inv.amount || '0') || 0,
            currencyCode: inv.currencyCode,
            exchangeRate: rateMap.get(inv.currencyCode) ?? 1,
            sar: inv.sarAmount,
            documentType: inv.documentType,
            invoiceDate: isPettyCash(item.category) ? '' : inv.invoiceDate,
            issuer: isPettyCash(item.category) ? '' : inv.issuer.trim(),
            attachment: inv.attachment,
          })),
      }))

    const pettyCashItem = items.find(i => isPettyCash(i.category))
    const pettyCashApproval = pettyCashItem?.invoices.find(inv => inv.attachment)?.attachment ?? null

    startTransition(async () => {
      const res = await fetch('/api/settlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loanId: loan.id,
          supported: summary.supported,
          unsupported: summary.unsupported,
          total: summary.total,
          savings: summary.savings,
          overage: summary.overage,
          currencyRates: rates,
          details,
          receiptNumber: receiptNumber.trim(),
          receiptDate,
          overageReason: overageReason.trim(),
          pettyCashApproval,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'تعذر حفظ التسوية')
        return
      }
      router.push(`/loans/${loan.id}?success=settled`)
    })
  }

  const stepTitles = ['أسعار الصرف', 'الفواتير والمرفقات', 'المراجعة والإرسال']

  return (
    <div className="form-page" dir="rtl">

      {/* Header */}
      <div className="form-page__header">
        <Link href={`/loans/${loan.id}`} className="back-btn">
          <ChevronIcon /> تفاصيل السلفة
        </Link>
        <div>
          <h1 className="form-page__title">تسوية السلفة</h1>
          <p className="form-page__sub">{loan.refNumber} — {loan.activity}</p>
        </div>
        <StepIndicator current={step} total={3} />
      </div>

      <div className="form-page__body">

        {/* ملخص السلفة */}
        <div className="settle-summary-bar">
          <div className="settle-summary-bar__item">
            <span>مبلغ السلفة</span>
            <strong>{formatCurrencySar(loan.amount)}</strong>
          </div>
          <div className="settle-summary-bar__item">
            <span>المصروف</span>
            <strong className={summary.overage > 0 ? 'text-danger' : 'text-primary'}>
              {formatCurrencySar(summary.total)}
            </strong>
          </div>
          <div className="settle-summary-bar__item">
            <span>{summary.savings > 0 ? 'الوفر' : 'الزيادة'}</span>
            <strong className={summary.savings > 0 ? 'text-success' : 'text-danger'}>
              {formatCurrencySar(summary.savings > 0 ? summary.savings : summary.overage)}
            </strong>
          </div>
        </div>

        {/* ── الخطوة 0: أسعار الصرف ── */}
        {step === 0 && (
          <div className="form-section">
            <div className="form-section__head">
              <h2 className="form-section__title">العملات وأسعار الصرف</h2>
              <button
                type="button"
                onClick={() => setRates(prev => [...prev, { currencyCode: 'EUR', rate: 0 }])}
                className="btn btn--primary btn--sm"
              >
                + إضافة عملة
              </button>
            </div>

            <p className="form-section__hint">
              أضف العملات المستخدمة في الفواتير مع سعر الصرف من البنك المركزي السعودي
            </p>

            {rates.length === 0 && (
              <div className="empty-hint">لا توجد عملات — إذا كانت جميع الفواتير بالريال تجاوز هذه الخطوة</div>
            )}

            {rates.map((rate, i) => (
              <div key={i} className="expense-row">
                <select
                  value={rate.currencyCode}
                  onChange={e => setRates(prev => prev.map((r, j) => j === i ? { ...r, currencyCode: e.target.value as CurrencyCode } : r))}
                  className="form-input"
                >
                  {CURRENCY_OPTIONS.filter(c => c.code !== 'SAR').map(c => (
                    <option key={c.code} value={c.code}>{c.label} ({c.symbol})</option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.0001"
                  value={rate.rate || ''}
                  onChange={e => setRates(prev => prev.map((r, j) => j === i ? { ...r, rate: parseFloat(e.target.value || '0') || 0 } : r))}
                  placeholder="سعر الصرف"
                  className="form-input expense-amt"
                />
                <button
                  type="button"
                  onClick={() => setRates(prev => prev.filter((_, j) => j !== i))}
                  className="expense-remove"
                >×</button>
              </div>
            ))}
          </div>
        )}

        {/* ── الخطوة 1: الفواتير ── */}
        {step === 1 && (
          <div className="form-section">
            <div className="form-section__head">
              <h2 className="form-section__title">الفواتير والمرفقات</h2>
              <button
                type="button"
                onClick={() => setItems(prev => [...prev, createItem('', 0, true)])}
                className="btn btn--ghost btn--sm"
              >
                + بند إضافي
              </button>
            </div>

            {items.map((item, itemIdx) => (
              <div key={item.id} className="invoice-section">
                <div className="invoice-section__head">
                  {item.isAdditional ? (
                    <input
                      value={item.category}
                      onChange={e => setItems(prev => prev.map((x, i) => i === itemIdx ? { ...x, category: e.target.value } : x))}
                      placeholder="اسم البند الإضافي"
                      className="form-input"
                    />
                  ) : (
                    <h3 className="invoice-section__title">{item.category}</h3>
                  )}
                  <div className="invoice-section__meta">
                    {item.budget > 0 && <span className="budget-badge">المعتمد: {formatCurrencySar(item.budget)}</span>}
                    <button
                      type="button"
                      onClick={() => setItems(prev => prev.map((x, i) => i === itemIdx ? { ...x, invoices: [...x.invoices, createInvoice('SAR')] } : x))}
                      className="btn btn--ghost btn--sm"
                    >
                      + فاتورة
                    </button>
                    {item.isAdditional && (
                      <button
                        type="button"
                        onClick={() => setItems(prev => prev.filter((_, i) => i !== itemIdx))}
                        className="btn btn--danger-ghost btn--sm"
                      >
                        حذف
                      </button>
                    )}
                  </div>
                </div>

                {item.invoices.map((inv, invIdx) => (
                  <div key={invIdx} className="invoice-row">
                    {/* المبلغ والعملة */}
                    <div className="invoice-row__amounts">
                      <input
                        type="number"
                        step="0.01"
                        value={inv.amount}
                        onChange={e => updateInvoice(itemIdx, invIdx, 'amount', e.target.value)}
                        placeholder="المبلغ"
                        className="form-input"
                      />
                      <select
                        value={inv.currencyCode}
                        onChange={e => updateInvoice(itemIdx, invIdx, 'currencyCode', e.target.value)}
                        className="form-input"
                      >
                        <option value="SAR">ريال (ر.س)</option>
                        {rates.map((r, i) => (
                          <option key={i} value={r.currencyCode}>{r.currencyCode}</option>
                        ))}
                      </select>
                      {inv.sarAmount > 0 && inv.currencyCode !== 'SAR' && (
                        <div className="sar-equiv">= {formatCurrencySar(inv.sarAmount)}</div>
                      )}
                    </div>

                    {/* تفاصيل الفاتورة (ليس نثريات) */}
                    {!isPettyCash(item.category) && (
                      <div className="invoice-row__details">
                        <select
                          value={inv.documentType}
                          onChange={e => updateInvoice(itemIdx, invIdx, 'documentType', e.target.value)}
                          className="form-input"
                        >
                          {SETTLEMENT_DOCUMENT_TYPES.map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                        <input
                          type="date"
                          value={inv.invoiceDate}
                          onChange={e => updateInvoice(itemIdx, invIdx, 'invoiceDate', e.target.value)}
                          className="form-input"
                        />
                        <input
                          value={inv.issuer}
                          onChange={e => updateInvoice(itemIdx, invIdx, 'issuer', e.target.value)}
                          placeholder="الجهة المصدرة"
                          className="form-input"
                        />
                      </div>
                    )}

                    {/* المرفق */}
                    <div className="attachment-card">
                      <div className="attachment-card__info">
                        <span className="attachment-card__label">
                          {isPettyCash(item.category) ? 'موافقة المعالي (صورة) *' : 'صورة الفاتورة *'}
                        </span>
                        {inv.attachment ? (
                          <span className="attachment-card__file">✓ {inv.attachment.name}</span>
                        ) : (
                          <span className="attachment-card__empty">لم يُرفق</span>
                        )}
                      </div>
                      <div className="attachment-card__actions">
                        <label className="btn btn--primary btn--sm attach-btn">
                          <CameraIcon />
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="sr-only"
                            onChange={e => void uploadInvoiceFile(itemIdx, invIdx, e.target.files)}
                          />
                          كاميرا
                        </label>
                        {!isPettyCash(item.category) && (
                          <label className="btn btn--ghost btn--sm attach-btn">
                            <UploadIcon />
                            <input
                              type="file"
                              accept=".pdf,image/*"
                              className="sr-only"
                              onChange={e => void uploadInvoiceFile(itemIdx, invIdx, e.target.files)}
                            />
                            ملف
                          </label>
                        )}
                        {inv.attachment && (
                          <button
                            type="button"
                            onClick={() => setItems(prev => prev.map((x, i) => i !== itemIdx ? x : {
                              ...x,
                              invoices: x.invoices.map((iv, j) => j === invIdx ? { ...iv, attachment: null } : iv),
                            }))}
                            className="btn btn--danger-ghost btn--sm"
                          >
                            إزالة
                          </button>
                        )}
                      </div>
                      {inv.attachment?.type.startsWith('image/') && (
                        <img src={inv.attachment.dataUrl} alt="" className="attachment-preview-img" />
                      )}
                    </div>

                    {/* حذف الفاتورة */}
                    {item.invoices.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setItems(prev => prev.map((x, i) => i !== itemIdx ? x : {
                          ...x,
                          invoices: x.invoices.filter((_, j) => j !== invIdx),
                        }))}
                        className="btn btn--danger-ghost btn--sm"
                      >
                        حذف الفاتورة
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* ── الخطوة 2: المراجعة والإرسال ── */}
        {step === 2 && (
          <div className="form-section">
            <h2 className="form-section__title">مراجعة التسوية</h2>

            {/* ملخص */}
            <div className="final-summary">
              <SummaryRow label="المصروفات المؤيدة بمستندات"      value={formatCurrencySar(summary.supported)} />
              <SummaryRow label="المصروفات غير المؤيدة بمستندات" value={formatCurrencySar(summary.unsupported)} />
              <SummaryRow label="إجمالي المصروفات"                value={formatCurrencySar(summary.total)} bold />
              <SummaryRow label="مبلغ السلفة"                     value={formatCurrencySar(loan.amount)} />
              {summary.savings > 0 && (
                <SummaryRow label="وفر السلفة" value={formatCurrencySar(summary.savings)} color="success" />
              )}
              {summary.overage > 0 && (
                <SummaryRow label="زيادة على السلفة" value={formatCurrencySar(summary.overage)} color="danger" />
              )}
            </div>

            {/* سند القبض (عند وجود وفر) */}
            {summary.savings > 0 && (
              <div className="receipt-section">
                <h3 className="receipt-section__title">سند القبض — الوفر المُستردّ</h3>
                <div className="field-row">
                  <label className="form-field">
                    <span className="form-field__label">رقم سند القبض *</span>
                    <input
                      value={receiptNumber}
                      onChange={e => setReceiptNumber(e.target.value)}
                      className="form-input"
                      placeholder="رقم السند"
                    />
                  </label>
                  <label className="form-field">
                    <span className="form-field__label">تاريخ سند القبض *</span>
                    <input
                      type="date"
                      value={receiptDate}
                      onChange={e => setReceiptDate(e.target.value)}
                      className="form-input"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* مبرر الزيادة */}
            {summary.overage > 0 && (
              <label className="form-field">
                <span className="form-field__label">مبرر الزيادة على مبلغ السلفة *</span>
                <textarea
                  value={overageReason}
                  onChange={e => setOverageReason(e.target.value)}
                  rows={3}
                  className="form-input"
                  placeholder="اذكر سبب تجاوز المبلغ المعتمد..."
                />
              </label>
            )}
          </div>
        )}

        {error && <div className="form-error"><span>⚠</span> {error}</div>}

        {/* أزرار التنقل */}
        <div className="form-nav">
          {step > 0 && (
            <button type="button" onClick={() => { setError(''); setStep(s => s - 1) }} className="btn btn--ghost btn--md">
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
              className="btn btn--primary btn--lg form-nav__next"
            >
              {isPending ? 'جاري الحفظ...' : 'حفظ التسوية'}
            </button>
          )}
        </div>

      </div>
    </div>
  )
}

// Sub-components
function SummaryRow({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: 'success' | 'danger' }) {
  return (
    <div className={`summary-row ${bold ? 'summary-row--bold' : ''}`}>
      <span>{label}</span>
      <span className={color === 'success' ? 'text-success' : color === 'danger' ? 'text-danger' : ''}>{value}</span>
    </div>
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

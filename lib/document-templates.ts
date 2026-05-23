import { readFile } from 'node:fs/promises'
import path from 'node:path'
import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'
import { type SettlementDetailRecord, type StoredFile } from '@/lib/loan-form-options'
import { formatEnglishNumber, numberToArabicWords } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
type LoanItemLike = { category: string; amount: number }

type SettlementInvoiceLike = {
  amount?: number
  currency?: string
  currencyCode?: string
  exchangeRate?: number
  sar?: number
  type?: string
  documentType?: string
  date?: string
  invoiceDate?: string
  issuer?: string
  attachment?: StoredFile | null
}

type SettlementDetailLike = {
  category?: string
  budget?: number
  invoices?: SettlementInvoiceLike[]
}

type SettlementLike = {
  supported: number
  unsupported: number
  total: number
  savings: number
  overage: number
  invoices?: unknown
}

type SettlementMetaLike = {
  receiptNumber?: string
  receiptDate?: string
  overageReason?: string
  pettyCashApproval?: StoredFile | null
}

export type LoanDocumentRecord = {
  id: string
  refNumber: string
  employee: string
  activity: string
  location: string | null
  amount: number
  budgetApproved?: boolean | null
  files?: unknown
  startDate: Date | string
  endDate: Date | string
  createdAt: Date | string
  items: LoanItemLike[]
  settlement?: SettlementLike | null
}

type LoanTemplateRow = {
  index: number
  amount: string
  category: string
  notes: string
}

type SettlementTemplateRow = {
  index: number
  category: string
  amount: string
  documentType: string
  documentDate: string
  issuer: string
}

type TemplateReplacement = { find: string; replace: string }

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────
const TEMPLATE_DIRECTORY = path.join(process.cwd(), 'templates')
const LOAN_TEMPLATE_PATH = path.join(TEMPLATE_DIRECTORY, 'loan-form-18.docx')
const SETTLEMENT_TEMPLATE_PATH = path.join(TEMPLATE_DIRECTORY, 'settlement-form-19.docx')

const LOAN_TEMPLATE_REPLACEMENTS: TemplateReplacement[] = [
  { find: '??? ?????: {referenceNumber}', replace: 'رقم مرجعي: {referenceNumber}' },
  { find: '???? ?????? ?????: {amountNumber}', replace: 'مبلغ السلفة رقماً: {amountNumber}' },
  { find: '?????: {amountWords} ????', replace: 'كتابة: {amountWords} ريال' },
  { find: '??? ??????: {activity}', replace: 'اسم النشاط: {activity}' },
  { find: '???? ????? ??????: ?? {startDate} ??? {endDate}', replace: 'فترة تنفيذ النشاط: من {startDate} إلى {endDate}' },
  { find: '???? ???????: {location}', replace: 'مكان التنفيذ: {location}' },
  { find: '?????? ???? ??????: {employee}', replace: 'السلفة باسم الموظف: {employee}' },
  { find: '????????: {totalAmount} ????', replace: 'الإجمالي: {totalAmount} ريال' },
]

const SETTLEMENT_TEMPLATE_REPLACEMENTS: TemplateReplacement[] = [
  { find: '??? ??????: {referenceNumber}', replace: 'رقم المرجع: {referenceNumber}' },
  { find: '??? ??????: {activity}', replace: 'اسم النشاط: {activity}' },
  { find: '???? ???????: {location}', replace: 'مكان التنفيذ: {location}' },
  { find: '????? ????? ??????: {startDate}', replace: 'تاريخ بداية النشاط: {startDate}' },
  { find: '????? ??????: {endDate}', replace: 'نهاية النشاط: {endDate}' },
  { find: '????? ????? ?????: {startDate}', replace: 'تاريخ بداية الصرف: {startDate}' },
  { find: '????? ?????: {endDate}', replace: 'نهاية الصرف: {endDate}' },
  { find: '??? ?????? ??????: {savingsAmount}', replace: 'وفر السلفة النقدي: {savingsAmount}' },
  { find: '??? ??? ?????: {receiptNumber}', replace: 'رقم سند القبض: {receiptNumber}' },
  { find: '??????: {receiptDate}', replace: 'تاريخه: {receiptDate}' },
  { find: '??? ????? ??????: {employee}', replace: 'اسم مستلم السلفة: {employee}' },
]

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`
}

function formatNumber(value: number) {
  return formatEnglishNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDateOrBlank(value: string) {
  return value.trim() ? formatDate(value) : ''
}

function joinValues(values: Array<string | undefined>, separator = '<br />') {
  return values.map(v => v?.trim() ?? '').filter(Boolean).map(v => escapeHtml(v)).join(separator)
}

function joinPlainValues(values: Array<string | undefined>, separator = '\n') {
  return values.map(v => v?.trim() ?? '').filter(Boolean).join(separator)
}

// ─────────────────────────────────────────────────────────────
// Normalizers
// ─────────────────────────────────────────────────────────────
function normalizeStoredFile(value: unknown): StoredFile | null {
  if (!value || typeof value !== 'object') return null
  const c = value as Partial<StoredFile>
  if (typeof c.name !== 'string' || typeof c.type !== 'string' || typeof c.dataUrl !== 'string') return null
  return { name: c.name, type: c.type, dataUrl: c.dataUrl, size: typeof c.size === 'number' ? c.size : 0 }
}

function normalizeSettlementDetails(raw: unknown): SettlementDetailLike[] {
  const source = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { details?: unknown[] }).details)
      ? (raw as { details: SettlementDetailRecord[] }).details
      : []

  return source.map((detail) => {
    const item = detail as SettlementDetailLike
    return {
      category: String(item.category ?? ''),
      budget: Number(item.budget ?? 0),
      invoices: Array.isArray(item.invoices)
        ? item.invoices.map((invoice) => ({
            amount: Number(invoice.amount ?? 0),
            currency: String(invoice.currency ?? invoice.currencyCode ?? 'SAR'),
            exchangeRate: Number(invoice.exchangeRate ?? 0),
            sar: Number(invoice.sar ?? invoice.amount ?? 0),
            type: invoice.type ? String(invoice.type) : String(invoice.documentType ?? ''),
            date: invoice.date ? String(invoice.date) : String(invoice.invoiceDate ?? ''),
            issuer: invoice.issuer ? String(invoice.issuer) : '',
            attachment: normalizeStoredFile(invoice.attachment),
          }))
        : [],
    }
  })
}

function normalizeSettlementMeta(raw: unknown): SettlementMetaLike {
  if (!raw || typeof raw !== 'object') return {}
  const source = raw as Record<string, unknown>
  return {
    receiptNumber: typeof source.receiptNumber === 'string' ? source.receiptNumber : '',
    receiptDate: typeof source.receiptDate === 'string' ? source.receiptDate : '',
    overageReason: typeof source.overageReason === 'string' ? source.overageReason : '',
    pettyCashApproval: normalizeStoredFile(source.pettyCashApproval),
  }
}

function normalizeLoanTemplateRows(loan: LoanDocumentRecord): LoanTemplateRow[] {
  const items = loan.items.length > 0 ? loan.items : [{ category: 'سلفة مؤقتة', amount: loan.amount }]
  return items.map((item, index) => ({
    index: index + 1,
    amount: formatNumber(item.amount),
    category: item.category,
    notes: '',
  }))
}

function normalizeSettlementTemplateRows(loan: LoanDocumentRecord): SettlementTemplateRow[] {
  const details = normalizeSettlementDetails(loan.settlement?.invoices)
  const rows = details.map((detail, index) => {
    const invoices = detail.invoices ?? []
    const totalSar = invoices.reduce((sum, inv) => sum + Number(inv.sar ?? 0), 0)
    const amount = totalSar > 0 ? totalSar : Number(detail.budget ?? 0)
    const isPettyCash = (detail.category ?? '').includes('نثريات')
    return {
      index: index + 1,
      category: detail.category?.trim() || 'بند صرف',
      amount: formatNumber(amount),
      documentType: isPettyCash ? 'موافقة المعالي' : joinValues(invoices.map(inv => inv.type), '<br />'),
      documentDate: joinValues(invoices.map(inv => formatDateOrBlank(inv.date ?? '')), '<br />'),
      issuer: isPettyCash ? '' : joinValues(invoices.map(inv => inv.issuer), '<br />'),
    }
  })
  return rows.length > 0 ? rows : [{ index: 1, category: 'لا توجد بنود صرف مسجلة', amount: formatNumber(0), documentType: '', documentDate: '', issuer: '' }]
}

function normalizeSettlementDocxRows(loan: LoanDocumentRecord): SettlementTemplateRow[] {
  const details = normalizeSettlementDetails(loan.settlement?.invoices)
  return details.map((detail, index) => {
    const invoices = detail.invoices ?? []
    const totalSar = invoices.reduce((sum, inv) => sum + Number(inv.sar ?? 0), 0)
    const amount = totalSar > 0 ? totalSar : Number(detail.budget ?? 0)
    const isPettyCash = (detail.category ?? '').includes('نثريات')
    return {
      index: index + 1,
      category: detail.category?.trim() || 'بند صرف',
      amount: formatNumber(amount),
      documentType: isPettyCash ? 'موافقة المعالي' : joinPlainValues(invoices.map(inv => inv.type)),
      documentDate: joinPlainValues(invoices.map(inv => formatDateOrBlank(inv.date ?? ''))),
      issuer: isPettyCash ? '' : joinPlainValues(invoices.map(inv => inv.issuer)),
    }
  })
}

function padLoanRows(rows: LoanTemplateRow[], min = 2): LoanTemplateRow[] {
  const result = [...rows]
  while (result.length < min) result.push({ index: result.length + 1, amount: '', category: '', notes: '' })
  return result
}

function padSettlementRows(rows: SettlementTemplateRow[], min = 9): SettlementTemplateRow[] {
  const result = [...rows]
  while (result.length < min) result.push({ index: result.length + 1, category: '', amount: '', documentType: '', documentDate: '', issuer: '' })
  return result
}

// ─────────────────────────────────────────────────────────────
// Attachment pages
// ─────────────────────────────────────────────────────────────
function buildSettlementAttachmentPages(loan: LoanDocumentRecord): string {
  const details = normalizeSettlementDetails(loan.settlement?.invoices)
  const meta = normalizeSettlementMeta(loan.settlement?.invoices)

  const attachments = details.flatMap((detail) =>
    (detail.invoices ?? [])
      .map(inv => ({ ...inv, attachment: normalizeStoredFile(inv.attachment) }))
      .filter(inv => inv.attachment)
      .map((inv, i) => ({
        category: detail.category?.trim() || 'بند صرف',
        index: i + 1,
        documentType: inv.type || '',
        issuer: inv.issuer || '',
        attachment: inv.attachment as StoredFile,
      })),
  )

  if (meta.pettyCashApproval) {
    attachments.push({
      category: 'النثريات',
      index: attachments.length + 1,
      documentType: 'موافقة المعالي',
      issuer: 'اعتماد النثريات',
      attachment: meta.pettyCashApproval,
    })
  }

  return attachments.map(({ category, index, documentType, issuer, attachment }) => {
    const preview = attachment.type.startsWith('image/')
      ? `<div class="att-preview"><img src="${attachment.dataUrl}" alt="${escapeHtml(attachment.name)}" /></div>`
      : `<div class="att-note">تم إرفاق الملف: ${escapeHtml(attachment.name)}<br/>نوع المستند: ${escapeHtml(documentType || 'مرفق')}</div>`
    return `
      <div class="att-page">
        <h2>مرفق رقم ${index}</h2>
        <p>البند: ${escapeHtml(category)} | نوع المستند: ${escapeHtml(documentType || '-')} | الجهة المصدرة: ${escapeHtml(issuer || '-')}</p>
        ${preview}
      </div>`
  }).join('')
}

// ─────────────────────────────────────────────────────────────
// CSS مشترك للنموذجين
// ─────────────────────────────────────────────────────────────
const SHARED_CSS = `
@font-face {
  font-family: "BoutrosJazirah";
  src: url("/fonts/BoutrosJazirahTextLight.ttf") format("truetype");
  font-weight: normal;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: #fff; color: #000; }
body {
  font-family: "BoutrosJazirah", "Traditional Arabic", Tahoma, Arial, sans-serif;
  direction: rtl;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.page { margin: 0 auto; background: #fff; }

/* العنوان */
.title-block { text-align: center; margin-bottom: 6pt; }
.t1 { font-size: 14pt; font-weight: bold; display: block; }
.t2 { font-size: 14pt; font-weight: bold; display: block; margin-top: 1pt; }

/* رقم مرجعي */
.ref { text-align: right; font-size: 13pt; font-weight: bold; margin-bottom: 3pt; }

/* الأسطر الرسمية */
.formal { text-align: right; font-size: 12.5pt; font-weight: bold; margin-bottom: 1.5pt; }
.formal-last { margin-bottom: 6pt; }

/* جداول المعلومات */
.info { width: 100%; border-collapse: collapse; margin-bottom: 3pt; }
.info td { font-size: 12pt; padding: 2pt 3pt; vertical-align: bottom; }
.lbl { font-weight: bold; white-space: nowrap; }
.val { border-bottom: 1pt solid #000; min-width: 30pt; }

/* الجدول الرئيسي */
.tbl { width: 100%; border-collapse: collapse; font-size: 11.5pt; margin: 4pt 0; }
.tbl th, .tbl td { border: 1pt solid #000; padding: 3pt 5pt; text-align: center; vertical-align: middle; }
.tbl th { background: #d9d9d9; font-weight: bold; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.tbl .tr { text-align: right; }

/* مربعات الاختيار */
.chk { display: inline-block; width: 12pt; height: 12pt; border: 1pt solid #000; text-align: center; line-height: 12pt; font-size: 10pt; vertical-align: middle; }

/* خط التوقيع */
.sig { display: inline-block; min-width: 50pt; border-bottom: 1pt solid #000; height: 11pt; vertical-align: bottom; }

/* المربعات الرسمية */
.box {
  border: 1pt solid #aaa;
  background: #d9d9d9;
  border-radius: 5pt;
  padding: 8pt 12pt;
  margin-top: 6pt;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.box-title { font-weight: bold; font-size: 13pt; margin-bottom: 5pt; text-align: right; display: block; }
.chk-row { text-align: right; margin-bottom: 3pt; font-size: 12pt; }

/* جدول الملخص */
.totals { width: 55%; border-collapse: collapse; font-size: 11pt; margin-top: 4pt; }
.totals td { border: 1pt solid #000; padding: 2pt 5pt; }
.tot-l { text-align: right; font-weight: bold; width: 74%; }
.tot-r { text-align: center; width: 26%; }

/* صفحات المرفقات */
.att-page { page-break-before: always; padding: 10pt; }
.att-page h2 { font-size: 13pt; margin-bottom: 4pt; text-align: right; }
.att-page p { font-size: 10pt; color: #555; margin-bottom: 8pt; text-align: right; }
.att-preview { border: 1pt solid #ddd; border-radius: 6pt; padding: 8pt; min-height: 160mm; display: flex; align-items: center; justify-content: center; }
.att-preview img { max-width: 100%; max-height: 155mm; object-fit: contain; }
.att-note { border: 1pt dashed #aaa; border-radius: 6pt; padding: 20pt; text-align: center; color: #555; font-size: 12pt; }

@media print { html, body { background: #fff; } }
`

// ─────────────────────────────────────────────────────────────
// buildLoanRequestWordHtml — نموذج 18
// ─────────────────────────────────────────────────────────────
export function buildLoanRequestWordHtml(loan: LoanDocumentRecord): string {
  const rows = padLoanRows(normalizeLoanTemplateRows(loan))
  const budgetApproved = loan.budgetApproved === true
  const budgetRejected = loan.budgetApproved === false
  const total = formatNumber(loan.amount)
  const words = numberToArabicWords(loan.amount)
  const refSeq = loan.refNumber.split('/')[2] ?? '....'

  const tableRows = rows.map(r => `
    <tr>
      <td style="width:7%;">${r.index}.</td>
      <td style="width:20%;">${escapeHtml(r.amount)}</td>
      <td style="text-align:right;padding:3pt 6pt;">${escapeHtml(r.category)}</td>
      <td style="width:28%;"></td>
    </tr>`).join('')

  const body = `
<div class="page" style="width:170mm;padding:0;">

  <div class="title-block">
    <span class="t1">نموذج رقم 18</span>
    <span class="t2">طلب صرف سلفة مؤقتة للعمل</span>
  </div>

  <p class="ref">رقم مرجعي:&nbsp; وت /&nbsp;26 /&nbsp;${escapeHtml(refSeq)}</p>

  <p class="formal">معالي رئيس الجامعة</p>
  <p class="formal">السلام عليكم ورحمة الله وبركاته</p>
  <p class="formal formal-last">آمل الموافقة على صرف سلفة نقدية مؤقتة وفق ما يلي:</p>

  <table class="info">
    <tr>
      <td class="lbl" style="width:24%;">مبلغ السلفة رقماً:</td>
      <td class="val" style="width:22%;">${total}</td>
      <td class="lbl" style="width:10%;">كتابة:</td>
      <td class="val">${escapeHtml(words)}&nbsp;ريال</td>
    </tr>
  </table>

  <table class="info">
    <tr>
      <td class="lbl" style="width:24%;">اسم النشاط:</td>
      <td class="val" style="width:22%;">${escapeHtml(loan.activity)}</td>
      <td style="width:26%;padding:2pt 4pt;vertical-align:bottom;font-size:11.5pt;">
        <span class="chk">${budgetApproved ? '✓' : '&nbsp;'}</span>&nbsp;معتمد في الموازنة
      </td>
      <td style="width:28%;padding:2pt 4pt;vertical-align:bottom;font-size:11.5pt;">
        <span class="chk">${budgetRejected ? '✓' : '&nbsp;'}</span>&nbsp;غير معتمد
      </td>
    </tr>
  </table>

  <table class="info">
    <tr>
      <td class="lbl" style="width:24%;">الجهة المنفذة للنشاط:</td>
      <td class="val">وكالة التدريب</td>
    </tr>
  </table>

  <table class="info">
    <tr>
      <td class="lbl" style="width:24%;">فترة تنفيذ النشاط:</td>
      <td class="val" style="width:36%;">من ${escapeHtml(formatDate(loan.startDate))} إلى ${escapeHtml(formatDate(loan.endDate))}</td>
      <td class="lbl" style="width:14%;">مكان التنفيذ:</td>
      <td class="val">${escapeHtml(loan.location ?? '')}</td>
    </tr>
  </table>

  <table class="info" style="margin-bottom:7pt;">
    <tr>
      <td class="lbl" style="width:24%;">السلفة باسم الموظف:</td>
      <td class="val" style="width:28%;">${escapeHtml(loan.employee)}</td>
      <td class="lbl" style="width:22%;">توقيع طالب السلفة:</td>
      <td class="val"></td>
    </tr>
  </table>

  <table class="tbl">
    <thead>
      <tr>
        <th style="width:7%;">م</th>
        <th style="width:20%;">المبلغ</th>
        <th>أوجه الصرف</th>
        <th style="width:28%;">الملاحظات</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
    <tfoot>
      <tr>
        <td colspan="2" style="text-align:right;padding:3pt 6pt;border:1pt solid #000;">
          <strong>الإجمالي: ${total}&nbsp;.................. ريال</strong>
        </td>
        <td colspan="2" style="border:1pt solid #000;padding:3pt 6pt;">&nbsp;</td>
      </tr>
    </tfoot>
  </table>

  <table class="info" style="margin-top:5pt;margin-bottom:8pt;">
    <tr>
      <td style="width:20%;font-weight:bold;">مسؤول الجهة:</td>
      <td style="width:28%;">وكيل الجامعة للتدريب</td>
      <td style="width:34%;font-weight:bold;">الاسم: د. عبدالرزاق بن عبدالعزيز المرجان</td>
      <td>التوقيع: <span class="sig"></span></td>
    </tr>
  </table>

  <div class="box">
    <span class="box-title">رأي المراقب المالي:</span>
    <p class="chk-row"><span class="chk">&nbsp;</span>&nbsp;&nbsp;مستوفي</p>
    <p class="chk-row"><span class="chk">&nbsp;</span>&nbsp;&nbsp;غير مستوفي للآتي:</p>
    <table class="info" style="margin-top:14pt;">
      <tr>
        <td style="width:40%;">الاسم: شريف محمد مصطفى الغزولي</td>
        <td style="width:30%;">التوقيع: <span class="sig"></span></td>
        <td>التاريخ: .... / ...... / ......</td>
      </tr>
    </table>
  </div>

  <div class="box" style="margin-top:6pt;">
    <span class="box-title">اعتماد رئيس الجامعة</span>
    <p style="font-size:12pt;margin-bottom:6pt;">
      <span class="chk">&nbsp;</span>&nbsp;نوافق
      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
      <span class="chk">&nbsp;</span>&nbsp;لا نوافق
    </p>
    <p style="font-size:12pt;margin-bottom:8pt;">وعلى كل فيما يخصه إكمال اللازم وفق الضوابط المحددة.</p>
    <table class="info">
      <tr>
        <td style="width:12%;">رئيس</td>
        <td style="width:36%;">الجامعة: <span class="sig" style="min-width:90pt;"></span></td>
        <td style="width:22%;">التوقيع: <span class="sig"></span></td>
        <td>التاريخ: .... / ...... / ......</td>
      </tr>
    </table>
  </div>

</div>`

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"/>
<style>
@page { size: A4; margin: 28mm 22mm 18mm 22mm; }
${SHARED_CSS}
</style>
</head>
<body>${body}</body>
</html>`
}

// ─────────────────────────────────────────────────────────────
// buildSettlementWordHtml — نموذج 19
// ─────────────────────────────────────────────────────────────
export function buildSettlementWordHtml(loan: LoanDocumentRecord): string {
  const settlement = loan.settlement
  const meta = normalizeSettlementMeta(settlement?.invoices)
  const rows = padSettlementRows(normalizeSettlementTemplateRows(loan))
  const refSeq = loan.refNumber.split('/')[2] ?? '....'

  const tableRows = rows.map(r => `
    <tr>
      <td style="width:5%;">${r.index}.</td>
      <td class="tr" style="padding:2pt 5pt;">${escapeHtml(r.category)}</td>
      <td style="width:12%;">${escapeHtml(r.amount)}</td>
      <td style="width:11%;">${r.documentType}</td>
      <td style="width:13%;">${r.documentDate}</td>
      <td style="width:21%;">${escapeHtml(r.issuer)}</td>
    </tr>`).join('')

  const sup    = formatNumber(Number(settlement?.supported   ?? 0))
  const unsup  = formatNumber(Number(settlement?.unsupported ?? 0))
  const total  = formatNumber(Number(settlement?.total       ?? 0))
  const loanAmt = formatNumber(loan.amount)
  const overage = formatNumber(Number(settlement?.overage    ?? 0))
  const savings = formatNumber(Number(settlement?.savings    ?? 0))
  const receiptNum = escapeHtml(meta.receiptNumber ?? '')
  const receiptDt  = escapeHtml(formatDateOrBlank(meta.receiptDate ?? ''))
  const attachPages = buildSettlementAttachmentPages(loan)

  const body = `
<div class="page" style="width:170mm;padding:0;">

  <div class="title-block">
    <span class="t1">نموذج رقم 19</span>
    <span class="t2">طلب تسوية سلفة مؤقتة</span>
  </div>

  <p class="ref">رقم المرجع: وت/25/${escapeHtml(refSeq)}</p>

  <p class="formal">لمعالي رئيس الجامعة مع الاحترام والتقدير</p>
  <p class="formal">السلام عليكم ورحمة الله وبركاته</p>
  <p class="formal formal-last">آمل التفضل بالموافقة على تسوية السلفة المصروفة باسمي وفق البيانات المحددة أدناه:</p>

  <table class="info">
    <tr>
      <td class="lbl" style="width:24%;">اسم النشاط:</td>
      <td class="val" style="width:26%;">${escapeHtml(loan.activity)}</td>
      <td class="lbl" style="width:15%;">مكان التنفيذ:</td>
      <td class="val">${escapeHtml(loan.location ?? '')}</td>
    </tr>
  </table>

  <table class="info">
    <tr>
      <td class="lbl" style="width:24%;">الجهة المنفذة للنشاط:</td>
      <td class="val">وكالة التدريب</td>
    </tr>
  </table>

  <table class="info">
    <tr>
      <td class="lbl" style="width:24%;">تاريخ بداية النشاط:</td>
      <td class="val" style="width:18%;">${escapeHtml(formatDate(loan.startDate))}</td>
      <td class="lbl" style="width:20%;">نهاية النشاط:</td>
      <td class="val">${escapeHtml(formatDate(loan.endDate))}</td>
    </tr>
  </table>

  <table class="info" style="margin-bottom:7pt;">
    <tr>
      <td class="lbl" style="width:24%;">تاريخ بداية الصرف:</td>
      <td class="val" style="width:18%;">${escapeHtml(formatDate(loan.startDate))}</td>
      <td class="lbl" style="width:20%;">نهاية الصرف:</td>
      <td class="val">${escapeHtml(formatDate(loan.endDate))}</td>
    </tr>
  </table>

  <table class="tbl">
    <thead>
      <tr>
        <th style="width:5%;" rowspan="2">م</th>
        <th rowspan="2">أوجه الصرف الفعلية</th>
        <th style="width:12%;" rowspan="2">المبلغ<br/>بالريال</th>
        <th colspan="3">المستندات المؤيدة</th>
      </tr>
      <tr>
        <th style="width:11%;">نوعه</th>
        <th style="width:13%;">تاريخه</th>
        <th style="width:21%;">الجهة المصدرة له</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>

  <table class="totals">
    <tr><td class="tot-l">المصروفات المؤيدة بمستندات</td><td class="tot-r">${sup}</td></tr>
    <tr><td class="tot-l">المصروفات غير المؤيدة بمستندات</td><td class="tot-r">${unsup}</td></tr>
    <tr><td class="tot-l">إجمالي المصروفات من السلفة</td><td class="tot-r">${total}</td></tr>
    <tr><td class="tot-l">مبلغ السلفة</td><td class="tot-r">${loanAmt}</td></tr>
    <tr><td class="tot-l">المبلغ المصروف بالزيادة المطلوبة صرفه</td><td class="tot-r">${overage}</td></tr>
  </table>

  <table class="info" style="margin-top:4pt;">
    <tr>
      <td class="lbl" style="width:24%;font-size:11pt;">وفر السلفة النقدي:</td>
      <td class="val" style="width:16%;">${savings}</td>
      <td class="lbl" style="width:22%;font-size:10.5pt;">رقم سند القبض:&nbsp;${receiptNum}</td>
      <td class="lbl" style="width:12%;font-size:10.5pt;">تاريخه:</td>
      <td class="val">${receiptDt}</td>
    </tr>
  </table>

  <table class="info" style="margin-top:6pt;margin-bottom:8pt;">
    <tr>
      <td style="width:34%;">اسم مستلم السلفة: ${escapeHtml(loan.employee)}</td>
      <td style="width:32%;">التوقيع: <span class="sig"></span></td>
      <td>التاريخ: <span class="sig" style="min-width:55pt;"></span></td>
    </tr>
    <tr>
      <td>وكيل الجامعة للتدريب</td>
      <td>د. عبدالرزاق بن عبدالعزيز المرجان</td>
      <td>التوقيع: <span class="sig"></span></td>
    </tr>
  </table>

  <div class="box">
    <span class="box-title">رأي المراقب المالي:</span>
    <p class="chk-row"><span class="chk">&nbsp;</span>&nbsp;المعاملة مستوفية للمتطلبات النظامية للتسوية</p>
    <p class="chk-row"><span class="chk">&nbsp;</span>&nbsp;المعاملة غير مستوفية للمتطلبات النظامية للتسوية ويرفق مذكرة بالتفاصيل.</p>
    <table class="info" style="margin-top:12pt;">
      <tr>
        <td style="width:38%;">الاسم: شريف محمد مصطفى الغزولي</td>
        <td style="width:31%;">التوقيع: <span class="sig"></span></td>
        <td>التاريخ: /&nbsp;&nbsp;&nbsp;&nbsp;/</td>
      </tr>
    </table>
  </div>

  <div class="box" style="margin-top:6pt;">
    <span class="box-title">اعتماد رئيس الجامعة</span>
    <p style="font-size:12pt;margin-bottom:5pt;">
      <span class="chk">&nbsp;</span>&nbsp;أوافق على تسوية السلفة وفق ما هو محدد أعلاه.
      &nbsp;&nbsp;&nbsp;
      <span class="chk">&nbsp;</span>&nbsp;لا نوافق
    </p>
    <p style="font-size:12pt;margin-bottom:7pt;">وعلى كل فيما يخصه إكمال اللازم</p>
    <table class="info">
      <tr>
        <td style="width:34%;">رئيس الجامعة: <span class="sig" style="min-width:65pt;"></span></td>
        <td style="width:32%;">التوقيع: <span class="sig"></span></td>
        <td>التاريخ: /&nbsp;&nbsp;&nbsp;&nbsp;/</td>
      </tr>
    </table>
  </div>

  ${attachPages}

</div>`

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"/>
<style>
@page { size: A4; margin: 26mm 22mm 16mm 22mm; }
${SHARED_CSS}
</style>
</head>
<body>${body}</body>
</html>`
}

// ─────────────────────────────────────────────────────────────
// DOCX builders (unchanged logic)
// ─────────────────────────────────────────────────────────────
const TEMPLATE_GUID_VALUE = '{28A0092B-C50C-407E-A947-70E740481C1C}'
const TEMPLATE_GUID_TOKEN = '__DOCX_GUID_TOKEN__'

function patchTemplateDocumentXml(xml: string, replacements: TemplateReplacement[]) {
  return replacements.reduce((cur, r) => cur.replaceAll(r.find, r.replace), xml)
}

async function loadPatchedTemplate(templatePath: string, replacements: TemplateReplacement[]) {
  const buffer = await readFile(templatePath)
  const zip = new PizZip(buffer)
  const document = zip.file('word/document.xml')
  if (!document) throw new Error(`Missing document.xml in template: ${path.basename(templatePath)}`)
  const patchedXml = patchTemplateDocumentXml(document.asText(), replacements)
    .replaceAll(TEMPLATE_GUID_VALUE, TEMPLATE_GUID_TOKEN)
  zip.file('word/document.xml', patchedXml)
  return zip
}

function renderDocxTemplate(templateZip: PizZip, data: Record<string, unknown>) {
  const doc = new Docxtemplater(templateZip, { paragraphLoop: true, linebreaks: true, nullGetter: () => '' })
  doc.render(data)
  const outputZip = doc.getZip()
  const renderedDocument = outputZip.file('word/document.xml')
  if (renderedDocument) {
    outputZip.file('word/document.xml', renderedDocument.asText().replaceAll(TEMPLATE_GUID_TOKEN, TEMPLATE_GUID_VALUE))
  }
  return Buffer.from(outputZip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }))
}

function createLoanRequestTemplateData(loan: LoanDocumentRecord) {
  return {
    referenceNumber: loan.refNumber,
    amountNumber: formatNumber(loan.amount),
    amountWords: numberToArabicWords(loan.amount),
    activity: loan.activity,
    startDate: formatDate(loan.startDate),
    endDate: formatDate(loan.endDate),
    location: loan.location ?? '',
    employee: loan.employee,
    expenseRows: padLoanRows(normalizeLoanTemplateRows(loan)),
    totalAmount: formatNumber(loan.amount),
  }
}

function createSettlementTemplateData(loan: LoanDocumentRecord) {
  const settlement = loan.settlement
  const meta = normalizeSettlementMeta(settlement?.invoices)
  return {
    referenceNumber: loan.refNumber,
    activity: loan.activity,
    location: loan.location ?? '',
    startDate: formatDate(loan.startDate),
    endDate: formatDate(loan.endDate),
    settlementRows: padSettlementRows(normalizeSettlementDocxRows(loan)),
    supportedAmount: formatNumber(Number(settlement?.supported ?? 0)),
    unsupportedAmount: formatNumber(Number(settlement?.unsupported ?? 0)),
    totalAmount: formatNumber(Number(settlement?.total ?? 0)),
    loanAmount: formatNumber(loan.amount),
    overageAmount: formatNumber(Number(settlement?.overage ?? 0)),
    savingsAmount: formatNumber(Number(settlement?.savings ?? 0)),
    receiptNumber: meta.receiptNumber ?? '',
    receiptDate: formatDateOrBlank(meta.receiptDate ?? ''),
    employee: loan.employee,
  }
}

export async function buildLoanRequestDocx(loan: LoanDocumentRecord) {
  const templateZip = await loadPatchedTemplate(LOAN_TEMPLATE_PATH, LOAN_TEMPLATE_REPLACEMENTS)
  return renderDocxTemplate(templateZip, createLoanRequestTemplateData(loan))
}

export async function buildSettlementDocx(loan: LoanDocumentRecord) {
  const templateZip = await loadPatchedTemplate(SETTLEMENT_TEMPLATE_PATH, SETTLEMENT_TEMPLATE_REPLACEMENTS)
  return renderDocxTemplate(templateZip, createSettlementTemplateData(loan))
}

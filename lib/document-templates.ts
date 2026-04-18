import { type SettlementDetailRecord, type StoredFile } from '@/lib/loan-form-options'
import { formatEnglishNumber, numberToArabicWords } from '@/lib/utils'

type LoanItemLike = {
  category: string
  amount: number
}

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

type PrintShellOptions = {
  pageMargins: string
  fontFamily?: string
  fontSize?: string
  fontFaceCss?: string
  lineHeight?: string
  sheetWidth?: string
  sheetMinHeight?: string
}

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

  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(
    2,
    '0',
  )}/${date.getFullYear()}`
}

function formatNumber(value: number) {
  return formatEnglishNumber(value, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatDateOrBlank(value: string) {
  return value.trim() ? formatDate(value) : ''
}

function joinValues(values: Array<string | undefined>, separator = '<br />') {
  return values
    .map((value) => value?.trim() ?? '')
    .filter(Boolean)
    .map((value) => escapeHtml(value))
    .join(separator)
}

function printShell(body: string, options: PrintShellOptions) {
  const fontFamily = options.fontFamily ?? '"Cairo", Tahoma, Arial, sans-serif'
  const fontSize = options.fontSize ?? '14px'
  const lineHeight = options.lineHeight ?? '1.7'
  const sheetWidth = options.sheetWidth ?? '100%'
  const sheetMinHeight = options.sheetMinHeight ?? 'auto'

  return `
  <style>
    ${options.fontFaceCss ?? ''}
    @page { size: A4; margin: ${options.pageMargins}; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #111827;
    }
    body {
      font-family: ${fontFamily};
      font-size: ${fontSize};
      line-height: ${lineHeight};
      direction: rtl;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .print-sheet {
      width: ${sheetWidth};
      min-height: ${sheetMinHeight};
      margin: 0 auto;
      background: #fff;
      color: #111827;
    }
    .print-title {
      text-align: center;
      margin-bottom: 4px;
      font-weight: 700;
    }
    .print-title h1,
    .print-title h2 {
      margin: 0;
      font-size: 18px;
      line-height: 1.45;
    }
    .reference-line {
      text-align: right;
      margin: 6px 0 8px;
      font-size: 14px;
      font-weight: 700;
    }
    .formal-text {
      text-align: right;
      margin-bottom: 6px;
      font-size: 13px;
      font-weight: 600;
    }
    .formal-text p { margin: 0 0 2px; }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 5px 14px;
      margin-bottom: 8px;
      font-size: 13px;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 8px;
    }
    .meta-label { font-weight: 700; }
    .meta-value {
      flex: 1;
      min-height: 18px;
      border-bottom: 1px solid #111827;
      padding-inline: 4px;
      text-align: right;
    }
    .choice-line {
      display: flex;
      gap: 28px;
      align-items: center;
      min-height: 32px;
    }
    .choice-item {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-weight: 600;
    }
    .box {
      width: 18px;
      height: 18px;
      border: 1px solid #111827;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      line-height: 1;
    }
    table.form-grid {
      width: 100%;
      border-collapse: collapse;
      margin-top: 6px;
      margin-bottom: 6px;
      font-size: 13px;
    }
    table.form-grid th,
    table.form-grid td {
      border: 1px solid #111827;
      padding: 4px 6px;
      text-align: center;
      vertical-align: middle;
    }
    table.form-grid th {
      background: #d9d9d9;
      font-weight: 700;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .text-right { text-align: right !important; }
    .text-top { vertical-align: top !important; }
    .official-inline {
      display: grid;
      gap: 8px;
      margin: 8px 0 10px;
      align-items: center;
      font-size: 13px;
      font-weight: 700;
    }
    .signature-line {
      display: inline-block;
      min-width: 140px;
      border-bottom: 1px solid #111827;
      height: 18px;
      vertical-align: middle;
    }
    .official-panel {
      border: 1px solid #ababab;
      background: #d9d9d9;
      border-radius: 16px;
      padding: 10px 14px;
      margin-top: 8px;
      min-height: 112px;
      break-inside: avoid-page;
      page-break-inside: avoid;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .official-panel h3 {
      margin: 0 0 10px;
      text-align: right;
      font-size: 14px;
      font-weight: 700;
    }
    .official-panel p { margin: 0 0 6px; }
    .official-panel .row {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: center;
      flex-wrap: wrap;
    }
    .official-panel .row.nowrap {
      flex-wrap: nowrap;
    }
    .approval-choice {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-inline-start: 14px;
    }
    .totals-table {
      margin-top: 10px;
      margin-right: auto;
      width: 58%;
    }
    .attachment-page {
      page-break-before: always;
      min-height: 250mm;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .attachment-page h2 {
      margin: 0;
      font-size: 16px;
      text-align: right;
    }
    .attachment-page p {
      margin: 0;
      font-size: 12px;
      color: #475569;
    }
    .attachment-preview {
      border: 1px solid #d1d5db;
      border-radius: 16px;
      padding: 16px;
      min-height: 190mm;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fff;
    }
    .attachment-preview img {
      max-width: 100%;
      max-height: 180mm;
      object-fit: contain;
    }
    .attachment-note {
      border: 1px dashed #94a3b8;
      border-radius: 16px;
      padding: 24px;
      text-align: center;
      color: #475569;
      background: #f8fafc;
    }
    @media print {
      html, body { background: #fff; }
      .print-sheet { width: 100%; min-height: auto; }
    }
  </style>
  <div class="print-sheet">${body}</div>`
}

function createWordCompatibleDocument(html: string) {
  return Buffer.from(
    `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8" /></head><body>${html}</body></html>`,
    'utf8',
  )
}

function normalizeStoredFile(value: unknown): StoredFile | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Partial<StoredFile>

  if (
    typeof candidate.name !== 'string' ||
    typeof candidate.type !== 'string' ||
    typeof candidate.dataUrl !== 'string'
  ) {
    return null
  }

  return {
    name: candidate.name,
    type: candidate.type,
    dataUrl: candidate.dataUrl,
    size: typeof candidate.size === 'number' ? candidate.size : 0,
  }
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
  if (!raw || typeof raw !== 'object') {
    return {}
  }

  const source = raw as Record<string, unknown>

  return {
    receiptNumber: typeof source.receiptNumber === 'string' ? source.receiptNumber : '',
    receiptDate: typeof source.receiptDate === 'string' ? source.receiptDate : '',
    overageReason: typeof source.overageReason === 'string' ? source.overageReason : '',
    pettyCashApproval: normalizeStoredFile(source.pettyCashApproval),
  }
}

function normalizeLoanTemplateRows(loan: LoanDocumentRecord): LoanTemplateRow[] {
  const items = loan.items.length > 0 ? loan.items : [{ category: 'ط³ظ„ظپط© ظ…ط¤ظ‚طھط©', amount: loan.amount }]

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
    const totalSar = invoices.reduce((sum, invoice) => sum + Number(invoice.sar ?? 0), 0)
    const amount = totalSar > 0 ? totalSar : Number(detail.budget ?? 0)
    const isPettyCash = (detail.category ?? '').includes('ظ†ط«ط±ظٹط§طھ')

    return {
      index: index + 1,
      category: detail.category?.trim() || 'ط¨ظ†ط¯ طµط±ظپ',
      amount: formatNumber(amount),
      documentType: isPettyCash
        ? 'ظ…ظˆط§ظپظ‚ط© ط§ظ„ظ…ط¹ط§ظ„ظٹ'
        : joinValues(invoices.map((invoice) => invoice.type), '<br />'),
      documentDate: joinValues(
        invoices.map((invoice) => formatDateOrBlank(invoice.date ?? '')),
        '<br />',
      ),
      issuer: isPettyCash ? '' : joinValues(invoices.map((invoice) => invoice.issuer), '<br />'),
    }
  })

  return rows.length > 0
    ? rows
    : [
        {
          index: 1,
          category: 'ظ„ط§ طھظˆط¬ط¯ ط¨ظ†ظˆط¯ طµط±ظپ ظ…ط³ط¬ظ„ط©',
          amount: formatNumber(0),
          documentType: '',
          documentDate: '',
          issuer: '',
        },
      ]
}

function buildSettlementAttachmentPages(loan: LoanDocumentRecord) {
  const details = normalizeSettlementDetails(loan.settlement?.invoices)
  const meta = normalizeSettlementMeta(loan.settlement?.invoices)
  const attachments = details.flatMap((detail) =>
    (detail.invoices ?? [])
      .map((invoice) => ({
        ...invoice,
        attachment: normalizeStoredFile(invoice.attachment),
      }))
      .filter((invoice) => invoice.attachment)
      .map((invoice, index) => ({
        category: detail.category?.trim() || 'ط¨ظ†ط¯ طµط±ظپ',
        index: index + 1,
        documentType: invoice.type || '',
        issuer: invoice.issuer || '',
        attachment: invoice.attachment as StoredFile,
      })),
  )

  if (meta.pettyCashApproval) {
    attachments.push({
      category: 'ط§ظ„ظ†ط«ط±ظٹط§طھ',
      index: attachments.length + 1,
      documentType: 'ظ…ظˆط§ظپظ‚ط© ط§ظ„ظ…ط¹ط§ظ„ظٹ',
      issuer: 'ط§ط¹طھظ…ط§ط¯ ط§ظ„ظ†ط«ط±ظٹط§طھ',
      attachment: meta.pettyCashApproval,
    })
  }

  return attachments
    .map(({ category, index, documentType, issuer, attachment }) => {
      const preview = attachment.type.startsWith('image/')
        ? `<div class="attachment-preview"><img src="${attachment.dataUrl}" alt="${escapeHtml(
            attachment.name,
          )}" /></div>`
        : `<div class="attachment-note">طھظ… ط¥ط±ظپط§ظ‚ ط§ظ„ظ…ظ„ظپ: ${escapeHtml(
            attachment.name,
          )}<br />ظ†ظˆط¹ ط§ظ„ظ…ط³طھظ†ط¯: ${escapeHtml(documentType || 'ظ…ط±ظپظ‚')}</div>`

      return `
        <section class="attachment-page">
          <h2>مرفق فاتورة ${index}</h2>
          <p>البند: ${escapeHtml(category)} | نوع المستند: ${escapeHtml(documentType || '-')} | الجهة المصدرة له: ${escapeHtml(issuer || '-')}</p>
          ${preview}
        </section>
      `
    })
    .join('')
}

export async function buildLoanRequestDocx(loan: LoanDocumentRecord) {
  return createWordCompatibleDocument(buildLoanRequestWordHtml(loan))
}

export async function buildSettlementDocx(loan: LoanDocumentRecord) {
  return createWordCompatibleDocument(buildSettlementWordHtml(loan))
}

export function buildLoanRequestWordHtml(loan: LoanDocumentRecord) {
  const tableFontSize =
    loan.items.length >= 5 ? '11px' : loan.items.length >= 3 ? '12px' : '13px'
  const rows = normalizeLoanTemplateRows(loan)
    .map(
      (item) => `
        <tr>
          <td style="width:5%;">${item.index}.</td>
          <td style="width:16%;">${item.amount}</td>
          <td class="text-right">${escapeHtml(item.category)}</td>
          <td style="width:28%;">${escapeHtml(item.notes)}</td>
        </tr>
      `,
    )
    .join('')

  const budgetApproved = loan.budgetApproved === true
  const budgetRejected = loan.budgetApproved === false

  const body = `
    <div class="print-title">
      <h2>ظ†ظ…ظˆط°ط¬ ط±ظ‚ظ… 18</h2>
      <h1>ط·ظ„ط¨ طµط±ظپ ط³ظ„ظپط© ظ…ط¤ظ‚طھط© ظ„ظ„ط¹ظ…ظ„</h1>
    </div>

    <div class="reference-line">ط±ظ‚ظ… ظ…ط±ط¬ط¹ظٹ: ${escapeHtml(loan.refNumber)}</div>

    <div class="formal-text">
      <p>ظ…ط¹ط§ظ„ظٹ ط±ط¦ظٹط³ ط§ظ„ط¬ط§ظ…ط¹ط©</p>
      <p>ط§ظ„ط³ظ„ط§ظ… ط¹ظ„ظٹظƒظ… ظˆط±ط­ظ…ط© ط§ظ„ظ„ظ‡ ظˆط¨ط±ظƒط§طھظ‡</p>
      <p>ط¢ظ…ظ„ ط§ظ„ظ…ظˆط§ظپظ‚ط© ط¹ظ„ظ‰ طµط±ظپ ط³ظ„ظپط© ظ†ظ‚ط¯ظٹط© ظ…ط¤ظ‚طھط© ظˆظپظ‚ ظ…ط§ ظٹظ„ظٹ:</p>
    </div>

    <div class="meta-grid">
      <div class="meta-row"><span class="meta-label">ظ…ط¨ظ„ط؛ ط§ظ„ط³ظ„ظپط© ط±ظ‚ظ…ظ‹ط§:</span><span class="meta-value">${formatNumber(loan.amount)}</span></div>
      <div class="meta-row"><span class="meta-label">ظƒطھط§ط¨ط©:</span><span class="meta-value">${escapeHtml(numberToArabicWords(loan.amount))}</span></div>
      <div class="meta-row"><span class="meta-label">ط§ط³ظ… ط§ظ„ظ†ط´ط§ط·:</span><span class="meta-value">${escapeHtml(loan.activity)}</span></div>
      <div class="choice-line">
        <span class="choice-item"><span class="box">${budgetApproved ? 'âœ“' : ''}</span>ظ…ط¹طھظ…ط¯ ظپظٹ ط§ظ„ظ…ظˆط§ط²ظ†ط©</span>
        <span class="choice-item"><span class="box">${budgetRejected ? 'âœ“' : ''}</span>ط؛ظٹط± ظ…ط¹طھظ…ط¯</span>
      </div>
      <div class="meta-row"><span class="meta-label">ط§ظ„ط¬ظ‡ط© ط§ظ„ظ…ظ†ظپط°ط© ظ„ظ„ظ†ط´ط§ط·:</span><span class="meta-value">ظˆظƒط§ظ„ط© ط§ظ„طھط¯ط±ظٹط¨</span></div>
      <div></div>
      <div class="meta-row"><span class="meta-label">ظپطھط±ط© طھظ†ظپظٹط° ط§ظ„ظ†ط´ط§ط·:</span><span class="meta-value">ظ…ظ† ${formatDate(loan.startDate)} ط¥ظ„ظ‰ ${formatDate(loan.endDate)}</span></div>
      <div class="meta-row"><span class="meta-label">ظ…ظƒط§ظ† ط§ظ„طھظ†ظپظٹط°:</span><span class="meta-value">${escapeHtml(loan.location ?? '')}</span></div>
      <div class="meta-row"><span class="meta-label">ط§ظ„ط³ظ„ظپط© ط¨ط§ط³ظ… ط§ظ„ظ…ظˆط¸ظپ:</span><span class="meta-value">${escapeHtml(loan.employee)}</span></div>
      <div class="meta-row"><span class="meta-label">طھظˆظ‚ظٹط¹ ط·ط§ظ„ط¨ ط§ظ„ط³ظ„ظپط©:</span><span class="meta-value"></span></div>
    </div>

    <table class="form-grid" style="font-size: ${tableFontSize};">
      <thead>
        <tr>
          <th style="width:5%;">ظ…</th>
          <th style="width:16%;">ط§ظ„ظ…ط¨ظ„ط؛</th>
          <th>ط£ظˆط¬ظ‡ ط§ظ„طµط±ظپ</th>
          <th style="width:28%;">ط§ظ„ظ…ظ„ط§ط­ط¸ط§طھ</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="4"><strong>ط§ظ„ط¥ط¬ظ…ط§ظ„ظٹ:</strong> ${formatNumber(loan.amount)} ط±ظٹط§ظ„</td>
        </tr>
      </tfoot>
    </table>

    <div class="official-inline" style="grid-template-columns: 0.9fr 1fr 1.55fr 1fr;">
      <span>ظ…ط³ط¤ظˆظ„ ط§ظ„ط¬ظ‡ط©:</span>
      <span>ظˆظƒظٹظ„ ط§ظ„ط¬ط§ظ…ط¹ط© ظ„ظ„طھط¯ط±ظٹط¨</span>
      <span>ط§ظ„ط§ط³ظ…: ط¯. ط¹ط¨ط¯ط§ظ„ط±ط²ط§ظ‚ ط¨ظ† ط¹ط¨ط¯ط§ظ„ط¹ط²ظٹط² ط§ظ„ظ…ط±ط¬ط§ظ†</span>
      <span>ط§ظ„طھظˆظ‚ظٹط¹: <span class="signature-line"></span></span>
    </div>

    <div class="official-panel">
      <h3>ط±ط£ظٹ ط§ظ„ظ…ط±ط§ظ‚ط¨ ط§ظ„ظ…ط§ظ„ظٹ:</h3>
      <p class="row">
        <span class="approval-choice"><span class="box"></span>ظ…ط³طھظˆظپظٹ</span>
        <span class="approval-choice"><span class="box"></span>ط؛ظٹط± ظ…ط³طھظˆظپظٹ ظ„ظ„ط¢طھظٹ:</span>
      </p>
      <div class="row nowrap" style="margin-top: 30px;">
        <span>ط§ظ„ط§ط³ظ…: ط´ط±ظٹظپ ظ…ط­ظ…ط¯ ظ…طµط·ظپظ‰ ط§ظ„ط؛ط²ظˆظ„ظٹ</span>
        <span>ط§ظ„طھظˆظ‚ظٹط¹: <span class="signature-line"></span></span>
        <span>ط§ظ„طھط§ط±ظٹط®: <span class="signature-line"></span></span>
      </div>
    </div>

    <div class="official-panel">
      <h3>ط§ط¹طھظ…ط§ط¯ ط±ط¦ظٹط³ ط§ظ„ط¬ط§ظ…ط¹ط©</h3>
      <p class="row">
        <span class="approval-choice"><span class="box"></span>ظ†ظˆط§ظپظ‚</span>
        <span class="approval-choice"><span class="box"></span>ظ„ط§ ظ†ظˆط§ظپظ‚</span>
      </p>
      <p style="margin-top: 10px;">ظˆط¹ظ„ظ‰ ظƒظ„ ظپظٹظ…ط§ ظٹط®طµظ‡ ط¥ظƒظ…ط§ظ„ ط§ظ„ظ„ط§ط²ظ… ظˆظپظ‚ ط§ظ„ط¶ظˆط§ط¨ط· ط§ظ„ظ…ط­ط¯ط¯ط©.</p>
      <div class="row" style="margin-top: 30px; flex-wrap: nowrap;">
        <span>ط±ط¦ظٹط³ ط§ظ„ط¬ط§ظ…ط¹ط©: <span class="signature-line" style="min-width: 180px;"></span></span>
        <span>ط§ظ„طھط§ط±ظٹط®: <span class="signature-line" style="min-width: 120px;"></span></span>
        <span>ط§ظ„طھظˆظ‚ظٹط¹: <span class="signature-line"></span></span>
      </div>
    </div>
  `

  return printShell(body, {
    pageMargins: '30mm 14mm 16mm 14mm',
    fontFamily: '"BoutrosJazirahTextLight", Tahoma, Arial, sans-serif',
    fontSize: '12.8pt',
    lineHeight: '1.26',
    sheetWidth: '182mm',
    sheetMinHeight: '215mm',
    fontFaceCss: `
      @font-face {
        font-family: "BoutrosJazirahTextLight";
        src: url("/fonts/BoutrosJazirahTextLight.ttf") format("truetype");
        font-weight: 300;
        font-style: normal;
      }
    `,
  })
}

export function buildSettlementWordHtml(loan: LoanDocumentRecord) {
  const settlement = loan.settlement
  const settlementMeta = normalizeSettlementMeta(settlement?.invoices)
  const rows = normalizeSettlementTemplateRows(loan)
    .map(
      (row) => `
        <tr>
          <td style="width:5%;">${row.index}.</td>
          <td class="text-right text-top">${escapeHtml(row.category)}</td>
          <td style="width:12%;">${row.amount}</td>
          <td style="width:11%;" class="text-top">${row.documentType}</td>
          <td style="width:14%;" class="text-top">${row.documentDate}</td>
          <td style="width:21%;" class="text-top">${row.issuer}</td>
        </tr>
      `,
    )
    .join('')

  const attachmentPages = buildSettlementAttachmentPages(loan)

  const body = `
    <div class="print-title">
      <h2>ظ†ظ…ظˆط°ط¬ ط±ظ‚ظ… 19</h2>
      <h1>ط·ظ„ط¨ طھط³ظˆظٹط© ط³ظ„ظپط© ظ…ط¤ظ‚طھط©</h1>
    </div>
    <div class="reference-line">ط±ظ‚ظ… ط§ظ„ظ…ط±ط¬ط¹: ${escapeHtml(loan.refNumber)}</div>

    <div class="formal-text">
      <p>ظ„ظ…ط¹ط§ظ„ظٹ ط±ط¦ظٹط³ ط§ظ„ط¬ط§ظ…ط¹ط© ظ…ط¹ ط§ظ„ط§ط­طھط±ط§ظ… ظˆط§ظ„طھظ‚ط¯ظٹط±</p>
      <p>ط§ظ„ط³ظ„ط§ظ… ط¹ظ„ظٹظƒظ… ظˆط±ط­ظ…ط© ط§ظ„ظ„ظ‡ ظˆط¨ط±ظƒط§طھظ‡</p>
      <p>ط¢ظ…ظ„ ط§ظ„طھظپط¶ظ„ ط¨ط§ظ„ظ…ظˆط§ظپظ‚ط© ط¹ظ„ظ‰ طھط³ظˆظٹط© ط§ظ„ط³ظ„ظپط© ط§ظ„ظ…طµط±ظˆظپط© ط¨ط§ط³ظ…ظٹ ظˆظپظ‚ ط§ظ„ط¨ظٹط§ظ†ط§طھ ط§ظ„ظ…ط­ط¯ط¯ط© ط£ط¯ظ†ط§ظ‡:</p>
    </div>

    <div class="meta-grid">
      <div class="meta-row"><span class="meta-label">ط§ط³ظ… ط§ظ„ظ†ط´ط§ط·:</span><span class="meta-value">${escapeHtml(loan.activity)}</span></div>
      <div class="meta-row"><span class="meta-label">ظ…ظƒط§ظ† ط§ظ„طھظ†ظپظٹط°:</span><span class="meta-value">${escapeHtml(loan.location ?? '')}</span></div>
      <div class="meta-row"><span class="meta-label">ط§ظ„ط¬ظ‡ط© ط§ظ„ظ…ظ†ظپط°ط© ظ„ظ„ظ†ط´ط§ط·:</span><span class="meta-value">ظˆظƒط§ظ„ط© ط§ظ„طھط¯ط±ظٹط¨</span></div>
      <div></div>
      <div class="meta-row"><span class="meta-label">طھط§ط±ظٹط® ط¨ط¯ط§ظٹط© ط§ظ„ظ†ط´ط§ط·:</span><span class="meta-value">${formatDate(loan.startDate)}</span></div>
      <div class="meta-row"><span class="meta-label">ظ†ظ‡ط§ظٹط© ط§ظ„ظ†ط´ط§ط·:</span><span class="meta-value">${formatDate(loan.endDate)}</span></div>
      <div class="meta-row"><span class="meta-label">طھط§ط±ظٹط® ط¨ط¯ط§ظٹط© ط§ظ„طµط±ظپ:</span><span class="meta-value">${formatDate(loan.startDate)}</span></div>
      <div class="meta-row"><span class="meta-label">ظ†ظ‡ط§ظٹط© ط§ظ„طµط±ظپ:</span><span class="meta-value">${formatDate(loan.endDate)}</span></div>
    </div>

    <table class="form-grid">
      <thead>
        <tr>
          <th style="width:5%;">ظ…</th>
          <th>ط£ظˆط¬ظ‡ ط§ظ„طµط±ظپ ط§ظ„ظپط¹ظ„ظٹط©</th>
          <th style="width:12%;">ط§ظ„ظ…ط¨ظ„ط؛<br />ط¨ط§ظ„ط±ظٹط§ظ„</th>
          <th style="width:11%;">ظ†ظˆط¹ظ‡</th>
          <th style="width:14%;">طھط§ط±ظٹط®ظ‡</th>
          <th style="width:21%;">ط§ظ„ط¬ظ‡ط© ط§ظ„ظ…طµط¯ط±ط© ظ„ظ‡</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <table class="form-grid totals-table">
      <tr>
        <td>ط§ظ„ظ…طµط±ظˆظپط§طھ ط§ظ„ظ…ط¤ظٹط¯ط© ط¨ظ…ط³طھظ†ط¯ط§طھ</td>
        <td>${formatNumber(Number(settlement?.supported ?? 0))}</td>
      </tr>
      <tr>
        <td>ط§ظ„ظ…طµط±ظˆظپط§طھ ط؛ظٹط± ط§ظ„ظ…ط¤ظٹط¯ط© ط¨ظ…ط³طھظ†ط¯ط§طھ</td>
        <td>${formatNumber(Number(settlement?.unsupported ?? 0))}</td>
      </tr>
      <tr>
        <td>ط¥ط¬ظ…ط§ظ„ظٹ ط§ظ„ظ…طµط±ظˆظپط§طھ ظ…ظ† ط§ظ„ط³ظ„ظپط©</td>
        <td>${formatNumber(Number(settlement?.total ?? 0))}</td>
      </tr>
      <tr>
        <td>ظ…ط¨ظ„ط؛ ط§ظ„ط³ظ„ظپط©</td>
        <td>${formatNumber(loan.amount)}</td>
      </tr>
      <tr>
        <td>ط§ظ„ظ…ط¨ظ„ط؛ ط§ظ„ظ…طµط±ظˆظپ ط¨ط§ظ„ط²ظٹط§ط¯ط© ط§ظ„ظ…ط·ظ„ظˆط¨ط© طµط±ظپظ‡</td>
        <td>${formatNumber(Number(settlement?.overage ?? 0))}</td>
      </tr>
      <tr>
        <td>ظˆظپط± ط§ظ„ط³ظ„ظپط© ط§ظ„ظ†ظ‚ط¯ظٹ</td>
        <td>${formatNumber(Number(settlement?.savings ?? 0))}</td>
      </tr>
    </table>

    <div class="official-inline" style="grid-template-columns: 1.2fr 0.9fr 0.6fr 0.7fr;">
      <span>ط§ط³ظ… ظ…ط³طھظ„ظ… ط§ظ„ط³ظ„ظپط©: ${escapeHtml(loan.employee)}</span>
      <span>ط±ظ‚ظ… ط³ظ†ط¯ ط§ظ„ظ‚ط¨ط¶: ${escapeHtml(settlementMeta.receiptNumber || '')}</span>
      <span></span>
      <span>طھط§ط±ظٹط®ظ‡: ${escapeHtml(formatDateOrBlank(settlementMeta.receiptDate || ''))}</span>
    </div>

    <div class="official-inline" style="grid-template-columns: 1.05fr 1.1fr 1fr;">
      <span>ظˆظƒظٹظ„ ط§ظ„ط¬ط§ظ…ط¹ط© ظ„ظ„طھط¯ط±ظٹط¨</span>
      <span>ط¯. ط¹ط¨ط¯ط§ظ„ط±ط²ط§ظ‚ ط¨ظ† ط¹ط¨ط¯ط§ظ„ط¹ط²ظٹط² ط§ظ„ظ…ط±ط¬ط§ظ†</span>
      <span>ط§ظ„طھظˆظ‚ظٹط¹: <span class="signature-line"></span></span>
    </div>

    <div class="official-panel">
      <h3>ط±ط£ظٹ ط§ظ„ظ…ط±ط§ظ‚ط¨ ط§ظ„ظ…ط§ظ„ظٹ:</h3>
      <p class="row">
        <span class="approval-choice"><span class="box"></span>ط§ظ„ظ…ط¹ط§ظ…ظ„ط© ظ…ط³طھظˆظپظٹط© ظ„ظ„ظ…طھط·ظ„ط¨ط§طھ ط§ظ„ظ†ط¸ط§ظ…ظٹط© ظ„ظ„طھط³ظˆظٹط©</span>
      </p>
      <p class="row">
        <span class="approval-choice"><span class="box"></span>ط§ظ„ظ…ط¹ط§ظ…ظ„ط© ط؛ظٹط± ظ…ط³طھظˆظپظٹط© ظ„ظ„ظ…طھط·ظ„ط¨ط§طھ ط§ظ„ظ†ط¸ط§ظ…ظٹط© ظ„ظ„طھط³ظˆظٹط© ظˆظٹط±ظپظ‚ ظ…ط°ظƒط±ط© ط¨ط§ظ„طھظپط§طµظٹظ„.</span>
      </p>
      <div class="row nowrap" style="margin-top: 22px;">
        <span>ط§ظ„ط§ط³ظ…: ط´ط±ظٹظپ ظ…ط­ظ…ط¯ ظ…طµط·ظپظ‰ ط§ظ„ط؛ط²ظˆظ„ظٹ</span>
        <span>ط§ظ„طھظˆظ‚ظٹط¹: <span class="signature-line"></span></span>
        <span>ط§ظ„طھط§ط±ظٹط®: <span class="signature-line"></span></span>
      </div>
    </div>

    <div class="official-panel">
      <h3>ط§ط¹طھظ…ط§ط¯ ط±ط¦ظٹط³ ط§ظ„ط¬ط§ظ…ط¹ط©</h3>
      <p class="row">
        <span class="approval-choice"><span class="box"></span>ط£ظˆط§ظپظ‚ ط¹ظ„ظ‰ طھط³ظˆظٹط© ط§ظ„ط³ظ„ظپط© ظˆظپظ‚ ظ…ط§ ظ‡ظˆ ظ…ط­ط¯ط¯ ط£ط¹ظ„ط§ظ‡.</span>
        <span class="approval-choice"><span class="box"></span>ظ„ط§ ط£ظˆط§ظپظ‚</span>
      </p>
      <p style="margin-top: 10px;">ظˆط¹ظ„ظ‰ ظƒظ„ ظپظٹظ…ط§ ظٹط®طµظ‡ ط¥ظƒظ…ط§ظ„ ط§ظ„ظ„ط§ط²ظ…</p>
      <div class="row nowrap" style="margin-top: 22px;">
        <span>ط±ط¦ظٹط³ ط§ظ„ط¬ط§ظ…ط¹ط©: <span class="signature-line" style="min-width: 180px;"></span></span>
        <span>ط§ظ„طھط§ط±ظٹط®: <span class="signature-line"></span></span>
        <span>ط§ظ„طھظˆظ‚ظٹط¹: <span class="signature-line"></span></span>
      </div>
    </div>
    ${attachmentPages}
  `

  return printShell(body, {
    pageMargins: '32mm 15mm 16mm 15mm',
    fontFamily: '"BoutrosJazirahTextLight", Tahoma, Arial, sans-serif',
    fontSize: '13.4pt',
    lineHeight: '1.24',
    sheetWidth: '178mm',
    sheetMinHeight: '218mm',
    fontFaceCss: `
      @font-face {
        font-family: "BoutrosJazirahTextLight";
        src: url("/fonts/BoutrosJazirahTextLight.ttf") format("truetype");
        font-weight: 300;
        font-style: normal;
      }
    `,
  })
}


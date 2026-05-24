import { readFile } from 'node:fs/promises'
import path from 'node:path'
import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'
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

type TemplateReplacement = {
  find: string
  replace: string
}

const TEMPLATE_DIRECTORY = path.join(process.cwd(), 'templates')
const LOAN_TEMPLATE_PATH = path.join(TEMPLATE_DIRECTORY, 'loan-form-18.docx')
const SETTLEMENT_TEMPLATE_PATH = path.join(TEMPLATE_DIRECTORY, 'settlement-form-19.docx')

const LOAN_TEMPLATE_REPLACEMENTS: TemplateReplacement[] = [
  { find: '??? ?????: {referenceNumber}', replace: 'رقم مرجعي: {referenceNumber}' },
  { find: '???? ?????? ?????: {amountNumber}', replace: 'مبلغ السلفة رقماً: {amountNumber}' },
  { find: '?????: {amountWords} ????', replace: 'كتابة: {amountWords} ريال' },
  { find: '??? ??????: {activity}', replace: 'اسم النشاط: {activity}' },
  {
    find: '???? ????? ??????: ?? {startDate} ??? {endDate}',
    replace: 'فترة تنفيذ النشاط: من {startDate} إلى {endDate}',
  },
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
  const receiptNumber = typeof source.receiptNumber === 'string'
    ? source.receiptNumber.trim()
    : ''
  const normalizedReceiptNumber = receiptNumber === '-' ? '' : receiptNumber

  return {
    receiptNumber: normalizedReceiptNumber,
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
    const totalSar = invoices.reduce((sum, invoice) => sum + Number(invoice.sar ?? 0), 0)
    const amount = totalSar > 0 ? totalSar : Number(detail.budget ?? 0)
    const isPettyCash = (detail.category ?? '').includes('نثريات')

    return {
      index: index + 1,
      category: detail.category?.trim() || 'بند صرف',
      amount: formatNumber(amount),
      documentType: isPettyCash
        ? 'موافقة المعالي'
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
          category: 'لا توجد بنود صرف مسجلة',
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
        category: detail.category?.trim() || 'بند صرف',
        index: index + 1,
        documentType: invoice.type || '',
        issuer: invoice.issuer || '',
        attachment: invoice.attachment as StoredFile,
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

  return attachments
    .map(({ category, index, documentType, issuer, attachment }) => {
      const preview = attachment.type.startsWith('image/')
        ? `<div class="attachment-preview"><img src="${attachment.dataUrl}" alt="${escapeHtml(
            attachment.name,
          )}" /></div>`
        : `<div class="attachment-note">تم إرفاق الملف: ${escapeHtml(
            attachment.name,
          )}<br />نوع المستند: ${escapeHtml(documentType || 'مرفق')}</div>`

      return `
        <section class="attachment-page">
          <h2>مرفق رقم ${index}</h2>
          <p>البند: ${escapeHtml(category)} | نوع المستند: ${escapeHtml(documentType || '-')} | الجهة المصدرة: ${escapeHtml(issuer || '-')}</p>
          ${preview}
        </section>
      `
    })
    .join('')
}

function joinPlainValues(values: Array<string | undefined>, separator = '\n') {
  return values
    .map((value) => value?.trim() ?? '')
    .filter(Boolean)
    .join(separator)
}

function normalizeSettlementDocxRows(loan: LoanDocumentRecord): SettlementTemplateRow[] {
  const details = normalizeSettlementDetails(loan.settlement?.invoices)

  return details.map((detail, index) => {
    const invoices = detail.invoices ?? []
    const totalSar = invoices.reduce((sum, invoice) => sum + Number(invoice.sar ?? 0), 0)
    const amount = totalSar > 0 ? totalSar : Number(detail.budget ?? 0)
    const isPettyCash = (detail.category ?? '').includes('نثريات')

    return {
      index: index + 1,
      category: detail.category?.trim() || 'بند صرف',
      amount: formatNumber(amount),
      documentType: isPettyCash
        ? 'موافقة المعالي'
        : joinPlainValues(invoices.map((invoice) => invoice.type)),
      documentDate: joinPlainValues(
        invoices.map((invoice) => formatDateOrBlank(invoice.date ?? '')),
      ),
      issuer: isPettyCash ? '' : joinPlainValues(invoices.map((invoice) => invoice.issuer)),
    }
  })
}

function padLoanRows(rows: LoanTemplateRow[], minimumRows = 2) {
  const paddedRows = [...rows]

  while (paddedRows.length < minimumRows) {
    paddedRows.push({
      index: paddedRows.length + 1,
      amount: '',
      category: '',
      notes: '',
    })
  }

  return paddedRows
}

function padSettlementRows(rows: SettlementTemplateRow[], minimumRows = 9) {
  const paddedRows = [...rows]

  while (paddedRows.length < minimumRows) {
    paddedRows.push({
      index: paddedRows.length + 1,
      category: '',
      amount: '',
      documentType: '',
      documentDate: '',
      issuer: '',
    })
  }

  return paddedRows
}

const TEMPLATE_GUID_VALUE = '{28A0092B-C50C-407E-A947-70E740481C1C}'
const TEMPLATE_GUID_TOKEN = '__DOCX_GUID_TOKEN__'

function patchTemplateDocumentXml(xml: string, replacements: TemplateReplacement[]) {
  return replacements.reduce(
    (current, replacement) => current.replaceAll(replacement.find, replacement.replace),
    xml,
  )
}

async function loadPatchedTemplate(
  templatePath: string,
  replacements: TemplateReplacement[],
) {
  const buffer = await readFile(templatePath)
  const zip = new PizZip(buffer)
  const document = zip.file('word/document.xml')

  if (!document) {
    throw new Error(`Missing document.xml in template: ${path.basename(templatePath)}`)
  }

  const patchedXml = patchTemplateDocumentXml(document.asText(), replacements).replaceAll(
    TEMPLATE_GUID_VALUE,
    TEMPLATE_GUID_TOKEN,
  )

  zip.file('word/document.xml', patchedXml)

  return zip
}

function renderDocxTemplate(
  templateZip: PizZip,
  data: Record<string, unknown>,
) {
  const doc = new Docxtemplater(templateZip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => '',
  })

  doc.render(data)

  const outputZip = doc.getZip()
  const renderedDocument = outputZip.file('word/document.xml')
  if (renderedDocument) {
    outputZip.file(
      'word/document.xml',
      renderedDocument.asText().replaceAll(TEMPLATE_GUID_TOKEN, TEMPLATE_GUID_VALUE),
    )
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

function escapeXml(value: string | number | null | undefined) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

type WordParagraphOptions = {
  align?: 'right' | 'center' | 'left'
  bold?: boolean
  size?: number
  before?: number
  after?: number
}

type WordCellOptions = {
  width?: number
  shade?: string
  bold?: boolean
  align?: 'right' | 'center' | 'left'
  size?: number
}

const WORD_FORM_FONT = 'BoutrosJazirahTextLight'
const WORD_PAGE_WIDTH = 11906
const WORD_PAGE_HEIGHT = 16838

function wordRun(text: string | number, options: WordParagraphOptions = {}) {
  const bold = options.bold ? '<w:b/>' : ''
  const size = options.size ?? 20
  const content = String(text ?? '')
    .split('\n')
    .map((part, index) => `${index > 0 ? '<w:br/>' : ''}<w:t xml:space="preserve">${escapeXml(part)}</w:t>`)
    .join('')

  return `<w:r><w:rPr><w:rFonts w:ascii="${WORD_FORM_FONT}" w:hAnsi="${WORD_FORM_FONT}" w:cs="${WORD_FORM_FONT}"/>${bold}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr>${content}</w:r>`
}

function wordParagraph(text: string | number = '', options: WordParagraphOptions = {}) {
  const align = options.align ?? 'right'
  const before = options.before ?? 0
  const after = options.after ?? 80

  return `<w:p><w:pPr><w:bidi/><w:jc w:val="${align}"/><w:spacing w:before="${before}" w:after="${after}"/></w:pPr>${wordRun(text, options)}</w:p>`
}

function wordCell(content: string, options: WordCellOptions = {}) {
  const width = options.width ? `<w:tcW w:w="${options.width}" w:type="dxa"/>` : ''
  const shade = options.shade ? `<w:shd w:fill="${options.shade}"/>` : ''
  const paragraph = content.startsWith('<w:p') || content.startsWith('<w:tbl')
    ? content
    : wordParagraph(content, {
        align: options.align ?? 'center',
        bold: options.bold,
        size: options.size ?? 18,
        after: 0,
      })

  return `<w:tc><w:tcPr>${width}${shade}<w:vAlign w:val="center"/></w:tcPr>${paragraph}</w:tc>`
}

function wordRow(cells: string[], height = 330) {
  return `<w:tr><w:trPr><w:trHeight w:val="${height}" w:hRule="atLeast"/></w:trPr>${cells.join('')}</w:tr>`
}

function wordTable(rows: string[], width = 9800) {
  return `<w:tbl><w:tblPr><w:bidiVisual/><w:tblW w:w="${width}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="single" w:sz="6"/><w:left w:val="single" w:sz="6"/><w:bottom w:val="single" w:sz="6"/><w:right w:val="single" w:sz="6"/><w:insideH w:val="single" w:sz="6"/><w:insideV w:val="single" w:sz="6"/></w:tblBorders></w:tblPr>${rows.join('')}</w:tbl>`
}

function wordSpacer(height: number) {
  return `<w:p><w:pPr><w:spacing w:before="0" w:after="0"/><w:rPr><w:sz w:val="2"/></w:rPr></w:pPr><w:r><w:rPr><w:sz w:val="2"/></w:rPr><w:t></w:t></w:r></w:p><w:p><w:pPr><w:spacing w:before="${height}" w:after="0"/></w:pPr></w:p>`
}

function wordInfoLine(label: string, value = '') {
  return wordParagraph(`${label}${value}`, { size: 19, after: 40 })
}

function wordBorderlessTable(rows: string[], width = 9000) {
  return `<w:tbl><w:tblPr><w:bidiVisual/><w:tblW w:w="${width}" w:type="dxa"/><w:tblLayout w:type="fixed"/></w:tblPr>${rows.join('')}</w:tbl>`
}

function wordPanel(title: string, lines: string[]) {
  const body = [
    wordParagraph(title, { bold: true, size: 20, after: 120 }),
    ...lines.map((line) => wordParagraph(line, { size: 18, after: 80 })),
  ].join('')

  return wordTable([wordRow([wordCell(body, { shade: 'D9D9D9', align: 'right' })], 1300)], 9000)
}

function buildDocxBuffer(documentBody: string, options?: { top?: number; bottom?: number; left?: number; right?: number }) {
  const top = options?.top ?? 900
  const bottom = options?.bottom ?? 900
  const left = options?.left ?? 850
  const right = options?.right ?? 850
  const zip = new PizZip()

  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/fontTable.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml"/></Types>`)
  zip.folder('_rels')?.file('.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`)
  zip.folder('word')?.file('_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`)
  zip.folder('word')?.file('styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${WORD_FORM_FONT}" w:hAnsi="${WORD_FORM_FONT}" w:cs="${WORD_FORM_FONT}"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:bidi/></w:pPr></w:pPrDefault></w:docDefaults></w:styles>`)
  zip.folder('word')?.file('fontTable.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:fonts xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:font w:name="${WORD_FORM_FONT}"><w:family w:val="roman"/><w:pitch w:val="variable"/></w:font></w:fonts>`)
  zip.folder('word')?.file('document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${documentBody}<w:sectPr><w:bidi/><w:pgSz w:w="${WORD_PAGE_WIDTH}" w:h="${WORD_PAGE_HEIGHT}"/><w:pgMar w:top="${top}" w:right="${right}" w:bottom="${bottom}" w:left="${left}" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`)

  return Buffer.from(zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }))
}

function buildLoanRequestFormalDocx(loan: LoanDocumentRecord) {
  const rows = padLoanRows(normalizeLoanTemplateRows(loan), 2)
  const budgetApproved = loan.budgetApproved === true ? '☑' : '☐'
  const budgetRejected = loan.budgetApproved === false ? '☑' : '☐'
  const expenseRows = rows.map((row) =>
    wordRow([
      wordCell(`${row.index}.`, { width: 550 }),
      wordCell(row.amount, { width: 1500, bold: row.index === 0 }),
      wordCell(row.category, { width: 5000, bold: row.index === 0 }),
      wordCell(row.notes, { width: 2700, bold: row.index === 0 }),
    ]),
  )
  const expenseTable = wordTable([
    wordRow([
      wordCell('م', { width: 550, shade: 'D9D9D9', bold: true }),
      wordCell('المبلغ', { width: 1500, shade: 'D9D9D9', bold: true }),
      wordCell('أوجه الصرف', { width: 5000, shade: 'D9D9D9', bold: true }),
      wordCell('الملاحظات', { width: 2700, shade: 'D9D9D9', bold: true }),
    ]),
    ...expenseRows,
    wordRow([
      wordCell('', { shade: 'D9D9D9' }),
      wordCell('', { shade: 'D9D9D9' }),
      wordCell('الإجمالي كتابة:', { shade: 'D9D9D9', bold: true }),
      wordCell(formatNumber(loan.amount), { shade: 'D9D9D9', bold: true }),
    ]),
  ])

  const metaRows = [
    wordRow([wordCell(wordInfoLine('مبلغ السلفة رقمًا: ', formatNumber(loan.amount)), { width: 4600, align: 'right' }), wordCell(wordInfoLine('كتابة: ', numberToArabicWords(loan.amount)), { width: 4600, align: 'right' })], 330),
    wordRow([wordCell(wordInfoLine('اسم النشاط: ', loan.activity), { align: 'right' }), wordCell(wordParagraph(`${budgetApproved} معتمد في الموازنة        ${budgetRejected} غير معتمد`, { size: 18, after: 0 }), { align: 'right' })], 330),
    wordRow([wordCell(wordInfoLine('الجهة المنفذة للنشاط: ', 'وكالة التدريب'), { align: 'right' }), wordCell('', {})], 330),
    wordRow([wordCell(wordInfoLine('فترة تنفيذ النشاط: من ', `${formatDate(loan.startDate)}     إلى     ${formatDate(loan.endDate)}`), { align: 'right' }), wordCell(wordInfoLine('مكان التنفيذ: ', loan.location ?? ''), { align: 'right' })], 330),
    wordRow([wordCell(wordInfoLine('السلفة باسم الموظف: ', loan.employee), { align: 'right' }), wordCell(wordInfoLine('توقيع طالب السلفة: ', ''), { align: 'right' })], 330),
  ]

  const body = [
    wordSpacer(2100),
    wordParagraph('نموذج رقم 18', { align: 'center', bold: true, size: 22, after: 80 }),
    wordParagraph('طلب صرف سلفة مؤقتة للعمل', { align: 'center', bold: true, size: 24, after: 260 }),
    wordParagraph(`رقم مرجعي: ${loan.refNumber}`, { align: 'right', bold: true, size: 20, after: 150 }),
    wordParagraph('معالي رئيس الجامعة', { bold: true, size: 20, after: 80 }),
    wordParagraph('السلام عليكم ورحمة الله وبركاته', { bold: true, size: 20, after: 160 }),
    wordParagraph('آمل الموافقة على صرف سلفة نقدية مؤقتة وفق ما يلي:', { size: 19, after: 160 }),
    wordBorderlessTable(metaRows, 9200),
    expenseTable,
    wordParagraph('مسؤول الجهة:      وكيل الجامعة للتدريب      الاسم: د. عبدالرزاق بن عبدالعزيز المرجان      التوقيع: ................', { bold: true, size: 18, after: 180 }),
    wordPanel('رأي المراقب المالي:', ['☐ مستوفي', '☐ غير مستوفي للآتي:', 'الاسم: شريف محمد مصطفى الغزولي        التوقيع: ........................        التاريخ: .... / .... / ....']),
    wordParagraph('', { after: 80 }),
    wordPanel('اعتماد رئيس الجامعة', ['☐ نوافق        ☐ لا نوافق', 'وعلى كل فيما يخصه إكمال اللازم وفق الضوابط المحددة', 'رئيس الجامعة: ................................        التوقيع: ........................        التاريخ: .... / .... / ....']),
  ].join('')

  return buildDocxBuffer(body, { top: 720, right: 900, left: 900, bottom: 720 })
}

function buildSettlementFormalDocx(loan: LoanDocumentRecord) {
  const settlement = loan.settlement
  const meta = normalizeSettlementMeta(settlement?.invoices)
  const rows = padSettlementRows(normalizeSettlementDocxRows(loan), 9)
  const settlementRows = rows.map((row) =>
    wordRow([
      wordCell(`${row.index}.`, { width: 450 }),
      wordCell(row.category, { width: 3400, align: 'right' }),
      wordCell(row.amount, { width: 1100 }),
      wordCell(row.documentType, { width: 1000 }),
      wordCell(row.documentDate, { width: 1600 }),
      wordCell(row.issuer, { width: 2100 }),
    ], 285),
  )
  const totals = [
    ['المصروفات المؤيدة بمستندات', formatNumber(Number(settlement?.supported ?? 0))],
    ['المصروفات غير المؤيدة بمستندات', formatNumber(Number(settlement?.unsupported ?? 0))],
    ['إجمالي المصروفات من السلفة', formatNumber(Number(settlement?.total ?? 0))],
    ['مبلغ السلفة', formatNumber(loan.amount)],
    ['المبلغ المصروف بالزيادة المطلوبة صرفه', formatNumber(Number(settlement?.overage ?? 0))],
    ['وفر السلفة النقدي', formatNumber(Number(settlement?.savings ?? 0))],
  ].map(([label, amount]) => wordRow([wordCell(label, { width: 3500, align: 'right' }), wordCell(amount, { width: 2400, shade: 'D9D9D9' })], 330))

  const body = [
    wordSpacer(1600),
    wordParagraph('نموذج رقم 19', { align: 'center', bold: true, size: 22, after: 80 }),
    wordParagraph('طلب تسوية سلفة مؤقتة', { align: 'center', bold: true, size: 22, after: 220 }),
    wordParagraph(`رقم المرجع: ${loan.refNumber}`, { align: 'right', bold: true, size: 20, after: 100 }),
    wordParagraph('لمعالي رئيس الجامعة مع الاحترام والتقدير', { bold: true, size: 20, after: 60 }),
    wordParagraph('السلام عليكم ورحمة الله وبركاته', { bold: true, size: 20, after: 150 }),
    wordParagraph('آمل التفضل بالموافقة على تسوية السلفة المصروفة باسمي وفق البيانات المحددة أدناه:', { size: 18, after: 150 }),
    wordBorderlessTable([
      wordRow([wordCell(wordInfoLine('اسم النشاط: ', loan.activity), { align: 'right' }), wordCell(wordInfoLine('مكان التنفيذ: ', loan.location ?? ''), { align: 'right' })], 300),
      wordRow([wordCell(wordInfoLine('الجهة المنفذة للنشاط: ', 'وكالة التدريب'), { align: 'right' }), wordCell('', {})], 300),
      wordRow([wordCell(wordInfoLine('تاريخ بداية النشاط: ', formatDate(loan.startDate)), { align: 'right' }), wordCell(wordInfoLine('نهاية النشاط: ', formatDate(loan.endDate)), { align: 'right' })], 300),
      wordRow([wordCell(wordInfoLine('تاريخ بداية الصرف: ', formatDate(loan.startDate)), { align: 'right' }), wordCell(wordInfoLine('نهاية الصرف: ', formatDate(loan.endDate)), { align: 'right' })], 300),
    ], 9000),
    wordTable([
      wordRow([
        wordCell('م', { width: 450, shade: 'D9D9D9', bold: true }),
        wordCell('أوجه الصرف الفعلية', { width: 3400, shade: 'D9D9D9', bold: true }),
        wordCell('المبلغ\nبالريال', { width: 1100, shade: 'D9D9D9', bold: true }),
        wordCell('نوعه', { width: 1000, shade: 'D9D9D9', bold: true }),
        wordCell('تاريخه', { width: 1600, shade: 'D9D9D9', bold: true }),
        wordCell('المستندات المؤيدة\nالجهة المصدرة له', { width: 2100, shade: 'D9D9D9', bold: true }),
      ], 360),
      ...settlementRows,
    ], 9650),
    wordBorderlessTable(totals, 6000),
    wordParagraph(`اسم مستلم السلفة: ${loan.employee}        رقم سند القبض: ${meta.receiptNumber ?? ''}        تاريخه: ${formatDateOrBlank(meta.receiptDate ?? '')}`, { size: 18, after: 120 }),
    wordParagraph('وكيل الجامعة للتدريب        د. عبدالرزاق بن عبدالعزيز المرجان        التوقيع: ........................', { bold: true, size: 18, after: 140 }),
    wordPanel('رأي المراقب المالي:', ['☐ المعاملة مستوفية للمتطلبات النظامية للتسوية', '☐ المعاملة غير مستوفية للمتطلبات النظامية للتسوية ويرفق مذكرة بالتفاصيل.', 'الاسم: شريف محمد مصطفى الغزولي        التوقيع: ........................        التاريخ: .... / .... / ....']),
    wordParagraph('', { after: 80 }),
    wordPanel('اعتماد رئيس الجامعة', ['☐ أوافق على تسوية السلفة وفق ما هو محدد أعلاه.        ☐ لا أوافق', 'وعلى كل فيما يخصه إكمال اللازم', 'رئيس الجامعة: ................................        التوقيع: ........................        التاريخ: .... / .... / ....']),
  ].join('')

  return buildDocxBuffer(body, { top: 720, right: 900, left: 900, bottom: 720 })
}

export async function buildLoanRequestDocx(loan: LoanDocumentRecord) {
  return buildLoanRequestFormalDocx(loan)
}

export async function buildSettlementDocx(loan: LoanDocumentRecord) {
  const templateZip = await loadPatchedTemplate(
    SETTLEMENT_TEMPLATE_PATH,
    SETTLEMENT_TEMPLATE_REPLACEMENTS,
  )
  return renderDocxTemplate(templateZip, createSettlementTemplateData(loan))
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
      <h2>نموذج رقم 18</h2>
      <h1>طلب صرف سلفة مؤقتة للعمل</h1>
    </div>

    <div class="reference-line">رقم مرجعي: ${escapeHtml(loan.refNumber)}</div>

    <div class="formal-text">
      <p>معالي رئيس الجامعة</p>
      <p>السلام عليكم ورحمة الله وبركاته</p>
      <p>آمل الموافقة على صرف سلفة نقدية مؤقتة وفق ما يلي:</p>
    </div>

    <div class="meta-grid">
      <div class="meta-row"><span class="meta-label">مبلغ السلفة رقمًا:</span><span class="meta-value">${formatNumber(loan.amount)}</span></div>
      <div class="meta-row"><span class="meta-label">كتابة:</span><span class="meta-value">${escapeHtml(numberToArabicWords(loan.amount))}</span></div>
      <div class="meta-row"><span class="meta-label">اسم النشاط:</span><span class="meta-value">${escapeHtml(loan.activity)}</span></div>
      <div class="choice-line">
        <span class="choice-item"><span class="box">${budgetApproved ? '✓' : ''}</span>معتمد في الموازنة</span>
        <span class="choice-item"><span class="box">${budgetRejected ? '✓' : ''}</span>غير معتمد</span>
      </div>
      <div class="meta-row"><span class="meta-label">الجهة المنفذة للنشاط:</span><span class="meta-value">وكالة التدريب</span></div>
      <div></div>
      <div class="meta-row"><span class="meta-label">فترة تنفيذ النشاط:</span><span class="meta-value">من ${formatDate(loan.startDate)} إلى ${formatDate(loan.endDate)}</span></div>
      <div class="meta-row"><span class="meta-label">مكان التنفيذ:</span><span class="meta-value">${escapeHtml(loan.location ?? '')}</span></div>
      <div class="meta-row"><span class="meta-label">السلفة باسم الموظف:</span><span class="meta-value">${escapeHtml(loan.employee)}</span></div>
      <div class="meta-row"><span class="meta-label">توقيع طالب السلفة:</span><span class="meta-value"></span></div>
    </div>

    <table class="form-grid" style="font-size: ${tableFontSize};">
      <thead>
        <tr>
          <th style="width:5%;">م</th>
          <th style="width:16%;">المبلغ</th>
          <th>أوجه الصرف</th>
          <th style="width:28%;">الملاحظات</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="4"><strong>الإجمالي:</strong> ${formatNumber(loan.amount)} ريال</td>
        </tr>
      </tfoot>
    </table>

    <div class="official-inline" style="grid-template-columns: 0.9fr 1fr 1.55fr 1fr;">
      <span>مسؤول الجهة:</span>
      <span>وكيل الجامعة للتدريب</span>
      <span>الاسم: د. عبدالرزاق بن عبدالعزيز المرجان</span>
      <span>التوقيع: <span class="signature-line"></span></span>
    </div>

    <div class="official-panel">
      <h3>رأي المراقب المالي:</h3>
      <p class="row">
        <span class="approval-choice"><span class="box"></span>مستوفي</span>
        <span class="approval-choice"><span class="box"></span>غير مستوفي للآتي:</span>
      </p>
      <div class="row nowrap" style="margin-top: 30px;">
        <span>الاسم: شريف محمد مصطفى الغزولي</span>
        <span>التوقيع: <span class="signature-line"></span></span>
        <span>التاريخ: <span class="signature-line"></span></span>
      </div>
    </div>

    <div class="official-panel">
      <h3>اعتماد رئيس الجامعة</h3>
      <p class="row">
        <span class="approval-choice"><span class="box"></span>نوافق</span>
        <span class="approval-choice"><span class="box"></span>لا نوافق</span>
      </p>
      <p style="margin-top: 10px;">وعلى كل فيما يخصه إكمال اللازم وفق الضوابط المحددة.</p>
      <div class="row" style="margin-top: 30px; flex-wrap: nowrap;">
        <span>رئيس الجامعة: <span class="signature-line" style="min-width: 180px;"></span></span>
        <span>التاريخ: <span class="signature-line" style="min-width: 120px;"></span></span>
        <span>التوقيع: <span class="signature-line"></span></span>
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
      <h2>نموذج رقم 19</h2>
      <h1>طلب تسوية سلفة مؤقتة</h1>
    </div>
    <div class="reference-line">رقم المرجع: ${escapeHtml(loan.refNumber)}</div>

    <div class="formal-text">
      <p>لمعالي رئيس الجامعة مع الاحترام والتقدير</p>
      <p>السلام عليكم ورحمة الله وبركاته</p>
      <p>آمل التفضل بالموافقة على تسوية السلفة المصروفة باسمي وفق البيانات المحددة أدناه:</p>
    </div>

    <div class="meta-grid">
      <div class="meta-row"><span class="meta-label">اسم النشاط:</span><span class="meta-value">${escapeHtml(loan.activity)}</span></div>
      <div class="meta-row"><span class="meta-label">مكان التنفيذ:</span><span class="meta-value">${escapeHtml(loan.location ?? '')}</span></div>
      <div class="meta-row"><span class="meta-label">الجهة المنفذة للنشاط:</span><span class="meta-value">وكالة التدريب</span></div>
      <div></div>
      <div class="meta-row"><span class="meta-label">تاريخ بداية النشاط:</span><span class="meta-value">${formatDate(loan.startDate)}</span></div>
      <div class="meta-row"><span class="meta-label">نهاية النشاط:</span><span class="meta-value">${formatDate(loan.endDate)}</span></div>
      <div class="meta-row"><span class="meta-label">تاريخ بداية الصرف:</span><span class="meta-value">${formatDate(loan.startDate)}</span></div>
      <div class="meta-row"><span class="meta-label">نهاية الصرف:</span><span class="meta-value">${formatDate(loan.endDate)}</span></div>
    </div>

    <table class="form-grid">
      <thead>
        <tr>
          <th style="width:5%;">م</th>
          <th>أوجه الصرف الفعلية</th>
          <th style="width:12%;">المبلغ<br />بالريال</th>
          <th style="width:11%;">نوعه</th>
          <th style="width:14%;">تاريخه</th>
          <th style="width:21%;">الجهة المصدرة له</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <table class="form-grid totals-table">
      <tr>
        <td>المصروفات المؤيدة بمستندات</td>
        <td>${formatNumber(Number(settlement?.supported ?? 0))}</td>
      </tr>
      <tr>
        <td>المصروفات غير المؤيدة بمستندات</td>
        <td>${formatNumber(Number(settlement?.unsupported ?? 0))}</td>
      </tr>
      <tr>
        <td>إجمالي المصروفات من السلفة</td>
        <td>${formatNumber(Number(settlement?.total ?? 0))}</td>
      </tr>
      <tr>
        <td>مبلغ السلفة</td>
        <td>${formatNumber(loan.amount)}</td>
      </tr>
      <tr>
        <td>المبلغ المصروف بالزيادة المطلوبة صرفه</td>
        <td>${formatNumber(Number(settlement?.overage ?? 0))}</td>
      </tr>
      <tr>
        <td>وفر السلفة النقدي</td>
        <td>${formatNumber(Number(settlement?.savings ?? 0))}</td>
      </tr>
    </table>

    <div class="official-inline" style="grid-template-columns: 1.2fr 0.9fr 0.6fr 0.7fr;">
      <span>اسم مستلم السلفة: ${escapeHtml(loan.employee)}</span>
      <span>رقم سند القبض: ${escapeHtml(settlementMeta.receiptNumber || '')}</span>
      <span></span>
      <span>تاريخه: ${escapeHtml(formatDateOrBlank(settlementMeta.receiptDate || ''))}</span>
    </div>

    <div class="official-inline" style="grid-template-columns: 1.05fr 1.1fr 1fr;">
      <span>وكيل الجامعة للتدريب</span>
      <span>د. عبدالرزاق بن عبدالعزيز المرجان</span>
      <span>التوقيع: <span class="signature-line"></span></span>
    </div>

    <div class="official-panel">
      <h3>رأي المراقب المالي:</h3>
      <p class="row">
        <span class="approval-choice"><span class="box"></span>المعاملة مستوفية للمتطلبات النظامية للتسوية</span>
      </p>
      <p class="row">
        <span class="approval-choice"><span class="box"></span>المعاملة غير مستوفية للمتطلبات النظامية للتسوية ويرفق مذكرة بالتفاصيل.</span>
      </p>
      <div class="row nowrap" style="margin-top: 22px;">
        <span>الاسم: شريف محمد مصطفى الغزولي</span>
        <span>التوقيع: <span class="signature-line"></span></span>
        <span>التاريخ: <span class="signature-line"></span></span>
      </div>
    </div>

    <div class="official-panel">
      <h3>اعتماد رئيس الجامعة</h3>
      <p class="row">
        <span class="approval-choice"><span class="box"></span>أوافق على تسوية السلفة وفق ما هو محدد أعلاه.</span>
        <span class="approval-choice"><span class="box"></span>لا أوافق</span>
      </p>
      <p style="margin-top: 10px;">وعلى كل فيما يخصه إكمال اللازم</p>
      <div class="row nowrap" style="margin-top: 22px;">
        <span>رئيس الجامعة: <span class="signature-line" style="min-width: 180px;"></span></span>
        <span>التاريخ: <span class="signature-line"></span></span>
        <span>التوقيع: <span class="signature-line"></span></span>
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


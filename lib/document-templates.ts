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
      margin-bottom: 6px;
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
      margin: 10px 0 12px;
      font-size: 15px;
      font-weight: 700;
    }
    .formal-text {
      text-align: right;
      margin-bottom: 10px;
      font-size: 15px;
      font-weight: 600;
    }
    .formal-text p { margin: 0 0 4px; }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 20px;
      margin-bottom: 12px;
      font-size: 14px;
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
      margin-top: 10px;
      margin-bottom: 10px;
      font-size: 14px;
    }
    table.form-grid th,
    table.form-grid td {
      border: 1px solid #111827;
      padding: 6px 8px;
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
      gap: 10px;
      margin: 10px 0 12px;
      align-items: center;
      font-size: 14px;
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
      padding: 14px 18px;
      margin-top: 10px;
      min-height: 128px;
      break-inside: avoid-page;
      page-break-inside: avoid;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .official-panel h3 {
      margin: 0 0 14px;
      text-align: right;
      font-size: 15px;
      font-weight: 700;
    }
    .official-panel p { margin: 0 0 10px; }
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
      font-size: 18px;
      text-align: right;
    }
    .attachment-page p {
      margin: 0;
      font-size: 13px;
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
          <h2>مرفق فاتورة ${index}</h2>
          <p>البند: ${escapeHtml(category)}</p>
          <p>نوع المستند: ${escapeHtml(documentType || '-')}</p>
          <p>الجهة المصدرة له: ${escapeHtml(issuer || '-')}</p>
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
    pageMargins: '34mm 16mm 20mm 16mm',
    fontFamily: '"BoutrosJazirahTextLight", Tahoma, Arial, sans-serif',
    fontSize: '13.2pt',
    lineHeight: '1.45',
    sheetWidth: '182mm',
    sheetMinHeight: '225mm',
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
      <div class="row" style="margin-top: 30px;">
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
      <div class="row nowrap" style="margin-top: 30px;">
        <span>رئيس الجامعة: <span class="signature-line" style="min-width: 180px;"></span></span>
        <span>التاريخ: <span class="signature-line"></span></span>
        <span>التوقيع: <span class="signature-line"></span></span>
      </div>
    </div>
    ${attachmentPages}
  `

  return printShell(body, {
    pageMargins: '38mm 18mm 22mm 18mm',
    fontFamily: '"BoutrosJazirahTextLight", Tahoma, Arial, sans-serif',
    fontSize: '14pt',
    lineHeight: '1.45',
    sheetWidth: '162mm',
    sheetMinHeight: '235mm',
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

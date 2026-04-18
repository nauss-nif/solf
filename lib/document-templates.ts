import { readFile } from 'node:fs/promises'
import path from 'node:path'
import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'
import { numberToArabicWords } from '@/lib/utils'

type LoanItemLike = {
  category: string
  amount: number
}

type SettlementInvoiceLike = {
  amount?: number
  currency?: string
  sar?: number
  type?: string
  date?: string
  issuer?: string
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

export type LoanDocumentRecord = {
  id: string
  refNumber: string
  employee: string
  activity: string
  location: string | null
  amount: number
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

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('ar-SA')
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('ar-SA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function printShell(body: string) {
  return `
  <style>
    @page { size: A4; margin: 10mm; }
    .print-sheet {
      width: 190mm;
      min-height: 277mm;
      margin: 0 auto;
      background: #fff;
      color: #111827;
      font-family: "Cairo", Tahoma, Arial, sans-serif;
      font-size: 14px;
      line-height: 1.7;
    }
    .print-title {
      text-align: center;
      margin-bottom: 8px;
      font-weight: 700;
    }
    .print-title h1,
    .print-title h2 {
      margin: 0;
      font-size: 18px;
      line-height: 1.5;
    }
    .print-title p {
      margin: 2px 0 0;
      font-size: 13px;
    }
    .reference-line {
      text-align: right;
      margin: 8px 0 10px;
      font-size: 15px;
      font-weight: 700;
    }
    .formal-text {
      text-align: right;
      margin-bottom: 10px;
      font-size: 15px;
      font-weight: 600;
    }
    .formal-text p {
      margin: 0 0 4px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px 24px;
      margin-bottom: 10px;
      font-size: 14px;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      white-space: nowrap;
    }
    .meta-label {
      font-weight: 700;
    }
    .meta-value {
      flex: 1;
      text-align: right;
      border-bottom: 1px dotted #111827;
      min-height: 20px;
      padding-inline: 4px;
    }
    .choice-line {
      display: flex;
      gap: 28px;
      margin: 4px 0 10px;
      font-size: 14px;
    }
    .choice-item {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .box {
      width: 14px;
      height: 14px;
      border: 1px solid #111827;
      display: inline-block;
    }
    table.form-grid {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
      margin-bottom: 8px;
      font-size: 14px;
    }
    table.form-grid th,
    table.form-grid td {
      border: 1px solid #111827;
      padding: 4px 6px;
      vertical-align: middle;
      text-align: center;
    }
    table.form-grid th {
      background: #ececec;
      font-weight: 700;
    }
    .text-right { text-align: right !important; }
    .totals-table {
      margin-top: 12px;
      margin-right: auto;
      width: 54%;
    }
    .official-inline {
      display: grid;
      grid-template-columns: 1.2fr 1.5fr 1fr;
      gap: 8px;
      align-items: center;
      margin: 10px 0 12px;
      font-size: 14px;
      font-weight: 700;
    }
    .official-panel {
      border: 1px solid #b9b9b9;
      background: #dedede;
      border-radius: 14px;
      padding: 12px 16px;
      margin-top: 8px;
      min-height: 118px;
    }
    .official-panel h3 {
      margin: 0 0 10px;
      text-align: right;
      font-size: 15px;
      font-weight: 700;
    }
    .official-panel p {
      margin: 0 0 8px;
    }
    .official-panel .row {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      align-items: center;
      flex-wrap: wrap;
    }
    .signature-line {
      display: inline-block;
      min-width: 120px;
      border-bottom: 1px dotted #111827;
      height: 20px;
      vertical-align: middle;
    }
    .approval-choice {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-inline-start: 14px;
    }
    .spacer-sm {
      height: 6px;
    }
    @media print {
      .print-sheet {
        width: 100%;
        min-height: auto;
      }
    }
  </style>
  <div class="print-sheet">${body}</div>`
}

function normalizeSettlementDetails(raw: unknown): SettlementDetailLike[] {
  if (!Array.isArray(raw)) return []

  return raw.map((detail) => {
    const item = detail as SettlementDetailLike

    return {
      category: String(item.category ?? ''),
      budget: Number(item.budget ?? 0),
      invoices: Array.isArray(item.invoices)
        ? item.invoices.map((invoice) => ({
            amount: Number(invoice.amount ?? 0),
            currency: String(invoice.currency ?? 'ر.س'),
            sar: Number(invoice.sar ?? invoice.amount ?? 0),
            type: invoice.type ? String(invoice.type) : '',
            date: invoice.date ? String(invoice.date) : '',
            issuer: invoice.issuer ? String(invoice.issuer) : '',
          }))
        : [],
    }
  })
}

function normalizeLoanTemplateRows(loan: LoanDocumentRecord): LoanTemplateRow[] {
  return loan.items.map((item, index) => ({
    index: index + 1,
    amount: formatNumber(item.amount),
    category: item.category,
    notes: '',
  }))
}

function normalizeSettlementTemplateRows(loan: LoanDocumentRecord): SettlementTemplateRow[] {
  const details = normalizeSettlementDetails(loan.settlement?.invoices)
  const rows = details.flatMap((detail, detailIndex) => {
    const invoices = detail.invoices?.length
      ? detail.invoices
      : [{ sar: detail.budget ?? 0, type: '', date: '', issuer: '' }]

    return invoices.map((invoice, invoiceIndex) => ({
      index: detailIndex + invoiceIndex + 1,
      category: detail.category || '—',
      amount: formatNumber(Number(invoice.sar ?? 0)),
      documentType: invoice.type || (Number(invoice.sar ?? 0) > 0 ? 'مستند' : ''),
      documentDate: invoice.date || '',
      issuer: invoice.issuer || '',
    }))
  })

  return rows.length > 0
    ? rows
    : [
        {
          index: 1,
          category: 'لا توجد تفاصيل تسوية محفوظة',
          amount: formatNumber(0),
          documentType: '',
          documentDate: '',
          issuer: '',
        },
      ]
}

async function renderDocxTemplate(templateName: string, data: Record<string, unknown>) {
  const templatePath = path.join(process.cwd(), 'templates', templateName)
  const content = await readFile(templatePath)
  const zip = new PizZip(content)
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  })

  doc.render(data)
  return Buffer.from(doc.getZip().generate({ type: 'nodebuffer' }))
}

export async function buildLoanRequestDocx(loan: LoanDocumentRecord) {
  return renderDocxTemplate('loan-form-18.docx', {
    referenceNumber: loan.refNumber,
    amountNumber: formatNumber(loan.amount),
    amountWords: numberToArabicWords(loan.amount),
    activity: loan.activity,
    location: loan.location ?? '—',
    startDate: formatDate(loan.startDate),
    endDate: formatDate(loan.endDate),
    employee: loan.employee,
    expenseRows: normalizeLoanTemplateRows(loan),
    totalAmount: formatNumber(loan.amount),
  })
}

export async function buildSettlementDocx(loan: LoanDocumentRecord) {
  const settlement = loan.settlement

  return renderDocxTemplate('settlement-form-19.docx', {
    referenceNumber: loan.refNumber,
    activity: loan.activity,
    location: loan.location ?? '—',
    startDate: formatDate(loan.startDate),
    endDate: formatDate(loan.endDate),
    settlementRows: normalizeSettlementTemplateRows(loan),
    supportedAmount: formatNumber(Number(settlement?.supported ?? 0)),
    unsupportedAmount: formatNumber(Number(settlement?.unsupported ?? 0)),
    totalAmount: formatNumber(Number(settlement?.total ?? 0)),
    loanAmount: formatNumber(loan.amount),
    overageAmount: formatNumber(Number(settlement?.overage ?? 0)),
    savingsAmount: formatNumber(Number(settlement?.savings ?? 0)),
    receiptNumber: '',
    receiptDate: '',
    employee: loan.employee,
  })
}

export function buildLoanRequestWordHtml(loan: LoanDocumentRecord) {
  const rows = normalizeLoanTemplateRows(loan)
    .map(
      (item) => `
        <tr>
          <td style="width:5%;">${item.index}.</td>
          <td style="width:15%;">${item.amount}</td>
          <td class="text-right">${escapeHtml(item.category)}</td>
          <td style="width:28%;"></td>
        </tr>
      `,
    )
    .join('')

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
      <div class="meta-row"><span class="meta-label">كتابة:</span><span class="meta-value">${escapeHtml(numberToArabicWords(loan.amount))} ريال</span></div>
      <div class="meta-row"><span class="meta-label">اسم النشاط:</span><span class="meta-value">${escapeHtml(loan.activity)}</span></div>
      <div class="choice-line">
        <span class="choice-item"><span class="box"></span>معتمد في الموازنة</span>
        <span class="choice-item"><span class="box"></span>غير معتمد</span>
      </div>
      <div class="meta-row"><span class="meta-label">الجهة المنفذة للنشاط:</span><span class="meta-value">وكالة التدريب</span></div>
      <div class="spacer-sm"></div>
      <div class="meta-row"><span class="meta-label">فترة تنفيذ النشاط:</span><span class="meta-value">من ${formatDate(loan.startDate)} إلى ${formatDate(loan.endDate)}</span></div>
      <div class="meta-row"><span class="meta-label">مكان التنفيذ:</span><span class="meta-value">${escapeHtml(loan.location ?? '—')}</span></div>
      <div class="meta-row"><span class="meta-label">السلفة باسم الموظف:</span><span class="meta-value">${escapeHtml(loan.employee)}</span></div>
      <div class="meta-row"><span class="meta-label">توقيع طالب السلفة:</span><span class="meta-value"></span></div>
    </div>

    <table class="form-grid">
      <thead>
        <tr>
          <th style="width:5%;">م</th>
          <th style="width:15%;">المبلغ</th>
          <th>أوجه الصرف</th>
          <th style="width:28%;">الملاحظات</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr>
          <td> </td>
          <td> </td>
          <td class="text-right"> </td>
          <td> </td>
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <td colspan="4"><strong>الإجمالي:</strong> ${formatNumber(loan.amount)} ريال</td>
        </tr>
      </tfoot>
    </table>

    <div class="official-inline">
      <span>مسؤول الجهة:</span>
      <span>وكيل الجامعة للتدريب</span>
      <span>الاسم: د. عبدالرزاق بن عبدالعزيز المرجان</span>
    </div>

    <div class="official-panel">
      <h3>رأي المراقب المالي:</h3>
      <p class="row">
        <span class="approval-choice"><span class="box"></span>مستوفي</span>
        <span class="approval-choice"><span class="box"></span>غير مستوفي للآتي:</span>
      </p>
      <div class="row" style="margin-top: 28px;">
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
      <div class="row" style="margin-top: 28px;">
        <span>رئيس الجامعة: <span class="signature-line" style="min-width: 160px;"></span></span>
        <span>التوقيع: <span class="signature-line"></span></span>
        <span>التاريخ: <span class="signature-line"></span></span>
      </div>
    </div>
  `

  return printShell(body)
}

export function buildSettlementWordHtml(loan: LoanDocumentRecord) {
  const settlement = loan.settlement
  const rows = normalizeSettlementTemplateRows(loan)
    .map(
      (row) => `
        <tr>
          <td style="width:5%;">${row.index}.</td>
          <td class="text-right">${escapeHtml(row.category)}</td>
          <td style="width:12%;">${row.amount}</td>
          <td style="width:11%;">${escapeHtml(row.documentType || '')}</td>
          <td style="width:14%;">${escapeHtml(row.documentDate || '')}</td>
          <td style="width:21%;">${escapeHtml(row.issuer || '')}</td>
        </tr>
      `,
    )
    .join('')

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
      <div class="meta-row"><span class="meta-label">مكان التنفيذ:</span><span class="meta-value">${escapeHtml(loan.location ?? '—')}</span></div>
      <div class="meta-row"><span class="meta-label">الجهة المنفذة للنشاط:</span><span class="meta-value">وكالة التدريب</span></div>
      <div></div>
      <div class="meta-row"><span class="meta-label">تاريخ بداية النشاط:</span><span class="meta-value">${formatDate(loan.startDate)}</span></div>
      <div class="meta-row"><span class="meta-label">نهاية النشاط</span><span class="meta-value">${formatDate(loan.endDate)}</span></div>
      <div class="meta-row"><span class="meta-label">تاريخ بداية الصرف:</span><span class="meta-value">${formatDate(loan.startDate)}</span></div>
      <div class="meta-row"><span class="meta-label">نهاية الصرف</span><span class="meta-value">${formatDate(loan.endDate)}</span></div>
    </div>

    <table class="form-grid">
      <thead>
        <tr>
          <th style="width:5%;">م</th>
          <th>أوجه الصرف الفعلية</th>
          <th style="width:12%;">المبلغ<br />الريال</th>
          <th style="width:11%;">نوعه</th>
          <th style="width:14%;">تاريخه</th>
          <th style="width:21%;">الجهة المصدرة له</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr><td> </td><td class="text-right"></td><td></td><td></td><td></td><td></td></tr>
        <tr><td> </td><td class="text-right"></td><td></td><td></td><td></td><td></td></tr>
        <tr><td> </td><td class="text-right"></td><td></td><td></td><td></td><td></td></tr>
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

    <div class="official-inline" style="grid-template-columns: 1.3fr 1fr 0.8fr 1fr;">
      <span>اسم مستلم السلفة: ${escapeHtml(loan.employee)}</span>
      <span>رقم سند القبض</span>
      <span></span>
      <span>تاريخه</span>
    </div>
    <div class="official-inline" style="grid-template-columns: 1.2fr 1fr 1fr;">
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
      <div class="row" style="margin-top: 30px;">
        <span>رئيس الجامعة: <span class="signature-line" style="min-width: 160px;"></span></span>
        <span>التوقيع: <span class="signature-line"></span></span>
        <span>التاريخ: <span class="signature-line"></span></span>
      </div>
    </div>
  `

  return printShell(body)
}

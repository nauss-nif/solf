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

function documentShell(title: string, body: string) {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4; margin: 16mm 12mm; }
    body {
      margin: 0;
      font-family: "Cairo", Tahoma, Arial, sans-serif;
      direction: rtl;
      color: #111827;
      background: #ffffff;
      font-size: 13px;
      line-height: 1.7;
    }
    .page {
      width: 100%;
      max-width: 185mm;
      margin: 0 auto;
    }
    .title {
      text-align: center;
      margin-bottom: 10px;
    }
    .title h1,
    .title h2,
    .title p {
      margin: 0;
      font-weight: 400;
    }
    .title h1 { font-size: 22px; margin-bottom: 3px; }
    .title h2 { font-size: 18px; margin-bottom: 4px; }
    .section { margin-bottom: 12px; }
    .text { margin: 0 0 6px; }
    table.grid {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }
    table.grid td,
    table.grid th {
      border: 1px solid #111827;
      padding: 6px 8px;
      vertical-align: top;
      font-weight: 400;
    }
    table.grid th {
      text-align: center;
      background: #f8fafc;
    }
    .inline-field {
      display: inline-block;
      min-width: 140px;
      border-bottom: 1px dotted #111827;
      padding: 0 4px 2px;
      margin-inline: 3px;
    }
    .signature {
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <div class="page">
    ${body}
  </div>
</body>
</html>`
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
          <td style="width:40px; text-align:center;">${item.index}</td>
          <td style="width:120px; text-align:center;">${item.amount}</td>
          <td>${escapeHtml(item.category)}</td>
          <td style="width:170px;"></td>
        </tr>
      `,
    )
    .join('')

  const body = `
    <div class="title">
      <h2>نموذج رقم 18</h2>
      <h1>طلب صرف سلفة مؤقتة للعمل</h1>
      <p>الرقم المرجعي: ${escapeHtml(loan.refNumber)}</p>
    </div>

    <div class="section">
      <p class="text">معالي رئيس الجامعة</p>
      <p class="text">السلام عليكم ورحمة الله وبركاته،</p>
      <p class="text">آمل الموافقة على صرف سلفة نقدية مؤقتة وفق البيانات التالية:</p>
    </div>

    <table class="grid">
      <tr>
        <td><strong>مبلغ السلفة رقمًا:</strong> ${formatNumber(loan.amount)} ريال</td>
        <td><strong>كتابة:</strong> ${escapeHtml(numberToArabicWords(loan.amount))}</td>
      </tr>
      <tr>
        <td><strong>اسم النشاط:</strong> ${escapeHtml(loan.activity)}</td>
        <td><strong>الجهة المنفذة:</strong> وكالة التدريب</td>
      </tr>
      <tr>
        <td><strong>فترة التنفيذ:</strong> من ${formatDate(loan.startDate)} إلى ${formatDate(loan.endDate)}</td>
        <td><strong>مكان التنفيذ:</strong> ${escapeHtml(loan.location ?? '—')}</td>
      </tr>
      <tr>
        <td colspan="2"><strong>السلفة باسم الموظف:</strong> ${escapeHtml(loan.employee)}</td>
      </tr>
    </table>

    <table class="grid">
      <thead>
        <tr>
          <th style="width:40px;">م</th>
          <th style="width:120px;">المبلغ</th>
          <th>أوجه الصرف</th>
          <th style="width:170px;">الملاحظات</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="4" style="text-align:left;"><strong>الإجمالي:</strong> ${formatNumber(loan.amount)} ريال</td>
        </tr>
      </tfoot>
    </table>
  `

  return documentShell(`نموذج 18 - ${loan.refNumber}`, body)
}

export function buildSettlementWordHtml(loan: LoanDocumentRecord) {
  const settlement = loan.settlement
  const rows = normalizeSettlementTemplateRows(loan)
    .map(
      (row) => `
        <tr>
          <td style="width:40px; text-align:center;">${row.index}</td>
          <td>${escapeHtml(row.category)}</td>
          <td style="width:95px; text-align:center;">${row.amount}</td>
          <td style="width:110px; text-align:center;">${escapeHtml(row.documentType || '—')}</td>
          <td style="width:110px; text-align:center;">${escapeHtml(row.documentDate || '—')}</td>
          <td style="width:160px; text-align:center;">${escapeHtml(row.issuer || '—')}</td>
        </tr>
      `,
    )
    .join('')

  const body = `
    <div class="title">
      <h2>نموذج رقم 19</h2>
      <h1>طلب تسوية سلفة مؤقتة</h1>
      <p>الرقم المرجعي: ${escapeHtml(loan.refNumber)}</p>
    </div>

    <table class="grid">
      <tr>
        <td><strong>اسم النشاط:</strong> ${escapeHtml(loan.activity)}</td>
        <td><strong>مكان التنفيذ:</strong> ${escapeHtml(loan.location ?? '—')}</td>
      </tr>
      <tr>
        <td><strong>الجهة المنفذة:</strong> وكالة التدريب</td>
        <td><strong>اسم الموظف:</strong> ${escapeHtml(loan.employee)}</td>
      </tr>
      <tr>
        <td><strong>بداية النشاط:</strong> ${formatDate(loan.startDate)}</td>
        <td><strong>نهاية النشاط:</strong> ${formatDate(loan.endDate)}</td>
      </tr>
    </table>

    <table class="grid">
      <thead>
        <tr>
          <th style="width:40px;">م</th>
          <th>أوجه الصرف الفعلية</th>
          <th style="width:95px;">المبلغ</th>
          <th style="width:110px;">نوع المستند</th>
          <th style="width:110px;">التاريخ</th>
          <th style="width:160px;">الجهة المصدرة</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <table class="grid">
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
  `

  return documentShell(`نموذج 19 - ${loan.refNumber}`, body)
}

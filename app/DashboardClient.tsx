'use client'

import Image from 'next/image'
import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  CURRENCY_OPTIONS,
  EXPENSE_CATEGORIES,
  GUIDE_SECTIONS,
  LOAN_ATTACHMENT_DEFINITIONS,
  SETTLEMENT_DOCUMENT_TYPES,
  toStoredFileArray,
  type CurrencyCode,
  type LoanRequestFiles,
  type SettlementCurrencyRate,
  type SettlementDetailRecord,
  type SettlementDocumentType,
  type StoredFile,
} from '@/lib/loan-form-options'
import { fileToStoredFile } from '@/lib/client-files'
import { formatCurrencySar, formatEnglishNumber, numberToArabicWords } from '@/lib/utils'

// ── TYPES ────────────────────────────────────────────────────────────────────

type LoanItemRecord   = { id: string; category: string; amount: number }
type SettlementRecord = { id: string; supported: number; unsupported: number; total: number; savings: number; overage: number; createdAt: string }

export type LoanDashboardRecord = {
  id: string; userId?: string; refNumber: string; employee: string; activity: string; location: string
  amount: number; budgetApproved: boolean | null
  reviewStatus: 'PENDING' | 'AWAITING_SECOND_REVIEW' | 'RETURNED' | 'REVIEWED'
  settlementStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED' | 'AWAITING_SECOND_REVIEW' | 'APPROVED' | 'OVERDUE'
  reviewNote?: string; startDate: string; endDate: string
  courseId?: string | null; courseCode?: string | null
  createdAt: string; updatedAt?: string; printedAt: string | null
  settlementDeadline?: string | null
  files?: LoanRequestFiles | null; isSettled: boolean
  isDraft?: boolean; settlementDraft?: { settlementItems?: SettlementDraft[]; currencyRates?: SettlementCurrencyRate[]; settlementMeta?: SettlementMetaState } | null
  recallRequested?: boolean; recallReason?: string | null
  reviewedById?: string | null; settlementReviewedById?: string | null
  secondReviewedById?: string | null; secondSettlementReviewedById?: string | null
  reviewedBy?: { id: string; fullName: string } | null
  secondReviewedBy?: { id: string; fullName: string } | null
  settlementReviewedBy?: { id: string; fullName: string } | null
  secondSettlementReviewedBy?: { id: string; fullName: string } | null
  items: LoanItemRecord[]; settlement: SettlementRecord | null
  user?: { email: string; fullName: string } | null
}

type CurrentUser = { userId: string; fullName: string; email: string; role: 'EMPLOYEE' | 'ADMIN' | 'REVIEWER'; roles: Array<'EMPLOYEE' | 'ADMIN' | 'REVIEWER'> }
type ExpenseDraft = { category: string; amount: string; customLabel?: string }
type InvoiceDraft = { amount: string; currencyCode: CurrencyCode; exchangeRate: string; sarAmount: number; documentType: SettlementDocumentType; invoiceDate: string; issuer: string; attachment: StoredFile | null }
type SettlementDraft = { id: string; category: string; budget: number; invoices: InvoiceDraft[]; isAdditional?: boolean }
type SettlementMetaState = { receiptNumber: string; receiptDate: string; overageReason: string; receiptAttachment?: StoredFile | null; exchangeRateProof?: StoredFile | null; exchangeRateProofDate?: string }
type ToastItem = { id: number; message: string; tone: 'success' | 'error' | 'info'; important: boolean }
type LoanFormState = { requestDate: string; refNumber: string; agencyCode: string; employee: string; activity: string; location: string; startDate: string; endDate: string; budgetApproved: boolean | null }
type ActiveTab = 'dashboard' | 'requests' | 'archive' | 'reports' | 'alerts' | 'guide'
type ReviewerQueueFilter = 'all' | 'advance' | 'settlement' | 'approved' | 'returned'
type NotificationItem = { id: string; type: string; title: string; message: string; isRead: boolean; createdAt: string; metadata?: { loanId?: string; refNumber?: string } | null }
type WorkMode = 'employee' | 'reviewer'
type LinkedCourse = { id: string; code: string; name: string; employeeEmail: string; location: string; startDate: string; endDate: string }
type ItemUsageStat = { category: string; requestCount: number; requestTotal: number; settlementCount: number; settlementTotal: number }

const AGENCY_CODE = '26'
const SETTLEMENT_GRACE_WORKDAYS = 10

// ── HELPERS ──────────────────────────────────────────────────────────────────

function formatDate(value: string) { return new Date(value).toLocaleDateString('en-GB') }

function getFirstName(fullName: string) { return fullName.trim().split(/\s+/)[0] || fullName }

function getDestinationLabel(location: string) { return location ? location.split(/[,،]/)[0].trim() : '' }

function workDaysSince(endDate: string) {
  const end = new Date(endDate); const today = new Date(); const current = new Date(end); let count = 0
  while (current < today) { current.setDate(current.getDate() + 1); const day = current.getDay(); if (day !== 5 && day !== 6) count++ }
  return count
}

// عداد تنازلي واحد لمهلة التسوية: أخضر وهو يتناقص، أحمر عند التأخير
function getSettlementCountdown(loan: { isSettled: boolean; settlementDeadline?: string | null }) {
  if (loan.isSettled || !loan.settlementDeadline) return null
  const dayMs = 1000 * 60 * 60 * 24
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const deadline = new Date(loan.settlementDeadline); deadline.setHours(0, 0, 0, 0)
  const diff = Math.round((deadline.getTime() - today.getTime()) / dayMs)
  const deadlineLabel = formatDate(loan.settlementDeadline)

  if (diff >= 0) {
    return {
      label: diff === 0 ? '⏳ اليوم آخر يوم لرفع التسوية!' : `⏳ متبقي ${formatEnglishNumber(diff)} يوم لرفع التسوية`,
      cls: 'alert-success',
      deadlineLabel,
      days: diff,
      overdue: false,
    }
  }
  return {
    label: `🚨 متأخر ${formatEnglishNumber(-diff)} يوم عن رفع التسوية!`,
    cls: 'alert-error',
    deadlineLabel,
    days: -diff,
    overdue: true,
  }
}

function workDaysBetween(startDate: string, endDate: string) {
  const start = new Date(startDate); const end = new Date(endDate); const current = new Date(start); let count = 0
  while (current < end) { current.setDate(current.getDate() + 1); const day = current.getDay(); if (day !== 5 && day !== 6) count++ }
  return count
}

const REVIEW_STATUS_LABEL: Record<string, string> = { PENDING: 'بانتظار الاعتماد', REVIEWED: 'معتمد', RETURNED: 'معاد للموظف' }

function downloadAgencyExcelReport(loans: LoanDashboardRecord[], itemUsage: ItemUsageStat[]) {
  const requesterMap = new Map<string, { count: number; totalAmount: number; totalSettlement: number; totalSavings: number }>()
  for (const loan of loans) {
    const r = requesterMap.get(loan.employee) ?? { count: 0, totalAmount: 0, totalSettlement: 0, totalSavings: 0 }
    r.count += 1
    r.totalAmount += loan.amount
    if (loan.isSettled && loan.settlement) {
      r.totalSettlement += loan.settlement.total
      r.totalSavings += loan.settlement.savings - loan.settlement.overage
    }
    requesterMap.set(loan.employee, r)
  }
  const requesters = [...requesterMap.entries()].sort((a, b) => b[1].totalAmount - a[1].totalAmount)

  const byRequestTotal = [...itemUsage].sort((a, b) => b.requestTotal - a.requestTotal)
  const mostUsedSettlement = [...itemUsage].filter((i) => i.settlementCount > 0).sort((a, b) => b.settlementCount - a.settlementCount).slice(0, 10)
  const leastUsedSettlement = [...itemUsage].filter((i) => i.settlementCount > 0).sort((a, b) => a.settlementCount - b.settlementCount).slice(0, 10)

  const escapeHtml = (value: string | number) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const tableRows = (rows: Array<Array<string | number>>) =>
    rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')

  const section = (title: string, headers: string[], rows: Array<Array<string | number>>) => `
    <h2>${escapeHtml(title)}</h2>
    <table border="1">
      <thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
      <tbody>${tableRows(rows)}</tbody>
    </table>
    <br/>
  `

  const html = `
    <html dir="rtl">
      <head>
        <meta charset="UTF-8" />
        <style>
          table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12px; }
          th, td { border: 1px solid #999; padding: 4px 8px; text-align: right; }
          th { background: #E7F3EE; font-weight: bold; }
          h2 { font-family: Arial, sans-serif; color: #1F3F40; }
        </style>
      </head>
      <body>
        <h1>التقرير الشامل لطلبات السلف والتسويات</h1>
        <p>تاريخ التصدير: ${new Date().toLocaleDateString('en-GB')}</p>

        ${section('أكثر الموظفين طلباً للسلف', ['الموظف', 'عدد الطلبات', 'إجمالي الطلب', 'إجمالي التسوية', 'صافي الوفر'],
          requesters.map(([employee, r]) => [employee, r.count, r.totalAmount.toFixed(2), r.totalSettlement.toFixed(2), r.totalSavings.toFixed(2)]))}

        ${section('أعلى البنود طلباً (حسب المبلغ)', ['البند', 'عدد المرات', 'إجمالي الطلب'],
          byRequestTotal.map((i) => [i.category, i.requestCount, i.requestTotal.toFixed(2)]))}

        ${section('أكثر البنود استخداماً في التسويات', ['البند', 'عدد المرات', 'إجمالي الصرف'],
          mostUsedSettlement.map((i) => [i.category, i.settlementCount, i.settlementTotal.toFixed(2)]))}

        ${section('أقل البنود استخداماً في التسويات', ['البند', 'عدد المرات', 'إجمالي الصرف'],
          leastUsedSettlement.map((i) => [i.category, i.settlementCount, i.settlementTotal.toFixed(2)]))}

        ${section('كافة الطلبات', ['الرقم المرجعي', 'الموظف', 'النشاط', 'المبلغ المطلوب', 'الحالة', 'التسوية', 'الوفر'],
          loans.map((loan) => [
            loan.refNumber,
            loan.employee,
            loan.activity,
            loan.amount.toFixed(2),
            loan.isSettled ? 'مسوّاة' : (REVIEW_STATUS_LABEL[loan.reviewStatus] ?? loan.reviewStatus),
            loan.isSettled ? (loan.settlement?.total ?? 0).toFixed(2) : '—',
            loan.isSettled ? ((loan.settlement?.savings ?? 0) - (loan.settlement?.overage ?? 0)).toFixed(2) : '—',
          ]))}
      </body>
    </html>
  `

  const blob = new Blob(['﻿', html], { type: 'application/vnd.ms-excel;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `تقرير-السلف-والتسويات-${new Date().toISOString().slice(0, 10)}.xls`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function generateRef(loans: LoanDashboardRecord[]) {
  const maxRef = loans.reduce((max, loan) => { const num = Number.parseInt(loan.refNumber.split('/')[2] ?? '0', 10); return Math.max(max, Number.isNaN(num) ? 0 : num) }, 0)
  return `وت/${AGENCY_CODE}/${String(maxRef + 1).padStart(4, '0')}`
}

function normalizeLoanRecord(loan: Omit<LoanDashboardRecord, 'location' | 'budgetApproved' | 'reviewStatus' | 'settlementStatus' | 'reviewNote' | 'printedAt' | 'files'> & { location?: string | null; budgetApproved?: boolean | null; reviewStatus?: string; settlementStatus?: string; reviewNote?: string; printedAt?: string | null; files?: LoanRequestFiles | null }): LoanDashboardRecord {
  return { ...loan, location: loan.location ?? '', budgetApproved: typeof loan.budgetApproved === 'boolean' ? loan.budgetApproved : null, reviewStatus: (loan.reviewStatus as LoanDashboardRecord['reviewStatus']) ?? 'PENDING', settlementStatus: (loan.settlementStatus as LoanDashboardRecord['settlementStatus']) ?? 'NOT_STARTED', reviewNote: loan.reviewNote ?? '', printedAt: loan.printedAt ?? null, files: loan.files ?? null, recallRequested: loan.recallRequested ?? false, recallReason: loan.recallReason ?? null, isDraft: loan.isDraft ?? false, settlementDraft: loan.settlementDraft ?? null }
}

function createEmptyLoanForm(currentUser: CurrentUser, loans: LoanDashboardRecord[]): LoanFormState {
  return { requestDate: new Date().toISOString().slice(0, 10), refNumber: generateRef(loans), agencyCode: AGENCY_CODE, employee: currentUser.fullName, activity: '', location: '', startDate: '', endDate: '', budgetApproved: null }
}

function createEmptyInvoice(currencyCode: CurrencyCode = 'SAR', exchangeRate = '1'): InvoiceDraft {
  return { amount: '', currencyCode, exchangeRate, sarAmount: 0, documentType: SETTLEMENT_DOCUMENT_TYPES[0], invoiceDate: '', issuer: '', attachment: null }
}

function createDraftId(prefix: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function createSettlementItem(category: string, budget: number, options?: { isAdditional?: boolean }): SettlementDraft {
  return { id: createDraftId('si'), category, budget, invoices: [createEmptyInvoice()], isAdditional: options?.isAdditional ?? false }
}

function createEmptyAttachments(): Record<string, StoredFile[]> {
  return Object.fromEntries(LOAN_ATTACHMENT_DEFINITIONS.map((a) => [a.key, []])) as Record<string, StoredFile[]>
}

function getCurrencyLabel(code: CurrencyCode) { return CURRENCY_OPTIONS.find((c) => c.code === code)?.label ?? code }
function getRateLabel(rate: SettlementCurrencyRate) { return rate.currencyCode === 'OTHER' ? (rate.customLabel?.trim() || 'أخرى') : getCurrencyLabel(rate.currencyCode) }
function isPettyCashCategory(category: string) { return category.includes('نثريات') }

function sortSettlementItems(items: SettlementDraft[]) {
  return [...items].sort((a, b) => { const ai = isPettyCashCategory(a.category); const bi = isPettyCashCategory(b.category); if (ai === bi) return 0; return ai ? 1 : -1 })
}

function settlementItemHasUserContent(item: SettlementDraft) {
  return item.invoices.some((inv) => Boolean(inv.amount) || Boolean(inv.attachment) || Boolean(inv.invoiceDate) || Boolean(inv.issuer.trim()))
}

// إعادة بناء بنود التسوية القابلة للتعديل من التفاصيل المحفوظة (لإعادة فتح تسوية مُقدَّمة قبل اعتمادها)
function rebuildSettlementItemsFromDetails(
  details: Array<{ category: string; budget?: number; invoices: Array<{ amount: number; currencyCode: CurrencyCode; exchangeRate: number; sar: number; documentType: SettlementDocumentType; invoiceDate: string; issuer: string; attachment: StoredFile | null }> }>,
  loanItems: LoanItemRecord[],
): SettlementDraft[] {
  const originalCategories = new Set(loanItems.map((i) => i.category))
  return details.map((d) => ({
    id: createDraftId('si'),
    category: d.category,
    budget: typeof d.budget === 'number' ? d.budget : (loanItems.find((i) => i.category === d.category)?.amount ?? 0),
    isAdditional: !originalCategories.has(d.category),
    invoices: d.invoices.length > 0 ? d.invoices.map((inv) => ({
      amount: String(inv.amount ?? ''),
      currencyCode: inv.currencyCode ?? 'SAR',
      exchangeRate: String(inv.exchangeRate ?? '1'),
      sarAmount: inv.sar ?? 0,
      documentType: inv.documentType ?? SETTLEMENT_DOCUMENT_TYPES[0],
      invoiceDate: inv.invoiceDate ?? '',
      issuer: inv.issuer ?? '',
      attachment: inv.attachment ?? null,
    })) : [createEmptyInvoice('SAR')],
  }))
}

function cloneStoredFile(file: StoredFile | null | undefined) {
  return file ? { name: file.name, type: file.type, size: file.size, dataUrl: file.dataUrl } : null
}

function toLoanRequestFiles(input: Record<string, StoredFile[]>): LoanRequestFiles {
  return Object.fromEntries(Object.entries(input).map(([k, v]) => [k, v.map((f) => cloneStoredFile(f) as StoredFile)]))
}

function buildRateMap(rates: SettlementCurrencyRate[]) {
  const map = new Map<CurrencyCode, number>(); map.set('SAR', 1)
  rates.forEach((r) => { if (r.currencyCode && r.rate > 0) map.set(r.currencyCode, r.rate) })
  return map
}

function recalculateInvoice(invoice: InvoiceDraft, rateMap: Map<CurrencyCode, number>): InvoiceDraft {
  const amount = Number.parseFloat(invoice.amount || '0') || 0
  const rate = invoice.currencyCode === 'SAR' ? 1 : (rateMap.get(invoice.currencyCode) ?? Number.parseFloat(invoice.exchangeRate || '0') ?? 0)
  return { ...invoice, exchangeRate: rate > 0 ? String(rate) : invoice.exchangeRate, sarAmount: amount * (rate || 0) }
}

function buildSettlementPayload(items: SettlementDraft[], rates: SettlementCurrencyRate[]): SettlementDetailRecord[] {
  const rateMap = buildRateMap(rates)
  return items.filter((item) => !item.isAdditional || item.category.trim() || settlementItemHasUserContent(item)).map((item) => ({
    category: item.category.trim(), budget: item.budget,
    invoices: item.invoices.filter((inv) => (Number.parseFloat(inv.amount || '0') || 0) > 0).map((inv) => ({
      amount: Number.parseFloat(inv.amount || '0') || 0, currencyCode: inv.currencyCode,
      exchangeRate: inv.currencyCode === 'SAR' ? 1 : (rateMap.get(inv.currencyCode) ?? Number.parseFloat(inv.exchangeRate || '0') ?? 0),
      sar: recalculateInvoice(inv, rateMap).sarAmount,
      documentType: inv.documentType,
      invoiceDate: isPettyCashCategory(item.category) ? '' : inv.invoiceDate,
      issuer: isPettyCashCategory(item.category) ? '' : inv.issuer.trim(),
      attachment: cloneStoredFile(inv.attachment),
    })),
  }))
}

// ── CHARTS (تحميل كسول — تُستخدم فقط في لوحة المراجع) ───────────────────────────
const ChartSkeleton = ({ height = 220 }: { height?: number }) => (
  <div className="flex items-center justify-center text-sm animate-pulse" style={{ height, color: '#B5BDBE' }}>...جاري تحميل الرسم البياني</div>
)
const MonthlyAmountsChart = dynamic(() => import('./dashboard-charts').then((m) => m.MonthlyAmountsChart), { ssr: false, loading: () => <ChartSkeleton /> })
const StatusDistributionChart = dynamic(() => import('./dashboard-charts').then((m) => m.StatusDistributionChart), { ssr: false, loading: () => <ChartSkeleton /> })
const CategoryUsageChart = dynamic(() => import('./dashboard-charts').then((m) => m.CategoryUsageChart), { ssr: false, loading: () => <ChartSkeleton /> })
const SettlementUrgencyRadarChart = dynamic(() => import('./dashboard-charts').then((m) => m.SettlementUrgencyRadarChart), { ssr: false, loading: () => <ChartSkeleton /> })
const ItemUsageInsights = dynamic(() => import('./dashboard-charts').then((m) => m.ItemUsageInsights), { ssr: false, loading: () => <ChartSkeleton height={160} /> })

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────────

export default function DashboardClient({ currentUser, initialLoans }: { currentUser: CurrentUser; initialLoans: LoanDashboardRecord[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isAdminOrReviewer = currentUser.roles.some((r) => r === 'ADMIN' || r === 'REVIEWER')
  const [isPending, startTransition] = useTransition()
  const [loans, setLoans] = useState<LoanDashboardRecord[]>(initialLoans.map(normalizeLoanRecord))
  const [isLoadingLoans, setIsLoadingLoans] = useState(initialLoans.length === 0)
  const [loadError, setLoadError] = useState('')
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    const tabParam = searchParams.get('tab')
    const validTabs: ActiveTab[] = ['dashboard', 'requests', 'archive', 'reports', 'alerts', 'guide']
    if (tabParam && (validTabs as string[]).includes(tabParam)) return tabParam as ActiveTab
    return isAdminOrReviewer ? 'dashboard' : 'requests'
  })
  const [search, setSearch] = useState('')
  const [loanModalOpen, setLoanModalOpen] = useState(false)
  const [settlementModalOpen, setSettlementModalOpen] = useState(false)
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null)
  const [editingLoanId, setEditingLoanId] = useState<string | null>(null)
  const [loanError, setLoanError] = useState('')
  const [settlementError, setSettlementError] = useState('')
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [loanForm, setLoanForm] = useState<LoanFormState>(() => createEmptyLoanForm(currentUser, initialLoans.map(normalizeLoanRecord)))
  const [expenses, setExpenses] = useState<ExpenseDraft[]>([{ category: '', amount: '' }])
  const [loanAttachments, setLoanAttachments] = useState<Record<string, StoredFile[]>>(createEmptyAttachments)
  const [currencyRates, setCurrencyRates] = useState<SettlementCurrencyRate[]>([])
  const [settlementItems, setSettlementItems] = useState<SettlementDraft[]>([])
  const [settlementMeta, setSettlementMeta] = useState<SettlementMetaState>({ receiptNumber: '', receiptDate: '', overageReason: '' })
  const [linkedCourse, setLinkedCourse] = useState<LinkedCourse | null>(null)
  const [handledCourseLink, setHandledCourseLink] = useState(false)
  const [navigationFeedback, setNavigationFeedback] = useState('')
  const [reviewerFilter, setReviewerFilter] = useState<ReviewerQueueFilter>('all')
  const [employeeStatFilter, setEmployeeStatFilter] = useState<'all' | 'pending' | 'overdue'>('all')
  const [itemUsage, setItemUsage] = useState<ItemUsageStat[]>([])
  const isAdmin = currentUser.roles.includes('ADMIN')
  const [reviewersList, setReviewersList] = useState<Array<{ id: string; fullName: string }>>([])
  const [onBehalfSelections, setOnBehalfSelections] = useState<Record<string, string>>({})
  const [myProfileImage, setMyProfileImage] = useState<StoredFile | null>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const [workMode, setWorkMode] = useState<WorkMode>(isAdminOrReviewer ? 'reviewer' : 'employee')
  const isReviewerMode = isAdminOrReviewer && workMode === 'reviewer'
  const isSuperAdmin = currentUser.email.toLowerCase() === 'od@nauss.edu.sa'
  const managementModeLabel = isSuperAdmin ? 'مدير النظام' : 'مراجع'
  const requestsSectionLabel = isReviewerMode ? 'اعتماد السلف والتسويات' : 'طلبات السلفة'

  function showNavigationFeedback(message: string) {
    setNavigationFeedback(message)
    window.setTimeout(() => setNavigationFeedback((current) => current === message ? '' : current), 2500)
  }

  function selectTab(tab: ActiveTab, label: string) {
    showNavigationFeedback(`جاري فتح ${label}...`)
    setActiveTab(tab)
  }

  function selectEmployeeStat(tab: ActiveTab, label: string, filter: 'all' | 'pending' | 'overdue') {
    setEmployeeStatFilter(filter)
    selectTab(tab, label)
  }

  function pushWithFeedback(url: string, message: string) {
    showNavigationFeedback(message)
    router.push(url)
  }

  async function refreshLoans(mode: WorkMode = workMode) {
    const url = isAdminOrReviewer && mode === 'employee' ? '/api/loans?scope=own' : '/api/loans'
    try { setIsLoadingLoans(true); setLoadError(''); const res = await fetch(url, { cache: 'no-store' }); if (!res.ok) throw new Error(); const data = await res.json() as LoanDashboardRecord[]; setLoans(data.map(normalizeLoanRecord)) }
    catch { setLoadError('تعذر تحميل بيانات السلف من الخادم.') }
    finally { setIsLoadingLoans(false) }
  }

  useEffect(() => { void refreshLoans(workMode) }, [workMode])

  useEffect(() => {
    if (!isAdminOrReviewer) return
    fetch('/api/reports/item-usage', { cache: 'no-store' })
      .then((res) => res.ok ? res.json() : [])
      .then((data: ItemUsageStat[]) => setItemUsage(Array.isArray(data) ? data : []))
      .catch(() => setItemUsage([]))
  }, [isAdminOrReviewer])
  useEffect(() => {
    if (!isAdmin) return
    fetch('/api/admin/reviewers', { cache: 'no-store' })
      .then((res) => res.ok ? res.json() : [])
      .then((data: Array<{ id: string; fullName: string }>) => setReviewersList(Array.isArray(data) ? data : []))
      .catch(() => setReviewersList([]))
  }, [isAdmin])
  useEffect(() => {
    fetch('/api/account', { cache: 'no-store' })
      .then((res) => res.ok ? res.json() : null)
      .then((data: { profileImage?: StoredFile | null } | null) => setMyProfileImage(data?.profileImage ?? null))
      .catch(() => setMyProfileImage(null))
  }, [])
  useEffect(() => {
    const timer = window.setTimeout(() => { void loadNotifications() }, 500)
    return () => window.clearTimeout(timer)
  }, [])
  useEffect(() => {
    if (handledCourseLink) return
    const courseId = searchParams.get('courseId')
    if (!courseId) return
    // انتظر تحميل قائمة السلف أولاً لنعرف إن كانت هناك معاملة مرتبطة بهذه الدورة بالفعل
    if (isLoadingLoans) return

    const formType = searchParams.get('formType') // 'settlement' | 'request'
    const existingLoan = loans.find((l) => l.courseId === courseId)

    if (existingLoan) {
      setHandledCourseLink(true)
      setWorkMode('employee')
      setActiveTab('requests')
      if (formType === 'settlement') {
        if (existingLoan.reviewStatus !== 'REVIEWED') {
          setLoadError('طلب السلفة المرتبط بهذه الدورة لم يُعتمد بعد (نموذج ١٨)، لذلك لا يمكن تقديم التسوية قبل اعتماده.')
          return
        }
        void openSettlementModal(existingLoan.id)
        return
      }
      void openEditLoanModal(existingLoan.id)
      return
    }

    if (formType === 'settlement') {
      setHandledCourseLink(true)
      setWorkMode('employee')
      setActiveTab('requests')
      setLoadError('لا يوجد طلب سلفة مرتبط بهذه الدورة لتسويته. يجب إنشاء طلب السلفة (نموذج ١٨) أولاً — تأكد أنه قُدِّم عبر زر "منصة السلف" من داخل الدورة نفسها حتى يُربط بها تلقائياً.')
      return
    }

    const course = {
      id: courseId,
      code: searchParams.get('courseCode') || '',
      name: searchParams.get('courseName') || '',
      employeeEmail: searchParams.get('employeeEmail') || '',
      location: searchParams.get('location') || '',
      startDate: searchParams.get('startDate') || '',
      endDate: searchParams.get('endDate') || '',
    }
    setHandledCourseLink(true)
    if (course.employeeEmail && course.employeeEmail.toLowerCase() !== currentUser.email.toLowerCase()) {
      setLoadError(`هذه الدورة مرتبطة بحساب ${course.employeeEmail}. سجّل الدخول بهذا الحساب في منصة السلف لإنشاء الطلب المرتبط.`)
      return
    }
    setLinkedCourse(course)
    setWorkMode('employee')
    setActiveTab('requests')
    setLoanForm((prev) => ({
      ...prev,
      activity: course.name || prev.activity,
      location: course.location || prev.location,
      startDate: course.startDate || prev.startDate,
      endDate: course.endDate || prev.endDate,
    }))
    setLoanModalOpen(true)
  }, [handledCourseLink, searchParams, isLoadingLoans, loans])

  useEffect(() => {
    const tab = searchParams.get('tab') as ActiveTab | null
    const filter = searchParams.get('filter') as ReviewerQueueFilter | null
    if (tab) setActiveTab(tab)
    if (filter) setReviewerFilter(filter)
  }, [])

  const showToast = (message: string, tone: ToastItem['tone'] = 'success', important = tone === 'error') => {
    const id = Date.now() + Math.floor(Math.random() * 1000)
    setToasts((curr) => [...curr.slice(-2), { id, message, tone, important }])
    window.setTimeout(() => setToasts((curr) => curr.filter((t) => t.id !== id)), important ? 5200 : 2600)
  }

  async function loadNotifications() {
    const res = await fetch('/api/notifications', { cache: 'no-store' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return
    setNotifications(Array.isArray(data.notifications) ? data.notifications : [])
    setUnreadNotifications(Number(data.unreadCount ?? 0))
  }

  async function toggleNotifications() {
    const nextOpen = !notificationsOpen
    setNotificationsOpen(nextOpen)
    if (!nextOpen || unreadNotifications === 0) return
    await fetch('/api/notifications', { method: 'PATCH' })
    setUnreadNotifications(0)
    setNotifications((curr) => curr.map((notification) => ({ ...notification, isRead: true })))
  }

  function openNotification(notification: NotificationItem) {
    setNotificationsOpen(false)
    if (notification.metadata?.loanId) {
      router.push(`/loans/${notification.metadata.loanId}`)
    }
  }

  const filteredLoans = useMemo(() => {
    const q = search.trim().toLowerCase(); if (!q) return loans
    return loans.filter((l) => l.refNumber.toLowerCase().includes(q) || l.employee.toLowerCase().includes(q) || l.activity.toLowerCase().includes(q) || l.location.toLowerCase().includes(q))
  }, [loans, search])

  const stats = useMemo(() => {
    const unsettled = loans.filter((l) => !l.isSettled); const settled = loans.filter((l) => l.isSettled)
    return { pending: unsettled.length, settled: settled.length, total: loans.length, overdue: unsettled.filter((l) => workDaysSince(l.endDate) > SETTLEMENT_GRACE_WORKDAYS).length, printed: loans.filter((l) => l.printedAt).length }
  }, [loans])

  const reportSummary = useMemo(() => ({
    totalRequested: loans.reduce((s, l) => s + l.amount, 0),
    totalExpenses: loans.reduce((s, l) => s + (l.settlement?.total ?? 0), 0),
    totalSavings: loans.reduce((s, l) => s + (l.settlement?.savings ?? 0), 0),
    totalOverage: loans.reduce((s, l) => s + (l.settlement?.overage ?? 0), 0),
  }), [loans])

  const categoryReport = useMemo(() => {
    const totals = new Map<string, number>()
    loans.forEach((l) => l.items.forEach((item) => totals.set(item.category, (totals.get(item.category) ?? 0) + item.amount)))
    return [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [loans])

  const monthlyData = useMemo(() => {
    const map = new Map<string, { requested: number; settled: number }>()
    loans.forEach((l) => {
      const month = new Date(l.createdAt).toLocaleDateString('ar-SA', { month: 'short', year: '2-digit' })
      const existing = map.get(month) ?? { requested: 0, settled: 0 }
      map.set(month, { requested: existing.requested + l.amount, settled: existing.settled + (l.settlement?.total ?? 0) })
    })
    return [...map.entries()].slice(-6).map(([name, vals]) => ({ name, ...vals }))
  }, [loans])

  const statusChartData = useMemo(() => [
    { name: 'قيد التسوية', value: stats.pending, color: '#C7B08C' },
    { name: 'مسوّاة', value: stats.settled, color: '#2A6364' },
    { name: 'متأخرة', value: stats.overdue, color: '#73384B' },
  ].filter((d) => d.value > 0), [stats])

  const settlementUrgencyData = useMemo(() => {
    const URGENCY_DECAY_DAYS = 15

    const openLoans = [...loans]
      .filter((l) => !l.isSettled)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

    const destinationCounts = new Map<string, number>()
    for (const loan of openLoans) {
      const dest = getDestinationLabel(loan.location)
      if (dest) destinationCounts.set(dest, (destinationCounts.get(dest) ?? 0) + 1)
    }

    const destinationSeen = new Map<string, number>()

    return openLoans.map((loan) => {
      const countdown = getSettlementCountdown(loan)
      const days = countdown?.days ?? 0
      const overdue = countdown?.overdue ?? false
      // كل ما اقترب موعد التسوية (قلّ عدد الأيام المتبقية) ارتفع المؤشر نحو 100
      const indicator = overdue ? 100 : Math.round(100 * Math.exp(-days / URGENCY_DECAY_DAYS))

      const dest = getDestinationLabel(loan.location)
      let label: string
      if (isReviewerMode) {
        label = getFirstName(loan.employee)
      } else if (dest && (destinationCounts.get(dest) ?? 0) > 1) {
        const seen = (destinationSeen.get(dest) ?? 0) + 1
        destinationSeen.set(dest, seen)
        label = `${dest} ${seen}`
      } else if (dest) {
        label = dest
      } else {
        label = getFirstName(loan.employee)
      }

      return { label, indicator, days, overdue }
    })
  }, [loans, isReviewerMode])

  const dashboardInsights = useMemo(() => {
    const requesters = new Map<string, { employee: string; count: number; active: number; settled: number; overdue: number; totalAmount: number }>()
    const settlers = new Map<string, { employee: string; count: number; totalSettlement: number; totalSavings: number; totalDays: number }>()
    const overdueLoans = loans
      .filter((loan) => !loan.isSettled)
      .map((loan) => ({ ...loan, workDaysAfterEnd: workDaysSince(loan.endDate), daysOverGrace: Math.max(0, workDaysSince(loan.endDate) - SETTLEMENT_GRACE_WORKDAYS) }))
      .filter((loan) => loan.workDaysAfterEnd > SETTLEMENT_GRACE_WORKDAYS)
      .sort((a, b) => b.daysOverGrace - a.daysOverGrace)

    loans.forEach((loan) => {
      const requester = requesters.get(loan.employee) ?? { employee: loan.employee, count: 0, active: 0, settled: 0, overdue: 0, totalAmount: 0 }
      requester.count += 1
      requester.totalAmount += loan.amount
      if (loan.isSettled) requester.settled += 1
      else requester.active += 1
      if (!loan.isSettled && workDaysSince(loan.endDate) > SETTLEMENT_GRACE_WORKDAYS) requester.overdue += 1
      requesters.set(loan.employee, requester)

      if (loan.isSettled && loan.settlement) {
        const settler = settlers.get(loan.employee) ?? { employee: loan.employee, count: 0, totalSettlement: 0, totalSavings: 0, totalDays: 0 }
        settler.count += 1
        settler.totalSettlement += loan.settlement.total
        settler.totalSavings += loan.settlement.savings - loan.settlement.overage
        settler.totalDays += workDaysBetween(loan.endDate, loan.settlement.createdAt)
        settlers.set(loan.employee, settler)
      }
    })

    return {
      requesterCount: requesters.size,
      settlerCount: settlers.size,
      topRequesters: [...requesters.values()].sort((a, b) => b.totalAmount - a.totalAmount).slice(0, 6),
      topSettlers: [...settlers.values()].sort((a, b) => b.count - a.count || b.totalSettlement - a.totalSettlement).slice(0, 6),
      overdueLoans,
      overdueAmount: overdueLoans.reduce((sum, loan) => sum + loan.amount, 0),
      averageSettleDays: [...settlers.values()].reduce((sum, item) => sum + item.totalDays, 0) / Math.max(1, [...settlers.values()].reduce((sum, item) => sum + item.count, 0)),
    }
  }, [loans])

  const executiveReport = useMemo(() => {
    const settledLoans = loans.filter((loan) => loan.isSettled && loan.settlement)
    const activeLoans = loans.filter((loan) => !loan.isSettled)
    const reviewedLoans = loans.filter((loan) => loan.reviewStatus === 'REVIEWED')
    const returnedLoans = loans.filter((loan) => loan.reviewStatus === 'RETURNED')
    const overdueLoans = activeLoans
      .map((loan) => ({ ...loan, days: workDaysSince(loan.endDate) }))
      .filter((loan) => loan.days > SETTLEMENT_GRACE_WORKDAYS)
      .sort((a, b) => b.days - a.days)

    const averageRequest = loans.length ? reportSummary.totalRequested / loans.length : 0
    const averageSettlement = settledLoans.length ? reportSummary.totalExpenses / settledLoans.length : 0
    const settlementRate = loans.length ? Math.round((settledLoans.length / loans.length) * 100) : 0
    const reviewRate = loans.length ? Math.round((reviewedLoans.length / loans.length) * 100) : 0
    const savingsRate = reportSummary.totalRequested > 0 ? (reportSummary.totalSavings / reportSummary.totalRequested) * 100 : 0
    const overageRate = reportSummary.totalRequested > 0 ? (reportSummary.totalOverage / reportSummary.totalRequested) * 100 : 0
    const netPosition = reportSummary.totalSavings - reportSummary.totalOverage
    const topLoans = [...loans].sort((a, b) => b.amount - a.amount).slice(0, 5)
    const topSettlements = settledLoans
      .sort((a, b) => (b.settlement?.total ?? 0) - (a.settlement?.total ?? 0))
      .slice(0, 5)
    const mainFinding = loans.length === 0
      ? 'لا توجد بيانات كافية لإصدار قراءة تنفيذية.'
      : overdueLoans.length > 0
        ? `يوجد ${formatEnglishNumber(overdueLoans.length)} طلب متأخر يحتاج متابعة مباشرة.`
        : settlementRate >= 70
          ? 'مستوى التسوية جيد ولا توجد مؤشرات تأخر جوهرية حالياً.'
          : 'نسبة التسوية تحتاج متابعة لرفع وتيرة إقفال الطلبات المفتوحة.'

    return {
      activeCount: activeLoans.length,
      settledCount: settledLoans.length,
      reviewedCount: reviewedLoans.length,
      returnedCount: returnedLoans.length,
      overdueLoans,
      averageRequest,
      averageSettlement,
      settlementRate,
      reviewRate,
      savingsRate,
      overageRate,
      netPosition,
      topLoans,
      topSettlements,
      mainFinding,
    }
  }, [loans, reportSummary])

  const settlementLoan = useMemo(() => loans.find((l) => l.id === selectedLoanId) ?? null, [loans, selectedLoanId])
  const rateMap = useMemo(() => buildRateMap(currencyRates), [currencyRates])
  const settlementSummary = useMemo(() => {
    if (!settlementLoan) return { supported: 0, unsupported: 0, total: 0, savings: 0, overage: 0 }
    const payload = buildSettlementPayload(settlementItems, currencyRates)
    const supported = payload.reduce((s, item) => s + (isPettyCashCategory(item.category) ? 0 : item.invoices.reduce((is, inv) => is + inv.sar, 0)), 0)
    const unsupported = payload.reduce((s, item) => s + (isPettyCashCategory(item.category) ? item.invoices.reduce((is, inv) => is + inv.sar, 0) : 0), 0)
    const total = supported + unsupported
    return { supported, unsupported, total, savings: settlementLoan.amount - total, overage: Math.max(0, total - settlementLoan.amount) }
  }, [currencyRates, settlementItems, settlementLoan])

  // ── LOAN FORM HANDLERS ───────────────────────────────────────────────────────

  function resetLoanForm() { setLoanError(''); setEditingLoanId(null); setLoanForm(createEmptyLoanForm(currentUser, loans)); setExpenses([{ category: '', amount: '' }]); setLoanAttachments(createEmptyAttachments()) }
  function openLoanModal() { setLinkedCourse(null); resetLoanForm(); setLoanModalOpen(true) }

  async function openEditLoanModal(loanId: string) {
    const loan = loans.find((l) => l.id === loanId); if (!loan || loan.isSettled || (!isReviewerMode && loan.reviewStatus === 'REVIEWED')) return
    setLoanError(''); setEditingLoanId(loan.id)
    setLoanForm({ requestDate: loan.createdAt.slice(0, 10), refNumber: loan.refNumber, agencyCode: AGENCY_CODE, employee: loan.employee, activity: loan.activity, location: loan.location, startDate: loan.startDate.slice(0, 10), endDate: loan.endDate.slice(0, 10), budgetApproved: loan.budgetApproved })
    setExpenses(loan.items.length > 0 ? loan.items.map((i) => ({ category: i.category, amount: String(i.amount) })) : [{ category: '', amount: '' }])
    setLoanAttachments(Object.fromEntries(LOAN_ATTACHMENT_DEFINITIONS.map((att) => [att.key, toStoredFileArray(loan.files?.[att.key]).map((f) => cloneStoredFile(f) as StoredFile)])))
    setLoanModalOpen(true)
    try {
      const res = await fetch(`/api/loans/${loanId}`)
      if (res.ok) {
        const fullLoan = await res.json()
        setLoanAttachments(Object.fromEntries(LOAN_ATTACHMENT_DEFINITIONS.map((att) => [att.key, toStoredFileArray(fullLoan.files?.[att.key]).map((f) => cloneStoredFile(f) as StoredFile)])))
      }
    } catch {
      // تجاهل الخطأ والاحتفاظ بالمرفقات المحملة مسبقاً (بدون بيانات الصور)
    }
  }

  async function openSettlementModal(loanId: string) {
    const loan = loans.find((l) => l.id === loanId); if (!loan) return
    setSelectedLoanId(loanId); setSettlementError('')

    // تعديل تسوية مُقدَّمة مسبقاً (قبل اعتمادها) — جلب التفاصيل الكاملة المحفوظة
    if (loan.isSettled && loan.settlementStatus !== 'APPROVED') {
      try {
        const res = await fetch(`/api/loans/${loanId}`)
        if (res.ok) {
          const full = await res.json()
          const invoicesData = full.settlement?.invoices ?? null
          if (invoicesData) {
            setCurrencyRates(invoicesData.currencyRates?.length ? invoicesData.currencyRates : [{ currencyCode: 'USD', rate: 3.75 }])
            setSettlementItems(rebuildSettlementItemsFromDetails(invoicesData.details ?? [], loan.items))
            setSettlementMeta({ receiptNumber: invoicesData.receiptNumber ?? '', receiptDate: invoicesData.receiptDate ?? '', overageReason: invoicesData.overageReason ?? '', receiptAttachment: invoicesData.receiptAttachment ?? null, exchangeRateProof: invoicesData.exchangeRateProof ?? null, exchangeRateProofDate: invoicesData.exchangeRateProofDate ?? '' })
            setSettlementModalOpen(true)
            return
          }
        }
      } catch {
        // عند الفشل: استمر بالمسار الافتراضي أدناه
      }
    }

    const draft = loan.settlementDraft
    setCurrencyRates(draft?.currencyRates?.length ? draft.currencyRates : [{ currencyCode: 'USD', rate: 3.75 }])
    setSettlementItems(draft?.settlementItems?.length ? draft.settlementItems : sortSettlementItems(loan.items.map((i) => createSettlementItem(i.category, i.amount))))
    setSettlementMeta(draft?.settlementMeta ?? { receiptNumber: '', receiptDate: '', overageReason: '' })
    setSettlementModalOpen(true)
  }

  async function deleteSettlement(loanId: string) {
    if (!window.confirm('سيتم حذف تسوية السلفة الحالية بالكامل والسماح بإعادة تقديمها من جديد. هل تريد المتابعة؟')) return
    startTransition(async () => {
      const res = await fetch(`/api/loans/${loanId}/settlement`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { showToast(typeof data?.error === 'string' ? data.error : 'تعذر حذف التسوية.', 'error'); return }
      setLoans((curr) => curr.map((l) => l.id === loanId ? normalizeLoanRecord(data) : l))
      showToast('تم حذف تسوية السلفة. يمكنك تقديمها من جديد.')
    })
  }

  async function saveSettlementDraft() {
    if (!settlementLoan) return
    startTransition(async () => {
      const res = await fetch(`/api/loans/${settlementLoan.id}/settlement-draft`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settlementDraft: { settlementItems, currencyRates, settlementMeta } }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setSettlementError(typeof data?.error === 'string' ? data.error : 'تعذر حفظ المسودة.'); return }
      setLoans((curr) => curr.map((l) => l.id === settlementLoan.id ? { ...l, settlementDraft: data.settlementDraft, settlementStatus: data.settlementStatus } : l))
      setSettlementModalOpen(false); setSettlementError(''); showToast('تم حفظ التسوية كمسودة، يمكنك إكمالها لاحقاً.')
    })
  }

  function updateExpense(index: number, field: keyof ExpenseDraft, value: string) {
    setExpenses((curr) => curr.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }

  async function handleLoanAttachmentUpload(key: string, fileList: FileList | null) {
    const files = Array.from(fileList ?? []); if (files.length === 0) return
    try {
      const stored = await Promise.all(files.map((file) => fileToStoredFile(file)))
      setLoanAttachments((curr) => ({ ...curr, [key]: [...(curr[key] ?? []), ...stored] }))
      setLoanError('')
    } catch (err) { setLoanError(err instanceof Error ? err.message : 'تعذر رفع الملف.') }
  }

  function removeLoanAttachment(key: string, index: number) {
    setLoanAttachments((curr) => ({ ...curr, [key]: (curr[key] ?? []).filter((_, i) => i !== index) }))
  }

  async function submitLoan(isDraft = false) {
    if (!isDraft && expenses.some((i) => i.category === 'أخرى' && !(i.customLabel ?? '').trim())) {
      setLoanError('حدد اسم بند "أخرى" قبل إرسال الطلب.'); return
    }
    const cleanExpenses = expenses
      .map((i) => ({ category: (i.category === 'أخرى' ? (i.customLabel ?? '').trim() : i.category).trim() || i.category.trim(), amount: Number.parseFloat(i.amount || '0') || 0 }))
      .filter((i) => i.category && i.amount > 0)
    if (!loanForm.activity || !loanForm.startDate || !loanForm.endDate) { setLoanError('أدخل النشاط وتاريخ البداية والنهاية على الأقل قبل حفظ المسودة.'); return }
    if (!isDraft) {
      if (!loanForm.location || !loanForm.employee) { setLoanError('أكمل الحقول الأساسية قبل إرسال الطلب.'); return }
      if (loanForm.budgetApproved === null) { setLoanError('حدد حالة اعتماد الموازنة.'); return }
      if (cleanExpenses.length === 0) { setLoanError('أضف بند صرف واحد على الأقل.'); return }
      for (const att of LOAN_ATTACHMENT_DEFINITIONS) { if (att.required && (loanAttachments[att.key]?.length ?? 0) === 0) { setLoanError(`أرفق ${att.label} قبل إرسال الطلب.`); return } }
    }
    const total = cleanExpenses.reduce((s, i) => s + i.amount, 0)
    const payload = { activity: loanForm.activity.trim(), location: loanForm.location.trim(), amount: total, budgetApproved: loanForm.budgetApproved, startDate: loanForm.startDate, endDate: loanForm.endDate, files: toLoanRequestFiles(loanAttachments), items: cleanExpenses, courseId: linkedCourse?.id, courseCode: linkedCourse?.code, isDraft, ...(editingLoanId ? { refNumber: loanForm.refNumber } : {}) }
    startTransition(async () => {
      const isEditing = Boolean(editingLoanId)
      const res = await fetch(isEditing ? `/api/loans/${editingLoanId}` : '/api/loans', { method: isEditing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setLoanError(typeof data?.error === 'string' ? data.error : 'تعذر حفظ طلب السلفة.'); return }
      const savedLoan = normalizeLoanRecord(data)
      setLoans((curr) => isEditing ? curr.map((l) => l.id === savedLoan.id ? savedLoan : l) : [savedLoan, ...curr])
      setLoanModalOpen(false); setLoanError('')
      showToast(isDraft ? 'تم حفظ الطلب كمسودة. أكمله متى أحببت.' : isEditing ? 'تم تحديث طلب السلفة.' : 'تم حفظ طلب السلفة بنجاح.')
    })
  }

  function updateRateRow(index: number, field: keyof SettlementCurrencyRate, value: string) {
    setCurrencyRates((curr) => {
      const updated = curr.map((r, i) => i === index ? { ...r, [field]: field === 'rate' ? Number.parseFloat(value || '0') || 0 : (value as CurrencyCode) } : r)
      const newRateMap = buildRateMap(updated)
      // إعادة حساب المبلغ بالريال السعودي لكل الفواتير فوراً عند تعديل سعر الصرف، دون انتظار تعديل كل فاتورة يدوياً
      setSettlementItems((items) => items.map((item) => ({
        ...item,
        invoices: item.invoices.map((inv) => recalculateInvoice(inv, newRateMap)),
      })))
      return updated
    })
  }

  function updateSettlementItem(itemIndex: number, field: 'category', value: string) {
    setSettlementItems((curr) => curr.map((item, i) => i === itemIndex ? { ...item, [field]: value } : item))
  }

  function updateInvoice(itemIndex: number, invoiceIndex: number, field: keyof InvoiceDraft, value: string) {
    setSettlementItems((curr) => curr.map((item, ci) => {
      if (ci !== itemIndex) return item
      const invoices = item.invoices.map((inv, ii) => ii !== invoiceIndex ? inv : recalculateInvoice({ ...inv, [field]: value } as InvoiceDraft, rateMap))
      return { ...item, invoices }
    }))
  }

  function addInvoice(itemIndex: number) {
    setSettlementItems((curr) => curr.map((item, i) => i === itemIndex ? { ...item, invoices: [...item.invoices, createEmptyInvoice('SAR')] } : item))
  }

  function removeInvoice(itemIndex: number, invoiceIndex: number) {
    setSettlementItems((curr) => curr.map((item, i) => i === itemIndex ? { ...item, invoices: item.invoices.length > 1 ? item.invoices.filter((_, idx) => idx !== invoiceIndex) : [createEmptyInvoice('SAR')] } : item))
  }

  async function uploadInvoiceAttachment(itemIndex: number, invoiceIndex: number, fileList: FileList | null) {
    const file = fileList?.[0]; if (!file) return
    const item = settlementItems[itemIndex]
    try {
      const stored = await fileToStoredFile(file)
      setSettlementItems((curr) => curr.map((itm, ci) => ci !== itemIndex ? itm : { ...itm, invoices: itm.invoices.map((inv, ii) => ii !== invoiceIndex ? inv : { ...inv, attachment: stored }) }))
      setSettlementError('')
    } catch (err) { setSettlementError(err instanceof Error ? err.message : 'تعذر رفع المرفق.') }
  }

  function removeInvoiceAttachment(itemIndex: number, invoiceIndex: number) {
    setSettlementItems((curr) => curr.map((itm, ci) => ci !== itemIndex ? itm : { ...itm, invoices: itm.invoices.map((inv, ii) => ii !== invoiceIndex ? inv : { ...inv, attachment: null }) }))
  }

  async function submitSettlement() {
    if (!settlementLoan) return
    const incompleteAdditional = settlementItems.find((item) => item.isAdditional && !item.category.trim() && settlementItemHasUserContent(item))
    if (incompleteAdditional) { setSettlementError('أدخل اسم البند الإضافي قبل حفظ التسوية.'); return }
    const details = buildSettlementPayload(settlementItems, currencyRates)
    const allInvoices = details.flatMap((item) => item.invoices.map((inv) => ({ ...inv, category: item.category })))
    if (currencyRates.some((r) => r.currencyCode !== 'SAR' && r.rate <= 0)) { setSettlementError('أكمل أسعار الصرف لجميع العملات المضافة.'); return }
    if (allInvoices.length === 0) { setSettlementError('أضف فاتورة واحدة على الأقل قبل حفظ التسوية.'); return }
    if (currencyRates.length > 0) {
      if (!settlementMeta.exchangeRateProof) { setSettlementError('أرفق إثبات سعر الصرف (أول يوم صرف) قبل حفظ التسوية.'); return }
      if (!settlementMeta.exchangeRateProofDate) { setSettlementError('حدد تاريخ سعر الصرف.'); return }
    }
    const hasPettyCash = details.some((item) => isPettyCashCategory(item.category))
    const pettyCashApproval = details.find((item) => isPettyCashCategory(item.category))?.invoices.find((inv) => inv.attachment)?.attachment ?? null
    if (hasPettyCash && !pettyCashApproval) { setSettlementError('أرفق موافقة المعالي عند وجود نثريات ضمن التسوية.'); return }
    for (const inv of allInvoices) {
      if (!inv.amount || inv.sar <= 0) { setSettlementError(`أكمل مبلغ الفاتورة في بند ${inv.category}.`); return }
      if (!isPettyCashCategory(inv.category) && !inv.invoiceDate) { setSettlementError(`حدد تاريخ الفاتورة في بند ${inv.category}.`); return }
      if (!isPettyCashCategory(inv.category) && !inv.issuer.trim()) { setSettlementError(`أدخل الجهة المصدرة للفاتورة في بند ${inv.category}.`); return }
      if (!isPettyCashCategory(inv.category) && !inv.attachment) { setSettlementError(`أرفق صورة الفاتورة في بند ${inv.category}.`); return }
    }
    if (settlementSummary.overage > 0 && !settlementMeta.overageReason.trim()) { setSettlementError('أدخل مبرر الزيادة عند تجاوز إجمالي المصروفات مبلغ السلفة.'); return }
    if (settlementSummary.savings > 0) {
      if (!settlementMeta.receiptNumber.trim()) { setSettlementError('أدخل رقم سند القبض عند وجود وفر في السلفة النقدية.'); return }
      if (!settlementMeta.receiptDate) { setSettlementError('أدخل تاريخ سند القبض.'); return }
    }
    startTransition(async () => {
      const res = await fetch('/api/settlements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ loanId: settlementLoan.id, supported: settlementSummary.supported, unsupported: settlementSummary.unsupported, total: settlementSummary.total, savings: settlementSummary.savings, overage: settlementSummary.overage, currencyRates, details, receiptNumber: settlementMeta.receiptNumber.trim(), receiptDate: settlementMeta.receiptDate, overageReason: settlementMeta.overageReason.trim(), pettyCashApproval: cloneStoredFile(pettyCashApproval), receiptAttachment: cloneStoredFile(settlementMeta.receiptAttachment), exchangeRateProof: cloneStoredFile(settlementMeta.exchangeRateProof), exchangeRateProofDate: settlementMeta.exchangeRateProofDate ?? '' }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setSettlementError(typeof data?.error === 'string' ? data.error : 'تعذر حفظ التسوية.'); return }
      setLoans((curr) => curr.map((l) => l.id === data.id ? normalizeLoanRecord(data) : l))
      setSettlementModalOpen(false); setSettlementError(''); showToast('تم حفظ تسوية السلفة بنجاح.')
    })
  }

  function openPrintDocument(kind: 'loan' | 'settlement', loanId: string) {
    if (kind === 'loan') setLoans((curr) => curr.map((l) => l.id === loanId && !l.printedAt ? { ...l, printedAt: new Date().toISOString() } : l))
    window.open(kind === 'loan' ? `/print/loans/${loanId}` : `/print/settlements/${loanId}`, '_blank', 'noopener,noreferrer')
  }

  async function deleteLoan(loanId: string) {
    if (!window.confirm('سيتم حذف المعاملة نهائياً مع أي تسوية أو تنبيهات مرتبطة بها. هل تريد المتابعة؟')) return
    startTransition(async () => {
      const res = await fetch(`/api/loans/${loanId}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { showToast(typeof data?.error === 'string' ? data.error : 'تعذر حذف الطلب.', 'error'); return }
      setLoans((curr) => curr.filter((l) => l.id !== loanId))
      await refreshLoans(workMode)
      showToast('تم حذف المعاملة.')
    })
  }

  async function handleLogout() { try { await fetch('/api/auth/logout', { method: 'POST' }) } finally { window.location.replace('/login') } }

  async function updateReviewState(loanId: string, reviewStatus: LoanDashboardRecord['reviewStatus'] | 'PENDING', reviewNote = '', closureType?: 'advance_req' | 'settlement') {
    startTransition(async () => {
      const onBehalfOfUserId = reviewStatus === 'REVIEWED' ? onBehalfSelections[loanId] || undefined : undefined
      const res = await fetch(`/api/loans/${loanId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reviewStatus, reviewNote, closureType, onBehalfOfUserId }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { showToast(typeof data?.error === 'string' ? data.error : 'تعذر تحديث حالة المراجعة.', 'error'); return }
      setLoans((curr) => curr.map((l) => l.id === data.id ? normalizeLoanRecord(data) : l))
      const finalized = closureType === 'settlement' ? data.settlementStatus === 'APPROVED' : data.reviewStatus === 'REVIEWED'
      showToast(reviewStatus === 'PENDING'
        ? (closureType === 'settlement' ? 'تم إلغاء اعتماد نموذج ١٩ وإعادته للمراجعة.' : 'تم إلغاء اعتماد نموذج ١٨ وإعادته للمراجعة.')
        : reviewStatus === 'RETURNED'
          ? (closureType === 'settlement' ? 'تمت إعادة نموذج ١٩ للموظف.' : 'تمت إعادة المعاملة للموظف.')
          : finalized
            ? (closureType === 'settlement' ? 'تم اعتماد نموذج ١٩ نهائياً بتوقيع المراجعين الاثنين.' : 'تم اعتماد نموذج ١٨ نهائياً بتوقيع المراجعين الاثنين.')
            : (closureType === 'settlement' ? 'تم تسجيل تأشيرتك على نموذج ١٩ — بانتظار تأشيرة المراجع الثاني لإكمال الاعتماد.' : 'تم تسجيل تأشيرتك على نموذج ١٨ — بانتظار تأشيرة المراجع الثاني لإكمال الاعتماد.'))
    })
  }

  async function requestRecall(loanId: string) {
    const reason = window.prompt('سبب طلب إعادة فتح المعاملة:', '')
    if (reason === null) return
    if (!reason.trim()) { showToast('يجب كتابة سبب الطلب.', 'error'); return }
    startTransition(async () => {
      const res = await fetch(`/api/loans/${loanId}/recall`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { showToast(typeof data?.error === 'string' ? data.error : 'تعذر إرسال طلب إعادة الفتح.', 'error'); return }
      setLoans((curr) => curr.map((l) => l.id === data.id ? normalizeLoanRecord(data) : l))
      showToast('تم إرسال طلب إعادة الفتح للمراجعين.')
    })
  }

  async function decideRecall(loanId: string, approve: boolean) {
    if (!window.confirm(approve ? 'تأكيد الموافقة على إعادة فتح المعاملة؟' : 'تأكيد رفض طلب إعادة الفتح؟')) return
    startTransition(async () => {
      const res = await fetch(`/api/loans/${loanId}/recall`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision: approve ? 'approve' : 'reject' }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { showToast(typeof data?.error === 'string' ? data.error : 'تعذر تنفيذ القرار.', 'error'); return }
      setLoans((curr) => curr.map((l) => l.id === data.id ? normalizeLoanRecord(data) : l))
      showToast(approve ? 'تمت الموافقة على إعادة فتح المعاملة.' : 'تم رفض طلب إعادة الفتح.')
    })
  }

  async function sendManualLoanAlert(loanId: string) {
    const customMessage = window.prompt('رسالة التنبيه للموظف (اختياري):', '')
    if (customMessage === null) return
    startTransition(async () => {
      const res = await fetch('/api/admin/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loanId, customMessage }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) { showToast(typeof data?.error === 'string' ? data.error : 'تعذر إرسال التنبيه.', 'error'); return }
      showToast('تم إرسال التنبيه للموظف.')
    })
  }

  async function runDeadlineCheckNow() {
    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/run-deadline-check', { method: 'POST' })
        const data = await res.json()
        if (!res.ok) { showToast(typeof data?.error === 'string' ? data.error : 'تعذر تشغيل الفحص.', 'error'); return }
        showToast(`تم الفحص: ${data.reminders} تذكير و ${data.overdueAlerts} إنذار تأخر أُرسلت.`)
      } catch {
        showToast('تعذر تشغيل الفحص.', 'error')
      }
    })
  }

  async function sendReviewerReminder(loanId: string) {
    startTransition(async () => {
      const res = await fetch(`/api/loans/${loanId}/reminder`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { showToast(typeof data?.error === 'string' ? data.error : 'تعذر إرسال تذكير المراجعين.', 'error'); return }
      showToast('تم إرسال تذكير للمراجعين والمدير.')
      await loadNotifications()
    })
  }

  const requestLoans = (!isAdminOrReviewer && employeeStatFilter !== 'all')
    ? filteredLoans.filter((l) => !l.isSettled && (employeeStatFilter !== 'overdue' || workDaysSince(l.endDate) > SETTLEMENT_GRACE_WORKDAYS))
    : filteredLoans
  const settledLoans  = filteredLoans.filter((l) => l.isSettled)
  const reviewerStats = useMemo(() => ({
    // تشمل PENDING + AWAITING_SECOND_REVIEW لأن المعاملة لا تنتهي إلا بتوقيع المراجعَين معاً
    advancePending: loans.filter((loan) => loan.reviewStatus === 'PENDING' || loan.reviewStatus === 'AWAITING_SECOND_REVIEW').length,
    settlementPending: loans.filter((loan) => loan.settlement && (loan.settlementStatus === 'SUBMITTED' || loan.settlementStatus === 'AWAITING_SECOND_REVIEW')).length,
    approved: loans.filter((loan) => loan.reviewStatus === 'REVIEWED' && (!loan.settlement || loan.settlementStatus === 'APPROVED')).length,
    returned: loans.filter((loan) => loan.reviewStatus === 'RETURNED' || loan.recallRequested).length,
    linkedCourses: loans.filter((loan) => loan.courseId).length,
  }), [loans])
  const reviewerQueue = filteredLoans
    .filter((loan) => {
      if (reviewerFilter === 'advance') return loan.reviewStatus === 'PENDING' || loan.reviewStatus === 'AWAITING_SECOND_REVIEW'
      if (reviewerFilter === 'settlement') return Boolean(loan.settlement) && (loan.settlementStatus === 'SUBMITTED' || loan.settlementStatus === 'AWAITING_SECOND_REVIEW')
      if (reviewerFilter === 'approved') return loan.reviewStatus === 'REVIEWED' && (!loan.settlement || loan.settlementStatus === 'APPROVED')
      // المعادة: إرجاع المراجع التقليدي للموظف، أو طلب إعادة فتح معاملة معتمدة سابقاً (سواء كان معلّقاً أو تمت الموافقة عليه وأصبح قيد التعديل من جديد)
      if (reviewerFilter === 'returned') return loan.reviewStatus === 'RETURNED' || loan.recallRequested || (loan.settlement && loan.settlementStatus === 'IN_PROGRESS')
      // كل المعاملات النشطة: تستبعد السلف المؤرشفة (المُسوّاة) إلا إن أُعيد فتحها أو كان عليها طلب إعادة فتح معلّق
      return !loan.isSettled || loan.recallRequested || loan.settlementStatus !== 'APPROVED'
    })
    .sort((a, b) => {
      const priority = (loan: LoanDashboardRecord) => {
        if (loan.recallRequested) return -1
        if (loan.reviewStatus === 'PENDING') return 0
        if (loan.settlement && loan.settlementStatus !== 'APPROVED') return 1
        if (loan.reviewStatus === 'RETURNED') return 2
        return 3
      }
      return priority(a) - priority(b) || new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime()
    })

  // ── RENDER ────────────────────────────────────────────────────────────────────

  return (
    <div className="app-layout">
      {/* SIDEBAR */}
      <aside className="app-sidebar">
        <div className="sidebar-logo">
          <Image src="/nauss-login-brand.png" alt="جامعة نايف العربية للعلوم الأمنية" width={330} height={95} className="h-auto w-full max-w-[205px]" priority />
          <p className="text-xs mt-3" style={{ color: '#C7B08C' }}>منصة السلف المؤقتة</p>
        </div>

        <nav className="flex-1 py-3 overflow-y-auto">
          <p className="sidebar-section-label">القائمة الرئيسية</p>
          {([
            ...(isAdminOrReviewer ? [{ tab: 'dashboard' as ActiveTab, label: 'لوحة المعلومات', icon: '📊' }] : []),
            { tab: 'requests', label: requestsSectionLabel, icon: '📋' },
            { tab: 'archive',  label: 'الأرشيف',       icon: '🗂️' },
            { tab: 'reports',  label: 'التقارير',       icon: '📊' },
            ...(isAdminOrReviewer ? [{ tab: 'alerts' as ActiveTab, label: 'التنبيهات اليدوية', icon: '📣' }] : []),
            { tab: 'guide',    label: 'التعليمات',      icon: '📖' },
          ] as Array<{ tab: ActiveTab; label: string; icon: string }>).map(({ tab, label, icon }) => (
            <button key={tab} type="button" onClick={() => selectTab(tab, label)}
              className={`nav-item w-full text-right ${activeTab === tab ? 'active' : ''}`}>
              <span style={{ fontSize: '1rem' }}>{icon}</span>
              {label}
              {tab === 'requests' && stats.pending > 0 && (
                <span className="mr-auto text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#C7B08C', color: '#2F2F2F' }}>{stats.pending}</span>
              )}
            </button>
          ))}

          {isSuperAdmin && (
            <>
              <p className="sidebar-section-label mt-4">الإدارة</p>
              <button type="button" onClick={() => pushWithFeedback('/admin', 'جاري فتح إدارة المستخدمين...')}
                className="nav-item w-full text-right">
                <span>👥</span> إدارة المستخدمين
              </button>
              <button type="button" onClick={() => pushWithFeedback('/admin/settings', 'جاري فتح إعدادات السلف...')}
                className="nav-item w-full text-right">
                <span>⚙️</span> إعدادات السلف
              </button>
            </>
          )}
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <div className="app-content">
        {/* TOP BAR */}
        <header className="app-topbar">
          <div>
            <h1 className="text-base font-bold" style={{ color: '#1F3F40' }}>
              {activeTab === 'dashboard' ? 'لوحة المعلومات' : activeTab === 'requests' ? requestsSectionLabel : activeTab === 'archive' ? 'الأرشيف' : activeTab === 'reports' ? 'التقارير والإحصاءات' : activeTab === 'alerts' ? 'التنبيهات اليدوية' : 'التعليمات والدليل'}
            </h1>
            <p className="text-xs" style={{ color: '#5A5A5A' }}>وكالة التدريب — جامعة نايف العربية للعلوم الأمنية</p>
          </div>
          <div className="flex items-center gap-3">
            {isAdminOrReviewer && (
              <div className="flex rounded-xl border border-slate-200 bg-white p-1 text-xs font-semibold">
                <button type="button" onClick={() => { showNavigationFeedback(`جاري فتح وضع ${managementModeLabel}...`); setWorkMode('reviewer') }} className="rounded-lg px-3 py-2" style={{ background: isReviewerMode ? '#2A6364' : 'transparent', color: isReviewerMode ? '#fff' : '#5A5A5A' }}>{managementModeLabel}</button>
                <button type="button" onClick={() => { showNavigationFeedback('جاري فتح وضع الموظف...'); setWorkMode('employee') }} className="rounded-lg px-3 py-2" style={{ background: !isReviewerMode ? '#2A6364' : 'transparent', color: !isReviewerMode ? '#fff' : '#5A5A5A' }}>موظف</button>
              </div>
            )}
            <div className="relative">
              <button
                type="button"
                onClick={toggleNotifications}
                className="btn btn-ghost btn-sm relative"
                title="الإشعارات"
                style={{ border: '1.5px solid #DADBD9', background: '#fff', minWidth: 38, height: 36 }}
              >
                🔔
                {unreadNotifications > 0 && (
                  <span className="absolute -top-1 -left-1 rounded-full px-1.5 text-[10px] font-bold" style={{ background: '#73384B', color: '#fff' }}>
                    {formatEnglishNumber(unreadNotifications)}
                  </span>
                )}
              </button>
              {notificationsOpen && (
                <div className="absolute left-0 top-11 z-50 w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl bg-white shadow-modal" style={{ border: '1px solid #DADBD9' }}>
                  <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #DADBD9' }}>
                    <h3 className="font-bold" style={{ color: '#1F3F40' }}>الإشعارات</h3>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => void loadNotifications()}>تحديث</button>
                  </div>
                  <div className="max-h-[420px] overflow-y-auto p-2">
                    {notifications.map((notification) => (
                      <button
                        key={notification.id}
                        type="button"
                        onClick={() => openNotification(notification)}
                        className="w-full rounded-xl px-3 py-2 text-right text-sm transition hover:opacity-90"
                        style={{ background: notification.isRead ? '#fff' : '#F3EDE3', border: '1px solid #DADBD9', marginBottom: 8, cursor: notification.metadata?.loanId ? 'pointer' : 'default' }}
                      >
                        <p className="font-semibold" style={{ color: '#1F3F40' }}>{notification.title}</p>
                        <p className="mt-1 leading-6" style={{ color: '#5A5A5A' }}>{notification.message}</p>
                        <p className="mt-1 text-xs" style={{ color: '#5A5A5A' }}>{new Date(notification.createdAt).toLocaleString('ar-SA')}</p>
                      </button>
                    ))}
                    {notifications.length === 0 && <p className="py-8 text-center text-sm" style={{ color: '#5A5A5A' }}>لا توجد إشعارات حالياً</p>}
                  </div>
                </div>
              )}
            </div>
            <button type="button" onClick={() => void refreshLoans()} disabled={isLoadingLoans}
              className="btn btn-ghost btn-sm flex items-center gap-1">
              <svg className={`w-3.5 h-3.5 ${isLoadingLoans ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"/>
              </svg>
              تحديث
            </button>
            {activeTab === 'requests' && !isReviewerMode && (
              <button type="button" onClick={openLoanModal} className="btn btn-primary btn-sm">
                نموذج ١٨ — طلب سلفة
              </button>
            )}
            <div className="relative">
              <button type="button" onClick={() => setUserMenuOpen((o) => !o)}
                className="flex items-center gap-2 rounded-xl px-1.5 py-1.5 transition hover:opacity-90"
                style={{ border: '1.5px solid #DADBD9', background: '#fff', height: 36 }}>
                {myProfileImage ? (
                  <img src={myProfileImage.dataUrl} alt={currentUser.fullName} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#2A6364', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: '#E8ECEB', fontWeight: 700, flexShrink: 0 }}>
                    {currentUser.fullName.charAt(0)}
                  </div>
                )}
                <span className="hidden md:inline text-sm font-semibold truncate max-w-[120px]" style={{ color: '#1F3F40' }}>{currentUser.fullName}</span>
              </button>
              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute left-0 top-11 z-50 w-64 overflow-hidden rounded-2xl bg-white shadow-modal" style={{ border: '1px solid #DADBD9' }}>
                    <div className="p-4" style={{ borderBottom: '1px solid #DADBD9' }}>
                      <div className="flex items-center gap-3">
                        {myProfileImage ? (
                          <img src={myProfileImage.dataUrl} alt={currentUser.fullName} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#2A6364', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', color: '#E8ECEB', fontWeight: 700, flexShrink: 0 }}>
                            {currentUser.fullName.charAt(0)}
                          </div>
                        )}
                        <div style={{ overflow: 'hidden' }}>
                          <p className="text-sm font-semibold truncate" style={{ color: '#1F3F40' }}>{currentUser.fullName}</p>
                          <p className="text-xs truncate" style={{ color: '#5A5A5A' }}>{currentUser.email}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {isSuperAdmin ? (
                          <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(199,176,140,0.24)', color: '#C7B08C' }}>
                            مدير النظام
                          </span>
                        ) : currentUser.roles.map((r) => (
                          <span key={r} className="text-xs px-2 py-0.5 rounded-full font-semibold"
                            style={{ background: r === 'ADMIN' ? '#F3EDE3' : r === 'REVIEWER' ? '#E4EEF3' : '#E7F3EE', color: r === 'ADMIN' ? '#C7B08C' : r === 'REVIEWER' ? '#2E6F8E' : '#2A6364' }}>
                            {r === 'ADMIN' ? 'مدير' : r === 'REVIEWER' ? 'مراجع' : 'موظف'}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="p-2">
                      <button type="button" onClick={() => { setUserMenuOpen(false); pushWithFeedback('/account', 'جاري فتح الملف الشخصي...') }}
                        className="w-full text-right flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition hover:bg-slate-100"
                        style={{ color: '#1F3F40' }}>
                        <span>👤</span> الملف الشخصي
                      </button>
                      <button type="button" onClick={handleLogout}
                        className="w-full mt-1 text-xs font-semibold py-2 rounded-lg transition text-center"
                        style={{ background: 'rgba(220,38,38,0.12)', color: '#C0392B', border: '1px solid rgba(220,38,38,0.2)' }}>
                        تسجيل الخروج
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {navigationFeedback && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
            <div className="rounded-3xl bg-white px-8 py-6 text-center shadow-modal" style={{ border: '1px solid #DADBD9' }}>
              <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[#DADBD9] border-t-[#2A6364]" />
              <p className="font-bold" style={{ color: '#1F3F40' }}>{navigationFeedback}</p>
            </div>
          </div>
        )}

        <main className="app-main">
          {!isAdminOrReviewer && (
            <>
              {/* STAT CARDS */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 animate-fade-up">
                <StatCard label="قيد التسوية"   value={stats.pending}  accent="warning" icon="⏳"
                  onClick={() => selectEmployeeStat('requests', requestsSectionLabel, 'pending')} />
                <StatCard label="تمت تسويتها"  value={stats.settled}  accent="success" icon="✅"
                  onClick={() => selectEmployeeStat('archive', 'الأرشيف', 'all')} />
                <StatCard label="إجمالي الطلبات" value={stats.total}   accent="primary" icon="📋"
                  onClick={() => selectEmployeeStat('requests', requestsSectionLabel, 'all')} />
                <StatCard label="متأخرة بعد ١٠ أيام عمل" value={stats.overdue} accent="danger"  icon="⚠️"
                  onClick={() => selectEmployeeStat('requests', requestsSectionLabel, 'overdue')} />
              </div>

              {/* HERO AMOUNTS */}
              <div className="hero-banner mb-6 animate-fade-up">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.65)' }}>إجمالي مبالغ السلف المطلوبة</p>
                    <p className="text-3xl font-bold mt-1" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                      {formatCurrencySar(reportSummary.totalRequested)}
                    </p>
                    <div className="flex gap-4 mt-4">
                      <div>
                        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>تمت تسويتها</p>
                        <p className="font-semibold text-sm">{formatCurrencySar(reportSummary.totalExpenses)}</p>
                      </div>
                      <div>
                        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>إجمالي الوفورات</p>
                        <p className="font-semibold text-sm" style={{ color: '#A7F3D0' }}>{formatCurrencySar(reportSummary.totalSavings)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 justify-end">
                    <button type="button" onClick={openLoanModal}
                      className="btn btn-lg font-semibold"
                      style={{ background: '#fff', color: '#2A6364' }}>
                      نموذج ١٨ — طلب سلفة
                    </button>
                    {loans.some((l) => !l.isSettled) && (
                      <button type="button"
                        onClick={() => { const first = loans.find((l) => !l.isSettled); if (first) openSettlementModal(first.id) }}
                        className="btn btn-lg font-semibold"
                        style={{ background: 'rgba(199,176,140,0.92)', color: '#2F2F2F' }}>
                        نموذج ١٩ — تسوية
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* TABS CONTENT */}
          <div className="section-card animate-fade-up">
            {/* DASHBOARD TAB */}
            {activeTab === 'dashboard' && isAdminOrReviewer && (
              <div className="space-y-6">
                {isReviewerMode ? (
                  <div className="flex flex-wrap gap-2 items-center justify-between">
                    <div className="flex gap-2 flex-wrap">
                      <button type="button" onClick={() => { setReviewerFilter('advance'); selectTab('requests', requestsSectionLabel) }} className="btn btn-primary btn-sm">
                        📝 طلبات نموذج 18
                        {reviewerStats.advancePending > 0 && <span className="mr-1 font-bold">({reviewerStats.advancePending})</span>}
                      </button>
                      <button type="button" onClick={() => { setReviewerFilter('settlement'); selectTab('requests', requestsSectionLabel) }} className="btn btn-gold btn-sm">
                        🧾 تسويات نموذج 19
                        {reviewerStats.settlementPending > 0 && <span className="mr-1 font-bold">({reviewerStats.settlementPending})</span>}
                      </button>
                      <button type="button" onClick={() => { setReviewerFilter('all'); selectTab('requests', requestsSectionLabel) }} className="btn btn-outline btn-sm">
                        كل المعاملات
                      </button>
                    </div>
                    <button type="button" onClick={() => void runDeadlineCheckNow()} className="btn btn-outline btn-sm">
                      🔔 فحص المواعيد
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 rounded-2xl p-5 lg:flex-row lg:items-center lg:justify-between" style={{ background: '#F3EDE3', border: '1px solid #C7B08C' }}>
                    <div>
                      <p className="text-xs font-semibold" style={{ color: '#6B5A4A' }}>الإجراءات الأساسية</p>
                      <h2 className="mt-1 text-lg font-bold" style={{ color: '#1F3F40' }}>طلبات السلف والتسويات</h2>
                      <p className="mt-1 text-sm" style={{ color: '#5A5A5A' }}>يمكن إنشاء طلب سلفة مباشر من هنا، أو تسوية سلفة مفتوحة عند توفرها.</p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button type="button" onClick={openLoanModal} className="btn btn-primary">
                        نموذج ١٨ — طلب سلفة
                      </button>
                      <button
                        type="button"
                        disabled={!loans.some((l) => !l.isSettled)}
                        onClick={() => { const first = loans.find((l) => !l.isSettled); if (first) openSettlementModal(first.id) }}
                        className="btn btn-gold disabled:opacity-50 disabled:cursor-not-allowed"
                        title={loans.some((l) => !l.isSettled) ? 'بدء تسوية سلفة مفتوحة' : 'لا توجد سلفة مفتوحة للتسوية'}
                      >
                        نموذج ١٩ — تسوية السلفة
                      </button>
                    </div>
                  </div>
                )}

                {isReviewerMode ? (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                      label="نموذج 18 — تحتاج اعتماد"
                      value={reviewerStats.advancePending}
                      accent="danger"
                      icon="📝"
                      sub={loans.filter((l) => l.reviewStatus === 'AWAITING_SECOND_REVIEW').length > 0
                        ? `${loans.filter((l) => l.reviewStatus === 'AWAITING_SECOND_REVIEW').length} وقّع عليها مراجع واحد`
                        : undefined}
                      onClick={() => { setReviewerFilter('advance'); selectTab('requests', requestsSectionLabel) }}
                    />
                    <StatCard
                      label="نموذج 19 — تحتاج اعتماد"
                      value={reviewerStats.settlementPending}
                      accent="warning"
                      icon="🧾"
                      sub={loans.filter((l) => l.settlementStatus === 'AWAITING_SECOND_REVIEW').length > 0
                        ? `${loans.filter((l) => l.settlementStatus === 'AWAITING_SECOND_REVIEW').length} وقّع عليها مراجع واحد`
                        : undefined}
                      onClick={() => { setReviewerFilter('settlement'); selectTab('requests', requestsSectionLabel) }}
                    />
                    <StatCard label="معادة للموظف" value={reviewerStats.returned} accent="primary" icon="↩️"
                      onClick={() => { setReviewerFilter('returned'); selectTab('requests', requestsSectionLabel) }} />
                    <StatCard label="مكتملة الاعتماد" value={reviewerStats.approved} accent="success" icon="✅"
                      onClick={() => { setReviewerFilter('approved'); selectTab('requests', requestsSectionLabel) }} />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard label="قيد التسوية" value={stats.pending} accent="warning" icon="⏳" />
                    <StatCard label="تمت تسويتها" value={stats.settled} accent="success" icon="✅" />
                    <StatCard label="إجمالي الطلبات" value={stats.total} accent="primary" icon="📋" />
                    <StatCard label="متأخرة بعد ١٠ أيام عمل" value={stats.overdue} accent="danger" icon="⚠️" />
                  </div>
                )}

                <div className="hero-banner animate-fade-up">
                  <div className="grid gap-6 md:grid-cols-4">
                    <div className="md:col-span-2">
                      <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.65)' }}>إجمالي مبالغ السلف المطلوبة</p>
                      <p className="text-3xl font-bold mt-1" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{formatCurrencySar(reportSummary.totalRequested)}</p>
                    </div>
                    <div>
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>مصروفات مسوّاة</p>
                      <p className="font-semibold text-sm">{formatCurrencySar(reportSummary.totalExpenses)}</p>
                    </div>
                    <div>
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>صافي الوفورات</p>
                      <p className="font-semibold text-sm" style={{ color: '#A7F3D0' }}>{formatCurrencySar(reportSummary.totalSavings - reportSummary.totalOverage)}</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <h3 className="text-sm font-semibold mb-3" style={{ color: '#2D4D40' }}>عدادات تسوية السلف المفتوحة</h3>
                    {loans.filter((l) => !l.isSettled).length === 0 ? (
                      <div className="summary-pill">
                        <p className="text-sm" style={{ color: '#5A5A5A' }}>لا توجد سلف مفتوحة بانتظار التسوية حالياً</p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {loans.filter((l) => !l.isSettled).map((loan) => {
                          const countdown = getSettlementCountdown(loan)
                          return (
                            <div key={loan.id} className="summary-pill flex items-center gap-3">
                              {countdown && (
                                <div className={`reviewer-counter-box ${countdown.overdue ? 'is-overdue' : ''}`}>
                                  <span className="reviewer-counter-number">{formatEnglishNumber(countdown.days)}</span>
                                  <span className="reviewer-counter-label">{countdown.overdue ? 'يوم تأخير' : 'يوم متبقي'}</span>
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="summary-pill-label">{loan.refNumber}</p>
                                <p className="mt-1 text-xs font-semibold" style={{ color: '#5A5A5A' }}>{loan.employee} • {loan.activity}</p>
                                {countdown && (
                                  <p className="mt-1 text-xs" style={{ color: '#5A5A5A' }}>آخر مهلة لرفع التسوية: {countdown.deadlineLabel}</p>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  <div className="section-card p-4">
                    <h3 className="text-sm font-semibold mb-3" style={{ color: '#2D4D40' }}>مؤشر استعجال التسوية حسب الموظف</h3>
                    <SettlementUrgencyRadarChart data={settlementUrgencyData} />
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="section-card p-4">
                    <h3 className="text-sm font-semibold mb-3" style={{ color: '#2D4D40' }}>المبالغ الشهرية</h3>
                    <MonthlyAmountsChart data={monthlyData} />
                  </div>

                  <div className="section-card p-4">
                    <h3 className="text-sm font-semibold mb-3" style={{ color: '#2D4D40' }}>توزيع الطلبات</h3>
                    <StatusDistributionChart data={statusChartData} />
                  </div>
                </div>

                <div className="section-card p-4">
                  <h3 className="text-sm font-semibold mb-3" style={{ color: '#2D4D40' }}>أعلى أوجه الصرف استخداماً</h3>
                  <CategoryUsageChart data={categoryReport} />
                </div>

                {isReviewerMode && (
                  <div>
                    <h3 className="text-sm font-bold mb-3" style={{ color: '#1F3F40' }}>تحليل البنود لدعم قرارات المراجعة</h3>
                    <ItemUsageInsights data={itemUsage} />
                  </div>
                )}

                <div className="grid gap-6 xl:grid-cols-2">
                  <div className="section-card p-4">
                    <h3 className="font-bold" style={{ color: '#1F3F40' }}>طالبو السلف</h3>
                    <p className="mt-1 text-sm" style={{ color: '#5A5A5A' }}>أكثر الموظفين طلباً للسلف مع حالة التسوية والتأخر.</p>
                    <div className="mt-3 overflow-x-auto">
                      <table className="data-table">
                        <thead><tr><th>الموظف</th><th>الطلبات</th><th>نشطة</th><th>مسوّاة</th><th>متأخرة</th><th>إجمالي المبلغ</th></tr></thead>
                        <tbody>
                          {dashboardInsights.topRequesters.map((item) => (
                            <tr key={item.employee}>
                              <td>{item.employee}</td>
                              <td>{formatEnglishNumber(item.count)}</td>
                              <td>{formatEnglishNumber(item.active)}</td>
                              <td>{formatEnglishNumber(item.settled)}</td>
                              <td style={{ color: item.overdue ? '#73384B' : '#5A5A5A', fontWeight: item.overdue ? 700 : 500 }}>{formatEnglishNumber(item.overdue)}</td>
                              <td>{formatCurrencySar(item.totalAmount)}</td>
                            </tr>
                          ))}
                          {dashboardInsights.topRequesters.length === 0 && <tr><td colSpan={6} className="py-6 text-center" style={{ color: '#5A5A5A' }}>لا توجد بيانات طلبات</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="section-card p-4">
                    <h3 className="font-bold" style={{ color: '#1F3F40' }}>مسوو السلف</h3>
                    <p className="mt-1 text-sm" style={{ color: '#5A5A5A' }}>الموظفون الذين أغلقوا تسوياتهم وقيمة المصروفات وصافي الوفورات.</p>
                    <div className="mt-3 overflow-x-auto">
                      <table className="data-table">
                        <thead><tr><th>الموظف</th><th>عدد التسويات</th><th>إجمالي التسوية</th><th>صافي الوفورات</th><th>متوسط الإغلاق</th></tr></thead>
                        <tbody>
                          {dashboardInsights.topSettlers.map((item) => (
                            <tr key={item.employee}>
                              <td>{item.employee}</td>
                              <td>{formatEnglishNumber(item.count)}</td>
                              <td>{formatCurrencySar(item.totalSettlement)}</td>
                              <td style={{ color: item.totalSavings >= 0 ? '#4F8F7A' : '#73384B', fontWeight: 700 }}>{formatCurrencySar(item.totalSavings)}</td>
                              <td>{formatEnglishNumber(Math.round(item.totalDays / Math.max(1, item.count)))} يوم عمل</td>
                            </tr>
                          ))}
                          {dashboardInsights.topSettlers.length === 0 && <tr><td colSpan={5} className="py-6 text-center" style={{ color: '#5A5A5A' }}>لا توجد تسويات محفوظة</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="section-card p-4" style={{ borderRight: '4px solid #73384B' }}>
                  <h3 className="font-bold" style={{ color: '#1F3F40' }}>المتأخرون عن تسوية السلف</h3>
                  <p className="mt-1 text-sm" style={{ color: '#5A5A5A' }}>يعتمد التأخر على مرور أكثر من {formatEnglishNumber(SETTLEMENT_GRACE_WORKDAYS)} أيام عمل بعد تاريخ نهاية البرنامج دون تسوية.</p>
                  <div className="mt-3 overflow-x-auto">
                    <table className="data-table">
                      <thead><tr><th>الرقم</th><th>الموظف</th><th>النشاط</th><th>نهاية البرنامج</th><th>أيام بعد النهاية</th><th>التجاوز</th><th>المبلغ</th></tr></thead>
                      <tbody>
                        {dashboardInsights.overdueLoans.slice(0, 8).map((loan) => (
                          <tr key={loan.id}>
                            <td>{loan.refNumber}</td>
                            <td>{loan.employee}</td>
                            <td>{loan.activity}</td>
                            <td>{formatDate(loan.endDate)}</td>
                            <td>{formatEnglishNumber(loan.workDaysAfterEnd)}</td>
                            <td style={{ color: '#73384B', fontWeight: 700 }}>{formatEnglishNumber(loan.daysOverGrace)} يوم عمل</td>
                            <td>{formatCurrencySar(loan.amount)}</td>
                          </tr>
                        ))}
                        {dashboardInsights.overdueLoans.length === 0 && <tr><td colSpan={7} className="py-6 text-center" style={{ color: '#5A5A5A' }}>لا توجد سلف متأخرة عن التسوية حالياً</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* REQUESTS TAB */}
            {activeTab === 'requests' && (
              <div className="space-y-4">
                {isReviewerMode ? (
                  <div className="reviewer-workbench">
                    <div className="reviewer-workbench-header">
                      <div>
                        <p className="text-xs font-bold" style={{ color: '#2A6364' }}>مساحة عمل المراجع</p>
                        <h3 className="mt-1 font-bold" style={{ color: '#1F3F40' }}>اعتماد نموذج ١٨ ونموذج ١٩</h3>
                        <p className="mt-1 text-sm" style={{ color: '#5A5A5A' }}>تعامل مع طلب السلفة وتسوية السلفة كعنصرين مستقلين، مع إمكانية المعاينة، الاعتماد، الإعادة، وإلغاء الاعتماد عند الحاجة.</p>
                      </div>
                      <button type="button" onClick={() => void refreshLoans(workMode)} className="btn btn-outline btn-sm">
                        تحديث القائمة
                      </button>
                    </div>
                    <div className="reviewer-metrics">
                      <button type="button" onClick={() => setReviewerFilter('advance')} className={`reviewer-metric ${reviewerFilter === 'advance' ? 'active' : ''}`}>
                        <span>طلبات سلفة تنتظر نموذج ١٨</span>
                        <strong>{formatEnglishNumber(reviewerStats.advancePending)}</strong>
                      </button>
                      <button type="button" onClick={() => setReviewerFilter('settlement')} className={`reviewer-metric ${reviewerFilter === 'settlement' ? 'active' : ''}`}>
                        <span>تسويات تنتظر نموذج ١٩</span>
                        <strong>{formatEnglishNumber(reviewerStats.settlementPending)}</strong>
                      </button>
                      <button type="button" onClick={() => setReviewerFilter('returned')} className={`reviewer-metric ${reviewerFilter === 'returned' ? 'active' : ''}`}>
                        <span>معادة للموظف</span>
                        <strong>{formatEnglishNumber(reviewerStats.returned)}</strong>
                      </button>
                      <button type="button" onClick={() => setReviewerFilter('approved')} className={`reviewer-metric ${reviewerFilter === 'approved' ? 'active' : ''}`}>
                        <span>مكتملة الاعتماد</span>
                        <strong>{formatEnglishNumber(reviewerStats.approved)}</strong>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between" style={{ background: '#F3EDE3', border: '1px solid #C7B08C' }}>
                    <div>
                      <h3 className="font-bold" style={{ color: '#1F3F40' }}>نموذج ١٨ — طلب سلفة مباشرة</h3>
                      <p className="mt-1 text-sm" style={{ color: '#5A5A5A' }}>استخدم هذا الخيار لإنشاء طلب سلفة بدون تحويل من نظام إقفال الدورات. إذا كانت السلفة مخصصة لتمويل دورة، يجب أن يأتي الطلب من "منصة إقفال الدورات" بالضغط على إجراء طلب السلفة الخاص بالدورة، حتى يتم ربط الطلب بها تلقائيًا.</p>
                    </div>
                    <button type="button" onClick={openLoanModal} className="btn btn-primary">
                      + طلب سلفة
                    </button>
                  </div>
                )}
                {!isReviewerMode && employeeStatFilter !== 'all' && (
                  <div className="flex items-center justify-between rounded-xl px-4 py-2 text-sm" style={{ background: '#E7F3EE', border: '1px solid #C8D9D0', color: '#2A6364' }}>
                    <span>
                      {employeeStatFilter === 'pending' ? 'عرض الطلبات قيد التسوية فقط' : 'عرض الطلبات المتأخرة عن التسوية فقط'}
                    </span>
                    <button type="button" onClick={() => setEmployeeStatFilter('all')} className="btn btn-ghost btn-sm">
                      إلغاء التصفية ✕
                    </button>
                  </div>
                )}
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <svg className="absolute top-1/2 -translate-y-1/2 right-3 w-4 h-4" style={{ color: '#5A5A5A' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                    </svg>
                    <input value={search} onChange={(e) => setSearch(e.target.value)}
                      placeholder="ابحث بالرقم المرجعي أو اسم النشاط أو الموظف..."
                      className="input-shell" style={{ paddingRight: '2.25rem' }} />
                  </div>
                </div>
                {loadError && <div className="alert alert-error">{loadError}</div>}
                {isLoadingLoans ? (
                  <div className="space-y-3">
                    {[1,2,3].map((i) => <div key={i} className="h-24 rounded-xl shimmer" />)}
                  </div>
                ) : isReviewerMode ? (
                  <div className="space-y-4">
                    <div className="reviewer-filter-bar">
                      {([
                        ['all', 'المعاملات النشطة'],
                        ['advance', 'نموذج ١٨'],
                        ['settlement', 'نموذج ١٩'],
                        ['returned', 'المعادة'],
                        ['approved', 'المكتملة'],
                      ] as Array<[ReviewerQueueFilter, string]>).map(([value, label]) => (
                        <button key={value} type="button" onClick={() => setReviewerFilter(value)} className={reviewerFilter === value ? 'active' : ''}>
                          {label}
                        </button>
                      ))}
                    </div>
                    {reviewerQueue.length === 0 ? (
                      <div className="empty-state">
                        <div className="empty-state-icon text-4xl">✅</div>
                        <p className="empty-state-title">لا توجد معاملات للمراجعة</p>
                      </div>
                    ) : reviewerQueue.map((loan) => (
                      <ReviewerLoanCard
                        key={loan.id}
                        loan={loan}
                        isAdmin={isAdmin}
                        isSuperAdmin={isSuperAdmin}
                        reviewersList={reviewersList}
                        onBehalfUserId={onBehalfSelections[loan.id] || ''}
                        onChangeOnBehalf={(userId) => setOnBehalfSelections((curr) => ({ ...curr, [loan.id]: userId }))}
                        onEditItems={() => openEditLoanModal(loan.id)}
                        onPreviewLoan={() => pushWithFeedback(`/loans/${loan.id}?form=18&returnTab=requests&returnFilter=${reviewerFilter}`, 'جاري فتح معاينة نموذج ١٨...')}
                        onApproveLoan={() => updateReviewState(loan.id, 'REVIEWED', '', 'advance_req')}
                        onReturnLoan={() => { const note = window.prompt('سبب إعادة نموذج ١٨ للموظف:', loan.reviewNote || ''); if (note === null) return; void updateReviewState(loan.id, 'RETURNED', note, 'advance_req') }}
                        onCancelLoanApproval={() => { if (!window.confirm('سيعود نموذج ١٨ إلى قائمة المراجعة. هل تريد إلغاء الاعتماد؟')) return; void updateReviewState(loan.id, 'PENDING', 'أُلغي اعتماد نموذج ١٨ لإعادة المراجعة.', 'advance_req') }}
                        onPreviewSettlement={() => pushWithFeedback(`/loans/${loan.id}?form=19&returnTab=requests&returnFilter=${reviewerFilter}`, 'جاري فتح معاينة نموذج ١٩...')}
                        onApproveSettlement={() => updateReviewState(loan.id, 'REVIEWED', '', 'settlement')}
                        onReturnSettlement={() => { const note = window.prompt('سبب إعادة نموذج ١٩ للموظف:', loan.reviewNote || ''); if (note === null) return; void updateReviewState(loan.id, 'RETURNED', note, 'settlement') }}
                        onCancelSettlementApproval={() => { if (!window.confirm('سيعود نموذج ١٩ إلى قائمة مراجعة التسويات. هل تريد إلغاء الاعتماد؟')) return; void updateReviewState(loan.id, 'PENDING', 'أُلغي اعتماد نموذج ١٩ لإعادة المراجعة.', 'settlement') }}
                        onRecallDecision={(approve) => decideRecall(loan.id, approve)}
                        onLinked={() => void refreshLoans(workMode)}
                      />
                    ))}
                  </div>
                ) : requestLoans.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon text-4xl">📭</div>
                    <p className="empty-state-title">لا توجد طلبات سلفة حاليًا</p>
                    <p className="empty-state-desc">اضغط على "طلب سلفة جديد" لإنشاء طلبك الأول</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {requestLoans.map((loan) => (
                      <LoanCard key={loan.id} loan={loan} canReview={false} canModify={loan.reviewStatus !== 'REVIEWED'}
                        canLinkCourse onLinked={() => void refreshLoans(workMode)} isSuperAdmin={isSuperAdmin} reviewersList={reviewersList}
                        onEdit={openEditLoanModal} onDelete={deleteLoan} onSettle={openSettlementModal} onDeleteSettlement={deleteSettlement}
                        onMarkReviewed={() => updateReviewState(loan.id, 'REVIEWED')}
                        onReturnForReview={() => { const note = window.prompt('ملاحظة الإرجاع للموظف:', loan.reviewNote || ''); if (note === null) return; void updateReviewState(loan.id, 'RETURNED', note) }}
                        onPrintLoan={() => openPrintDocument('loan', loan.id)}
                        onPrintSettlement={() => openPrintDocument('settlement', loan.id)}
                        onSendManualAlert={() => sendManualLoanAlert(loan.id)}
                        onSendReviewerReminder={() => sendReviewerReminder(loan.id)}
                        onRequestRecall={() => requestRecall(loan.id)} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ARCHIVE TAB */}
            {activeTab === 'archive' && (
              <div className="space-y-3">
                {settledLoans.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon text-4xl">🗂️</div>
                    <p className="empty-state-title">الأرشيف فارغ</p>
                    <p className="empty-state-desc">ستظهر هنا الطلبات بعد إتمام تسويتها</p>
                  </div>
                ) : settledLoans.map((loan) => (
                  <LoanCard key={loan.id} loan={loan} archived canReview={false} canModify={false} canDelete={isSuperAdmin}
                    canLinkCourse onLinked={() => void refreshLoans(workMode)} isSuperAdmin={isSuperAdmin} reviewersList={reviewersList}
                    onEdit={openEditLoanModal} onDelete={deleteLoan} onSettle={openSettlementModal} onDeleteSettlement={deleteSettlement}
                    onMarkReviewed={() => updateReviewState(loan.id, 'REVIEWED')}
                    onReturnForReview={() => { const note = window.prompt('ملاحظة الإرجاع:', loan.reviewNote || ''); if (note === null) return; void updateReviewState(loan.id, 'RETURNED', note) }}
                    onPrintLoan={() => openPrintDocument('loan', loan.id)}
                    onPrintSettlement={() => openPrintDocument('settlement', loan.id)}
                    onSendManualAlert={() => sendManualLoanAlert(loan.id)}
                    onSendReviewerReminder={() => sendReviewerReminder(loan.id)}
                    onRequestRecall={() => requestRecall(loan.id)} />
                ))}
              </div>
            )}

            {/* MANUAL ALERTS TAB */}
            {activeTab === 'alerts' && isAdminOrReviewer && (
              <div className="space-y-4">
                <div className="section-card p-4" style={{ background: '#F9F9F9' }}>
                  <h3 className="font-bold" style={{ color: '#1F3F40' }}>إرسال تنبيه يدوي للموظف</h3>
                  <p className="mt-1 text-sm" style={{ color: '#5A5A5A' }}>
                    استخدم هذا القسم لتذكير الموظف بتسوية السلفة أو متابعة إجراء مطلوب. يتم توثيق الإرسال في سجل التنبيهات.
                  </p>
                </div>
                {loans.filter((loan) => !loan.isSettled).length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon text-4xl">📣</div>
                    <p className="empty-state-title">لا توجد طلبات مفتوحة للتنبيه</p>
                  </div>
                ) : loans.filter((loan) => !loan.isSettled).map((loan) => (
                  <div key={loan.id} className="card p-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h3 className="font-bold" style={{ color: '#1F3F40' }}>{loan.refNumber}</h3>
                      <p className="text-sm" style={{ color: '#5A5A5A' }}>{loan.activity} • {loan.employee}</p>
                    </div>
                    <button type="button" disabled={isPending} className="btn btn-warning btn-sm" onClick={() => sendManualLoanAlert(loan.id)}>
                      إرسال تنبيه للموظف
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* REPORTS TAB */}
            {activeTab === 'reports' && (
              <div className="space-y-6">
                <div className="section-card p-5" style={{ borderRight: '4px solid #2A6364' }}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-xs font-semibold" style={{ color: '#C7B08C' }}>تقرير تنفيذي</p>
                      <h2 className="mt-1 text-xl font-bold" style={{ color: '#1F3F40' }}>ملخص أداء طلبات السلف والتسويات</h2>
                      <p className="mt-2 max-w-3xl text-sm leading-7" style={{ color: '#5A5A5A' }}>{executiveReport.mainFinding}</p>
                    </div>
                    <div className="rounded-xl px-4 py-3 text-sm" style={{ background: '#F3EDE3', color: '#6B5A4A', border: '1px solid #C7B08C' }}>
                      صافي الوفورات: <strong>{formatCurrencySar(executiveReport.netPosition)}</strong>
                    </div>
                  </div>
                  {isAdminOrReviewer && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <a href="/print/agency-report" target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
                        📄 فتح التقرير الشامل لسعادة الوكيل (PDF)
                      </a>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => downloadAgencyExcelReport(loans, itemUsage)}>
                        📊 تصدير التقرير الشامل (Excel)
                      </button>
                    </div>
                  )}
                </div>

                {/* Summary tiles */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'إجمالي المبالغ المطلوبة', value: formatCurrencySar(reportSummary.totalRequested), color: '#2A6364' },
                    { label: 'إجمالي المصروفات المسوّاة', value: formatCurrencySar(reportSummary.totalExpenses), color: '#2E6F8E' },
                    { label: 'إجمالي الوفورات', value: formatCurrencySar(reportSummary.totalSavings), color: '#4F8F7A' },
                    { label: 'إجمالي الزيادات', value: formatCurrencySar(reportSummary.totalOverage), color: '#73384B' },
                  ].map((tile) => (
                    <div key={tile.label} className="summary-pill">
                      <p className="summary-pill-label">{tile.label}</p>
                      <p className="summary-pill-value" style={{ color: tile.color }}>{tile.value}</p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {[
                    { label: 'نسبة التسوية', value: `${formatEnglishNumber(executiveReport.settlementRate)}%`, hint: `${formatEnglishNumber(executiveReport.settledCount)} من ${formatEnglishNumber(stats.total)} طلب`, color: '#2A6364' },
                    { label: 'نسبة المراجعة', value: `${formatEnglishNumber(executiveReport.reviewRate)}%`, hint: `${formatEnglishNumber(executiveReport.reviewedCount)} طلب تمت مراجعته`, color: '#2E6F8E' },
                    { label: 'متوسط الطلب', value: formatCurrencySar(executiveReport.averageRequest), hint: 'متوسط قيمة السلفة المطلوبة', color: '#6B5A4A' },
                    { label: 'متوسط التسوية', value: formatCurrencySar(executiveReport.averageSettlement), hint: 'متوسط المصروفات للطلبات المسوّاة', color: '#4F8F7A' },
                  ].map((item) => (
                    <div key={item.label} className="section-card p-4">
                      <p className="text-xs font-semibold" style={{ color: '#5A5A5A' }}>{item.label}</p>
                      <p className="mt-2 text-2xl font-bold" style={{ color: item.color }}>{item.value}</p>
                      <p className="mt-1 text-xs" style={{ color: '#5A5A5A' }}>{item.hint}</p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="section-card p-4">
                    <h3 className="font-bold" style={{ color: '#1F3F40' }}>قراءة المخاطر</h3>
                    <div className="mt-3 space-y-2 text-sm" style={{ color: '#5A5A5A' }}>
                      <p>الطلبات المفتوحة: <strong>{formatEnglishNumber(executiveReport.activeCount)}</strong></p>
                      <p>الطلبات المتأخرة: <strong style={{ color: '#73384B' }}>{formatEnglishNumber(executiveReport.overdueLoans.length)}</strong></p>
                      <p>المعاملات المعادة: <strong>{formatEnglishNumber(executiveReport.returnedCount)}</strong></p>
                      <p>نسبة الوفورات: <strong style={{ color: '#4F8F7A' }}>{formatEnglishNumber(Number(executiveReport.savingsRate.toFixed(1)))}%</strong></p>
                      <p>نسبة الزيادات: <strong style={{ color: '#73384B' }}>{formatEnglishNumber(Number(executiveReport.overageRate.toFixed(1)))}%</strong></p>
                    </div>
                  </div>

                  <div className="section-card p-4 lg:col-span-2">
                    <h3 className="font-bold" style={{ color: '#1F3F40' }}>أبرز الطلبات التي تتطلب متابعة</h3>
                    <div className="mt-3 overflow-x-auto">
                      <table className="data-table">
                        <thead>
                          <tr><th>الرقم</th><th>النشاط</th><th>الموظف</th><th>أيام العمل بعد النهاية</th><th>المبلغ</th></tr>
                        </thead>
                        <tbody>
                          {executiveReport.overdueLoans.slice(0, 5).map((loan) => (
                            <tr key={loan.id}>
                              <td>{loan.refNumber}</td>
                              <td>{loan.activity}</td>
                              <td>{loan.employee}</td>
                              <td style={{ color: '#73384B', fontWeight: 700 }}>{formatEnglishNumber(loan.days)}</td>
                              <td>{formatCurrencySar(loan.amount)}</td>
                            </tr>
                          ))}
                          {executiveReport.overdueLoans.length === 0 && (
                            <tr><td colSpan={5} className="text-center py-6" style={{ color: '#5A5A5A' }}>لا توجد طلبات متأخرة حالياً</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Charts row */}
                <div className="grid lg:grid-cols-2 gap-6">
                  {/* Monthly bar chart */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3" style={{ color: '#2D4D40' }}>المبالغ الشهرية (ر.س)</h3>
                    <MonthlyAmountsChart data={monthlyData} />
                  </div>

                  {/* Status donut chart */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3" style={{ color: '#2D4D40' }}>توزيع الطلبات حسب الحالة</h3>
                    <StatusDistributionChart data={statusChartData} />
                  </div>
                </div>

                {/* Category bar chart */}
                <div>
                  <h3 className="text-sm font-semibold mb-3" style={{ color: '#2D4D40' }}>أعلى أوجه الصرف استخدامًا</h3>
                  <CategoryUsageChart data={categoryReport} height={200} emptyText="لا توجد بيانات كافية لعرض التقرير" />
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="section-card p-4">
                    <h3 className="font-bold mb-3" style={{ color: '#1F3F40' }}>أعلى طلبات السلف قيمة</h3>
                    <div className="space-y-2">
                      {executiveReport.topLoans.map((loan, index) => (
                        <div key={loan.id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2" style={{ background: '#F9F9F9', border: '1px solid #DADBD9' }}>
                          <span className="text-sm"><strong>{formatEnglishNumber(index + 1)}.</strong> {loan.activity}</span>
                          <span className="text-sm font-bold" style={{ color: '#2A6364' }}>{formatCurrencySar(loan.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="section-card p-4">
                    <h3 className="font-bold mb-3" style={{ color: '#1F3F40' }}>أعلى التسويات مصروفاً</h3>
                    <div className="space-y-2">
                      {executiveReport.topSettlements.map((loan, index) => (
                        <div key={loan.id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2" style={{ background: '#F9F9F9', border: '1px solid #DADBD9' }}>
                          <span className="text-sm"><strong>{formatEnglishNumber(index + 1)}.</strong> {loan.activity}</span>
                          <span className="text-sm font-bold" style={{ color: '#2E6F8E' }}>{formatCurrencySar(loan.settlement?.total ?? 0)}</span>
                        </div>
                      ))}
                      {executiveReport.topSettlements.length === 0 && <p className="text-sm" style={{ color: '#5A5A5A' }}>لا توجد تسويات مكتملة بعد</p>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* GUIDE TAB */}
            {activeTab === 'guide' && (
              <div className="space-y-4">
                {GUIDE_SECTIONS.map((section) => (
                  <div key={section.title} className="rounded-xl p-5" style={{ background: '#F9F9F9', border: '1px solid #C8D9D0' }}>
                    <h3 className="font-bold mb-3" style={{ color: '#1F3F40' }}>{section.title}</h3>
                    <ul className="space-y-2">
                      {section.items.map((item) => (
                        <li key={item} className="flex gap-2 text-sm" style={{ color: '#2D4D40' }}>
                          <span style={{ color: '#2A6364', flexShrink: 0, marginTop: 2 }}>◆</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ── LOAN MODAL ── */}
      {loanModalOpen && (
        <div className="modal-overlay active">
          <div className="modal-box" style={{ maxWidth: 860 }}>
            <div className="modal-header">
              <div>
                <h3 className="text-base font-bold" style={{ color: '#2A6364' }}>
                  {editingLoanId ? 'تعديل طلب السلفة' : 'نموذج ١٨ — طلب صرف سلفة مؤقتة'}
                </h3>
                <p className="text-xs mt-0.5" style={{ color: '#5A5A5A' }}>إدخال بيانات الطلب ومرفقاته الرسمية</p>
              </div>
              <button type="button" onClick={() => setLoanModalOpen(false)} className="modal-close">×</button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 80px)' }}>
              {linkedCourse ? (
                <div className="rounded-xl px-4 py-3 text-sm" style={{ background: '#F3EDE3', border: '1px solid #C7B08C', color: '#6B5A4A' }}>
                  هذه السلفة مرتبطة بدورة من نظام الإقفال: <strong>{linkedCourse.code || linkedCourse.name || linkedCourse.id}</strong>
                </div>
              ) : !editingLoanId && (
                <div className="rounded-xl px-4 py-3 text-sm" style={{ background: '#E7F3EE', border: '1px solid #C8D9D0', color: '#2A6364' }}>
                  💡 يمكنك إكمال هذا الطلب من هنا مباشرة بشكل طبيعي، أياً كانت طبيعة الصرف. ملاحظة فقط لمن لديه دورة
                  تدريبية مسجّلة في منصة الإقفال: تقديم سلفة تلك الدورة تحديداً من خلال زر "منصة السلف" داخل الدورة
                  نفسها (بدل هذا النموذج) يربطها بها تلقائياً ويُسهّل متابعة مواعيدها — وهذا اختياري ولا ينطبق إن لم
                  تكن السلفة لدورة من الأساس.
                </div>
              )}

              {/* Row 1 */}
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="التاريخ *">
                  <input type="date" value={loanForm.requestDate} onChange={(e) => setLoanForm((c) => ({ ...c, requestDate: e.target.value }))} className="input-shell" />
                </Field>
                <Field label="الرقم المرجعي">
                  <input value={editingLoanId ? loanForm.refNumber : 'يُولّد تلقائياً عند حفظ الطلب'} readOnly={!editingLoanId || !isSuperAdmin} onChange={(e) => setLoanForm((c) => ({ ...c, refNumber: e.target.value }))} className="input-shell" />
                </Field>
                <Field label="كود الوكالة (ثابت)">
                  <input value={loanForm.agencyCode} readOnly className="input-shell" />
                </Field>
              </div>

              {/* Row 2 */}
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="المبلغ رقمًا (محسوب تلقائيًا)">
                  <input value={formatEnglishNumber(expenses.reduce((s, i) => s + (Number.parseFloat(i.amount || '0') || 0), 0), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} readOnly className="input-shell" />
                </Field>
                <Field label="المبلغ كتابةً">
                  <input value={numberToArabicWords(expenses.reduce((s, i) => s + (Number.parseFloat(i.amount || '0') || 0), 0))} readOnly className="input-shell text-sm" />
                </Field>
              </div>

              {/* Row 3 */}
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="اسم النشاط *">
                  <input value={loanForm.activity} onChange={(e) => setLoanForm((c) => ({ ...c, activity: e.target.value }))} className="input-shell" placeholder="مثال: دورة تدريبية في الرياض" />
                </Field>
                <Field label="مكان التنفيذ *">
                  <input value={loanForm.location} onChange={(e) => setLoanForm((c) => ({ ...c, location: e.target.value }))} className="input-shell" placeholder="مثال: الرياض، المملكة العربية السعودية" />
                </Field>
                <Field label="اسم الموظف">
                  <input value={loanForm.employee} readOnly className="input-shell" />
                </Field>
                <Field label="تاريخ البداية *">
                  <input type="date" value={loanForm.startDate} onChange={(e) => setLoanForm((c) => ({ ...c, startDate: e.target.value }))} className="input-shell" />
                </Field>
                <Field label="اعتماد الموازنة *">
                  <div className="flex h-[42px] items-center gap-6 rounded-lg border px-4" style={{ borderColor: '#C8D9D0' }}>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" checked={loanForm.budgetApproved === true} onChange={() => setLoanForm((c) => ({ ...c, budgetApproved: true }))} /> معتمدة
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" checked={loanForm.budgetApproved === false} onChange={() => setLoanForm((c) => ({ ...c, budgetApproved: false }))} /> غير معتمدة
                    </label>
                  </div>
                </Field>
                <Field label="تاريخ النهاية *">
                  <input type="date" value={loanForm.endDate} onChange={(e) => setLoanForm((c) => ({ ...c, endDate: e.target.value }))} className="input-shell" />
                </Field>
              </div>

              {/* Expenses */}
              <div className="rounded-xl p-4" style={{ border: '1px solid #C8D9D0' }}>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-sm" style={{ color: '#1F3F40' }}>أوجه الصرف</h4>
                  <button type="button" onClick={() => setExpenses((c) => [...c, { category: '', amount: '' }])} className="btn btn-primary btn-sm">+ إضافة بند</button>
                </div>
                <div className="grid grid-cols-[1fr_160px_40px] gap-2 pb-2 mb-2 text-xs font-semibold" style={{ borderBottom: '1px solid #DADBD9', color: '#5A5A5A' }}>
                  <span>البند</span><span>المبلغ (ر.س)</span><span></span>
                </div>
                <div className="space-y-2">
                  {expenses.map((expense, index) => (
                    <div key={index} className="space-y-1.5">
                      <div className="grid gap-2 md:grid-cols-[1fr_160px_40px]">
                        <select value={expense.category} onChange={(e) => updateExpense(index, 'category', e.target.value)} className="input-shell">
                          <option value="">اختر البند...</option>
                          {EXPENSE_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                        <input type="number" min="0" step="0.01" value={expense.amount} onChange={(e) => updateExpense(index, 'amount', e.target.value)} className="input-shell" placeholder="0.00" />
                        <button type="button" onClick={() => setExpenses((c) => c.filter((_, i) => i !== index))}
                          className="h-[42px] w-10 flex items-center justify-center rounded-lg text-lg font-bold transition"
                          style={{ color: '#73384B', border: '1.5px solid #D9B8C4', background: 'transparent' }}>×</button>
                      </div>
                      {expense.category === 'أخرى' && (
                        <input value={expense.customLabel ?? ''} onChange={(e) => updateExpense(index, 'customLabel', e.target.value)}
                          className="input-shell" placeholder="حدد البند (مثال: احتياجات تدريبية)" />
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between rounded-lg px-4 py-2 text-sm" style={{ background: '#F9F9F9' }}>
                  <span style={{ color: '#5A5A5A' }}>الإجمالي</span>
                  <span className="font-bold" style={{ color: '#2A6364', fontFamily: 'IBM Plex Mono, monospace' }}>
                    {formatCurrencySar(expenses.reduce((s, i) => s + (Number.parseFloat(i.amount || '0') || 0), 0))}
                  </span>
                </div>
              </div>

              {/* Attachments */}
              <div className="rounded-xl p-4" style={{ border: '1px solid #C8D9D0', background: '#F9F9F9' }}>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-sm" style={{ color: '#1F3F40' }}>المرفقات الرسمية</h4>
                  <span className="text-xs" style={{ color: '#5A5A5A' }}>الحد الأقصى للملف 12 MB — تُضغط الصور تلقائيًا</span>
                </div>
                <div className="space-y-3">
                  {LOAN_ATTACHMENT_DEFINITIONS.map((att) => {
                    const currentFiles = loanAttachments[att.key] ?? []
                    return (
                      <div key={att.key} className={`attachment-card flex-col items-stretch ${currentFiles.length > 0 ? 'has-file' : att.required ? 'required-missing' : ''}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: att.required ? '#73384B' : '#1F3F40' }}>
                              {att.label} {att.required ? '(إلزامي)' : '(اختياري)'}
                            </p>
                            <p className="text-xs mt-0.5" style={{ color: currentFiles.length > 0 ? '#4F8F7A' : '#5A5A5A' }}>
                              {currentFiles.length > 0 ? `✓ ${currentFiles.length} صورة مرفقة` : 'لم يتم اختيار صور'}
                            </p>
                          </div>
                          <label className="btn btn-primary btn-sm cursor-pointer flex-shrink-0">
                            إضافة صور
                            <input type="file" multiple className="hidden" accept="image/*" onChange={(e) => { void handleLoanAttachmentUpload(att.key, e.target.files); e.target.value = '' }} />
                          </label>
                        </div>
                        {currentFiles.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {currentFiles.map((file, index) => (
                              <div key={index} className="relative group" style={{ width: 64, height: 64 }}>
                                <img src={file.dataUrl} alt={file.name} className="w-full h-full object-cover rounded-lg" style={{ border: '1px solid #C8D9D0' }} />
                                <button type="button" onClick={() => removeLoanAttachment(att.key, index)} className="absolute -top-2 -left-2 flex items-center justify-center rounded-full text-white text-xs" style={{ width: 20, height: 20, background: '#73384B' }} title="إزالة الصورة">×</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {loanError && <div className="alert alert-error">{loanError}</div>}

              <div className="flex justify-end gap-3 pt-2" style={{ borderTop: '1px solid #DADBD9' }}>
                <button type="button" onClick={() => setLoanModalOpen(false)} className="btn btn-outline">إلغاء</button>
                <button type="button" onClick={() => submitLoan(true)} disabled={isPending} className="btn btn-outline">
                  {isPending ? 'جاري الحفظ...' : 'حفظ كمسودة'}
                </button>
                <button type="button" onClick={() => submitLoan(false)} disabled={isPending} className="btn btn-primary">
                  {isPending ? 'جاري الحفظ...' : editingLoanId ? 'تحديث الطلب' : 'حفظ وإرسال الطلب'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SETTLEMENT MODAL ── */}
      {settlementModalOpen && settlementLoan && (
        <div className="modal-overlay active">
          <div className="modal-box" style={{ maxWidth: 900 }}>
            <div className="modal-header">
              <div>
                <h3 className="text-base font-bold" style={{ color: '#C7B08C' }}>نموذج ١٩ — تسوية سلفة مؤقتة</h3>
                <p className="text-xs mt-0.5" style={{ color: '#5A5A5A' }}>{settlementLoan.refNumber} • {settlementLoan.employee}</p>
              </div>
              <button type="button" onClick={() => setSettlementModalOpen(false)} className="modal-close">×</button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 80px)' }}>
              {/* إثبات سعر الصرف ليوم الصرف الأول */}
              <div className="rounded-xl p-4" style={{ border: '1px solid #C8D9D0' }}>
                <p className="text-sm font-semibold mb-2" style={{ color: '#1F3F40' }}>إثبات سعر الصرف (أول يوم صرف)</p>
                <p className="text-xs mb-3" style={{ color: '#5A5A5A' }}>إيصال من بنك، أو سعر البنك المركزي السعودي، أو إيصال من مركز صرافة، يثبت سعر الصرف المستخدم في الفواتير</p>
                <div className="grid gap-3 md:grid-cols-[1fr_220px]">
                  <div className="flex items-center gap-3">
                    <label className="btn btn-outline btn-sm cursor-pointer">
                      📎 {settlementMeta.exchangeRateProof ? 'تغيير المرفق' : 'رفع المرفق'}
                      <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
                        const file = e.target.files?.[0]; e.target.value = ''
                        if (!file) return
                        try {
                          const stored = await fileToStoredFile(file)
                          setSettlementMeta((c) => ({ ...c, exchangeRateProof: stored }))
                        } catch (err) { setSettlementError(err instanceof Error ? err.message : 'تعذر رفع المرفق.') }
                      }} />
                    </label>
                    {settlementMeta.exchangeRateProof && (
                      <>
                        <img src={settlementMeta.exchangeRateProof.dataUrl} alt="إثبات سعر الصرف" className="h-12 w-12 object-cover rounded-lg" style={{ border: '1px solid #C8D9D0' }} />
                        <button type="button" onClick={() => setSettlementMeta((c) => ({ ...c, exchangeRateProof: null }))} className="btn btn-danger btn-sm">إزالة</button>
                      </>
                    )}
                  </div>
                  <input type="date" value={settlementMeta.exchangeRateProofDate ?? ''} onChange={(e) => setSettlementMeta((c) => ({ ...c, exchangeRateProofDate: e.target.value }))} className="input-shell" placeholder="تاريخ سعر الصرف" />
                </div>
              </div>

              {/* Currency rates */}
              <div className="rounded-xl p-4" style={{ border: '1px solid #C8D9D0' }}>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-sm" style={{ color: '#1F3F40' }}>العملات وأسعار الصرف</h4>
                  <button type="button" onClick={() => setCurrencyRates((c) => [...c, { currencyCode: 'USD', rate: 0 }])} className="btn btn-gold btn-sm">+ إضافة عملة</button>
                </div>
                {currencyRates.length === 0 ? (
                  <p className="text-sm text-center py-3" style={{ color: '#5A5A5A' }}>أضف العملات الأجنبية المستخدمة في الفواتير أولًا (الريال السعودي مضاف تلقائيًا)</p>
                ) : (
                  <div className="space-y-2">
                    {currencyRates.map((rate, index) => (
                      <div key={`${rate.currencyCode}-${index}`} className="space-y-1.5">
                        <div className="grid gap-2 md:grid-cols-[220px_1fr_40px]">
                          <select value={rate.currencyCode} onChange={(e) => updateRateRow(index, 'currencyCode', e.target.value)} className="input-shell">
                            {CURRENCY_OPTIONS.filter((c) => c.code !== 'SAR').map((c) => (
                              <option key={c.code} value={c.code}>{c.label} {c.symbol ? `(${c.symbol})` : ''}</option>
                            ))}
                          </select>
                          <input type="number" step="0.0001" value={rate.rate || ''} onChange={(e) => updateRateRow(index, 'rate', e.target.value)} className="input-shell" placeholder="سعر الصرف مقابل الريال السعودي" />
                          <button type="button" onClick={() => setCurrencyRates((c) => c.filter((_, i) => i !== index))}
                            className="h-[42px] w-10 flex items-center justify-center rounded-lg text-lg font-bold"
                            style={{ color: '#73384B', border: '1.5px solid #D9B8C4', background: 'transparent' }}>×</button>
                        </div>
                        {rate.currencyCode === 'OTHER' && (
                          <input value={rate.customLabel ?? ''} onChange={(e) => updateRateRow(index, 'customLabel', e.target.value)}
                            className="input-shell" placeholder="اكتب اسم العملة" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Settlement items */}
              <div className="flex justify-end">
                <button type="button" onClick={() => setSettlementItems((c) => [...c, createSettlementItem('', 0, { isAdditional: true })])} className="btn btn-outline btn-sm">+ إضافة بند إضافي</button>
              </div>

              <div className="space-y-4">
                {settlementItems.map((item, itemIndex) => {
                  const itemTotal = item.invoices.reduce((s, inv) => s + inv.sarAmount, 0)
                  const isPettyCash = isPettyCashCategory(item.category)
                  return (
                    <div key={item.id} className="rounded-xl p-4" style={{ border: '1px solid #C8D9D0' }}>
                      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                        <div className="flex-1 min-w-[200px]">
                          {item.isAdditional ? (
                            <div>
                              <Field label="اسم البند الإضافي *">
                                <input value={item.category} onChange={(e) => updateSettlementItem(itemIndex, 'category', e.target.value)} className="input-shell" placeholder="مثال: رسوم إضافية غير مدرجة في الطلب" />
                              </Field>
                              <p className="text-xs mt-1" style={{ color: '#5A5A5A' }}>بند غير مدرج في طلب السلفة الأصلي — يظهر في نموذج التسوية فقط</p>
                            </div>
                          ) : (
                            <div>
                              <p className="font-semibold" style={{ color: '#1F3F40' }}>{item.category}</p>
                              <p className="text-xs mt-0.5" style={{ color: '#5A5A5A' }}>المعتمد في الطلب: {formatCurrencySar(item.budget)}</p>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-sm font-bold" style={{ fontFamily: 'IBM Plex Mono, monospace', color: '#2A6364' }}>{formatCurrencySar(itemTotal)}</span>
                          {item.isAdditional && (
                            <button type="button" onClick={() => setSettlementItems((c) => c.filter((_, i) => i !== itemIndex))} className="btn btn-danger btn-sm">حذف البند</button>
                          )}
                          <button type="button" onClick={() => addInvoice(itemIndex)} className="btn btn-outline btn-sm">+ فاتورة</button>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {item.invoices.map((invoice, invoiceIndex) => (
                          <div key={invoiceIndex} className="rounded-lg p-3 space-y-3" style={{ background: '#F9F9F9', border: '1px solid #DADBD9' }}>
                            <div className="grid gap-3 md:grid-cols-3">
                              <Field label="المبلغ حسب الفاتورة">
                                <input type="number" step="0.01" value={invoice.amount} onChange={(e) => updateInvoice(itemIndex, invoiceIndex, 'amount', e.target.value)} className="input-shell" placeholder="0.00" />
                              </Field>
                              <Field label="العملة">
                                <select value={invoice.currencyCode} onChange={(e) => updateInvoice(itemIndex, invoiceIndex, 'currencyCode', e.target.value)} className="input-shell">
                                  <option value="SAR">ريال سعودي</option>
                                  {currencyRates.map((r, ri) => <option key={`${r.currencyCode}-${ri}`} value={r.currencyCode}>{getRateLabel(r)}</option>)}
                                </select>
                              </Field>
                              <Field label="المبلغ بالريال السعودي">
                                <input readOnly value={formatCurrencySar(invoice.sarAmount)} className="input-shell font-bold" style={{ fontFamily: 'IBM Plex Mono, monospace', color: '#2A6364' }} />
                              </Field>
                            </div>

                            {!isPettyCash && (
                              <div className="grid gap-3 md:grid-cols-3">
                                <Field label="نوع المستند">
                                  <select value={invoice.documentType} onChange={(e) => updateInvoice(itemIndex, invoiceIndex, 'documentType', e.target.value)} className="input-shell">
                                    {SETTLEMENT_DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                                  </select>
                                </Field>
                                <Field label="تاريخ الفاتورة">
                                  <input type="date" value={invoice.invoiceDate} onChange={(e) => updateInvoice(itemIndex, invoiceIndex, 'invoiceDate', e.target.value)} className="input-shell" />
                                </Field>
                                <Field label="الجهة المصدرة">
                                  <input value={invoice.issuer} onChange={(e) => updateInvoice(itemIndex, invoiceIndex, 'issuer', e.target.value)} className="input-shell" placeholder="اسم الجهة أو الشركة" />
                                </Field>
                              </div>
                            )}

                            {isPettyCash && (
                              <div className="text-xs rounded-lg px-3 py-2" style={{ background: '#F3EDE3', color: '#6B5A4A', border: '1px solid #C7B08C' }}>
                                المرفقات تقبل الصور فقط — لا تقبل ملفات PDF
                              </div>
                            )}

                            {/* Attachment */}
                            <div className={`attachment-card ${invoice.attachment ? 'has-file' : ''}`}>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold" style={{ color: '#1F3F40' }}>
                                  {isPettyCash ? 'موافقة المعالي (صورة)' : 'صورة الفاتورة / المستند'}
                                </p>
                                {invoice.attachment ? (
                                  <p className="text-xs mt-0.5 truncate" style={{ color: '#4F8F7A' }}>✓ {invoice.attachment.name} — {Math.round(invoice.attachment.size / 1024)} KB</p>
                                ) : (
                                  <p className="text-xs mt-0.5" style={{ color: '#5A5A5A' }}>لم يتم إرفاق مستند</p>
                                )}
                              </div>
                              <div className="flex gap-2 flex-shrink-0">
                                <label className="btn btn-primary btn-sm cursor-pointer">
                                  {invoice.attachment ? 'تغيير' : 'رفع'}
                                  <input type="file" className="hidden" accept="image/*" onChange={(e) => void uploadInvoiceAttachment(itemIndex, invoiceIndex, e.target.files)} />
                                </label>
                                {invoice.attachment && <button type="button" onClick={() => removeInvoiceAttachment(itemIndex, invoiceIndex)} className="btn btn-danger btn-sm">إزالة</button>}
                                {item.invoices.length > 1 && <button type="button" onClick={() => removeInvoice(itemIndex, invoiceIndex)} className="btn btn-ghost btn-sm">حذف الفاتورة</button>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Summary — تُعرض بعد تعبئة البنود لتلخيص النتيجة النهائية */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: 'مبلغ السلفة', value: formatCurrencySar(settlementLoan.amount), color: '#2A6364' },
                  { label: 'إجمالي المصروفات', value: formatCurrencySar(settlementSummary.total), color: '#1F3F40' },
                  { label: 'المبلغ بالزيادة', value: formatCurrencySar(settlementSummary.overage), color: settlementSummary.overage > 0 ? '#73384B' : '#5A5A5A' },
                  { label: 'وفر السلفة', value: formatCurrencySar(Math.max(0, settlementSummary.savings)), color: settlementSummary.savings > 0 ? '#4F8F7A' : '#5A5A5A' },
                ].map((pill) => (
                  <div key={pill.label} className="summary-pill">
                    <p className="summary-pill-label">{pill.label}</p>
                    <p className="summary-pill-value" style={{ color: pill.color }}>{pill.value}</p>
                  </div>
                ))}
              </div>

              {/* Receipt / overage meta */}
              {(settlementSummary.savings > 0 || settlementSummary.overage > 0) && (
                <div className="rounded-xl p-4" style={{ border: '1px solid #C8D9D0' }}>
                  <h4 className="font-semibold text-sm mb-3" style={{ color: '#1F3F40' }}>بيانات التسوية التكميلية</h4>
                  {settlementSummary.savings > 0 && (
                    <div className="grid gap-4 md:grid-cols-2 mb-4">
                      <Field label="رقم سند القبض *">
                        <input value={settlementMeta.receiptNumber} onChange={(e) => setSettlementMeta((c) => ({ ...c, receiptNumber: e.target.value }))} className="input-shell" placeholder="رقم السند" />
                      </Field>
                      <Field label="تاريخ سند القبض *">
                        <input type="date" value={settlementMeta.receiptDate} onChange={(e) => setSettlementMeta((c) => ({ ...c, receiptDate: e.target.value }))} className="input-shell" />
                      </Field>
                    </div>
                  )}
                  {settlementSummary.savings > 0 && (
                    <div className="mb-4">
                      <p className="text-sm font-semibold mb-1.5" style={{ color: '#1F3F40' }}>إيصال السداد (اختياري)</p>
                      <div className="flex items-center gap-3">
                        <label className="btn btn-outline btn-sm cursor-pointer">
                          📎 {settlementMeta.receiptAttachment ? 'تغيير الصورة' : 'رفع صورة الإيصال'}
                          <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
                            const file = e.target.files?.[0]; e.target.value = ''
                            if (!file) return
                            try {
                              const stored = await fileToStoredFile(file)
                              setSettlementMeta((c) => ({ ...c, receiptAttachment: stored }))
                            } catch (err) { setSettlementError(err instanceof Error ? err.message : 'تعذر رفع صورة الإيصال.') }
                          }} />
                        </label>
                        {settlementMeta.receiptAttachment && (
                          <>
                            <img src={settlementMeta.receiptAttachment.dataUrl} alt="إيصال السداد" className="h-12 w-12 object-cover rounded-lg" style={{ border: '1px solid #C8D9D0' }} />
                            <button type="button" onClick={() => setSettlementMeta((c) => ({ ...c, receiptAttachment: null }))} className="btn btn-danger btn-sm">إزالة</button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                  {settlementSummary.overage > 0 && (
                    <Field label="مبرر الزيادة على مبلغ السلفة *">
                      <textarea value={settlementMeta.overageReason} onChange={(e) => setSettlementMeta((c) => ({ ...c, overageReason: e.target.value }))} rows={3} className="input-shell" placeholder="يرجى توضيح سبب تجاوز مبلغ السلفة الأصلي..." />
                    </Field>
                  )}
                </div>
              )}

              {settlementError && <div className="alert alert-error">{settlementError}</div>}

              <div className="flex justify-end gap-3 pt-2" style={{ borderTop: '1px solid #DADBD9' }}>
                <button type="button" onClick={() => setSettlementModalOpen(false)} className="btn btn-outline">إلغاء</button>
                <button type="button" onClick={saveSettlementDraft} disabled={isPending} className="btn btn-outline">
                  {isPending ? 'جاري الحفظ...' : 'حفظ كمسودة'}
                </button>
                <button type="button" onClick={submitSettlement} disabled={isPending} className="btn btn-gold">
                  {isPending ? 'جاري الحفظ...' : 'حفظ التسوية'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TOASTS */}
      <div className="toast-container toast-container-passive">
        {toasts.filter((toast) => !toast.important).map((toast) => (
          <div key={toast.id} className={`toast ${toast.tone === 'success' ? 'toast-success' : toast.tone === 'error' ? 'toast-error' : 'toast-info'}`}>
            {toast.message}
          </div>
        ))}
      </div>
      <div className="toast-container toast-container-important">
        {toasts.filter((toast) => toast.important).map((toast) => (
          <div key={toast.id} className={`toast ${toast.tone === 'success' ? 'toast-success' : toast.tone === 'error' ? 'toast-error' : 'toast-info'}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── SUB COMPONENTS ─────────────────────────────────────────────────────────────

function ReviewerLoanCard({ loan, isAdmin, isSuperAdmin, reviewersList, onBehalfUserId, onChangeOnBehalf, onEditItems, onPreviewLoan, onApproveLoan, onReturnLoan, onCancelLoanApproval, onPreviewSettlement, onApproveSettlement, onReturnSettlement, onCancelSettlementApproval, onRecallDecision, onLinked }: {
  loan: LoanDashboardRecord
  isAdmin: boolean
  isSuperAdmin: boolean
  reviewersList: Array<{ id: string; fullName: string }>
  onBehalfUserId: string
  onChangeOnBehalf: (userId: string) => void
  onEditItems: () => void
  onPreviewLoan: () => void
  onApproveLoan: () => void
  onReturnLoan: () => void
  onCancelLoanApproval: () => void
  onPreviewSettlement: () => void
  onApproveSettlement: () => void
  onReturnSettlement: () => void
  onCancelSettlementApproval: () => void
  onRecallDecision: (approve: boolean) => void
  onLinked: () => void
}) {
  const hasSettlement = Boolean(loan.settlement)
  const isLoanApproved = loan.reviewStatus === 'REVIEWED'
  const isSettlementApproved = loan.settlementStatus === 'APPROVED'
  const canActAsReviewer = !isLoanApproved || (hasSettlement && !isSettlementApproved)

  const loan18Signers = [loan.reviewedBy?.fullName, loan.secondReviewedBy?.fullName].filter(Boolean)
  const loan19Signers = [loan.settlementReviewedBy?.fullName, loan.secondSettlementReviewedBy?.fullName].filter(Boolean)

  return (
    <div className={`rc${isLoanApproved ? ' is-approved' : ''}`}>

      {/* ── رأس البطاقة: رمز المعاملة + اسم الدورة + الشارات ── */}
      <div className={`rc-header${isLoanApproved ? ' is-approved' : ''}`}>
        {/* يمين: رمز المعاملة */}
        <div className="rc-ref">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
          {loan.refNumber}
        </div>

        {/* وسط: اسم الدورة */}
        <h3 className="rc-title">{loan.activity}</h3>

        {/* يسار: الشارات */}
        <div className="rc-badges">
          {loan.courseId && <span className="rc-badge rc-badge-lock">🔒 إفعال</span>}
          {isSettlementApproved
            ? <span className="rc-badge rc-badge-done">✓ مكتمل</span>
            : isLoanApproved
              ? <span className="rc-badge rc-badge-approved">✓ معتمد 18</span>
              : null}
        </div>
      </div>

      {/* ── شريط البيانات: 4 خانات ── */}
      <div className="rc-info">
        <div className="rc-info-cell">
          <span className="rc-info-label">الموظف</span>
          <span className="rc-info-value">{loan.employee}</span>
          {(loan as any).user?.email && <span className="rc-info-sub">{(loan as any).user.email}</span>}
        </div>
        <div className="rc-info-cell">
          <span className="rc-info-label">الفترة</span>
          <span className="rc-info-value" style={{ fontSize: '0.7rem' }}>{formatDate(loan.startDate)} — {formatDate(loan.endDate)}</span>
        </div>
        <div className="rc-info-cell">
          <span className="rc-info-label">المبلغ</span>
          <span className="rc-info-value">💰 {loan.amount?.toLocaleString('en-US')} ر.س</span>
        </div>
        <div className="rc-info-cell">
          <span className="rc-info-label">رمز المعاملة</span>
          <span className="rc-info-value">{loan.refNumber}</span>
        </div>
      </div>

      {/* ── تنبيهات ── */}
      {(loan.reviewNote || loan.recallRequested) && (
        <div className="rc-alerts">
          {loan.reviewNote && <div className="alert alert-warning text-xs my-1">⚠️ <strong>ملاحظة الإرجاع:</strong> {loan.reviewNote}</div>}
          {loan.recallRequested && (
            <div className="alert alert-warning text-xs my-1 flex flex-wrap items-center justify-between gap-2">
              <span>🔓 <strong>طلب إعادة فتح:</strong> {loan.recallReason}</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => onRecallDecision(true)} className="btn btn-success btn-sm">✓ قبول</button>
                <button type="button" onClick={() => onRecallDecision(false)} className="btn btn-danger btn-sm">✗ رفض</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── القسم السفلي: التواقيع (يمين) | الأزرار (يسار) ── */}
      <div className="rc-bottom">

        {/* يمين: التواقيع والاعتمادات */}
        <div className="rc-sigs">
          <div className="rc-sigs-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            التواقيع والاعتمادات
          </div>

          {/* صف 18 */}
          <div className="rc-sig-row">
            <span className="rc-sig-num">18</span>
            {loan18Signers.length === 0
              ? <><span className="rc-sig-wait">⏳</span><span className="rc-sig-muted">لم يعتمد</span></>
              : <><span className="rc-sig-check">✓</span><span className="rc-sig-name">{loan18Signers.join(' ، ')}</span></>}
          </div>

          {/* صف 19 */}
          <div className="rc-sig-row">
            <span className="rc-sig-num">19</span>
            {!hasSettlement
              ? <><span className="rc-sig-wait">⏳</span><span className="rc-sig-muted">لم ترفع التسوية</span></>
              : loan19Signers.length === 0
                ? <><span className="rc-sig-wait">⏳</span><span className="rc-sig-muted">لم يعتمد</span></>
                : <><span className="rc-sig-check">✓</span><span className="rc-sig-name">{loan19Signers.join(' ، ')}</span></>}
          </div>
        </div>

        {/* يسار: الأزرار */}
        <div className="rc-actions">
          {/* صف أزرار نموذج 18 */}
          <div className="rc-action-row">
            <button type="button" onClick={onPreviewLoan} className="rc-btn rc-btn-preview">👁 معاينة</button>
            <button type="button" onClick={onReturnLoan} className="rc-btn rc-btn-return">↩ إعادة</button>
            {isLoanApproved
              ? <button type="button" onClick={onCancelLoanApproval} disabled={isSettlementApproved} className="rc-btn rc-btn-cancel" title={isSettlementApproved ? 'ألغِ 19 أولاً' : ''}>✗ إلغاء</button>
              : <button type="button" onClick={onApproveLoan} className="rc-btn rc-btn-approve">✓ اعتماد</button>}
          </div>

          {/* صف أزرار نموذج 19 */}
          <div className="rc-action-row">
            {hasSettlement ? (
              <>
                <button type="button" onClick={onPreviewSettlement} className="rc-btn rc-btn-preview">👁 معاينة</button>
                <button type="button" onClick={onReturnSettlement} className="rc-btn rc-btn-return">↩ إعادة</button>
                {isSettlementApproved
                  ? <button type="button" onClick={onCancelSettlementApproval} className="rc-btn rc-btn-cancel">✗ إلغاء</button>
                  : <button type="button" onClick={onApproveSettlement} className="rc-btn rc-btn-approve">✓ اعتماد</button>}
              </>
            ) : (
              <span className="rc-no-settlement">لم يرفع الموظف التسوية بعد</span>
            )}
          </div>
        </div>
      </div>

      {/* ── أدوات المدير ── */}
      {!loan.courseId && <div className="rc-admin"><LinkCourseControl loanId={loan.id} onLinked={onLinked} /></div>}
      {isSuperAdmin && reviewersList.length > 0 && canActAsReviewer && (
        <div className="flex items-center gap-2 px-3 py-1 text-xs" style={{ borderTop: '1px solid #EEF1F1' }}>
          <label style={{ color: '#5A5A5A' }}>اعتماد بالنيابة عن:</label>
          <select value={onBehalfUserId} onChange={(e) => onChangeOnBehalf(e.target.value)} className="input-shell" style={{ maxWidth: 180, padding: '0.2rem 0.4rem', height: 'auto' }}>
            <option value="">(توقيعي)</option>
            {reviewersList.map((r) => (<option key={r.id} value={r.id}>{r.fullName}</option>))}
          </select>
        </div>
      )}
      {isSuperAdmin && !(loan.reviewedBy && loan.secondReviewedBy) && (
        <div className="px-3"><AdminFinalizeReviewControl loanId={loan.id} formType="advance_req" reviewersList={reviewersList} onDone={onLinked} /></div>
      )}
      {isSuperAdmin && hasSettlement && !(loan.settlementReviewedBy && loan.secondSettlementReviewedBy) && (
        <div className="px-3"><AdminFinalizeReviewControl loanId={loan.id} formType="settlement" reviewersList={reviewersList} onDone={onLinked} /></div>
      )}
    </div>
  )
}

type CourseLookupResult = { id: string; code: string; name: string; employeeName: string; employeeEmail: string | null }

// تحكم ربط معاملة قديمة بدورة في منصة الإقفال — يبحث برمز/اسم الدورة عبر منصة الإقفال،
// وعند الاختيار يربط المعاملة فوراً ويعيد مزامنة حالتها الحقيقية (في الوقت / متأخرة)
function LinkCourseControl({ loanId, onLinked }: { loanId: string; onLinked: () => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CourseLookupResult[]>([])
  const [searching, setSearching] = useState(false)
  const [linkingId, setLinkingId] = useState('')
  const [error, setError] = useState('')

  async function search() {
    if (!query.trim()) return
    setSearching(true); setError('')
    try {
      const res = await fetch(`/api/loans/course-lookup?q=${encodeURIComponent(query.trim())}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) { setError(data?.error || 'تعذر البحث'); setResults([]); return }
      setResults(data.courses || [])
    } catch {
      setError('تعذر الاتصال بمنصة الإقفال')
    } finally {
      setSearching(false)
    }
  }

  async function link(course: CourseLookupResult) {
    setLinkingId(course.id); setError('')
    try {
      const res = await fetch(`/api/loans/${loanId}/link-course`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: course.id, courseCode: course.code }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data?.error || 'تعذر الربط'); return }
      setOpen(false); setQuery(''); setResults([])
      onLinked()
    } catch {
      setError('تعذر الربط')
    } finally {
      setLinkingId('')
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn btn-outline btn-sm mt-2">
        🔗 ربط بدورة (معاملة قديمة غير مربوطة)
      </button>
    )
  }

  return (
    <div className="mt-2 rounded-xl p-3" style={{ background: '#F3EDE3', border: '1px solid #C7B08C' }}>
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void search() }}
          placeholder="رمز الدورة أو اسمها، مثل od-2026-0019"
          className="input-shell flex-1"
        />
        <button type="button" onClick={() => void search()} disabled={searching} className="btn btn-primary btn-sm">
          {searching ? '...' : 'بحث'}
        </button>
        <button type="button" onClick={() => { setOpen(false); setResults([]); setError('') }} className="btn btn-ghost btn-sm">إلغاء</button>
      </div>
      {error && <p className="text-xs mt-2" style={{ color: '#73384B' }}>{error}</p>}
      {results.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {results.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-xs">
              <div className="min-w-0">
                <strong>{c.code}</strong> — {c.name}
                <div style={{ color: '#5A5A5A' }}>{c.employeeName} {c.employeeEmail ? `(${c.employeeEmail})` : ''}</div>
              </div>
              <button type="button" onClick={() => void link(c)} disabled={linkingId === c.id} className="btn btn-success btn-sm flex-shrink-0">
                {linkingId === c.id ? '...' : 'ربط'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// صلاحية مطلقة للمدير الفائق: تثبيت توقيع مراجع أو الاثنين على معاملة معيّنة
// مباشرة، بدلاً من انتظار اعتماد كل مراجع بنفسه عبر حسابه — تُستخدم للمعاملات
// القديمة بلا توقيع، أو لإقفال معاملة عالقة بصلاحية المدير العام
function AdminFinalizeReviewControl({ loanId, formType, reviewersList, onDone }: {
  loanId: string; formType: 'advance_req' | 'settlement'
  reviewersList: Array<{ id: string; fullName: string }>
  onDone?: () => void
}) {
  const [first, setFirst] = useState('')
  const [second, setSecond] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function run() {
    if (!first) return
    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/loans/${loanId}/admin-finalize-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formType, firstReviewerId: first, secondReviewerId: second || undefined }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data?.error || 'تعذر الاعتماد'); return }
      onDone?.()
    } catch {
      setError('تعذر الاعتماد')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-2">
      <span className="text-xs" style={{ color: '#73384B' }}>اعتماد بصلاحية المدير العام:</span>
      <select value={first} onChange={(e) => setFirst(e.target.value)} className="input-shell" style={{ maxWidth: 170, padding: '0.25rem 0.5rem', height: 'auto' }}>
        <option value="">المراجع الأول...</option>
        {reviewersList.map((r) => <option key={r.id} value={r.id}>{r.fullName}</option>)}
      </select>
      <select value={second} onChange={(e) => setSecond(e.target.value)} className="input-shell" style={{ maxWidth: 170, padding: '0.25rem 0.5rem', height: 'auto' }}>
        <option value="">المراجع الثاني (اختياري)...</option>
        {reviewersList.filter((r) => r.id !== first).map((r) => <option key={r.id} value={r.id}>{r.fullName}</option>)}
      </select>
      <button type="button" onClick={() => void run()} disabled={!first || saving} className="btn btn-outline btn-sm">
        {saving ? '...' : 'اعتماد فوري'}
      </button>
      {error && <span className="text-xs" style={{ color: '#73384B' }}>{error}</span>}
    </div>
  )
}

function LoanCard({ loan, archived = false, canReview = false, canModify = false, canDelete = false, canLinkCourse = false, onLinked, isSuperAdmin = false, reviewersList = [], onEdit, onDelete, onSettle, onDeleteSettlement, onMarkReviewed, onReturnForReview, onPrintLoan, onPrintSettlement, onSendManualAlert, onSendReviewerReminder, onRequestRecall, onRecallDecision }: {
  loan: LoanDashboardRecord; archived?: boolean; canReview?: boolean; canModify?: boolean; canDelete?: boolean
  canLinkCourse?: boolean; onLinked?: () => void
  isSuperAdmin?: boolean; reviewersList?: Array<{ id: string; fullName: string }>
  onEdit: (id: string) => void; onDelete: (id: string) => void; onSettle: (id: string) => void; onDeleteSettlement: (id: string) => void
  onMarkReviewed: () => void; onReturnForReview: () => void
  onPrintLoan: () => void; onPrintSettlement: () => void
  onSendManualAlert: () => void; onSendReviewerReminder: () => void
  onRequestRecall?: () => void; onRecallDecision?: (approve: boolean) => void
}) {
  const attachCount = Object.values(loan.files ?? {}).reduce((sum: number, v) => sum + toStoredFileArray(v).length, 0)
  const reviewBadge = loan.reviewStatus === 'REVIEWED' ? { label: 'تمت المراجعة', cls: 'badge-success' } : loan.reviewStatus === 'AWAITING_SECOND_REVIEW' ? { label: 'بانتظار المراجع الثاني', cls: 'badge-warning' } : loan.reviewStatus === 'RETURNED' ? { label: 'مُعاد للمراجعة', cls: 'badge-warning' } : { label: 'بانتظار المراجعة', cls: 'badge-neutral' }
  const isSettlementApproved = loan.settlementStatus === 'APPROVED'

  const accentColor = loan.isSettled ? '#4F8F7A' : loan.reviewStatus === 'RETURNED' ? '#6B5A4A' : '#2A6364'

  return (
    <div className="lc animate-fade-up" style={{ borderRightColor: accentColor }}>

      {/* ── رأس: الشارات ── */}
      <div className="lc-badges">
        <span className={`badge ${loan.isSettled ? 'badge-success' : 'badge-primary'}`}>
          {loan.isSettled ? '✓ تمت التسوية' : '⏳ قيد التسوية'}
        </span>
        {loan.printedAt && <span className="badge badge-gold">🖨️ مطبوع / قصّر</span>}
        {loan.isDraft
          ? <span className="badge badge-warning">✏️ مسودة</span>
          : <span className={`badge ${reviewBadge.cls}`}>{reviewBadge.label}</span>}
        {!loan.isDraft && loan.settlementDraft && !loan.isSettled && <span className="badge badge-warning">✏️ تسوية مسودة</span>}
        {loan.courseId && <span className="badge badge-info">🔒 إقفال الدورات</span>}
        {attachCount > 0 && <span className="badge badge-neutral">📎 {attachCount}</span>}
      </div>

      {/* ── جسم: معلومات + أزرار ── */}
      <div className="lc-body">

        {/* يمين: المعلومات */}
        <div className="lc-info">
          {/* اسم الدورة */}
          <h3 className="lc-title">{loan.activity}</h3>

          {/* موظف + رقم مرجعي + إيميل */}
          <div className="lc-meta">
            <span className="lc-meta-item">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="3"/></svg>
              {loan.refNumber}
            </span>
            <span className="lc-meta-sep">·</span>
            <span className="lc-meta-item">{loan.employee}</span>
            {(loan as any).user?.email && (
              <>
                <span className="lc-meta-sep">·</span>
                <span className="lc-meta-item lc-meta-muted">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 7L2 7"/></svg>
                  {(loan as any).user.email}
                </span>
              </>
            )}
          </div>

          {/* التواقيع */}
          {loan.reviewedBy && (
            <div className="lc-sig">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l4-8 4 4 4-6 4 10"/></svg>
              توقيع نموذج 18: {loan.reviewedBy.fullName}{loan.secondReviewedBy ? ` و${loan.secondReviewedBy.fullName}` : ''}
            </div>
          )}
          {isSuperAdmin && !(loan.reviewedBy && loan.secondReviewedBy) && (
            <AdminFinalizeReviewControl loanId={loan.id} formType="advance_req" reviewersList={reviewersList} onDone={() => onLinked?.()} />
          )}
          {loan.settlement && loan.settlementReviewedBy && (
            <div className="lc-sig">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l4-8 4 4 4-6 4 10"/></svg>
              توقيع نموذج 19: {loan.settlementReviewedBy.fullName}{loan.secondSettlementReviewedBy ? ` و${loan.secondSettlementReviewedBy.fullName}` : ''}
            </div>
          )}
          {isSuperAdmin && loan.settlement && !(loan.settlementReviewedBy && loan.secondSettlementReviewedBy) && (
            <AdminFinalizeReviewControl loanId={loan.id} formType="settlement" reviewersList={reviewersList} onDone={() => onLinked?.()} />
          )}

          {/* تفاصيل: موقع + تاريخ + موازنة + مبلغ */}
          <div className="lc-details">
            {loan.location && <span>📍 {loan.location}</span>}
            <span>📅 {formatDate(loan.startDate)} – {formatDate(loan.endDate)}</span>
            <span>الموازنة: {loan.budgetApproved === true ? '✓ معتمدة' : loan.budgetApproved === false ? '✗ غير معتمدة' : '—'}</span>
            <span className="lc-amount">💰 {formatCurrencySar(loan.amount)}</span>
          </div>

          {canLinkCourse && !loan.courseId && <LinkCourseControl loanId={loan.id} onLinked={() => onLinked?.()} />}
        </div>

        {/* يسار: الأزرار */}
        <div className="lc-actions">
          <button type="button" onClick={onPrintLoan} className="btn btn-outline btn-sm">🖨️ طباعة نموذج 18</button>

          {loan.isSettled ? (
            <>
              <button type="button" onClick={onPrintSettlement} className="btn btn-outline btn-sm">🖨️ طباعة نموذج 19</button>
              {loan.settlementStatus !== 'APPROVED' && (
                <>
                  <button type="button" onClick={() => onSettle(loan.id)} className="btn btn-success btn-sm">✏️ تعديل التسوية</button>
                  <button type="button" onClick={() => onDeleteSettlement(loan.id)} className="btn btn-danger btn-sm">🗑️ حذف التسوية</button>
                </>
              )}
            </>
          ) : (
            <button type="button" onClick={() => onSettle(loan.id)} className="btn btn-gold btn-sm">📝 بدء تسوية السلفة</button>
          )}

          {!archived && canModify && !loan.isSettled && loan.reviewStatus !== 'REVIEWED' && (
            <button type="button" onClick={() => onEdit(loan.id)} className="btn btn-success btn-sm">✏️ تعديل</button>
          )}
          {((!archived && canModify && !loan.isSettled && loan.reviewStatus !== 'REVIEWED') || canDelete) && (
            <button type="button" onClick={() => onDelete(loan.id)} className="btn btn-danger btn-sm">🗑️ حذف</button>
          )}

          {canReview && (
            <>
              <button type="button" onClick={onMarkReviewed} className="btn btn-success btn-sm">✓ اعتماد المراجعة</button>
              <button type="button" onClick={onReturnForReview} className="btn btn-warning btn-sm">↩ إعادة للموظف</button>
              {!loan.isSettled && <button type="button" onClick={onSendManualAlert} className="btn btn-warning btn-sm">📣 تنبيه الموظف</button>}
              {loan.recallRequested && onRecallDecision && (
                <>
                  <button type="button" onClick={() => onRecallDecision(true)} className="btn btn-success btn-sm">✓ قبول إعادة الفتح</button>
                  <button type="button" onClick={() => onRecallDecision(false)} className="btn btn-danger btn-sm">✗ رفض الطلب</button>
                </>
              )}
            </>
          )}

          {!canReview && !loan.isSettled && loan.reviewStatus !== 'REVIEWED' && (
            <button type="button" onClick={onSendReviewerReminder} className="btn btn-outline btn-sm">🔔 تذكير المراجعين</button>
          )}
          {!canReview
            && ((loan.reviewStatus === 'REVIEWED' && !loan.isSettled) || loan.settlementStatus === 'APPROVED')
            && !loan.recallRequested
            && onRequestRecall && (
            <button type="button" onClick={onRequestRecall} className="btn btn-outline btn-sm">↩ طلب إعادة فتح المعاملة</button>
          )}
        </div>
      </div>

      {/* ── تنبيهات ── */}
      {(() => { const countdown = getSettlementCountdown(loan); return countdown && (
        <div className={`alert ${countdown.cls} text-xs font-semibold flex flex-wrap items-center justify-between gap-2 mx-4 mb-2`}>
          <span>{countdown.label}</span>
          <span style={{ opacity: 0.8 }}>آخر مهلة: {countdown.deadlineLabel}</span>
        </div>
      ) })()}
      {loan.reviewNote && <div className="alert alert-warning text-xs mx-4 mb-2"><strong>ملاحظة المراجع:</strong> {loan.reviewNote}</div>}
      {loan.recallRequested && <div className="alert alert-warning text-xs mx-4 mb-2"><strong>طلب إعادة فتح:</strong> {loan.recallReason}</div>}
    </div>
  )
}

function StatCard({ label, value, accent, icon, sub, onClick }: { label: string; value: number; accent: 'primary' | 'warning' | 'success' | 'danger'; icon: string; sub?: string; onClick?: () => void }) {
  const colors = { primary: '#2A6364', warning: '#6B5A4A', success: '#4F8F7A', danger: '#73384B' }
  const bgs    = { primary: '#E7F3EE', warning: '#F3EDE3', success: '#E7F3EE', danger: '#F3E7EB' }
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} className={`stat-card w-full text-right ${onClick ? 'stat-card-clickable' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="stat-label">{label}</span>
        <span className="text-xl w-9 h-9 flex items-center justify-center rounded-lg" style={{ background: bgs[accent] }}>{icon}</span>
      </div>
      <p className="stat-value" style={{ color: colors[accent] }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: '#92400E', background: '#FEF3C7', borderRadius: '0.3rem', padding: '0.1rem 0.4rem', display: 'inline-block' }}>⚡ {sub}</p>}
    </Tag>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
    </label>
  )
}

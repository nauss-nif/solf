'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import {
  CURRENCY_OPTIONS,
  EXPENSE_CATEGORIES,
  FILE_SIZE_LIMIT_BYTES,
  GUIDE_SECTIONS,
  IMAGE_MAX_DIMENSION,
  IMAGE_TARGET_MAX_BYTES,
  LOAN_ATTACHMENT_DEFINITIONS,
  SETTLEMENT_DOCUMENT_TYPES,
  type CurrencyCode,
  type LoanRequestFiles,
  type SettlementCurrencyRate,
  type SettlementDetailRecord,
  type SettlementDocumentType,
  type StoredFile,
} from '@/lib/loan-form-options'
import { formatCurrencySar, formatEnglishNumber, numberToArabicWords } from '@/lib/utils'

// ── TYPES ────────────────────────────────────────────────────────────────────

type LoanItemRecord   = { id: string; category: string; amount: number }
type SettlementRecord = { id: string; supported: number; unsupported: number; total: number; savings: number; overage: number; createdAt: string }

export type LoanDashboardRecord = {
  id: string; userId?: string; refNumber: string; employee: string; activity: string; location: string
  amount: number; budgetApproved: boolean | null
  reviewStatus: 'PENDING' | 'RETURNED' | 'REVIEWED'
  reviewNote?: string; startDate: string; endDate: string
  createdAt: string; updatedAt?: string; printedAt: string | null
  files?: LoanRequestFiles | null; isSettled: boolean
  items: LoanItemRecord[]; settlement: SettlementRecord | null
}

type CurrentUser = { userId: string; fullName: string; email: string; role: 'EMPLOYEE' | 'ADMIN' | 'REVIEWER'; roles: Array<'EMPLOYEE' | 'ADMIN' | 'REVIEWER'> }
type ExpenseDraft = { category: string; amount: string }
type InvoiceDraft = { amount: string; currencyCode: CurrencyCode; exchangeRate: string; sarAmount: number; documentType: SettlementDocumentType; invoiceDate: string; issuer: string; attachment: StoredFile | null }
type SettlementDraft = { id: string; category: string; budget: number; invoices: InvoiceDraft[]; isAdditional?: boolean }
type SettlementMetaState = { receiptNumber: string; receiptDate: string; overageReason: string }
type ToastItem = { id: number; message: string; tone: 'success' | 'error' | 'info'; important: boolean }
type LoanFormState = { requestDate: string; refNumber: string; agencyCode: string; employee: string; activity: string; location: string; startDate: string; endDate: string; budgetApproved: boolean | null }
type ActiveTab = 'dashboard' | 'requests' | 'archive' | 'reports' | 'alerts' | 'guide'
type NotificationItem = { id: string; type: string; title: string; message: string; isRead: boolean; createdAt: string; metadata?: { loanId?: string; refNumber?: string } | null }
type WorkMode = 'employee' | 'reviewer'
type LinkedCourse = { id: string; code: string; name: string; employeeEmail: string; location: string; startDate: string; endDate: string }

const AGENCY_CODE = '26'

// ── HELPERS ──────────────────────────────────────────────────────────────────

function formatDate(value: string) { return new Date(value).toLocaleDateString('en-GB') }

function workDaysSince(endDate: string) {
  const end = new Date(endDate); const today = new Date(); const current = new Date(end); let count = 0
  while (current < today) { current.setDate(current.getDate() + 1); const day = current.getDay(); if (day !== 5 && day !== 6) count++ }
  return count
}

function generateRef(loans: LoanDashboardRecord[]) {
  const maxRef = loans.reduce((max, loan) => { const num = Number.parseInt(loan.refNumber.split('/')[2] ?? '0', 10); return Math.max(max, Number.isNaN(num) ? 0 : num) }, 0)
  return `وت/${AGENCY_CODE}/${String(maxRef + 1).padStart(4, '0')}`
}

function normalizeLoanRecord(loan: Omit<LoanDashboardRecord, 'location' | 'budgetApproved' | 'reviewStatus' | 'reviewNote' | 'printedAt' | 'files'> & { location?: string | null; budgetApproved?: boolean | null; reviewStatus?: string; reviewNote?: string; printedAt?: string | null; files?: LoanRequestFiles | null }): LoanDashboardRecord {
  return { ...loan, location: loan.location ?? '', budgetApproved: typeof loan.budgetApproved === 'boolean' ? loan.budgetApproved : null, reviewStatus: (loan.reviewStatus as LoanDashboardRecord['reviewStatus']) ?? 'PENDING', reviewNote: loan.reviewNote ?? '', printedAt: loan.printedAt ?? null, files: loan.files ?? null }
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

function createEmptyAttachments(): Record<string, StoredFile | null> {
  return Object.fromEntries(LOAN_ATTACHMENT_DEFINITIONS.map((a) => [a.key, null])) as Record<string, StoredFile | null>
}

function getCurrencyLabel(code: CurrencyCode) { return CURRENCY_OPTIONS.find((c) => c.code === code)?.label ?? code }
function isPettyCashCategory(category: string) { return category.includes('نثريات') }

function sortSettlementItems(items: SettlementDraft[]) {
  return [...items].sort((a, b) => { const ai = isPettyCashCategory(a.category); const bi = isPettyCashCategory(b.category); if (ai === bi) return 0; return ai ? 1 : -1 })
}

function settlementItemHasUserContent(item: SettlementDraft) {
  return item.invoices.some((inv) => Boolean(inv.amount) || Boolean(inv.attachment) || Boolean(inv.invoiceDate) || Boolean(inv.issuer.trim()))
}

async function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result ?? '')); r.onerror = () => reject(new Error('تعذر قراءة الملف.')); r.readAsDataURL(file) })
}

async function optimizeImageFile(file: File): Promise<StoredFile> {
  const sourceUrl = await readFileAsDataUrl(file)
  const image = await new Promise<HTMLImageElement>((resolve, reject) => { const el = new window.Image(); el.onload = () => resolve(el); el.onerror = () => reject(new Error('تعذر معالجة الصورة.')); el.src = sourceUrl })
  const maxSide = Math.max(image.width, image.height)
  const ratio = maxSide > IMAGE_MAX_DIMENSION ? IMAGE_MAX_DIMENSION / maxSide : 1
  const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.width * ratio)); canvas.height = Math.max(1, Math.round(image.height * ratio))
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('تعذر تهيئة معالجة الصورة.')
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  let quality = 0.92; let dataUrl = canvas.toDataURL('image/jpeg', quality)
  while (dataUrl.length > IMAGE_TARGET_MAX_BYTES * 1.37 && quality > 0.45) { quality -= 0.08; dataUrl = canvas.toDataURL('image/jpeg', quality) }
  return { name: file.name.replace(/\.[^.]+$/, '') + '.jpg', type: 'image/jpeg', size: Math.round((dataUrl.length * 3) / 4), dataUrl }
}

async function fileToStoredFile(file: File): Promise<StoredFile> {
  if (file.size > FILE_SIZE_LIMIT_BYTES) throw new Error('حجم الملف كبير جدًا، الحد الأقصى 12 ميجابايت.')
  if (file.type.startsWith('image/')) return optimizeImageFile(file)
  const dataUrl = await readFileAsDataUrl(file)
  return { name: file.name, type: file.type || 'application/octet-stream', size: file.size, dataUrl }
}

function cloneStoredFile(file: StoredFile | null | undefined) {
  return file ? { name: file.name, type: file.type, size: file.size, dataUrl: file.dataUrl } : null
}

function toLoanRequestFiles(input: Record<string, StoredFile | null>): LoanRequestFiles {
  return Object.fromEntries(Object.entries(input).map(([k, v]) => [k, v ? cloneStoredFile(v) : null]))
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

// ── CHART COLORS ──────────────────────────────────────────────────────────────
const CHART_COLORS = ['#2A6364', '#C7B08C', '#2E6F8E', '#C7B08C', '#5A5A5A', '#C7B08C', '#B5BDBE', '#5A5A5A']

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────────

export default function DashboardClient({ currentUser, initialLoans }: { currentUser: CurrentUser; initialLoans: LoanDashboardRecord[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isAdminOrReviewer = currentUser.roles.some((r) => r === 'ADMIN' || r === 'REVIEWER')
  const [isPending, startTransition] = useTransition()
  const [loans, setLoans] = useState<LoanDashboardRecord[]>(initialLoans.map(normalizeLoanRecord))
  const [isLoadingLoans, setIsLoadingLoans] = useState(initialLoans.length === 0)
  const [loadError, setLoadError] = useState('')
  const [activeTab, setActiveTab] = useState<ActiveTab>(isAdminOrReviewer ? 'dashboard' : 'requests')
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
  const [loanAttachments, setLoanAttachments] = useState<Record<string, StoredFile | null>>(createEmptyAttachments)
  const [currencyRates, setCurrencyRates] = useState<SettlementCurrencyRate[]>([])
  const [settlementItems, setSettlementItems] = useState<SettlementDraft[]>([])
  const [settlementMeta, setSettlementMeta] = useState<SettlementMetaState>({ receiptNumber: '', receiptDate: '', overageReason: '' })
  const [linkedCourse, setLinkedCourse] = useState<LinkedCourse | null>(null)
  const [handledCourseLink, setHandledCourseLink] = useState(false)

  const [workMode, setWorkMode] = useState<WorkMode>(isAdminOrReviewer ? 'reviewer' : 'employee')
  const isReviewerMode = isAdminOrReviewer && workMode === 'reviewer'
  const isSuperAdmin = currentUser.email.toLowerCase() === 'od@nauss.edu.sa'
  const managementModeLabel = isSuperAdmin ? 'مدير النظام' : 'مراجع'
  const requestsSectionLabel = isReviewerMode ? 'إدارة السلف' : 'طلبات السلفة'

  async function refreshLoans(mode: WorkMode = workMode) {
    const url = isAdminOrReviewer && mode === 'employee' ? '/api/loans?scope=own' : '/api/loans'
    try { setIsLoadingLoans(true); setLoadError(''); const res = await fetch(url, { cache: 'no-store' }); if (!res.ok) throw new Error(); const data = await res.json() as LoanDashboardRecord[]; setLoans(data.map(normalizeLoanRecord)) }
    catch { setLoadError('تعذر تحميل بيانات السلف من الخادم.') }
    finally { setIsLoadingLoans(false) }
  }

  useEffect(() => { if (initialLoans.length > 0) return; void refreshLoans() }, [initialLoans.length])
  useEffect(() => { void refreshLoans(workMode) }, [workMode])
  useEffect(() => { void loadNotifications() }, [])
  useEffect(() => {
    if (handledCourseLink) return
    const courseId = searchParams.get('courseId')
    if (!courseId) return
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
  }, [handledCourseLink, searchParams])

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
    return { pending: unsettled.length, settled: settled.length, total: loans.length, overdue: unsettled.filter((l) => workDaysSince(l.endDate) > 15).length, printed: loans.filter((l) => l.printedAt).length }
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

  const executiveReport = useMemo(() => {
    const settledLoans = loans.filter((loan) => loan.isSettled && loan.settlement)
    const activeLoans = loans.filter((loan) => !loan.isSettled)
    const reviewedLoans = loans.filter((loan) => loan.reviewStatus === 'REVIEWED')
    const returnedLoans = loans.filter((loan) => loan.reviewStatus === 'RETURNED')
    const overdueLoans = activeLoans
      .map((loan) => ({ ...loan, days: workDaysSince(loan.endDate) }))
      .filter((loan) => loan.days > 15)
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

  function openEditLoanModal(loanId: string) {
    const loan = loans.find((l) => l.id === loanId); if (!loan || loan.isSettled || (!isReviewerMode && loan.reviewStatus === 'REVIEWED')) return
    setLoanError(''); setEditingLoanId(loan.id)
    setLoanForm({ requestDate: loan.createdAt.slice(0, 10), refNumber: loan.refNumber, agencyCode: AGENCY_CODE, employee: loan.employee, activity: loan.activity, location: loan.location, startDate: loan.startDate.slice(0, 10), endDate: loan.endDate.slice(0, 10), budgetApproved: loan.budgetApproved })
    setExpenses(loan.items.length > 0 ? loan.items.map((i) => ({ category: i.category, amount: String(i.amount) })) : [{ category: '', amount: '' }])
    setLoanAttachments({ grandApproval: cloneStoredFile(loan.files?.grandApproval), nomineeAdjustment: cloneStoredFile(loan.files?.nomineeAdjustment) })
    setLoanModalOpen(true)
  }

  function openSettlementModal(loanId: string) {
    const loan = loans.find((l) => l.id === loanId); if (!loan) return
    setSelectedLoanId(loanId); setSettlementError('')
    setCurrencyRates([{ currencyCode: 'USD', rate: 3.75 }])
    setSettlementItems(sortSettlementItems(loan.items.map((i) => createSettlementItem(i.category, i.amount))))
    setSettlementMeta({ receiptNumber: '', receiptDate: '', overageReason: '' })
    setSettlementModalOpen(true)
  }

  function updateExpense(index: number, field: keyof ExpenseDraft, value: string) {
    setExpenses((curr) => curr.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }

  async function handleLoanAttachmentUpload(key: string, fileList: FileList | null) {
    const file = fileList?.[0]; if (!file) return
    try { const stored = await fileToStoredFile(file); setLoanAttachments((curr) => ({ ...curr, [key]: stored })); setLoanError('') }
    catch (err) { setLoanError(err instanceof Error ? err.message : 'تعذر رفع الملف.') }
  }

  async function submitLoan() {
    const cleanExpenses = expenses.map((i) => ({ category: i.category.trim(), amount: Number.parseFloat(i.amount || '0') || 0 })).filter((i) => i.category && i.amount > 0)
    if (!loanForm.activity || !loanForm.location || !loanForm.employee) { setLoanError('أكمل الحقول الأساسية قبل حفظ الطلب.'); return }
    if (!loanForm.startDate || !loanForm.endDate) { setLoanError('حدد تاريخ البداية والنهاية.'); return }
    if (loanForm.budgetApproved === null) { setLoanError('حدد حالة اعتماد الموازنة.'); return }
    if (cleanExpenses.length === 0) { setLoanError('أضف بند صرف واحد على الأقل.'); return }
    for (const att of LOAN_ATTACHMENT_DEFINITIONS) { if (att.required && !loanAttachments[att.key]) { setLoanError(`أرفق ${att.label} قبل إرسال الطلب.`); return } }
    const total = cleanExpenses.reduce((s, i) => s + i.amount, 0)
    const payload = { refNumber: loanForm.refNumber, employee: loanForm.employee, activity: loanForm.activity.trim(), location: loanForm.location.trim(), amount: total, budgetApproved: loanForm.budgetApproved, startDate: loanForm.startDate, endDate: loanForm.endDate, files: toLoanRequestFiles(loanAttachments), items: cleanExpenses, courseId: linkedCourse?.id, courseCode: linkedCourse?.code }
    startTransition(async () => {
      const isEditing = Boolean(editingLoanId)
      const res = await fetch(isEditing ? `/api/loans/${editingLoanId}` : '/api/loans', { method: isEditing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setLoanError(typeof data?.error === 'string' ? data.error : 'تعذر حفظ طلب السلفة.'); return }
      const savedLoan = normalizeLoanRecord(data)
      setLoans((curr) => isEditing ? curr.map((l) => l.id === savedLoan.id ? savedLoan : l) : [savedLoan, ...curr])
      setLoanModalOpen(false); setLoanError(''); showToast(isEditing ? 'تم تحديث طلب السلفة.' : 'تم حفظ طلب السلفة بنجاح.')
    })
  }

  function updateRateRow(index: number, field: keyof SettlementCurrencyRate, value: string) {
    setCurrencyRates((curr) => curr.map((r, i) => i === index ? { ...r, [field]: field === 'rate' ? Number.parseFloat(value || '0') || 0 : (value as CurrencyCode) } : r))
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
    if (item && isPettyCashCategory(item.category) && !file.type.startsWith('image/')) { setSettlementError('في بند النثريات يجب إرفاق موافقة المعالي كصورة فقط.'); return }
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
    const hasPettyCash = details.some((item) => isPettyCashCategory(item.category))
    const pettyCashApproval = details.find((item) => isPettyCashCategory(item.category))?.invoices.find((inv) => inv.attachment)?.attachment ?? null
    if (hasPettyCash && !pettyCashApproval) { setSettlementError('أرفق موافقة المعالي عند وجود نثريات ضمن التسوية.'); return }
    for (const inv of allInvoices) {
      if (!inv.amount || inv.sar <= 0) { setSettlementError(`أكمل مبلغ الفاتورة في بند ${inv.category}.`); return }
      if (!isPettyCashCategory(inv.category) && !inv.invoiceDate) { setSettlementError(`حدد تاريخ الفاتورة في بند ${inv.category}.`); return }
      if (!isPettyCashCategory(inv.category) && !inv.issuer.trim()) { setSettlementError(`أدخل الجهة المصدرة للفاتورة في بند ${inv.category}.`); return }
      if (!isPettyCashCategory(inv.category) && !inv.attachment) { setSettlementError(`أرفق صورة أو ملف الفاتورة في بند ${inv.category}.`); return }
    }
    if (settlementSummary.overage > 0 && !settlementMeta.overageReason.trim()) { setSettlementError('أدخل مبرر الزيادة عند تجاوز إجمالي المصروفات مبلغ السلفة.'); return }
    if (settlementSummary.savings > 0) {
      if (!settlementMeta.receiptNumber.trim()) { setSettlementError('أدخل رقم سند القبض عند وجود وفر في السلفة النقدية.'); return }
      if (!settlementMeta.receiptDate) { setSettlementError('أدخل تاريخ سند القبض.'); return }
    }
    startTransition(async () => {
      const res = await fetch('/api/settlements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ loanId: settlementLoan.id, supported: settlementSummary.supported, unsupported: settlementSummary.unsupported, total: settlementSummary.total, savings: settlementSummary.savings, overage: settlementSummary.overage, currencyRates, details, receiptNumber: settlementMeta.receiptNumber.trim(), receiptDate: settlementMeta.receiptDate, overageReason: settlementMeta.overageReason.trim(), pettyCashApproval: cloneStoredFile(pettyCashApproval) }) })
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

  async function handleLogout() { try { await fetch('/api/auth/logout', { method: 'POST' }) } finally { router.push('/login') } }

  async function updateReviewState(loanId: string, reviewStatus: LoanDashboardRecord['reviewStatus'], reviewNote = '') {
    startTransition(async () => {
      const res = await fetch(`/api/loans/${loanId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reviewStatus, reviewNote }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { showToast(typeof data?.error === 'string' ? data.error : 'تعذر تحديث حالة المراجعة.', 'error'); return }
      setLoans((curr) => curr.map((l) => l.id === data.id ? normalizeLoanRecord(data) : l))
      showToast(reviewStatus === 'RETURNED' ? 'تمت إعادة المعاملة للموظف.' : 'تم تحديث حالة المراجعة.')
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

  async function sendReviewerReminder(loanId: string) {
    startTransition(async () => {
      const res = await fetch(`/api/loans/${loanId}/reminder`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { showToast(typeof data?.error === 'string' ? data.error : 'تعذر إرسال تذكير المراجعين.', 'error'); return }
      showToast('تم إرسال تذكير للمراجعين والمدير.')
      await loadNotifications()
    })
  }

  const requestLoans = filteredLoans
  const settledLoans  = filteredLoans.filter((l) => l.isSettled)
  const reviewerQueue = filteredLoans
    .filter((loan) => !loan.isSettled)
    .sort((a, b) => {
      const rank = { PENDING: 0, RETURNED: 1, REVIEWED: 2 } as Record<LoanDashboardRecord['reviewStatus'], number>
      return rank[a.reviewStatus] - rank[b.reviewStatus] || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
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
            <button key={tab} type="button" onClick={() => setActiveTab(tab)}
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
              <button type="button" onClick={() => router.push('/admin')}
                className="nav-item w-full text-right">
                <span>👥</span> إدارة المستخدمين
              </button>
              <button type="button" onClick={() => router.push('/admin/settings')}
                className="nav-item w-full text-right">
                <span>⚙️</span> إعدادات النظام
              </button>
            </>
          )}
        </nav>

        {/* User section */}
        <div style={{ borderTop: '1px solid rgba(218,219,217,0.18)', padding: '1rem' }}>
          <div className="flex items-center gap-3 mb-3">
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#2A6364', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', color: '#E8ECEB', fontWeight: 700, flexShrink: 0 }}>
              {currentUser.fullName.charAt(0)}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <p className="text-sm font-semibold truncate" style={{ color: '#DADBD9' }}>{currentUser.fullName}</p>
              <p className="text-xs truncate" style={{ color: '#5A5A5A' }}>{currentUser.email}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1 mb-3">
            {isSuperAdmin ? (
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(199,176,140,0.24)', color: '#C7B08C' }}>
                مدير النظام
              </span>
            ) : currentUser.roles.map((r) => (
              <span key={r} className="text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{ background: r === 'ADMIN' ? 'rgba(199,176,140,0.24)' : r === 'REVIEWER' ? 'rgba(42,99,100,0.35)' : 'rgba(32,63,64,0.45)', color: r === 'ADMIN' ? '#C7B08C' : '#E8ECEB' }}>
                {r === 'ADMIN' ? 'مدير' : r === 'REVIEWER' ? 'مراجع' : 'موظف'}
              </span>
            ))}
          </div>
          <button type="button" onClick={handleLogout}
            className="w-full text-xs font-semibold py-2 rounded-lg transition text-center"
            style={{ background: 'rgba(220,38,38,0.12)', color: '#FCA5A5', border: '1px solid rgba(220,38,38,0.2)' }}>
            تسجيل الخروج
          </button>
        </div>
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
                <button type="button" onClick={() => setWorkMode('reviewer')} className="rounded-lg px-3 py-2" style={{ background: isReviewerMode ? '#2A6364' : 'transparent', color: isReviewerMode ? '#fff' : '#5A5A5A' }}>{managementModeLabel}</button>
                <button type="button" onClick={() => setWorkMode('employee')} className="rounded-lg px-3 py-2" style={{ background: !isReviewerMode ? '#2A6364' : 'transparent', color: !isReviewerMode ? '#fff' : '#5A5A5A' }}>موظف</button>
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
                + طلب سلفة جديد
              </button>
            )}
          </div>
        </header>

        <main className="app-main">
          {!isAdminOrReviewer && (
            <>
              {/* STAT CARDS */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 animate-fade-up">
                <StatCard label="قيد التسوية"   value={stats.pending}  accent="warning" icon="⏳" />
                <StatCard label="تمت تسويتها"  value={stats.settled}  accent="success" icon="✅" />
                <StatCard label="إجمالي الطلبات" value={stats.total}   accent="primary" icon="📋" />
                <StatCard label="متأخرة > ١٥ يوم" value={stats.overdue} accent="danger"  icon="⚠️" />
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
            <div className="tab-list">
              {([
                ...(isAdminOrReviewer ? [{ tab: 'dashboard' as ActiveTab, label: 'لوحة المعلومات' }] : []),
                { tab: 'requests', label: `${requestsSectionLabel} (${loans.filter((l) => !l.isSettled).length})` },
                { tab: 'reports',  label: 'التقارير' },
                { tab: 'archive',  label: `الأرشيف (${settledLoans.length})` },
                ...(isAdminOrReviewer ? [{ tab: 'alerts' as ActiveTab, label: 'التنبيهات اليدوية' }] : []),
                { tab: 'guide',    label: 'التعليمات' },
              ] as Array<{ tab: ActiveTab; label: string }>).map(({ tab, label }) => (
                <button key={tab} type="button" onClick={() => setActiveTab(tab)}
                  className={`tab-btn ${activeTab === tab ? 'active' : ''}`}>
                  {label}
                </button>
              ))}
            </div>

            {/* DASHBOARD TAB */}
            {activeTab === 'dashboard' && isAdminOrReviewer && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard label="قيد التسوية" value={stats.pending} accent="warning" icon="⏳" />
                  <StatCard label="تمت تسويتها" value={stats.settled} accent="success" icon="✅" />
                  <StatCard label="إجمالي الطلبات" value={stats.total} accent="primary" icon="📋" />
                  <StatCard label="متأخرة > ١٥ يوم" value={stats.overdue} accent="danger" icon="⚠️" />
                </div>

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

                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="section-card p-4">
                    <h3 className="text-sm font-semibold mb-3" style={{ color: '#2D4D40' }}>المبالغ الشهرية</h3>
                    {monthlyData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={monthlyData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#DADBD9" />
                          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#5A5A5A' }} />
                          <YAxis tick={{ fontSize: 10, fill: '#5A5A5A' }} width={60} />
                          <Tooltip formatter={(v) => [formatCurrencySar(Number(v)), '']} contentStyle={{ borderRadius: 8, border: '1px solid #C8D9D0', fontSize: 12 }} />
                          <Bar dataKey="requested" name="مطلوب" fill="#2A6364" radius={[4,4,0,0]} />
                          <Bar dataKey="settled" name="مسوّى" fill="#C7B08C" radius={[4,4,0,0]} />
                          <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 11, color: '#5A5A5A' }}>{v}</span>} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <div className="h-[220px] flex items-center justify-center text-sm" style={{ color: '#5A5A5A' }}>لا توجد بيانات كافية</div>}
                  </div>

                  <div className="section-card p-4">
                    <h3 className="text-sm font-semibold mb-3" style={{ color: '#2D4D40' }}>توزيع الطلبات</h3>
                    {statusChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={statusChartData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                            {statusChartData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                          </Pie>
                          <Tooltip formatter={(v) => [Number(v), 'طلب']} contentStyle={{ borderRadius: 8, border: '1px solid #C8D9D0', fontSize: 12 }} />
                          <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 11, color: '#5A5A5A' }}>{v}</span>} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : <div className="h-[220px] flex items-center justify-center text-sm" style={{ color: '#5A5A5A' }}>لا توجد بيانات</div>}
                  </div>
                </div>

                <div className="section-card p-4">
                  <h3 className="text-sm font-semibold mb-3" style={{ color: '#2D4D40' }}>أعلى أوجه الصرف استخداماً</h3>
                  {categoryReport.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={categoryReport.map(([name, value]) => ({ name, value }))} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#DADBD9" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10, fill: '#5A5A5A' }} width={80} tickFormatter={(v) => formatEnglishNumber(v)} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#2D4D40' }} width={120} />
                        <Tooltip formatter={(v) => [formatCurrencySar(Number(v)), 'الإجمالي']} contentStyle={{ borderRadius: 8, border: '1px solid #C8D9D0', fontSize: 12 }} />
                        <Bar dataKey="value" radius={[0,4,4,0]}>
                          {categoryReport.map((_, index) => <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <div className="h-[220px] flex items-center justify-center text-sm" style={{ color: '#5A5A5A' }}>لا توجد بيانات كافية</div>}
                </div>
              </div>
            )}

            {/* REQUESTS TAB */}
            {activeTab === 'requests' && (
              <div className="space-y-4">
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
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="summary-pill"><p className="summary-pill-label">بانتظار المراجعة</p><p className="summary-pill-value" style={{ color: '#73384B' }}>{formatEnglishNumber(reviewerQueue.filter((loan) => loan.reviewStatus === 'PENDING').length)}</p></div>
                      <div className="summary-pill"><p className="summary-pill-label">معادة للموظف</p><p className="summary-pill-value" style={{ color: '#C7B08C' }}>{formatEnglishNumber(reviewerQueue.filter((loan) => loan.reviewStatus === 'RETURNED').length)}</p></div>
                      <div className="summary-pill"><p className="summary-pill-label">جاهزة للطباعة</p><p className="summary-pill-value" style={{ color: '#2A6364' }}>{formatEnglishNumber(reviewerQueue.filter((loan) => loan.reviewStatus === 'REVIEWED').length)}</p></div>
                    </div>
                    {reviewerQueue.length === 0 ? (
                      <div className="empty-state">
                        <div className="empty-state-icon text-4xl">✅</div>
                        <p className="empty-state-title">لا توجد معاملات مفتوحة للمراجعة</p>
                      </div>
                    ) : reviewerQueue.map((loan) => (
                      <ReviewerLoanCard
                        key={loan.id}
                        loan={loan}
                        onPreview={() => router.push(`/loans/${loan.id}`)}
                        onEdit={() => openEditLoanModal(loan.id)}
                        onReturn={() => { const note = window.prompt('ملاحظة الإرجاع للموظف:', loan.reviewNote || ''); if (note === null) return; void updateReviewState(loan.id, 'RETURNED', note) }}
                        onMarkReviewed={() => updateReviewState(loan.id, 'REVIEWED')}
                        onPrint={() => openPrintDocument('loan', loan.id)}
                        onDelete={() => deleteLoan(loan.id)}
                        canDelete={isSuperAdmin}
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
                      <LoanCard key={loan.id} loan={loan} canReview={isReviewerMode} canModify={isReviewerMode || loan.reviewStatus !== 'REVIEWED'}
                        onEdit={openEditLoanModal} onDelete={deleteLoan} onSettle={openSettlementModal}
                        onMarkReviewed={() => updateReviewState(loan.id, 'REVIEWED')}
                        onReturnForReview={() => { const note = window.prompt('ملاحظة الإرجاع للموظف:', loan.reviewNote || ''); if (note === null) return; void updateReviewState(loan.id, 'RETURNED', note) }}
                        onPrintLoan={() => openPrintDocument('loan', loan.id)}
                        onPrintSettlement={() => openPrintDocument('settlement', loan.id)}
                        onSendManualAlert={() => sendManualLoanAlert(loan.id)}
                        onSendReviewerReminder={() => sendReviewerReminder(loan.id)} />
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
                  <LoanCard key={loan.id} loan={loan} archived canReview={isReviewerMode} canModify={isReviewerMode} canDelete={isSuperAdmin}
                    onEdit={openEditLoanModal} onDelete={deleteLoan} onSettle={openSettlementModal}
                    onMarkReviewed={() => updateReviewState(loan.id, 'REVIEWED')}
                    onReturnForReview={() => { const note = window.prompt('ملاحظة الإرجاع:', loan.reviewNote || ''); if (note === null) return; void updateReviewState(loan.id, 'RETURNED', note) }}
                    onPrintLoan={() => openPrintDocument('loan', loan.id)}
                    onPrintSettlement={() => openPrintDocument('settlement', loan.id)}
                    onSendManualAlert={() => sendManualLoanAlert(loan.id)}
                    onSendReviewerReminder={() => sendReviewerReminder(loan.id)} />
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
                    {monthlyData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={monthlyData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#DADBD9" />
                          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#5A5A5A' }} />
                          <YAxis tick={{ fontSize: 10, fill: '#5A5A5A' }} width={60} />
                          <Tooltip formatter={(v) => [formatCurrencySar(Number(v)), '']} labelStyle={{ fontFamily: 'inherit', fontSize: 12 }} contentStyle={{ borderRadius: 8, border: '1px solid #C8D9D0', fontSize: 12 }} />
                          <Bar dataKey="requested" name="مطلوب" fill="#2A6364" radius={[4,4,0,0]} />
                          <Bar dataKey="settled"   name="مسوّى" fill="#C7B08C" radius={[4,4,0,0]} />
                          <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 11, color: '#5A5A5A' }}>{v}</span>} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[220px] flex items-center justify-center text-sm" style={{ color: '#5A5A5A' }}>لا توجد بيانات كافية</div>
                    )}
                  </div>

                  {/* Status donut chart */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3" style={{ color: '#2D4D40' }}>توزيع الطلبات حسب الحالة</h3>
                    {statusChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={statusChartData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                            {statusChartData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                          </Pie>
                          <Tooltip formatter={(v) => [Number(v), 'طلب']} contentStyle={{ borderRadius: 8, border: '1px solid #C8D9D0', fontSize: 12 }} />
                          <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 11, color: '#5A5A5A' }}>{v}</span>} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[220px] flex items-center justify-center text-sm" style={{ color: '#5A5A5A' }}>لا توجد بيانات</div>
                    )}
                  </div>
                </div>

                {/* Category bar chart */}
                <div>
                  <h3 className="text-sm font-semibold mb-3" style={{ color: '#2D4D40' }}>أعلى أوجه الصرف استخدامًا</h3>
                  {categoryReport.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={categoryReport.map(([name, value]) => ({ name, value }))} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#DADBD9" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10, fill: '#5A5A5A' }} width={80} tickFormatter={(v) => formatEnglishNumber(v)} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#2D4D40' }} width={120} />
                        <Tooltip formatter={(v) => [formatCurrencySar(Number(v)), 'الإجمالي']} contentStyle={{ borderRadius: 8, border: '1px solid #C8D9D0', fontSize: 12 }} />
                        <Bar dataKey="value" radius={[0,4,4,0]}>
                          {categoryReport.map((_, index) => <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[200px] flex items-center justify-center text-sm" style={{ color: '#5A5A5A' }}>لا توجد بيانات كافية لعرض التقرير</div>
                  )}
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
              {linkedCourse && (
                <div className="rounded-xl px-4 py-3 text-sm" style={{ background: '#F3EDE3', border: '1px solid #C7B08C', color: '#6B5A4A' }}>
                  هذه السلفة مرتبطة بدورة من نظام الإقفال: <strong>{linkedCourse.code || linkedCourse.name || linkedCourse.id}</strong>
                </div>
              )}

              {/* Row 1 */}
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="التاريخ *">
                  <input type="date" value={loanForm.requestDate} onChange={(e) => setLoanForm((c) => ({ ...c, requestDate: e.target.value }))} className="input-shell" />
                </Field>
                <Field label="الرقم المرجعي">
                  <input value={loanForm.refNumber} readOnly={!isSuperAdmin} onChange={(e) => setLoanForm((c) => ({ ...c, refNumber: e.target.value }))} className="input-shell" />
                </Field>
                <Field label="كود الوكالة">
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
                    <div key={index} className="grid gap-2 md:grid-cols-[1fr_160px_40px]">
                      <select value={expense.category} onChange={(e) => updateExpense(index, 'category', e.target.value)} className="input-shell">
                        <option value="">اختر البند...</option>
                        {EXPENSE_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                      <input type="number" min="0" step="0.01" value={expense.amount} onChange={(e) => updateExpense(index, 'amount', e.target.value)} className="input-shell" placeholder="0.00" />
                      <button type="button" onClick={() => setExpenses((c) => c.filter((_, i) => i !== index))}
                        className="h-[42px] w-10 flex items-center justify-center rounded-lg text-lg font-bold transition"
                        style={{ color: '#73384B', border: '1.5px solid #D9B8C4', background: 'transparent' }}>×</button>
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
                    const currentFile = loanAttachments[att.key]
                    return (
                      <div key={att.key} className={`attachment-card ${currentFile ? 'has-file' : att.required ? 'required-missing' : ''}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: att.required ? '#73384B' : '#1F3F40' }}>
                            {att.label} {att.required ? '(إلزامي)' : '(اختياري)'}
                          </p>
                          {currentFile ? (
                            <p className="text-xs mt-0.5 truncate" style={{ color: '#4F8F7A' }}>
                              ✓ {currentFile.name} — {Math.round(currentFile.size / 1024)} KB
                            </p>
                          ) : (
                            <p className="text-xs mt-0.5" style={{ color: '#5A5A5A' }}>لم يتم اختيار ملف</p>
                          )}
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <label className="btn btn-primary btn-sm cursor-pointer">
                            {currentFile ? 'تغيير' : 'رفع ملف'}
                            <input type="file" className="hidden" accept=".pdf,image/*" onChange={(e) => void handleLoanAttachmentUpload(att.key, e.target.files)} />
                          </label>
                          {currentFile && (
                            <button type="button" onClick={() => setLoanAttachments((c) => ({ ...c, [att.key]: null }))} className="btn btn-danger btn-sm">إزالة</button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {loanError && <div className="alert alert-error">{loanError}</div>}

              <div className="flex justify-end gap-3 pt-2" style={{ borderTop: '1px solid #DADBD9' }}>
                <button type="button" onClick={() => setLoanModalOpen(false)} className="btn btn-outline">إلغاء</button>
                <button type="button" onClick={submitLoan} disabled={isPending} className="btn btn-primary">
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
              {/* Summary */}
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
                      <div key={`${rate.currencyCode}-${index}`} className="grid gap-2 md:grid-cols-[220px_1fr_40px]">
                        <select value={rate.currencyCode} onChange={(e) => updateRateRow(index, 'currencyCode', e.target.value)} className="input-shell">
                          {CURRENCY_OPTIONS.filter((c) => c.code !== 'SAR').map((c) => (
                            <option key={c.code} value={c.code}>{c.label} ({c.symbol})</option>
                          ))}
                        </select>
                        <input type="number" step="0.0001" value={rate.rate || ''} onChange={(e) => updateRateRow(index, 'rate', e.target.value)} className="input-shell" placeholder="سعر الصرف مقابل الريال السعودي" />
                        <button type="button" onClick={() => setCurrencyRates((c) => c.filter((_, i) => i !== index))}
                          className="h-[42px] w-10 flex items-center justify-center rounded-lg text-lg font-bold"
                          style={{ color: '#73384B', border: '1.5px solid #D9B8C4', background: 'transparent' }}>×</button>
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
                                  {currencyRates.map((r, ri) => <option key={`${r.currencyCode}-${ri}`} value={r.currencyCode}>{getCurrencyLabel(r.currencyCode)}</option>)}
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
                                في بند النثريات يجب إرفاق موافقة المعالي كصورة فقط — لا تقبل ملفات PDF
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
                                  <input type="file" className="hidden" accept={isPettyCash ? 'image/*' : '.pdf,image/*'} onChange={(e) => void uploadInvoiceAttachment(itemIndex, invoiceIndex, e.target.files)} />
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

function ReviewerLoanCard({ loan, onPreview, onEdit, onReturn, onMarkReviewed, onPrint, onDelete, canDelete }: {
  loan: LoanDashboardRecord
  onPreview: () => void
  onEdit: () => void
  onReturn: () => void
  onMarkReviewed: () => void
  onPrint: () => void
  onDelete: () => void
  canDelete: boolean
}) {
  const reviewBadge = loan.reviewStatus === 'REVIEWED' ? { label: 'تمت المراجعة', cls: 'badge-success' } : loan.reviewStatus === 'RETURNED' ? { label: 'مُعاد للموظف', cls: 'badge-warning' } : { label: 'بانتظار المراجعة', cls: 'badge-danger' }

  return (
    <div className="card p-5" style={{ borderRight: `4px solid ${loan.reviewStatus === 'PENDING' ? '#73384B' : loan.reviewStatus === 'RETURNED' ? '#C7B08C' : '#2A6364'}` }}>
      <div className="grid gap-4 xl:grid-cols-[1fr_420px] xl:items-center">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`badge ${reviewBadge.cls}`}>{reviewBadge.label}</span>
            <span className="badge badge-primary">{loan.refNumber}</span>
            {loan.isSettled && <span className="badge badge-success">تمت التسوية</span>}
          </div>
          <div>
            <h3 className="text-lg font-bold" style={{ color: '#1F3F40' }}>{loan.activity}</h3>
            <p className="text-sm" style={{ color: '#5A5A5A' }}>{loan.employee} • {loan.location || 'بدون موقع'}</p>
          </div>
          <div className="grid gap-2 text-sm md:grid-cols-3" style={{ color: '#2D4D40' }}>
            <span>المبلغ: <strong>{formatCurrencySar(loan.amount)}</strong></span>
            <span>الفترة: {formatDate(loan.startDate)} - {formatDate(loan.endDate)}</span>
            <span>الموازنة: {loan.budgetApproved === true ? 'معتمدة' : loan.budgetApproved === false ? 'غير معتمدة' : 'غير محددة'}</span>
          </div>
          {loan.reviewNote && <div className="alert alert-warning text-xs"><strong>ملاحظة الإرجاع:</strong> {loan.reviewNote}</div>}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={onPreview} className="btn btn-primary btn-sm">معاينة المعاملة</button>
          <button type="button" onClick={onEdit} disabled={loan.isSettled} className="btn btn-success btn-sm">تعديل المعاملة</button>
          <button type="button" onClick={onReturn} disabled={loan.isSettled} className="btn btn-warning btn-sm">إعادة للموظف</button>
          <button type="button" onClick={onMarkReviewed} disabled={loan.isSettled} className="btn btn-success btn-sm">اعتماد المراجعة</button>
          <button type="button" onClick={onPrint} className="btn btn-outline btn-sm sm:col-span-2">طباعة نموذج ١٨</button>
          {canDelete && <button type="button" onClick={onDelete} className="btn btn-danger btn-sm sm:col-span-2">🗑️ حذف</button>}
        </div>
      </div>
    </div>
  )
}

function LoanCard({ loan, archived = false, canReview = false, canModify = false, canDelete = false, onEdit, onDelete, onSettle, onMarkReviewed, onReturnForReview, onPrintLoan, onPrintSettlement, onSendManualAlert, onSendReviewerReminder }: {
  loan: LoanDashboardRecord; archived?: boolean; canReview?: boolean; canModify?: boolean; canDelete?: boolean
  onEdit: (id: string) => void; onDelete: (id: string) => void; onSettle: (id: string) => void
  onMarkReviewed: () => void; onReturnForReview: () => void
  onPrintLoan: () => void; onPrintSettlement: () => void
  onSendManualAlert: () => void; onSendReviewerReminder: () => void
}) {
  const attachCount = Object.values(loan.files ?? {}).filter(Boolean).length
  const reviewBadge = loan.reviewStatus === 'REVIEWED' ? { label: 'تمت المراجعة', cls: 'badge-success' } : loan.reviewStatus === 'RETURNED' ? { label: 'مُعاد للمراجعة', cls: 'badge-warning' } : { label: 'بانتظار المراجعة', cls: 'badge-neutral' }

  return (
    <div className="card p-5 animate-fade-up" style={{ borderRight: `3px solid ${loan.isSettled ? '#4F8F7A' : loan.reviewStatus === 'RETURNED' ? '#6B5A4A' : '#2A6364'}` }}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2 flex-1">
          <div className="flex flex-wrap gap-2 items-center">
            <span className={`badge ${loan.isSettled ? 'badge-success' : 'badge-primary'}`}>
              {loan.isSettled ? '✓ تمت التسوية' : '⏳ قيد التسوية'}
            </span>
            {loan.printedAt && <span className="badge badge-gold">🖨️ مطبوع / مُصدَّر</span>}
            {attachCount > 0 && <span className="badge badge-neutral">📎 {attachCount} مرفق</span>}
            <span className={`badge ${reviewBadge.cls}`}>{reviewBadge.label}</span>
          </div>

          <div>
            <h3 className="font-bold text-base" style={{ color: '#1F3F40' }}>{loan.refNumber}</h3>
            <p className="text-sm mt-0.5" style={{ color: '#5A5A5A' }}>{loan.activity} • {loan.employee}</p>
          </div>

          <div className="grid gap-1 text-sm md:grid-cols-2" style={{ color: '#2D4D40' }}>
            <span>📍 {loan.location || '—'}</span>
            <span>📅 {formatDate(loan.startDate)} – {formatDate(loan.endDate)}</span>
            <span>الموازنة: {loan.budgetApproved === true ? '✓ معتمدة' : loan.budgetApproved === false ? '✗ غير معتمدة' : '—'}</span>
            <span className="font-semibold" style={{ color: '#2A6364', fontFamily: 'IBM Plex Mono, monospace' }}>💰 {formatCurrencySar(loan.amount)}</span>
          </div>

          {loan.reviewNote && (
            <div className="alert alert-warning text-xs">
              <strong>ملاحظة المراجع:</strong> {loan.reviewNote}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="grid gap-2 sm:grid-cols-2 lg:w-[340px] flex-shrink-0">
          <button type="button" onClick={onPrintLoan} className="btn btn-outline btn-sm">🖨️ طباعة نموذج ١٨</button>

          {loan.isSettled ? (
            <>
              <button type="button" onClick={onPrintSettlement} className="btn btn-outline btn-sm">🖨️ طباعة نموذج ١٩</button>
            </>
          ) : (
            <button type="button" onClick={() => onSettle(loan.id)} className="btn btn-gold btn-sm sm:col-span-2">📝 بدء تسوية السلفة</button>
          )}

          {!archived && canModify && !loan.isSettled && (
            <>
              <button type="button" onClick={() => onEdit(loan.id)} className="btn btn-success btn-sm">✏️ تعديل</button>
            </>
          )}

          {((!archived && canModify && !loan.isSettled) || canDelete) && (
            <button type="button" onClick={() => onDelete(loan.id)} className="btn btn-danger btn-sm">🗑️ حذف</button>
          )}

          {canReview && (
            <>
              <button type="button" onClick={onMarkReviewed} className="btn btn-success btn-sm">✓ اعتماد المراجعة</button>
              <button type="button" onClick={onReturnForReview} className="btn btn-warning btn-sm">↩ إعادة للموظف</button>
              {!loan.isSettled && <button type="button" onClick={onSendManualAlert} className="btn btn-warning btn-sm sm:col-span-2">📣 تنبيه الموظف</button>}
            </>
          )}

          {!canReview && !loan.isSettled && loan.reviewStatus !== 'REVIEWED' && (
            <button type="button" onClick={onSendReviewerReminder} className="btn btn-outline btn-sm sm:col-span-2">🔔 تذكير المراجعين</button>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, accent, icon }: { label: string; value: number; accent: 'primary' | 'warning' | 'success' | 'danger'; icon: string }) {
  const colors = { primary: '#2A6364', warning: '#6B5A4A', success: '#4F8F7A', danger: '#73384B' }
  const bgs    = { primary: '#E7F3EE', warning: '#F3EDE3', success: '#E7F3EE', danger: '#F3E7EB' }
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-2">
        <span className="stat-label">{label}</span>
        <span className="text-xl w-9 h-9 flex items-center justify-center rounded-lg" style={{ background: bgs[accent] }}>{icon}</span>
      </div>
      <p className="stat-value" style={{ color: colors[accent] }}>{value}</p>
    </div>
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

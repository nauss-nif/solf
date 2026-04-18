'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
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
  type SettlementInvoiceRecord,
  type SettlementMetaRecord,
  type StoredFile,
} from '@/lib/loan-form-options'
import { formatCurrencySar, formatEnglishNumber, numberToArabicWords } from '@/lib/utils'

type LoanItemRecord = {
  id: string
  category: string
  amount: number
}

type SettlementRecord = {
  id: string
  supported: number
  unsupported: number
  total: number
  savings: number
  overage: number
  createdAt: string
}

export type LoanDashboardRecord = {
  id: string
  refNumber: string
  employee: string
  activity: string
  location: string
  amount: number
  budgetApproved: boolean | null
  reviewStatus: 'PENDING' | 'RETURNED' | 'REVIEWED'
  reviewNote?: string
  startDate: string
  endDate: string
  createdAt: string
  updatedAt?: string
  printedAt: string | null
  files?: LoanRequestFiles | null
  isSettled: boolean
  items: LoanItemRecord[]
  settlement: SettlementRecord | null
}

type CurrentUser = {
  userId: string
  fullName: string
  email: string
  role: 'EMPLOYEE' | 'ADMIN' | 'REVIEWER'
  roles: Array<'EMPLOYEE' | 'ADMIN' | 'REVIEWER'>
}

type ExpenseDraft = {
  category: string
  amount: string
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

type SettlementDraft = {
  category: string
  budget: number
  invoices: InvoiceDraft[]
}

type SettlementMetaState = {
  receiptNumber: string
  receiptDate: string
  overageReason: string
}

type ToastItem = {
  id: number
  message: string
  tone: 'success' | 'error' | 'info'
}

type LoanFormState = {
  requestDate: string
  refNumber: string
  agencyCode: string
  employee: string
  activity: string
  location: string
  startDate: string
  endDate: string
  budgetApproved: boolean | null
}

const AGENCY_CODE = '26'

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB')
}

function workDaysSince(endDate: string) {
  const end = new Date(endDate)
  const today = new Date()
  const current = new Date(end)
  let count = 0

  while (current < today) {
    current.setDate(current.getDate() + 1)
    const day = current.getDay()
    if (day !== 5 && day !== 6) count++
  }

  return count
}

function generateRef(loans: LoanDashboardRecord[]) {
  const maxRef = loans.reduce((max, loan) => {
    const num = Number.parseInt(loan.refNumber.split('/')[2] ?? '0', 10)
    return Math.max(max, Number.isNaN(num) ? 0 : num)
  }, 0)

  return `ظˆطھ/${AGENCY_CODE}/${String(maxRef + 1).padStart(4, '0')}`
}

function normalizeLoanRecord(loan: {
  id: string
  refNumber: string
  employee: string
  activity: string
  location: string | null
  amount: number
  budgetApproved?: boolean | null
  reviewStatus?: 'PENDING' | 'RETURNED' | 'REVIEWED'
  reviewNote?: string
  startDate: string
  endDate: string
  createdAt: string
  updatedAt?: string
  printedAt?: string | null
  files?: LoanRequestFiles | null
  isSettled: boolean
  items: LoanItemRecord[]
  settlement: SettlementRecord | null
}): LoanDashboardRecord {
  return {
    ...loan,
    location: loan.location ?? '',
    budgetApproved:
      typeof loan.budgetApproved === 'boolean' ? loan.budgetApproved : null,
    reviewStatus: loan.reviewStatus ?? 'PENDING',
    reviewNote: loan.reviewNote ?? '',
    printedAt: loan.printedAt ?? null,
    files: loan.files ?? null,
  }
}

function createEmptyLoanForm(currentUser: CurrentUser, loans: LoanDashboardRecord[]): LoanFormState {
  return {
    requestDate: new Date().toISOString().slice(0, 10),
    refNumber: generateRef(loans),
    agencyCode: AGENCY_CODE,
    employee: currentUser.fullName,
    activity: '',
    location: '',
    startDate: '',
    endDate: '',
    budgetApproved: null,
  }
}

function createEmptyInvoice(currencyCode: CurrencyCode = 'SAR', exchangeRate = '1'): InvoiceDraft {
  return {
    amount: '',
    currencyCode,
    exchangeRate,
    sarAmount: 0,
    documentType: SETTLEMENT_DOCUMENT_TYPES[0],
    invoiceDate: '',
    issuer: '',
    attachment: null,
  }
}

function createEmptyAttachments(): Record<string, StoredFile | null> {
  return Object.fromEntries(
    LOAN_ATTACHMENT_DEFINITIONS.map((attachment) => [attachment.key, null]),
  ) as Record<string, StoredFile | null>
}

function getCurrencyLabel(code: CurrencyCode) {
  return CURRENCY_OPTIONS.find((currency) => currency.code === code)?.label ?? code
}

function isPettyCashCategory(category: string) {
  return category.includes('ظ†ط«ط±ظٹط§طھ')
}

function sortSettlementItems(items: SettlementDraft[]) {
  return [...items].sort((a, b) => {
    const aIsPettyCash = isPettyCashCategory(a.category)
    const bIsPettyCash = isPettyCashCategory(b.category)

    if (aIsPettyCash === bIsPettyCash) return 0
    return aIsPettyCash ? 1 : -1
  })
}

async function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('طھط¹ط°ط± ظ‚ط±ط§ط،ط© ط§ظ„ظ…ظ„ظپ ط§ظ„ظ…ط±ظپظˆط¹.'))
    reader.readAsDataURL(file)
  })
}

async function optimizeImageFile(file: File) {
  const sourceUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('طھط¹ط°ط± ظ‚ط±ط§ط،ط© ط§ظ„طµظˆط±ط© ط§ظ„ظ…ط±ظپظˆط¹ط©.'))
    reader.readAsDataURL(file)
  })

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new window.Image()
    element.onload = () => resolve(element)
    element.onerror = () => reject(new Error('طھط¹ط°ط± ظ…ط¹ط§ظ„ط¬ط© ط§ظ„طµظˆط±ط© ط§ظ„ظ…ط±ظپظˆط¹ط©.'))
    element.src = sourceUrl
  })

  const maxSide = Math.max(image.width, image.height)
  const ratio = maxSide > IMAGE_MAX_DIMENSION ? IMAGE_MAX_DIMENSION / maxSide : 1
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.width * ratio))
  canvas.height = Math.max(1, Math.round(image.height * ratio))

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('طھط¹ط°ط± طھظ‡ظٹط¦ط© ظ…ط¹ط§ظ„ط¬ط© ط§ظ„طµظˆط±ط©.')
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height)

  let quality = 0.92
  let dataUrl = canvas.toDataURL('image/jpeg', quality)

  while (dataUrl.length > IMAGE_TARGET_MAX_BYTES * 1.37 && quality > 0.45) {
    quality -= 0.08
    dataUrl = canvas.toDataURL('image/jpeg', quality)
  }

  return {
    name: file.name.replace(/\.[^.]+$/, '') + '.jpg',
    type: 'image/jpeg',
    size: Math.round((dataUrl.length * 3) / 4),
    dataUrl,
  } satisfies StoredFile
}

async function fileToStoredFile(file: File) {
  if (file.size > FILE_SIZE_LIMIT_BYTES) {
    throw new Error('ط­ط¬ظ… ط§ظ„ظ…ظ„ظپ ظƒط¨ظٹط± ط¬ط¯ظ‹ط§طŒ ط§ظ„ط­ط¯ ط§ظ„ط£ط¹ظ„ظ‰ ظ„ظ„ظ…ظ„ظپ ط§ظ„ظˆط§ط­ط¯ ظ‡ظˆ 12 ظ…ظٹط¬ط§ط¨ط§ظٹطھ.')
  }

  if (file.type.startsWith('image/')) {
    return optimizeImageFile(file)
  }

  const dataUrl = await readFileAsDataUrl(file)

  return {
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
    dataUrl,
  } satisfies StoredFile
}

function cloneStoredFile(file: StoredFile | null | undefined) {
  return file
    ? {
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl: file.dataUrl,
      }
    : null
}

function toLoanRequestFiles(input: Record<string, StoredFile | null>): LoanRequestFiles {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, value ? cloneStoredFile(value) : null]),
  )
}

function buildRateMap(rates: SettlementCurrencyRate[]) {
  const map = new Map<CurrencyCode, number>()
  map.set('SAR', 1)

  rates.forEach((rate) => {
    if (rate.currencyCode && rate.rate > 0) {
      map.set(rate.currencyCode, rate.rate)
    }
  })

  return map
}

function recalculateInvoice(invoice: InvoiceDraft, rateMap: Map<CurrencyCode, number>): InvoiceDraft {
  const amount = Number.parseFloat(invoice.amount || '0') || 0
  const rate =
    invoice.currencyCode === 'SAR'
      ? 1
      : (rateMap.get(invoice.currencyCode) ??
          Number.parseFloat(invoice.exchangeRate || '0') ??
          0)

  return {
    ...invoice,
    exchangeRate: rate > 0 ? String(rate) : invoice.exchangeRate,
    sarAmount: amount * (rate || 0),
  }
}

function buildSettlementPayload(
  items: SettlementDraft[],
  rates: SettlementCurrencyRate[],
): SettlementDetailRecord[] {
  const rateMap = buildRateMap(rates)

  return items.map((item) => ({
    category: item.category,
    budget: item.budget,
    invoices: item.invoices
      .filter((invoice) => (Number.parseFloat(invoice.amount || '0') || 0) > 0)
      .map(
        (invoice) =>
          ({
            amount: Number.parseFloat(invoice.amount || '0') || 0,
            currencyCode: invoice.currencyCode,
            exchangeRate:
              invoice.currencyCode === 'SAR'
                ? 1
                : rateMap.get(invoice.currencyCode) ??
                  Number.parseFloat(invoice.exchangeRate || '0') ??
                  0,
            sar: recalculateInvoice(invoice, rateMap).sarAmount,
            documentType: invoice.documentType,
            invoiceDate: isPettyCashCategory(item.category) ? '' : invoice.invoiceDate,
            issuer: isPettyCashCategory(item.category) ? '' : invoice.issuer.trim(),
            attachment: cloneStoredFile(invoice.attachment),
          }) satisfies SettlementInvoiceRecord,
      ),
  }))
}

export default function DashboardClient({
  currentUser,
  initialLoans,
}: {
  currentUser: CurrentUser
  initialLoans: LoanDashboardRecord[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [loans, setLoans] = useState<LoanDashboardRecord[]>(
    initialLoans.map(normalizeLoanRecord),
  )
  const [isLoadingLoans, setIsLoadingLoans] = useState(initialLoans.length === 0)
  const [loadError, setLoadError] = useState('')
  const [activeTab, setActiveTab] = useState<'requests' | 'archive' | 'reports' | 'guide'>(
    'requests',
  )
  const [search, setSearch] = useState('')
  const [loanModalOpen, setLoanModalOpen] = useState(false)
  const [settlementModalOpen, setSettlementModalOpen] = useState(false)
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null)
  const [editingLoanId, setEditingLoanId] = useState<string | null>(null)
  const [loanError, setLoanError] = useState('')
  const [settlementError, setSettlementError] = useState('')
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [loanForm, setLoanForm] = useState<LoanFormState>(() =>
    createEmptyLoanForm(currentUser, initialLoans.map(normalizeLoanRecord)),
  )
  const [expenses, setExpenses] = useState<ExpenseDraft[]>([{ category: '', amount: '' }])
  const [loanAttachments, setLoanAttachments] = useState<Record<string, StoredFile | null>>(
    createEmptyAttachments,
  )
  const [currencyRates, setCurrencyRates] = useState<SettlementCurrencyRate[]>([])
  const [settlementItems, setSettlementItems] = useState<SettlementDraft[]>([])
  const [settlementMeta, setSettlementMeta] = useState<SettlementMetaState>({
    receiptNumber: '',
    receiptDate: '',
    overageReason: '',
  })

  async function refreshLoans() {
    try {
      setIsLoadingLoans(true)
      setLoadError('')

      const response = await fetch('/api/loans', { cache: 'no-store' })
      if (!response.ok) {
        throw new Error('LOAD_FAILED')
      }

      const data = (await response.json()) as LoanDashboardRecord[]
      setLoans(data.map(normalizeLoanRecord))
    } catch {
      setLoadError('طھط¹ط°ط± طھط­ظ…ظٹظ„ ط¨ظٹط§ظ†ط§طھ ط§ظ„ط³ظ„ظپ ظ…ظ† ط§ظ„ط®ط§ط¯ظ….')
    } finally {
      setIsLoadingLoans(false)
    }
  }

  useEffect(() => {
    if (initialLoans.length > 0) return
    void refreshLoans()
  }, [initialLoans.length])

  const showToast = (message: string, tone: ToastItem['tone'] = 'success') => {
    const id = Date.now() + Math.floor(Math.random() * 1000)
    setToasts((current) => [...current, { id, message, tone }])
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id))
    }, 3200)
  }

  const filteredLoans = useMemo(() => {
    const normalized = search.trim().toLowerCase()
    if (!normalized) return loans

    return loans.filter((loan) => {
      return (
        loan.refNumber.toLowerCase().includes(normalized) ||
        loan.employee.toLowerCase().includes(normalized) ||
        loan.activity.toLowerCase().includes(normalized) ||
        loan.location.toLowerCase().includes(normalized)
      )
    })
  }, [loans, search])

  const stats = useMemo(() => {
    const unsettled = loans.filter((loan) => !loan.isSettled)
    const settled = loans.filter((loan) => loan.isSettled)
    const overdue = unsettled.filter((loan) => workDaysSince(loan.endDate) > 15)

    return {
      pending: unsettled.length,
      settled: settled.length,
      total: loans.length,
      overdue: overdue.length,
    }
  }, [loans])

  const reportSummary = useMemo(() => {
    const totalRequested = loans.reduce((sum, loan) => sum + loan.amount, 0)
    const totalExpenses = loans.reduce((sum, loan) => sum + (loan.settlement?.total ?? 0), 0)
    const totalSavings = loans.reduce((sum, loan) => sum + (loan.settlement?.savings ?? 0), 0)
    const totalOverage = loans.reduce((sum, loan) => sum + (loan.settlement?.overage ?? 0), 0)

    return {
      totalRequested,
      totalExpenses,
      totalSavings,
      totalOverage,
    }
  }, [loans])

  const loanTotals = useMemo(() => {
    const totalLoanAmount = loans.reduce((sum, loan) => sum + loan.amount, 0)
    const totalSettledAmount = loans.reduce((sum, loan) => sum + (loan.settlement?.total ?? 0), 0)

    return {
      totalLoanAmount,
      totalSettledAmount,
    }
  }, [loans])

  const categoryReport = useMemo(() => {
    const totals = new Map<string, number>()

    loans.forEach((loan) => {
      loan.items.forEach((item) => {
        totals.set(item.category, (totals.get(item.category) ?? 0) + item.amount)
      })
    })

    return [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [loans])

  const settlementLoan = useMemo(
    () => loans.find((loan) => loan.id === selectedLoanId) ?? null,
    [loans, selectedLoanId],
  )

  const rateMap = useMemo(() => buildRateMap(currencyRates), [currencyRates])

  const settlementSummary = useMemo(() => {
    if (!settlementLoan) {
      return { supported: 0, unsupported: 0, total: 0, savings: 0, overage: 0 }
    }

    const payload = buildSettlementPayload(settlementItems, currencyRates)
    const supported = payload.reduce(
      (sum, item) =>
        sum +
        (isPettyCashCategory(item.category)
          ? 0
          : item.invoices.reduce((invoiceSum, invoice) => invoiceSum + invoice.sar, 0)),
      0,
    )

    const unsupported = payload.reduce(
      (sum, item) =>
        sum +
        (isPettyCashCategory(item.category)
          ? item.invoices.reduce((invoiceSum, invoice) => invoiceSum + invoice.sar, 0)
          : 0),
      0,
    )

    const total = supported + unsupported

    return {
      supported,
      unsupported,
      total,
      savings: settlementLoan.amount - total,
      overage: Math.max(0, total - settlementLoan.amount),
    }
  }, [currencyRates, settlementItems, settlementLoan])

  function resetLoanForm() {
    setLoanError('')
    setEditingLoanId(null)
    setLoanForm(createEmptyLoanForm(currentUser, loans))
    setExpenses([{ category: '', amount: '' }])
    setLoanAttachments(createEmptyAttachments())
  }

  function openLoanModal() {
    resetLoanForm()
    setLoanModalOpen(true)
  }

  function openEditLoanModal(loanId: string) {
    const loan = loans.find((item) => item.id === loanId)
    if (!loan || loan.printedAt || loan.isSettled) return

    setLoanError('')
    setEditingLoanId(loan.id)
    setLoanForm({
      requestDate: loan.createdAt.slice(0, 10),
      refNumber: loan.refNumber,
      agencyCode: AGENCY_CODE,
      employee: loan.employee,
      activity: loan.activity,
      location: loan.location,
      startDate: loan.startDate.slice(0, 10),
      endDate: loan.endDate.slice(0, 10),
      budgetApproved: loan.budgetApproved,
    })
    setExpenses(
      loan.items.length > 0
        ? loan.items.map((item) => ({
            category: item.category,
            amount: String(item.amount),
          }))
        : [{ category: '', amount: '' }],
    )
    setLoanAttachments({
      grandApproval: cloneStoredFile(loan.files?.grandApproval),
      nomineeAdjustment: cloneStoredFile(loan.files?.nomineeAdjustment),
    })
    setLoanModalOpen(true)
  }

  function openSettlementModal(loanId: string) {
    const loan = loans.find((item) => item.id === loanId)
    if (!loan) return

    setSelectedLoanId(loanId)
    setSettlementError('')
    setCurrencyRates([{ currencyCode: 'USD', rate: 3.75 }])
    setSettlementItems(
      sortSettlementItems(loan.items.map((item) => ({
        category: item.category,
        budget: item.amount,
        invoices: [createEmptyInvoice()],
      }))),
    )
    setSettlementMeta({
      receiptNumber: '',
      receiptDate: '',
      overageReason: '',
    })
    setSettlementModalOpen(true)
  }

  function updateExpense(index: number, field: keyof ExpenseDraft, value: string) {
    setExpenses((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    )
  }

  function addExpense() {
    setExpenses((current) => [...current, { category: '', amount: '' }])
  }

  function removeExpense(index: number) {
    setExpenses((current) => current.filter((_, itemIndex) => itemIndex !== index))
  }

  async function handleLoanAttachmentUpload(key: string, fileList: FileList | null) {
    const file = fileList?.[0]
    if (!file) return

    try {
      const stored = await fileToStoredFile(file)
      setLoanAttachments((current) => ({ ...current, [key]: stored }))
      setLoanError('')
    } catch (error) {
      setLoanError(error instanceof Error ? error.message : 'طھط¹ط°ط± ط±ظپط¹ ط§ظ„ظ…ظ„ظپ.')
    }
  }

  function removeLoanAttachment(key: string) {
    setLoanAttachments((current) => ({ ...current, [key]: null }))
  }

  async function submitLoan() {
    const cleanExpenses = expenses
      .map((item) => ({
        category: item.category.trim(),
        amount: Number.parseFloat(item.amount || '0') || 0,
      }))
      .filter((item) => item.category && item.amount > 0)

    if (!loanForm.activity || !loanForm.location || !loanForm.employee) {
      setLoanError('ط£ظƒظ…ظ„ ط§ظ„ط­ظ‚ظˆظ„ ط§ظ„ط£ط³ط§ط³ظٹط© ظ‚ط¨ظ„ ط­ظپط¸ ط§ظ„ط·ظ„ط¨.')
      return
    }

    if (!loanForm.startDate || !loanForm.endDate) {
      setLoanError('ط­ط¯ط¯ طھط§ط±ظٹط® ط§ظ„ط¨ط¯ط§ظٹط© ظˆط§ظ„ظ†ظ‡ط§ظٹط©.')
      return
    }

    if (loanForm.budgetApproved === null) {
      setLoanError('ط­ط¯ط¯ ط­ط§ظ„ط© ط§ط¹طھظ…ط§ط¯ ط§ظ„ظ…ظˆط§ط²ظ†ط© ظ‚ط¨ظ„ ط­ظپط¸ ط§ظ„ط·ظ„ط¨.')
      return
    }

    if (cleanExpenses.length === 0) {
      setLoanError('ط£ط¶ظپ ط¨ظ†ط¯ طµط±ظپ ظˆط§ط­ط¯ ط¹ظ„ظ‰ ط§ظ„ط£ظ‚ظ„.')
      return
    }

    for (const attachment of LOAN_ATTACHMENT_DEFINITIONS) {
      if (attachment.required && !loanAttachments[attachment.key]) {
        setLoanError(`ط£ط±ظپظ‚ ${attachment.label} ظ‚ط¨ظ„ ط¥ط±ط³ط§ظ„ ط§ظ„ط·ظ„ط¨.`)
        return
      }
    }

    const total = cleanExpenses.reduce((sum, item) => sum + item.amount, 0)
    const payload = {
      refNumber: loanForm.refNumber,
      employee: loanForm.employee,
      activity: loanForm.activity.trim(),
      location: loanForm.location.trim(),
      amount: total,
      budgetApproved: loanForm.budgetApproved,
      startDate: loanForm.startDate,
      endDate: loanForm.endDate,
      files: toLoanRequestFiles(loanAttachments),
      items: cleanExpenses,
    }

    startTransition(async () => {
      const isEditing = Boolean(editingLoanId)
      const response = await fetch(isEditing ? `/api/loans/${editingLoanId}` : '/api/loans', {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setLoanError(
          typeof data?.error === 'string' ? data.error : 'طھط¹ط°ط± ط­ظپط¸ ط·ظ„ط¨ ط§ظ„ط³ظ„ظپط©.',
        )
        return
      }

      const savedLoan = normalizeLoanRecord(data)
      setLoans((current) =>
        isEditing
          ? current.map((loan) => (loan.id === savedLoan.id ? savedLoan : loan))
          : [savedLoan, ...current],
      )
      setLoanModalOpen(false)
      setLoanError('')
      showToast(isEditing ? 'طھظ… طھط­ط¯ظٹط« ط·ظ„ط¨ ط§ظ„ط³ظ„ظپط©.' : 'طھظ… ط­ظپط¸ ط·ظ„ط¨ ط§ظ„ط³ظ„ظپط© ط¨ظ†ط¬ط§ط­.')
    })
  }

  function addRateRow() {
    setCurrencyRates((current) => [...current, { currencyCode: 'USD', rate: 0 }])
  }

  function updateRateRow(index: number, field: keyof SettlementCurrencyRate, value: string) {
    setCurrencyRates((current) =>
      current.map((rate, rateIndex) =>
        rateIndex === index
          ? {
              ...rate,
              [field]:
                field === 'rate'
                  ? Number.parseFloat(value || '0') || 0
                  : (value as CurrencyCode),
            }
          : rate,
      ),
    )
  }

  function removeRateRow(index: number) {
    setCurrencyRates((current) => current.filter((_, rateIndex) => rateIndex !== index))
  }

  function updateInvoice(
    itemIndex: number,
    invoiceIndex: number,
    field: keyof InvoiceDraft,
    value: string,
  ) {
    setSettlementItems((current) =>
      current.map((item, currentIndex) => {
        if (currentIndex !== itemIndex) return item

        const invoices = item.invoices.map((invoice, currentInvoiceIndex) => {
          if (currentInvoiceIndex !== invoiceIndex) return invoice

          const nextInvoice = {
            ...invoice,
            [field]: value,
          } as InvoiceDraft

          return recalculateInvoice(nextInvoice, rateMap)
        })

        return { ...item, invoices }
      }),
    )
  }

  function addInvoice(itemIndex: number) {
    setSettlementItems((current) =>
      current.map((item, currentIndex) =>
        currentIndex === itemIndex
          ? {
              ...item,
              invoices: [
                ...item.invoices,
                createEmptyInvoice(isPettyCashCategory(item.category) ? 'SAR' : 'SAR'),
              ],
            }
          : item,
      ),
    )
  }

  function removeInvoice(itemIndex: number, invoiceIndex: number) {
    setSettlementItems((current) =>
      current.map((item, currentIndex) =>
        currentIndex === itemIndex
          ? {
              ...item,
              invoices:
                item.invoices.length > 1
                  ? item.invoices.filter((_, idx) => idx !== invoiceIndex)
                  : [createEmptyInvoice(isPettyCashCategory(item.category) ? 'SAR' : 'SAR')],
            }
          : item,
      ),
    )
  }

  async function uploadInvoiceAttachment(
    itemIndex: number,
    invoiceIndex: number,
    fileList: FileList | null,
  ) {
    const file = fileList?.[0]
    if (!file) return

    try {
      const stored = await fileToStoredFile(file)
      setSettlementItems((current) =>
        current.map((item, currentIndex) => {
          if (currentIndex !== itemIndex) return item
          return {
            ...item,
            invoices: item.invoices.map((invoice, currentInvoiceIndex) =>
              currentInvoiceIndex === invoiceIndex
                ? { ...invoice, attachment: stored }
                : invoice,
            ),
          }
        }),
      )
      setSettlementError('')
    } catch (error) {
      setSettlementError(error instanceof Error ? error.message : 'طھط¹ط°ط± ط±ظپط¹ ظ…ط±ظپظ‚ ط§ظ„ظپط§طھظˆط±ط©.')
    }
  }

  function removeInvoiceAttachment(itemIndex: number, invoiceIndex: number) {
    setSettlementItems((current) =>
      current.map((item, currentIndex) => {
        if (currentIndex !== itemIndex) return item
        return {
          ...item,
          invoices: item.invoices.map((invoice, currentInvoiceIndex) =>
            currentInvoiceIndex === invoiceIndex ? { ...invoice, attachment: null } : invoice,
          ),
        }
      }),
    )
  }

  async function submitSettlement() {
    if (!settlementLoan) return

    const details = buildSettlementPayload(settlementItems, currencyRates)
    const allInvoices = details.flatMap((item) =>
      item.invoices.map((invoice) => ({ ...invoice, category: item.category })),
    )

    if (currencyRates.some((rate) => rate.currencyCode !== 'SAR' && rate.rate <= 0)) {
      setSettlementError('ط£ظƒظ…ظ„ ط£ط³ط¹ط§ط± ط§ظ„طµط±ظپ ظ„ط¬ظ…ظٹط¹ ط§ظ„ط¹ظ…ظ„ط§طھ ط§ظ„ظ…ط¶ط§ظپط©.')
      return
    }

    if (allInvoices.length === 0) {
      setSettlementError('ط£ط¶ظپ ظپط§طھظˆط±ط© ظˆط§ط­ط¯ط© ط¹ظ„ظ‰ ط§ظ„ط£ظ‚ظ„ ظ‚ط¨ظ„ ط­ظپط¸ ط§ظ„طھط³ظˆظٹط©.')
      return
    }

    const hasPettyCash = details.some((item) => isPettyCashCategory(item.category))
    const pettyCashApproval =
      details
        .find((item) => isPettyCashCategory(item.category))
        ?.invoices.find((invoice) => invoice.attachment)?.attachment ?? null
    if (hasPettyCash && !pettyCashApproval) {
      setSettlementError('ط£ط±ظپظ‚ ظ…ظˆط§ظپظ‚ط© ط§ظ„ظ…ط¹ط§ظ„ظٹ ط¹ظ†ط¯ ظˆط¬ظˆط¯ ظ†ط«ط±ظٹط§طھ ط¶ظ…ظ† ط§ظ„طھط³ظˆظٹط©.')
      return
    }

    for (const invoice of allInvoices) {
      if (!invoice.amount || invoice.sar <= 0) {
        setSettlementError(`ط£ظƒظ…ظ„ ظ…ط¨ظ„ط؛ ط§ظ„ظپط§طھظˆط±ط© ظپظٹ ط¨ظ†ط¯ ${invoice.category}.`)
        return
      }
      if (!isPettyCashCategory(invoice.category) && !invoice.invoiceDate) {
        setSettlementError(`ط­ط¯ط¯ طھط§ط±ظٹط® ط§ظ„ظپط§طھظˆط±ط© ظپظٹ ط¨ظ†ط¯ ${invoice.category}.`)
        return
      }
      if (!isPettyCashCategory(invoice.category) && !invoice.issuer.trim()) {
        setSettlementError(`ط£ط¯ط®ظ„ ط§ظ„ط¬ظ‡ط© ط§ظ„ظ…طµط¯ط±ط© ظ„ظ„ظپط§طھظˆط±ط© ظپظٹ ط¨ظ†ط¯ ${invoice.category}.`)
        return
      }
      if (!isPettyCashCategory(invoice.category) && !invoice.attachment) {
        setSettlementError(`ط£ط±ظپظ‚ طµظˆط±ط© ط£ظˆ ظ…ظ„ظپ ط§ظ„ظپط§طھظˆط±ط© ظپظٹ ط¨ظ†ط¯ ${invoice.category}.`)
        return
      }
    }

    if (settlementSummary.overage > 0 && !settlementMeta.overageReason.trim()) {
      setSettlementError('ط£ط¯ط®ظ„ ظ…ط¨ط±ط± ط§ظ„ط²ظٹط§ط¯ط© ط¹ظ†ط¯ طھط¬ط§ظˆط² ط¥ط¬ظ…ط§ظ„ظٹ ط§ظ„ظ…طµط±ظˆظپط§طھ ظ…ط¨ظ„ط؛ ط§ظ„ط³ظ„ظپط©.')
      return
    }

    if (settlementSummary.savings > 0) {
      if (!settlementMeta.receiptNumber.trim()) {
        setSettlementError('ط£ط¯ط®ظ„ ط±ظ‚ظ… ط³ظ†ط¯ ط§ظ„ظ‚ط¨ط¶ ط¹ظ†ط¯ ظˆط¬ظˆط¯ ظˆظپط± ظپظٹ ط§ظ„ط³ظ„ظپط© ط§ظ„ظ†ظ‚ط¯ظٹط©.')
        return
      }

      if (!settlementMeta.receiptDate) {
        setSettlementError('ط£ط¯ط®ظ„ طھط§ط±ظٹط® ط³ظ†ط¯ ط§ظ„ظ‚ط¨ط¶ ط¹ظ†ط¯ ظˆط¬ظˆط¯ ظˆظپط± ظپظٹ ط§ظ„ط³ظ„ظپط© ط§ظ„ظ†ظ‚ط¯ظٹط©.')
        return
      }
    }

    startTransition(async () => {
      const response = await fetch('/api/settlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loanId: settlementLoan.id,
          supported: settlementSummary.supported,
          unsupported: settlementSummary.unsupported,
          total: settlementSummary.total,
          savings: settlementSummary.savings,
          overage: settlementSummary.overage,
          currencyRates,
          details,
          receiptNumber: settlementMeta.receiptNumber.trim(),
          receiptDate: settlementMeta.receiptDate,
          overageReason: settlementMeta.overageReason.trim(),
          pettyCashApproval: cloneStoredFile(pettyCashApproval),
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setSettlementError(
          typeof data?.error === 'string' ? data.error : 'طھط¹ط°ط± ط­ظپط¸ ط§ظ„طھط³ظˆظٹط©.',
        )
        return
      }

      setLoans((current) =>
        current.map((loan) => (loan.id === data.id ? normalizeLoanRecord(data) : loan)),
      )
      setSettlementModalOpen(false)
      setSettlementError('')
      showToast('طھظ… ط­ظپط¸ طھط³ظˆظٹط© ط§ظ„ط³ظ„ظپط© ط¨ظ†ط¬ط§ط­.')
    })
  }

  function openPrintDocument(kind: 'loan' | 'settlement', loanId: string) {
    if (kind === 'loan') {
      setLoans((current) =>
        current.map((loan) =>
          loan.id === loanId && !loan.printedAt
            ? { ...loan, printedAt: new Date().toISOString() }
            : loan,
        ),
      )
    }

    const href =
      kind === 'loan' ? `/print/loans/${loanId}` : `/print/settlements/${loanId}`

    window.open(href, '_blank', 'noopener,noreferrer')
  }

  function exportWordDocument(kind: 'loan' | 'settlement', loanId: string) {
    if (kind === 'loan') {
      setLoans((current) =>
        current.map((loan) =>
          loan.id === loanId && !loan.printedAt
            ? { ...loan, printedAt: new Date().toISOString() }
            : loan,
        ),
      )
    }

    const href =
      kind === 'loan' ? `/api/loans/${loanId}/word` : `/api/settlements/${loanId}/word`

    window.open(href, '_blank', 'noopener,noreferrer')
  }

  async function deleteLoan(loanId: string) {
    const confirmed = window.confirm('ط³ظٹطھظ… ط­ط°ظپ ط·ظ„ط¨ ط§ظ„ط³ظ„ظپط© ظ†ظ‡ط§ط¦ظٹظ‹ط§ ظ‚ط¨ظ„ ط·ط¨ط§ط¹طھظ‡. ظ‡ظ„ طھط±ظٹط¯ ط§ظ„ظ…طھط§ط¨ط¹ط©طں')
    if (!confirmed) return

    startTransition(async () => {
      const response = await fetch(`/api/loans/${loanId}`, {
        method: 'DELETE',
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setLoadError(
          typeof data?.error === 'string' ? data.error : 'طھط¹ط°ط± ط­ط°ظپ ط·ظ„ط¨ ط§ظ„ط³ظ„ظپط©.',
        )
        showToast('طھط¹ط°ط± ط­ط°ظپ ط·ظ„ط¨ ط§ظ„ط³ظ„ظپط©.', 'error')
        return
      }

      setLoadError('')
      setLoans((current) => current.filter((loan) => loan.id !== loanId))
      showToast('طھظ… ط­ط°ظپ ط·ظ„ط¨ ط§ظ„ط³ظ„ظپط©.')
    })
  }

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      router.push('/login')
    }
  }

  async function updateReviewState(
    loanId: string,
    reviewStatus: LoanDashboardRecord['reviewStatus'],
    reviewNote = '',
  ) {
    startTransition(async () => {
      const response = await fetch(`/api/loans/${loanId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewStatus, reviewNote }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        showToast(
          typeof data?.error === 'string' ? data.error : 'طھط¹ط°ط± طھط­ط¯ظٹط« ط­ط§ظ„ط© ط§ظ„ظ…ط±ط§ط¬ط¹ط©.',
          'error',
        )
        return
      }

      setLoans((current) =>
        current.map((loan) => (loan.id === data.id ? normalizeLoanRecord(data) : loan)),
      )
      showToast(
        reviewStatus === 'RETURNED' ? 'طھظ…طھ ط¥ط¹ط§ط¯ط© ط§ظ„ظ…ط¹ط§ظ…ظ„ط© ظ„ظ„ظ…ط±ط§ط¬ط¹ط©.' : 'طھظ… طھط­ط¯ظٹط« ط­ط§ظ„ط© ط§ظ„ظ…ط±ط§ط¬ط¹ط©.',
      )
    })
  }

  const requestLoans = filteredLoans
  const settledLoans = filteredLoans.filter((loan) => loan.isSettled)

  return (
    <div className="min-h-screen bg-app-gradient">
      <header className="sticky top-0 z-30 border-b border-white/60 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
          <div className="flex items-center gap-4">
            <Image
              src="/logo-footer.png"
              alt="ط´ط¹ط§ط± ط¬ط§ظ…ط¹ط© ظ†ط§ظٹظپ ط§ظ„ط¹ط±ط¨ظٹط© ظ„ظ„ط¹ظ„ظˆظ… ط§ظ„ط£ظ…ظ†ظٹط©"
              width={280}
              height={64}
              className="h-auto w-[180px] md:w-[240px]"
              priority
            />
            <div className="hidden border-r border-slate-200 pr-4 md:block">
              <h1 className="text-lg font-bold text-primary md:text-xl">ظ…ظ†طµط© ط·ظ„ط¨ ط§ظ„ط³ظ„ظپ ط§ظ„ظ…ط¤ظ‚طھط©</h1>
              <p className="text-xs text-slate-500 md:text-sm">
                ظˆظƒط§ظ„ط© ط§ظ„طھط¯ط±ظٹط¨ ط¨ط¬ط§ظ…ط¹ط© ظ†ط§ظٹظپ ط§ظ„ط¹ط±ط¨ظٹط© ظ„ظ„ط¹ظ„ظˆظ… ط§ظ„ط£ظ…ظ†ظٹط©
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            {currentUser.roles.includes('ADMIN') && (
              <button
                type="button"
                onClick={() => router.push('/admin')}
                className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-2 text-xs font-bold text-primary"
              >
                ط¥ط¯ط§ط±ط© ط§ظ„ظ†ط¸ط§ظ…
              </button>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600"
            >
              طھط³ط¬ظٹظ„ ط§ظ„ط®ط±ظˆط¬
            </button>
            <div className="rounded-full border border-primary/10 bg-primary/5 px-4 py-2 text-right text-xs font-semibold text-primary md:text-sm">
              <div>{currentUser.fullName}</div>
              <div className="text-[11px] text-slate-500">{currentUser.email}</div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        <section className="dashboard-hero mb-6 rounded-[28px] p-6 text-white shadow-soft md:p-8">
          <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
            <div>
              <h2 className="mb-2 text-2xl font-bold md:text-4xl">ظ„ظˆط­ط© ط§ظ„ط³ظ„ظپ ط§ظ„ظ…ط¤ظ‚طھط©</h2>
              <p className="max-w-2xl text-sm leading-7 text-white/85 md:text-base">
                ط¥ط¯ط§ط±ط© ط§ظ„ط·ظ„ط¨ط§طھ ظˆط§ظ„طھط³ظˆظٹط§طھ ظ…ظ† ط­ط³ط§ط¨ ط§ظ„ظ…ظˆط¸ظپ ظ…ط¹ ط§ظ„ط­ظپط§ط¸ ط¹ظ„ظ‰ ط§ظ„ظ†ظ…ط§ط°ط¬ ط§ظ„ط±ط³ظ…ظٹط© ظˆط§ظ„ظ…ط±ظپظ‚ط§طھ ظˆط§ظ„ط·ط¨ط§ط¹ط©.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={openLoanModal}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-bold text-primary transition hover:-translate-y-0.5"
                >
                  ظ†ظ…ظˆط°ط¬ 18 - ط·ظ„ط¨ ط³ظ„ظپط©
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const firstOpenLoan = loans.find((loan) => !loan.isSettled)
                    if (firstOpenLoan) openSettlementModal(firstOpenLoan.id)
                  }}
                  className="rounded-2xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/15"
                >
                  ظ†ظ…ظˆط°ط¬ 19 - طھط³ظˆظٹط© ط³ظ„ظپط©
                </button>
                <button
                  type="button"
                  onClick={refreshLoans}
                  className="rounded-2xl border border-white/25 bg-transparent px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10"
                >
                  طھط­ط¯ظٹط« ط§ظ„ط¨ظٹط§ظ†ط§طھ
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <MiniStat label="ط¥ط¬ظ…ط§ظ„ظٹ ط§ظ„ط³ظ„ظپ ط§ظ„ظ…ط¤ظ‚طھط©" value={formatCurrencySar(loanTotals.totalLoanAmount)} />
              <MiniStat label="ط¥ط¬ظ…ط§ظ„ظٹ ظ…ط§ طھظ…طھ طھط³ظˆظٹطھظ‡" value={formatCurrencySar(loanTotals.totalSettledAmount)} />
              <MiniStat label="ط§ظ„ط·ظ„ط¨ط§طھ ط؛ظٹط± ط§ظ„ظ…ط·ط¨ظˆط¹ط©" value={loans.filter((loan) => !loan.printedAt).length} />
              <MiniStat label="ط§ظ„ط·ظ„ط¨ط§طھ ط§ظ„ظ…ط³ظˆط§ط©" value={settledLoans.length} />
            </div>
          </div>
        </section>

        <section className="mb-6 grid gap-4 md:grid-cols-4">
          <StatCard label="ظ‚ظٹط¯ ط§ظ„طھط³ظˆظٹط©" value={stats.pending} accent="warning" />
          <StatCard label="ط·ظ„ط¨ط§طھ ظ…ظ†طھظ‡ظٹط©" value={stats.settled} accent="success" />
          <StatCard label="ط¥ط¬ظ…ط§ظ„ظٹ ط§ظ„ط·ظ„ط¨ط§طھ" value={stats.total} accent="primary" />
          <StatCard label="ظ…طھط£ط®ط±ط©" value={stats.overdue} accent="danger" />
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-soft">
        <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
          <TabButton label="ط§ظ„ط·ظ„ط¨ط§طھ" active={activeTab === 'requests'} onClick={() => setActiveTab('requests')} />
          <TabButton label="ط§ظ„ط£ط±ط´ظٹظپ" active={activeTab === 'archive'} onClick={() => setActiveTab('archive')} />
          <TabButton label="ط§ظ„طھظ‚ط§ط±ظٹط±" active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} />
          <TabButton label="ط§ظ„طھط¹ظ„ظٹظ…ط§طھ" active={activeTab === 'guide'} onClick={() => setActiveTab('guide')} />
        </div>

        {activeTab === 'requests' && (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex-1">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="ط§ط¨ط­ط« ط¨ط§ظ„ط±ظ‚ظ… ط§ظ„ظ…ط±ط¬ط¹ظٹ ط£ظˆ ط§ط³ظ… ط§ظ„ظ†ط´ط§ط· ط£ظˆ ط§ظ„ظ…ظˆط¸ظپ"
                  className="input-shell"
                />
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
                ط§ظ„ظ…ط³طھط®ط¯ظ… ط§ظ„ط­ط§ظ„ظٹ: <span className="font-bold text-slate-900">{currentUser.fullName}</span>
              </div>
            </div>

            {loadError && (
              <div className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">{loadError}</div>
            )}

            {isLoadingLoans ? (
              <div className="rounded-[24px] bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                ط¬ط§ط±ظٹ طھط­ظ…ظٹظ„ ط§ظ„ط·ظ„ط¨ط§طھ...
              </div>
            ) : requestLoans.length === 0 ? (
              <EmptyState message="ظ„ط§ طھظˆط¬ط¯ ط·ظ„ط¨ط§طھ ط³ظ„ظپط© ط£ظˆ طھط³ظˆظٹط© ط؛ظٹط± ظ…ظ†طھظ‡ظٹط© ط­ط§ظ„ظٹظ‹ط§." />
            ) : (
              <div className="space-y-4">
                {requestLoans.map((loan) => (
                  <LoanCard
                    key={loan.id}
                    loan={loan}
                    canReview={currentUser.roles.some((role) => role === 'ADMIN' || role === 'REVIEWER')}
                    onEdit={openEditLoanModal}
                    onDelete={deleteLoan}
                    onSettle={openSettlementModal}
                    onMarkReviewed={() => updateReviewState(loan.id, 'REVIEWED')}
                    onReturnForReview={() => {
                      const note = window.prompt('ط£ط¯ط®ظ„ ظ…ظ„ط§ط­ط¸ط© ط§ظ„ط¥ط±ط¬ط§ط¹ ظ„ظ„ظ…ط±ط§ط¬ط¹ط©', loan.reviewNote || '')
                      if (note === null) return
                      void updateReviewState(loan.id, 'RETURNED', note)
                    }}
                    onPrintLoan={() => openPrintDocument('loan', loan.id)}
                    onWordLoan={() => exportWordDocument('loan', loan.id)}
                    onPrintSettlement={() => openPrintDocument('settlement', loan.id)}
                    onWordSettlement={() => exportWordDocument('settlement', loan.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'archive' && (
          <div className="space-y-4">
            {settledLoans.length === 0 ? (
              <EmptyState message="ظ„ط§ طھظˆط¬ط¯ ظ…ط¹ط§ظ…ظ„ط§طھ ظ…ط¤ط±ط´ظپط© ط¨ط¹ط¯." />
            ) : (
              settledLoans.map((loan) => (
                <LoanCard
                  key={loan.id}
                  loan={loan}
                  archived
                  canReview={currentUser.roles.some((role) => role === 'ADMIN' || role === 'REVIEWER')}
                  onEdit={openEditLoanModal}
                  onDelete={deleteLoan}
                  onSettle={openSettlementModal}
                  onMarkReviewed={() => updateReviewState(loan.id, 'REVIEWED')}
                  onReturnForReview={() => {
                    const note = window.prompt('ط£ط¯ط®ظ„ ظ…ظ„ط§ط­ط¸ط© ط§ظ„ط¥ط±ط¬ط§ط¹ ظ„ظ„ظ…ط±ط§ط¬ط¹ط©', loan.reviewNote || '')
                    if (note === null) return
                    void updateReviewState(loan.id, 'RETURNED', note)
                  }}
                  onPrintLoan={() => openPrintDocument('loan', loan.id)}
                  onWordLoan={() => exportWordDocument('loan', loan.id)}
                  onPrintSettlement={() => openPrintDocument('settlement', loan.id)}
                  onWordSettlement={() => exportWordDocument('settlement', loan.id)}
                />
              ))
            )}
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-4">
              <ReportTile label="ط¥ط¬ظ…ط§ظ„ظٹ ط§ظ„ظ…ط¨ط§ظ„ط؛ ط§ظ„ظ…ط·ظ„ظˆط¨ط©" value={formatCurrencySar(reportSummary.totalRequested)} />
              <ReportTile label="ط¥ط¬ظ…ط§ظ„ظٹ ط§ظ„ظ…طµط±ظˆظپط§طھ ط§ظ„ظ…ط³ظˆط§ط©" value={formatCurrencySar(reportSummary.totalExpenses)} />
              <ReportTile label="ط¥ط¬ظ…ط§ظ„ظٹ ط§ظ„ظˆظپظˆط±ط§طھ" value={formatCurrencySar(reportSummary.totalSavings)} />
              <ReportTile label="ط¥ط¬ظ…ط§ظ„ظٹ ط§ظ„ط²ظٹط§ط¯ط§طھ" value={formatCurrencySar(reportSummary.totalOverage)} />
            </div>

            <div className="rounded-[24px] bg-slate-50 p-4">
              <h3 className="mb-4 text-sm font-bold text-slate-900">ط£ط¹ظ„ظ‰ ط£ظˆط¬ظ‡ ط§ظ„طµط±ظپ ط§ط³طھط®ط¯ط§ظ…ظ‹ط§</h3>
              <div className="space-y-3">
                {categoryReport.length === 0 ? (
                  <p className="text-sm text-slate-500">ظ„ط§ طھظˆط¬ط¯ ط¨ظٹط§ظ†ط§طھ ظƒط§ظپظٹط© ظ„ط¹ط±ط¶ ط§ظ„طھظ‚ط±ظٹط±.</p>
                ) : (
                  categoryReport.map(([category, amount]) => (
                    <div key={category} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
                      <span className="text-sm font-medium text-slate-700">{category}</span>
                      <span className="text-sm font-bold text-primary">{formatCurrencySar(amount)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'guide' && (
          <div className="space-y-4">
            {GUIDE_SECTIONS.map((section) => (
              <div key={section.title} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <h3 className="mb-3 text-base font-bold text-slate-900">{section.title}</h3>
                <div className="space-y-2 text-sm text-slate-600">
                  {section.items.map((item) => (
                    <p key={item} className="leading-7">
                      {item}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        </section>
      </main>

      {loanModalOpen && (
        <div className="modal-overlay active">
          <div className="modal-box">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
              <div>
                <h3 className="text-lg font-bold text-primary">ظ†ظ…ظˆط°ط¬ 18 - ط·ظ„ط¨ ط³ظ„ظپط© ظ…ط¤ظ‚طھط©</h3>
                <p className="text-sm text-slate-500">ط¥ط¯ط®ط§ظ„ ط¨ظٹط§ظ†ط§طھ ط§ظ„ط·ظ„ط¨ ظˆظ…ط±ظپظ‚ط§طھظ‡ ط§ظ„ط±ط³ظ…ظٹط©</p>
              </div>
              <button
                type="button"
                onClick={() => setLoanModalOpen(false)}
                className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                أ—
              </button>
            </div>

            <div className="space-y-5 p-5">
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="ط§ظ„طھط§ط±ظٹط® *">
                  <input
                    type="date"
                    value={loanForm.requestDate}
                    onChange={(event) =>
                      setLoanForm((current) => ({ ...current, requestDate: event.target.value }))
                    }
                    className="input-shell"
                  />
                </Field>
                <Field label="ط§ظ„ط±ظ‚ظ… ط§ظ„ظ…ط±ط¬ط¹ظٹ">
                  <input value={loanForm.refNumber} readOnly className="input-shell bg-slate-100" />
                </Field>
                <Field label="ظƒظˆط¯ ط§ظ„ظˆظƒط§ظ„ط©">
                  <input value={loanForm.agencyCode} readOnly className="input-shell bg-slate-100" />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="ط§ظ„ظ…ط¨ظ„ط؛ ط±ظ‚ظ…ظ‹ط§ *">
                  <input
                    value={formatEnglishNumber(
                      expenses.reduce(
                        (sum, item) => sum + (Number.parseFloat(item.amount || '0') || 0),
                        0,
                      ),
                      { minimumFractionDigits: 2, maximumFractionDigits: 2 },
                    )}
                    readOnly
                    className="input-shell bg-slate-100"
                  />
                </Field>
                <Field label="ط§ظ„ظ…ط¨ظ„ط؛ ظƒطھط§ط¨ط©">
                  <input
                    value={numberToArabicWords(
                      expenses.reduce(
                        (sum, item) => sum + (Number.parseFloat(item.amount || '0') || 0),
                        0,
                      ),
                    )}
                    readOnly
                    className="input-shell bg-slate-100 text-sm"
                  />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="ط§ط³ظ… ط§ظ„ظ†ط´ط§ط· *">
                  <input
                    value={loanForm.activity}
                    onChange={(event) =>
                      setLoanForm((current) => ({ ...current, activity: event.target.value }))
                    }
                    className="input-shell"
                  />
                </Field>
                <Field label="ظ…ظƒط§ظ† ط§ظ„طھظ†ظپظٹط° *">
                  <input
                    value={loanForm.location}
                    onChange={(event) =>
                      setLoanForm((current) => ({ ...current, location: event.target.value }))
                    }
                    className="input-shell"
                  />
                </Field>
                <Field label="ط§ط³ظ… ط§ظ„ظ…ظˆط¸ظپ *">
                  <input value={loanForm.employee} readOnly className="input-shell bg-slate-100" />
                </Field>
                <Field label="طھط§ط±ظٹط® ط§ظ„ط¨ط¯ط§ظٹط© *">
                  <input
                    type="date"
                    value={loanForm.startDate}
                    onChange={(event) =>
                      setLoanForm((current) => ({ ...current, startDate: event.target.value }))
                    }
                    className="input-shell"
                  />
                </Field>
                <Field label="ط§ط¹طھظ…ط§ط¯ ط§ظ„ظ…ظˆط§ط²ظ†ط© *">
                  <div className="flex h-[56px] items-center gap-6 rounded-[20px] border border-slate-200 bg-white px-4">
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="radio"
                        checked={loanForm.budgetApproved === true}
                        onChange={() =>
                          setLoanForm((current) => ({ ...current, budgetApproved: true }))
                        }
                      />
                      ظ…ط¹طھظ…ط¯ط©
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="radio"
                        checked={loanForm.budgetApproved === false}
                        onChange={() =>
                          setLoanForm((current) => ({ ...current, budgetApproved: false }))
                        }
                      />
                      ط؛ظٹط± ظ…ط¹طھظ…ط¯ط©
                    </label>
                  </div>
                </Field>
                <Field label="طھط§ط±ظٹط® ط§ظ„ظ†ظ‡ط§ظٹط© *">
                  <input
                    type="date"
                    value={loanForm.endDate}
                    onChange={(event) =>
                      setLoanForm((current) => ({ ...current, endDate: event.target.value }))
                    }
                    className="input-shell"
                  />
                </Field>
              </div>

              <div className="rounded-[24px] border border-slate-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="font-bold text-slate-900">ط£ظˆط¬ظ‡ ط§ظ„طµط±ظپ</h4>
                  <button
                    type="button"
                    onClick={addExpense}
                    className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-white"
                  >
                    + ط¥ط¶ط§ظپط©
                  </button>
                </div>

                <div className="grid grid-cols-[1fr_180px_48px] gap-3 border-b border-slate-100 pb-2 text-xs font-bold text-slate-500">
                  <span>ط§ظ„ط¨ظ†ط¯</span>
                  <span>ط§ظ„ظ…ط¨ظ„ط؛</span>
                  <span></span>
                </div>

                <div className="mt-3 space-y-3">
                  {expenses.map((expense, index) => (
                    <div key={index} className="grid gap-3 md:grid-cols-[1fr_180px_48px]">
                      <select
                        value={expense.category}
                        onChange={(event) => updateExpense(index, 'category', event.target.value)}
                        className="input-shell"
                      >
                        <option value="">ط§ط®طھط± ط§ظ„ط¨ظ†ط¯...</option>
                        {EXPENSE_CATEGORIES.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={expense.amount}
                        onChange={(event) => updateExpense(index, 'amount', event.target.value)}
                        className="input-shell"
                        placeholder="0.00"
                      />
                      <button
                        type="button"
                        onClick={() => removeExpense(index)}
                        className="rounded-2xl border border-danger/20 text-danger transition hover:bg-danger/5"
                      >
                        أ—
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                  <span className="text-slate-500">ط§ظ„ط¥ط¬ظ…ط§ظ„ظٹ</span>
                  <span className="font-bold text-primary">
                    {formatCurrencySar(
                      expenses.reduce(
                        (sum, item) => sum + (Number.parseFloat(item.amount || '0') || 0),
                        0,
                      ),
                    )}
                  </span>
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="font-bold text-slate-900">ط§ظ„ظ…ط±ظپظ‚ط§طھ</h4>
                  <span className="text-xs text-slate-500">ط§ظ„ط­ط¯ ط§ظ„ط£ظ‚طµظ‰ 500 ظƒظٹظ„ظˆط¨ط§ظٹطھ ظ„ظ„ظ…ظ„ظپ</span>
                </div>

                <div className="space-y-3">
                  {LOAN_ATTACHMENT_DEFINITIONS.map((attachment) => {
                    const currentFile = loanAttachments[attachment.key]

                    return (
                      <div
                        key={attachment.key}
                        className="rounded-[20px] border border-slate-200 bg-white p-4"
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <p
                              className={`text-sm font-semibold ${
                                attachment.required ? 'text-danger' : 'text-slate-700'
                              }`}
                            >
                              {attachment.label}
                              {attachment.required ? ' (ط¥ط¬ط¨ط§ط±ظٹ)' : ' (ط§ط®طھظٹط§ط±ظٹ)'}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {currentFile
                                ? `${currentFile.name} - ${Math.round(currentFile.size / 1024)} KB`
                                : 'ظ„ظ… ظٹطھظ… ط§ط®طھظٹط§ط± ظ…ظ„ظپ'}
                            </p>
                          </div>

                          <div className="flex gap-2">
                            <label className="rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-white">
                              ط§ط®طھط± ظ…ظ„ظپ
                              <input
                                type="file"
                                className="hidden"
                                accept=".pdf,image/*"
                                onChange={(event) =>
                                  void handleLoanAttachmentUpload(attachment.key, event.target.files)
                                }
                              />
                            </label>
                            {currentFile && (
                              <button
                                type="button"
                                onClick={() => removeLoanAttachment(attachment.key)}
                                className="rounded-2xl border border-danger/20 px-4 py-3 text-sm font-bold text-danger"
                              >
                                ط¥ط²ط§ظ„ط©
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {loanError && (
                <div className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">
                  {loanError}
                </div>
              )}

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setLoanModalOpen(false)}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700"
                >
                  ط¥ظ„ط؛ط§ط،
                </button>
                <button
                  type="button"
                  onClick={submitLoan}
                  disabled={isPending}
                  className="rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
                >
                  {isPending ? 'ط¬ط§ط±ظٹ ط§ظ„ط­ظپط¸...' : editingLoanId ? 'طھط­ط¯ظٹط« ط§ظ„ط·ظ„ط¨' : 'ط¥ط±ط³ط§ظ„ ط§ظ„ط·ظ„ط¨'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {settlementModalOpen && settlementLoan && (
        <div className="modal-overlay active">
          <div className="modal-box">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
              <div>
                <h3 className="text-lg font-bold text-secondary">ظ†ظ…ظˆط°ط¬ 19 - طھط³ظˆظٹط© ط³ظ„ظپط© ظ…ط¤ظ‚طھط©</h3>
                <p className="text-sm text-slate-500">
                  {settlementLoan.refNumber} â€¢ {settlementLoan.employee}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSettlementModalOpen(false)}
                className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                أ—
              </button>
            </div>

            <div className="space-y-5 p-5">
              <div className="grid gap-4 md:grid-cols-4">
                <SummaryPill label="ظ…ط¨ظ„ط؛ ط§ظ„ط³ظ„ظپط©" value={formatCurrencySar(settlementLoan.amount)} />
                <SummaryPill label="ط¥ط¬ظ…ط§ظ„ظٹ ط§ظ„ظ…طµط±ظˆظپط§طھ ظ…ظ† ط§ظ„ط³ظ„ظپط©" value={formatCurrencySar(settlementSummary.total)} />
                <SummaryPill label="ط§ظ„ظ…ط¨ظ„ط؛ ط§ظ„ظ…طµط±ظˆظپ ط¨ط§ظ„ط²ظٹط§ط¯ط©" value={formatCurrencySar(settlementSummary.overage)} />
                <SummaryPill label="ظˆظپط± ط§ظ„ط³ظ„ظپط© ط§ظ„ظ†ظ‚ط¯ظٹ" value={formatCurrencySar(settlementSummary.savings)} />
              </div>

              <div className="rounded-[24px] border border-slate-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="font-bold text-slate-900">ط§ظ„ط¹ظ…ظ„ط§طھ ظˆط£ط³ط¹ط§ط± ط§ظ„طµط±ظپ</h4>
                  <button
                    type="button"
                    onClick={addRateRow}
                    className="rounded-xl bg-secondary px-3 py-2 text-xs font-bold text-white"
                  >
                    + ط¥ط¶ط§ظپط© ط¹ظ…ظ„ط©
                  </button>
                </div>

                <div className="space-y-3">
                  {currencyRates.length === 0 ? (
                    <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
                      ظ„ظ… طھطھظ… ط¥ط¶ط§ظپط© ط¹ظ…ظ„ط§طھ ط¨ط¹ط¯. ط£ط¶ظپ ط§ظ„ط¹ظ…ظ„ط§طھ ط§ظ„ظ…ط³طھط®ط¯ظ…ط© ظپظٹ ط§ظ„ظپظˆط§طھظٹط± ط£ظˆظ„ظ‹ط§.
                    </div>
                  ) : (
                    currencyRates.map((rate, index) => (
                      <div
                        key={`${rate.currencyCode}-${index}`}
                        className="grid gap-3 md:grid-cols-[220px_1fr_52px]"
                      >
                        <select
                          value={rate.currencyCode}
                          onChange={(event) =>
                            updateRateRow(index, 'currencyCode', event.target.value)
                          }
                          className="input-shell"
                        >
                          {CURRENCY_OPTIONS.filter((currency) => currency.code !== 'SAR').map(
                            (currency) => (
                              <option key={currency.code} value={currency.code}>
                                {currency.label} ({currency.symbol})
                              </option>
                            ),
                          )}
                        </select>
                        <input
                          type="number"
                          step="0.0001"
                          value={rate.rate || ''}
                          onChange={(event) => updateRateRow(index, 'rate', event.target.value)}
                          className="input-shell"
                          placeholder="ط³ط¹ط± ط§ظ„طµط±ظپ ط­ط³ط¨ ط§ظ„ط¨ظ†ظƒ ط§ظ„ظ…ط±ظƒط²ظٹ ط§ظ„ط³ط¹ظˆط¯ظٹ"
                        />
                        <button
                          type="button"
                          onClick={() => removeRateRow(index)}
                          className="rounded-2xl border border-danger/20 text-danger transition hover:bg-danger/5"
                        >
                          أ—
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="hidden">
                <div className="rounded-[24px] border border-slate-200 p-4">
                  <h4 className="mb-3 font-bold text-slate-900">ط¨ظٹط§ظ†ط§طھ ط§ظ„طھط³ظˆظٹط©</h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="ط±ظ‚ظ… ط³ظ†ط¯ ط§ظ„ظ‚ط¨ط¶">
                      <input
                        value={settlementMeta.receiptNumber}
                        onChange={(event) =>
                          setSettlementMeta((current) => ({
                            ...current,
                            receiptNumber: event.target.value,
                          }))
                        }
                        className="input-shell"
                      />
                    </Field>
                    <Field label="طھط§ط±ظٹط®ظ‡">
                      <input
                        type="date"
                        value={settlementMeta.receiptDate}
                        onChange={(event) =>
                          setSettlementMeta((current) => ({
                            ...current,
                            receiptDate: event.target.value,
                          }))
                        }
                        className="input-shell"
                      />
                    </Field>
                  </div>

                  <div className="mt-4">
                    <Field label="ظ…ط¨ط±ط± ط§ظ„ط²ظٹط§ط¯ط© ط¹ظ„ظ‰ ظ…ط¨ظ„ط؛ ط§ظ„ط³ظ„ظپط©">
                      <textarea
                        value={settlementMeta.overageReason}
                        onChange={(event) =>
                          setSettlementMeta((current) => ({
                            ...current,
                            overageReason: event.target.value,
                          }))
                        }
                        rows={3}
                        className="input-shell min-h-[110px] resize-y"
                        placeholder="ظٹط¹ط¨ط£ ظپظ‚ط· ط¹ظ†ط¯ ظˆط¬ظˆط¯ ط²ظٹط§ط¯ط© ط¹ظ„ظ‰ ظ…ط¨ظ„ط؛ ط§ظ„ط³ظ„ظپط©طŒ ظˆظ„ط§ ظٹط¸ظ‡ط± ظپظٹ ط§ظ„ظ†ظ…ظˆط°ط¬ ط§ظ„ظ…ط·ط¨ظˆط¹."
                      />
                    </Field>
                  </div>
                </div>

              </div>

              <div className="space-y-4">
                {settlementItems.map((item, itemIndex) => {
                  const itemTotal = item.invoices.reduce((sum, invoice) => sum + invoice.sarAmount, 0)
                  const isPettyCash = isPettyCashCategory(item.category)

                  return (
                    <div
                      key={`${item.category}-${itemIndex}`}
                      className="rounded-[24px] border border-slate-200 p-4"
                    >
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h4 className="font-bold text-slate-900">{item.category}</h4>
                          <p className="text-xs text-slate-400">
                            ط§ظ„ظ…ط¹طھظ…ط¯: {formatCurrencySar(item.budget)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => addInvoice(itemIndex)}
                          className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700"
                        >
                          + ط¥ط¶ط§ظپط© ظپط§طھظˆط±ط©
                        </button>
                      </div>

                      <div className="mt-3 space-y-3">
                        {item.invoices.map((invoice, invoiceIndex) => (
                          <div
                            key={invoiceIndex}
                            className="rounded-[20px] border border-slate-200 bg-slate-50 p-4"
                          >
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                              <Field label="ط§ظ„ظ…ط¨ظ„ط؛ ط­ط³ط¨ ط§ظ„ظپط§طھظˆط±ط©">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={invoice.amount}
                                  onChange={(event) =>
                                    updateInvoice(itemIndex, invoiceIndex, 'amount', event.target.value)
                                  }
                                  className="input-shell"
                                  placeholder="0.00"
                                />
                              </Field>
                              <Field label="ط§ظ„ط¹ظ…ظ„ط©">
                                <select
                                  value={invoice.currencyCode}
                                  onChange={(event) =>
                                    updateInvoice(
                                      itemIndex,
                                      invoiceIndex,
                                      'currencyCode',
                                      event.target.value,
                                    )
                                  }
                                  className="input-shell"
                                >
                                  <option value="SAR">ط±ظٹط§ظ„ ط³ط¹ظˆط¯ظٹ (ط±.ط³)</option>
                                  {currencyRates.map((rate, rateIndex) => (
                                    <option key={`${rate.currencyCode}-${rateIndex}`} value={rate.currencyCode}>
                                      {getCurrencyLabel(rate.currencyCode)}
                                    </option>
                                  ))}
                                </select>
                              </Field>
                              <Field label="ط§ظ„ظ…ط¨ظ„ط؛ ط¨ط§ظ„ط±ظٹط§ظ„">
                                <input
                                  readOnly
                                  value={formatCurrencySar(invoice.sarAmount)}
                                  className="input-shell bg-slate-100 text-lg font-bold"
                                />
                              </Field>
                              {isPettyCash ? (
                                <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 md:col-span-2 xl:col-span-3">
                                  هذا البند خاص بالنثريات، ويكتفى فيه بإرفاق موافقة المعالي بدل بيانات الفاتورة.
                                </div>
                              ) : (
                                <>
                                  <Field label="ظ†ظˆط¹ظ‡">
                                    <select
                                      value={invoice.documentType}
                                      onChange={(event) =>
                                        updateInvoice(
                                          itemIndex,
                                          invoiceIndex,
                                          'documentType',
                                          event.target.value,
                                        )
                                      }
                                      className="input-shell"
                                    >
                                      {SETTLEMENT_DOCUMENT_TYPES.map((type) => (
                                        <option key={type} value={type}>
                                          {type}
                                        </option>
                                      ))}
                                    </select>
                                  </Field>
                                  <Field label="طھط§ط±ظٹط®ظ‡">
                                    <input
                                      type="date"
                                      value={invoice.invoiceDate}
                                      onChange={(event) =>
                                        updateInvoice(
                                          itemIndex,
                                          invoiceIndex,
                                          'invoiceDate',
                                          event.target.value,
                                        )
                                      }
                                      className="input-shell"
                                    />
                                  </Field>
                                  <Field label="ط§ظ„ط¬ظ‡ط© ط§ظ„ظ…طµط¯ط±ط© ظ„ظ‡">
                                    <input
                                      value={invoice.issuer}
                                      onChange={(event) =>
                                        updateInvoice(itemIndex, invoiceIndex, 'issuer', event.target.value)
                                      }
                                      className="input-shell"
                                    />
                                  </Field>
                                </>
                              )}
                            </div>

                            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3">
                              <div className="flex items-center gap-2 text-xs text-slate-500">
                                <span
                                  className={`inline-block h-2.5 w-2.5 rounded-full ${
                                    invoice.attachment ? 'bg-success' : 'bg-slate-300'
                                  }`}
                                />
                                <span>
                                  {invoice.attachment
                                    ? invoice.attachment.name
                                    : isPettyCash
                                      ? 'ظ„ط§ ظٹظ„ط²ظ… ظ…ط±ظپظ‚ ظپط§طھظˆط±ط© ظ„ظ‡ط°ط§ ط§ظ„ط¨ظ†ط¯'
                                      : 'ظ„ظ… ظٹطھظ… ط±ظپط¹ ط§ظ„ظ…ط±ظپظ‚'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <label className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-2xl border border-slate-200 bg-white text-lg font-bold text-primary">
                                  📎
                                  <input
                                    type="file"
                                    className="hidden"
                                    accept=".pdf,image/*"
                                    onChange={(event) =>
                                      void uploadInvoiceAttachment(
                                        itemIndex,
                                        invoiceIndex,
                                        event.target.files,
                                      )
                                    }
                                  />
                                </label>
                                {invoice.attachment && (
                                  <button
                                    type="button"
                                    onClick={() => removeInvoiceAttachment(itemIndex, invoiceIndex)}
                                    className="rounded-2xl border border-danger/20 px-3 py-2 text-xs font-bold text-danger"
                                  >
                                    ط¥ط²ط§ظ„ط© ط§ظ„ظ…ط±ظپظ‚
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => removeInvoice(itemIndex, invoiceIndex)}
                                  className="rounded-2xl border border-danger/20 px-4 py-2 text-sm font-bold text-danger"
                                >
                                  ط­ط°ظپ ط§ظ„طµظپ
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
                        <span className="text-slate-500">ط¥ط¬ظ…ط§ظ„ظٹ ط§ظ„ط¨ظ†ط¯</span>
                        <span className="font-bold text-primary">{formatCurrencySar(itemTotal)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <SummaryPill label="ط§ظ„ظ…طµط±ظˆظپط§طھ ط§ظ„ظ…ط¤ظٹط¯ط© ط¨ظ…ط³طھظ†ط¯ط§طھ" value={formatCurrencySar(settlementSummary.supported)} />
                <SummaryPill label="ط§ظ„ظ…طµط±ظˆظپط§طھ ط؛ظٹط± ط§ظ„ظ…ط¤ظٹط¯ط© ط¨ظ…ط³طھظ†ط¯ط§طھ" value={formatCurrencySar(settlementSummary.unsupported)} />
                <SummaryPill label="ط¥ط¬ظ…ط§ظ„ظٹ ط§ظ„ظ…طµط±ظˆظپط§طھ ظ…ظ† ط§ظ„ط³ظ„ظپط©" value={formatCurrencySar(settlementSummary.total)} />
                <SummaryPill label="ظ…ط¨ظ„ط؛ ط§ظ„ط³ظ„ظپط©" value={formatCurrencySar(settlementLoan.amount)} />
                <SummaryPill label="ط§ظ„ظ…ط¨ظ„ط؛ ط§ظ„ظ…طµط±ظˆظپ ط¨ط§ظ„ط²ظٹط§ط¯ط© ط§ظ„ظ…ط·ظ„ظˆط¨ط© طµط±ظپظ‡" value={formatCurrencySar(settlementSummary.overage)} />
                <SummaryPill label="ظˆظپط± ط§ظ„ط³ظ„ظپط© ط§ظ„ظ†ظ‚ط¯ظٹ" value={formatCurrencySar(settlementSummary.savings)} />
              </div>

              <div className="rounded-[24px] border border-slate-200 p-4">
                <h4 className="mb-3 text-lg font-bold text-slate-900">ط¨ظٹط§ظ†ط§طھ ط§ظ„طھط³ظˆظٹط©</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="ط±ظ‚ظ… ط³ظ†ط¯ ط§ظ„ظ‚ط¨ط¶">
                    <input
                      value={settlementMeta.receiptNumber}
                      onChange={(event) =>
                        setSettlementMeta((current) => ({
                          ...current,
                          receiptNumber: event.target.value,
                        }))
                      }
                      className="input-shell"
                    />
                  </Field>
                  <Field label="طھط§ط±ظٹط®ظ‡">
                    <input
                      type="date"
                      value={settlementMeta.receiptDate}
                      onChange={(event) =>
                        setSettlementMeta((current) => ({
                          ...current,
                          receiptDate: event.target.value,
                        }))
                      }
                      className="input-shell"
                    />
                  </Field>
                </div>

                <div className="mt-4">
                  <Field label="ظ…ط¨ط±ط± ط§ظ„ط²ظٹط§ط¯ط© ط¹ظ„ظ‰ ظ…ط¨ظ„ط؛ ط§ظ„ط³ظ„ظپط©">
                    <textarea
                      value={settlementMeta.overageReason}
                      onChange={(event) =>
                        setSettlementMeta((current) => ({
                          ...current,
                          overageReason: event.target.value,
                        }))
                      }
                      rows={3}
                      className="input-shell min-h-[110px] resize-y"
                      placeholder="ظٹط¹ط¨ط£ ظپظ‚ط· ط¹ظ†ط¯ ظˆط¬ظˆط¯ ط²ظٹط§ط¯ط© ط¹ظ„ظ‰ ظ…ط¨ظ„ط؛ ط§ظ„ط³ظ„ظپط©طŒ ظˆظ„ط§ ظٹط¸ظ‡ط± ظپظٹ ط§ظ„ظ†ظ…ظˆط°ط¬ ط§ظ„ظ…ط·ط¨ظˆط¹."
                    />
                  </Field>
                </div>
              </div>

              {settlementError && (
                <div className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">
                  {settlementError}
                </div>
              )}

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setSettlementModalOpen(false)}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700"
                >
                  ط¥ظ„ط؛ط§ط،
                </button>
                <button
                  type="button"
                  onClick={submitSettlement}
                  disabled={isPending}
                  className="rounded-2xl bg-secondary px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
                >
                  {isPending ? 'ط¬ط§ط±ظٹ ط§ظ„ط­ظپط¸...' : 'ط­ظپط¸ ط§ظ„طھط³ظˆظٹط©'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-4 left-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-2xl px-4 py-3 text-sm font-bold text-white shadow-soft ${
              toast.tone === 'success'
                ? 'bg-success'
                : toast.tone === 'error'
                  ? 'bg-danger'
                  : 'bg-primary'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  )
}

function LoanCard({
  loan,
  archived = false,
  canReview = false,
  onEdit,
  onDelete,
  onSettle,
  onMarkReviewed,
  onReturnForReview,
  onPrintLoan,
  onWordLoan,
  onPrintSettlement,
  onWordSettlement,
}: {
  loan: LoanDashboardRecord
  archived?: boolean
  canReview?: boolean
  onEdit: (loanId: string) => void
  onDelete: (loanId: string) => void
  onSettle: (loanId: string) => void
  onMarkReviewed: () => void
  onReturnForReview: () => void
  onPrintLoan: () => void
  onWordLoan: () => void
  onPrintSettlement: () => void
  onWordSettlement: () => void
}) {
  const loanAttachmentsCount = Object.values(loan.files ?? {}).filter(Boolean).length

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-soft">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                loan.isSettled ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'
              }`}
            >
              {loan.isSettled ? 'طھظ…طھ ط§ظ„طھط³ظˆظٹط©' : 'ط·ظ„ط¨ ط³ظ„ظپط©'}
            </span>
            {loan.printedAt && (
              <span className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-bold text-secondary">
                ظ…ط·ط¨ظˆط¹ / ظ…ظڈطµط¯ظ‘ط±
              </span>
            )}
            {loanAttachmentsCount > 0 && (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                {loanAttachmentsCount} ظ…ط±ظپظ‚
              </span>
            )}
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                loan.reviewStatus === 'REVIEWED'
                  ? 'bg-success/10 text-success'
                  : loan.reviewStatus === 'RETURNED'
                    ? 'bg-warning/10 text-warning'
                    : 'bg-slate-100 text-slate-600'
              }`}
            >
              {loan.reviewStatus === 'REVIEWED'
                ? 'طھظ…طھ ط§ظ„ظ…ط±ط§ط¬ط¹ط©'
                : loan.reviewStatus === 'RETURNED'
                  ? 'ظ…ط¹ط§ط¯ ظ„ظ„ظ…ط±ط§ط¬ط¹ط©'
                  : 'ط¨ط§ظ†طھط¸ط§ط± ط§ظ„ظ…ط±ط§ط¬ط¹ط©'}
            </span>
          </div>

          <div>
            <h3 className="text-lg font-bold text-slate-900">{loan.refNumber}</h3>
            <p className="text-sm text-slate-500">
              {loan.activity} â€¢ {loan.employee}
            </p>
          </div>

          <div className="grid gap-2 text-sm text-slate-600 md:grid-cols-2">
            <p>ظ…ظƒط§ظ† ط§ظ„طھظ†ظپظٹط°: {loan.location || '-'}</p>
            <p>
              ظپطھط±ط© ط§ظ„طھظ†ظپظٹط°: {formatDate(loan.startDate)} - {formatDate(loan.endDate)}
            </p>
            <p>ط§ط¹طھظ…ط§ط¯ ط§ظ„ظ…ظˆط§ط²ظ†ط©: {loan.budgetApproved === true ? 'ظ…ط¹طھظ…ط¯ط©' : loan.budgetApproved === false ? 'ط؛ظٹط± ظ…ط¹طھظ…ط¯ط©' : '-'}</p>
            <p>ط¥ط¬ظ…ط§ظ„ظٹ ط§ظ„ط³ظ„ظپط©: {formatCurrencySar(loan.amount)}</p>
            {loan.reviewNote && <p className="md:col-span-2">ظ…ظ„ط§ط­ط¸ط© ط§ظ„ظ…ط±ط§ط¬ط¹: {loan.reviewNote}</p>}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:w-[360px]">
          <button type="button" onClick={onPrintLoan} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700">
            ط·ط¨ط§ط¹ط© ظ†ظ…ظˆط°ط¬ 18
          </button>
          <button type="button" onClick={onWordLoan} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700">
            Word ظ†ظ…ظˆط°ط¬ 18
          </button>

          {loan.isSettled ? (
            <>
              <button type="button" onClick={onPrintSettlement} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700">
                ط·ط¨ط§ط¹ط© ظ†ظ…ظˆط°ط¬ 19
              </button>
              <button type="button" onClick={onWordSettlement} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700">
                Word ظ†ظ…ظˆط°ط¬ 19
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onSettle(loan.id)}
              className="rounded-2xl bg-secondary px-4 py-3 text-sm font-bold text-white sm:col-span-2"
            >
              ط¨ط¯ط، طھط³ظˆظٹط© ط§ظ„ط³ظ„ظپط©
            </button>
          )}

          {!archived && !loan.printedAt && !loan.isSettled && (
            <>
              <button
                type="button"
                onClick={() => onEdit(loan.id)}
                className="rounded-2xl border border-primary/20 px-4 py-3 text-sm font-bold text-primary"
              >
                طھط¹ط¯ظٹظ„
              </button>
              <button
                type="button"
                onClick={() => onDelete(loan.id)}
                className="rounded-2xl border border-danger/20 px-4 py-3 text-sm font-bold text-danger"
              >
                ط­ط°ظپ
              </button>
            </>
          )}

          {canReview && (
            <>
              <button
                type="button"
                onClick={onMarkReviewed}
                className="rounded-2xl border border-success/20 px-4 py-3 text-sm font-bold text-success"
              >
                ط§ط¹طھظ…ط§ط¯ ط§ظ„ظ…ط±ط§ط¬ط¹ط©
              </button>
              <button
                type="button"
                onClick={onReturnForReview}
                className="rounded-2xl border border-warning/20 px-4 py-3 text-sm font-bold text-warning"
              >
                ط¥ط¹ط§ط¯ط© ظ„ظ„ظ…ط±ط§ط¬ط¹ط©
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-[24px] bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
      {message}
    </div>
  )
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-t-2xl px-4 py-3 text-sm font-bold transition ${
        active
          ? 'border-b-2 border-primary text-primary'
          : 'border-b-2 border-transparent text-slate-500 hover:text-slate-800'
      }`}
    >
      {label}
    </button>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold text-slate-500">{label}</span>
      {children}
    </label>
  )
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent: 'primary' | 'warning' | 'success' | 'danger'
}) {
  const accentStyles = {
    primary: 'border-primary/20 text-primary',
    warning: 'border-warning/20 text-warning',
    success: 'border-success/20 text-success',
    danger: 'border-danger/20 text-danger',
  }

  return (
    <div className={`rounded-[24px] border bg-white/95 p-5 shadow-soft ${accentStyles[accent]}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4 text-center shadow-soft">
      <p className="text-lg font-bold text-primary">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  )
}

function ReportTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] bg-slate-50 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-bold text-slate-900">{value}</p>
    </div>
  )
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] bg-slate-50 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
    </div>
  )
}


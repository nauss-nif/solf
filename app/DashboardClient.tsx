'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { numberToArabicWords } from '@/lib/utils'

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
  invoices: unknown
}

export type LoanDashboardRecord = {
  id: string
  refNumber: string
  employee: string
  activity: string
  location: string
  amount: number
  startDate: string
  endDate: string
  createdAt: string
  isSettled: boolean
  items: LoanItemRecord[]
  settlement: SettlementRecord | null
}

type CurrentUser = {
  userId: string
  fullName: string
  email: string
  role: 'EMPLOYEE' | 'ADMIN'
}

type ExpenseDraft = {
  category: string
  amount: string
}

type CurrencyCode = 'ر.س' | 'USD' | 'EUR'

type InvoiceDraft = {
  amount: string
  currency: CurrencyCode
}

type SettlementDraft = {
  category: string
  budget: number
  invoices: InvoiceDraft[]
}

const CATEGORIES = [
  'مواصلات مشاركين',
  'مواصلات مدربين',
  'سكن مدربين',
  'سكن مشاركين',
  'رسوم وتصاريح حكومية',
  'رسوم تأشيرات',
  'تذاكر سفر مدربين',
  'شحن ونقل وتغليف',
  'طباعة ونسخ',
  'ترجمة وتحرير',
  'ضيافة للمشاركين',
  'ضيافة للمدربين',
  'مياه ومشروبات',
  'إيجار قاعات',
  'إيجار معدات',
  'صيانة وتشغيل',
  'اشتراكات برمجيات رقمية',
  'احتياجات تدريبية',
  'مستلزمات تنفيذ',
  'هدايا تذكارية',
  'شهادات ودروع',
  'توثيق وتصوير',
  'اتصالات وإنترنت',
  'نثريات',
  'أخرى',
]

const GUIDE_SECTIONS = [
  {
    title: 'شروط طلب السلفة',
    items: [
      'أن يكون الطلب مرتبطًا بنشاط تدريبي أو مهمة عمل واضحة.',
      'تحديد مدة النشاط ومكان التنفيذ والموظف المسؤول بدقة.',
      'إدخال أوجه الصرف بمبالغ واضحة قبل الإرسال.',
    ],
  },
  {
    title: 'إجراءات الطلب',
    items: [
      'يُنشئ الموظف طلب السلفة مباشرة من لوحة الطلبات.',
      'يتم حفظ الطلب فورًا داخل النظام بدون مراحل اعتماد.',
      'يمكن العودة للطلب لاحقًا لتسويته بعد انتهاء المهمة.',
    ],
  },
  {
    title: 'إجراءات التسوية',
    items: [
      'تُسجل الفواتير تحت كل بند صرف مع تحويل تلقائي إلى الريال السعودي.',
      'تُحسب الوفورات والزيادات مباشرة أثناء إدخال التسوية.',
      'عند الحفظ تُغلق السلفة وتُنقل إلى الأرشيف والتقارير.',
    ],
  },
]

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('ar-SA')
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

  return `وت/26/${String(maxRef + 1).padStart(4, '0')}`
}

function normalizeLoanRecord(loan: {
  id: string
  refNumber: string
  employee: string
  activity: string
  location: string | null
  amount: number
  startDate: string
  endDate: string
  createdAt: string
  isSettled: boolean
  items: LoanItemRecord[]
  settlement: SettlementRecord | null
}): LoanDashboardRecord {
  return {
    ...loan,
    location: loan.location ?? '',
  }
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
  const [loanError, setLoanError] = useState('')
  const [settlementError, setSettlementError] = useState('')
  const [savedDocument, setSavedDocument] = useState<null | {
    kind: 'loan' | 'settlement'
    loanId: string
  }>(null)
  const [loanForm, setLoanForm] = useState({
    refNumber: generateRef(initialLoans.map(normalizeLoanRecord)),
    employee: currentUser.fullName,
    activity: '',
    location: '',
    startDate: '',
    endDate: '',
  })
  const [expenses, setExpenses] = useState<ExpenseDraft[]>([{ category: '', amount: '' }])
  const [settlementItems, setSettlementItems] = useState<SettlementDraft[]>([])
  const [rates, setRates] = useState({ USD: 3.75, EUR: 4.1 })

  useEffect(() => {
    let isCancelled = false

    async function loadLoans() {
      try {
        setIsLoadingLoans(true)
        setLoadError('')

        const response = await fetch('/api/loans', { cache: 'no-store' })
        if (!response.ok) {
          throw new Error('LOAD_FAILED')
        }

        const data = (await response.json()) as Array<{
          id: string
          refNumber: string
          employee: string
          activity: string
          location: string | null
          amount: number
          startDate: string
          endDate: string
          createdAt: string
          isSettled: boolean
          items: LoanItemRecord[]
          settlement: {
            id: string
            supported: number
            unsupported: number
            total: number
            savings: number
            overage: number
            createdAt: string
            invoices: unknown
          } | null
        }>

        if (isCancelled) return

        setLoans(data.map(normalizeLoanRecord))
      } catch {
        if (isCancelled) return
        setLoadError('تعذر تحميل بيانات السلف من الخادم.')
      } finally {
        if (!isCancelled) {
          setIsLoadingLoans(false)
        }
      }
    }

    loadLoans()

    return () => {
      isCancelled = true
    }
  }, [])

  useEffect(() => {
    if (!loanModalOpen) return

    setLoanForm((current) => ({
      ...current,
      refNumber: generateRef(loans),
    }))
  }, [loanModalOpen, loans])

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

  const settlementSummary = useMemo(() => {
    if (!settlementLoan) {
      return { supported: 0, unsupported: 0, total: 0, savings: 0, overage: 0 }
    }

    const supported = settlementItems.reduce((sum, item) => {
      if (item.category.includes('نثريات')) return sum

      return (
        sum +
        item.invoices.reduce((invoiceSum, invoice) => {
          const amount = Number.parseFloat(invoice.amount || '0') || 0
          const rate =
            invoice.currency === 'USD'
              ? rates.USD
              : invoice.currency === 'EUR'
                ? rates.EUR
                : 1

          return invoiceSum + amount * rate
        }, 0)
      )
    }, 0)

    const unsupported = settlementItems.reduce((sum, item) => {
      if (!item.category.includes('نثريات')) return sum

      return (
        sum +
        item.invoices.reduce((invoiceSum, invoice) => {
          return invoiceSum + (Number.parseFloat(invoice.amount || '0') || 0)
        }, 0)
      )
    }, 0)

    const total = supported + unsupported

    return {
      supported,
      unsupported,
      total,
      savings: Math.max(0, settlementLoan.amount - total),
      overage: Math.max(0, total - settlementLoan.amount),
    }
  }, [rates, settlementItems, settlementLoan])

  function openLoanModal() {
    setLoanError('')
    setSavedDocument(null)
    setLoanForm({
      refNumber: generateRef(loans),
      employee: currentUser.fullName,
      activity: '',
      location: '',
      startDate: '',
      endDate: '',
    })
    setExpenses([{ category: '', amount: '' }])
    setLoanModalOpen(true)
  }

  function openSettlementModal(loanId: string) {
    const loan = loans.find((item) => item.id === loanId)
    if (!loan) return

    setSelectedLoanId(loanId)
    setSettlementError('')
    setSavedDocument(null)
    setRates({ USD: 3.75, EUR: 4.1 })
    setSettlementItems(
      loan.items.map((item) => ({
        category: item.category,
        budget: item.amount,
        invoices: item.category.includes('نثريات')
          ? [{ amount: '', currency: 'ر.س' }]
          : [],
      })),
    )
    setSettlementModalOpen(true)
  }

  function openPrintDocument(kind: 'loan' | 'settlement', loanId: string) {
    const href =
      kind === 'loan' ? `/print/loans/${loanId}` : `/print/settlements/${loanId}`

    window.open(href, '_blank', 'noopener,noreferrer')
  }

  function exportWordDocument(kind: 'loan' | 'settlement', loanId: string) {
    const href =
      kind === 'loan' ? `/api/loans/${loanId}/word` : `/api/settlements/${loanId}/word`

    window.open(href, '_blank', 'noopener,noreferrer')
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

  async function submitLoan() {
    const cleanExpenses = expenses
      .map((item) => ({
        category: item.category.trim(),
        amount: Number.parseFloat(item.amount || '0') || 0,
      }))
      .filter((item) => item.category && item.amount > 0)

    if (!loanForm.employee || !loanForm.activity || !loanForm.location) {
      setLoanError('أكمل الحقول الأساسية قبل حفظ الطلب.')
      return
    }

    if (!loanForm.startDate || !loanForm.endDate) {
      setLoanError('حدد تاريخ البداية والنهاية.')
      return
    }

    if (cleanExpenses.length === 0) {
      setLoanError('أضف بند صرف واحد على الأقل.')
      return
    }

    const total = cleanExpenses.reduce((sum, item) => sum + item.amount, 0)

    startTransition(async () => {
      const response = await fetch('/api/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...loanForm,
          amount: total,
          items: cleanExpenses,
        }),
      })

      const data = await response.json().catch(() => ({}))
      const createdLoan = response.ok && data ? normalizeLoanRecord(data) : null

      if (!response.ok) {
        if (typeof data?.error === 'string') {
          setLoanError(data.error)
          return
        }
      }

      if (!response.ok) {
        setLoanError('تعذر حفظ طلب السلفة. حاول مرة أخرى.')
        return
      }

      if (createdLoan) {
        setLoans((current) => [createdLoan, ...current])
        setSavedDocument({ kind: 'loan', loanId: createdLoan.id })
      }

      setLoanModalOpen(false)
      setLoanError('')
      router.refresh()
    })
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

        const invoices = item.invoices.map((invoice, currentInvoiceIndex) =>
          currentInvoiceIndex === invoiceIndex ? { ...invoice, [field]: value } : invoice,
        )

        return { ...item, invoices }
      }),
    )
  }

  function addInvoice(itemIndex: number) {
    setSettlementItems((current) =>
      current.map((item, currentIndex) =>
        currentIndex === itemIndex
          ? { ...item, invoices: [...item.invoices, { amount: '', currency: 'ر.س' }] }
          : item,
      ),
    )
  }

  function removeInvoice(itemIndex: number, invoiceIndex: number) {
    setSettlementItems((current) =>
      current.map((item, currentIndex) =>
        currentIndex === itemIndex
          ? { ...item, invoices: item.invoices.filter((_, idx) => idx !== invoiceIndex) }
          : item,
      ),
    )
  }

  async function submitSettlement() {
    if (!settlementLoan) return

    const hasAnyValue = settlementItems.some((item) =>
      item.invoices.some((invoice) => (Number.parseFloat(invoice.amount || '0') || 0) > 0),
    )

    if (!hasAnyValue) {
      setSettlementError('أدخل فواتير أو مبالغ نثريات قبل حفظ التسوية.')
      return
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
          details: settlementItems.map((item) => ({
            category: item.category,
            budget: item.budget,
            invoices: item.invoices.map((invoice) => {
              const amount = Number.parseFloat(invoice.amount || '0') || 0
              const rate =
                invoice.currency === 'USD'
                  ? rates.USD
                  : invoice.currency === 'EUR'
                    ? rates.EUR
                    : 1

              return {
                amount,
                currency: invoice.currency,
                sar: amount * rate,
              }
            }),
          })),
        }),
      })

      const data = await response.json().catch(() => ({}))
      const updatedLoan = response.ok && data ? normalizeLoanRecord(data) : null

      if (!response.ok) {
        if (typeof data?.error === 'string') {
          setSettlementError(data.error)
          return
        }
      }

      if (!response.ok) {
        setSettlementError('تعذر حفظ التسوية. حاول مرة أخرى.')
        return
      }

      if (updatedLoan) {
        setLoans((current) =>
          current.map((loan) => (loan.id === updatedLoan.id ? updatedLoan : loan)),
        )
        setSavedDocument({ kind: 'settlement', loanId: updatedLoan.id })
      }

      setSettlementModalOpen(false)
      setSelectedLoanId(null)
      setSettlementError('')
      router.refresh()
    })
  }

  return (
    <div className="min-h-screen bg-app-gradient">
      <header className="sticky top-0 z-30 border-b border-white/60 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-6">
          <div className="flex items-center gap-4">
            <img
              src="https://nauss.edu.sa/Style%20Library/ar-sa/Styles/images/home/Logo.svg"
              alt="شعار الجامعة"
              className="h-12 w-auto"
            />
            <div className="border-r border-slate-200 pr-4">
              <h1 className="text-lg font-bold text-primary md:text-xl">نظام السلف المؤقتة</h1>
              <p className="text-xs text-slate-500 md:text-sm">
                لوحة الموظف لطلب السلف وتسويتها
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {currentUser.role === 'ADMIN' && (
              <button
                type="button"
                onClick={() => router.push('/admin')}
                className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-2 text-xs font-bold text-primary"
              >
                إدارة النظام
              </button>
            )}
            <button
              type="button"
              onClick={async () => {
                await fetch('/api/auth/logout', { method: 'POST' })
                router.push('/login')
                router.refresh()
              }}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600"
            >
              تسجيل الخروج
            </button>
            <div className="rounded-full border border-primary/10 bg-primary/5 px-4 py-2 text-right text-xs font-semibold text-primary md:text-sm">
              <div>{currentUser.fullName}</div>
              <div className="text-[11px] text-slate-500">{currentUser.email}</div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        {loadError && (
          <div className="mb-4 rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">
            {loadError}
          </div>
        )}

        <section className="dashboard-hero mb-6 rounded-[28px] p-6 text-white shadow-soft md:p-8">
          <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
            <div>
              <h2 className="mb-2 text-2xl font-bold md:text-4xl">لوحة السلف المؤقتة</h2>
              <p className="max-w-2xl text-sm leading-7 text-white/85 md:text-base">
                إدارة الطلبات والتسويات من حساب الموظف.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={openLoanModal}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-bold text-primary transition hover:-translate-y-0.5"
                >
                  نموذج 18 - طلب سلفة
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const firstOpenLoan = loans.find((loan) => !loan.isSettled)
                    if (firstOpenLoan) openSettlementModal(firstOpenLoan.id)
                  }}
                  className="rounded-2xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/15"
                >
                  نموذج 19 - تسوية سلفة
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <StatCard label="إجمالي السلف" value={stats.total} accent="primary" />
              <StatCard label="نشطة" value={stats.pending} accent="warning" />
              <StatCard label="مسوّاة" value={stats.settled} accent="success" />
              <StatCard label="متأخرة" value={stats.overdue} accent="danger" />
            </div>
          </div>
        </section>

        {savedDocument && (
          <section className="mb-4 rounded-[28px] border border-success/20 bg-success/10 px-5 py-4 shadow-soft">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-medium text-success">تم الحفظ بنجاح.</p>
                <p className="text-sm text-slate-600">
                  يمكنك الآن طباعة {savedDocument.kind === 'loan' ? 'طلب السلفة' : 'التسوية'} أو
                  تنزيله بصيغة Word.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openPrintDocument(savedDocument.kind, savedDocument.loanId)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
                >
                  طباعة
                </button>
                <button
                  type="button"
                  onClick={() => exportWordDocument(savedDocument.kind, savedDocument.loanId)}
                  className="rounded-2xl bg-primary px-4 py-2 text-sm text-white"
                >
                  تنزيل Word
                </button>
              </div>
            </div>
          </section>
        )}

        <nav className="mb-4 flex flex-wrap gap-2 border-b border-slate-200">
          <TabButton label="الطلبات" active={activeTab === 'requests'} onClick={() => setActiveTab('requests')} />
          <TabButton label="الأرشيف" active={activeTab === 'archive'} onClick={() => setActiveTab('archive')} />
          <TabButton label="التقارير" active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} />
          <TabButton label="تعليمات عامة" active={activeTab === 'guide'} onClick={() => setActiveTab('guide')} />
        </nav>

        {activeTab === 'requests' && (
          <section className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
              <button
                type="button"
                onClick={openLoanModal}
                className="rounded-[24px] bg-primary p-5 text-right text-white shadow-soft transition hover:-translate-y-0.5"
              >
                <p className="text-lg font-bold">نموذج 18 - طلب سلفة</p>
                <p className="mt-2 text-sm text-white/80">طلب جديد</p>
              </button>

              <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-soft">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">طلبات الموظف</h3>
                    <p className="text-sm text-slate-500">قائمة الطلبات والسلف المسجلة</p>
                  </div>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="بحث بالرقم أو الموظف أو النشاط"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-primary md:w-80"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-soft">
              <div className="border-b border-slate-100 px-5 py-4 text-sm font-bold text-slate-800">
                قائمة السلف
              </div>
              <div className="divide-y divide-slate-100">
                {isLoadingLoans && (
                  <div className="px-6 py-12 text-center text-sm text-slate-500">
                    جاري تحميل السلف...
                  </div>
                )}
                {filteredLoans.length === 0 && (
                  <div className="px-6 py-12 text-center text-sm text-slate-500">
                    لا توجد معاملات مطابقة لنتيجة البحث الحالية.
                  </div>
                )}

                {!isLoadingLoans &&
                  filteredLoans.map((loan) => {
                  const overdueDays = Math.max(0, workDaysSince(loan.endDate) - 15)

                  return (
                    <div
                      key={loan.id}
                      className="grid gap-4 px-5 py-5 transition hover:bg-slate-50 lg:grid-cols-[1.2fr_0.8fr_0.7fr_0.6fr]"
                    >
                      <div>
                        <div className="mb-2 flex items-center gap-2">
                          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                            {loan.refNumber}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                              loan.isSettled
                                ? 'bg-success/10 text-success'
                                : 'bg-warning/10 text-warning'
                            }`}
                          >
                            {loan.isSettled ? 'مسوّاة' : 'بانتظار التسوية'}
                          </span>
                          {overdueDays > 0 && (
                            <span className="rounded-full bg-danger/10 px-2.5 py-1 text-xs font-bold text-danger">
                              متأخرة {overdueDays} يوم
                            </span>
                          )}
                        </div>
                        <h4 className="text-base font-bold text-slate-900">{loan.activity}</h4>
                        <p className="mt-1 text-sm text-slate-500">
                          {loan.employee} • {loan.location || 'بدون موقع'}
                        </p>
                      </div>

                      <div className="text-sm text-slate-600">
                        <p className="mb-1 font-semibold text-slate-800">فترة التنفيذ</p>
                        <p>
                          {formatDate(loan.startDate)} - {formatDate(loan.endDate)}
                        </p>
                        <p className="mt-2 text-xs text-slate-400">
                          أوجه الصرف: {loan.items.length} بند
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-400">المبلغ الإجمالي</p>
                        <p className="mt-1 text-xl font-bold text-primary">
                          {loan.amount.toLocaleString()} ر.س
                        </p>
                        {loan.settlement && (
                          <p className="mt-2 text-xs text-success">
                            وفر: {loan.settlement.savings.toLocaleString()} ر.س
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-start justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openPrintDocument('loan', loan.id)}
                          className="rounded-2xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                          طباعة الطلب
                        </button>
                        <button
                          type="button"
                          onClick={() => exportWordDocument('loan', loan.id)}
                          className="rounded-2xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                          تنزيل Word
                        </button>
                        {!loan.isSettled && (
                          <button
                            type="button"
                            onClick={() => openSettlementModal(loan.id)}
                            className="rounded-2xl bg-secondary px-4 py-2 text-xs font-bold text-white transition hover:opacity-90"
                          >
                            تسوية
                          </button>
                        )}
                        {loan.isSettled && (
                          <>
                            <button
                              type="button"
                              onClick={() => openPrintDocument('settlement', loan.id)}
                              className="rounded-2xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                            >
                              طباعة التسوية
                            </button>
                            <button
                              type="button"
                              onClick={() => exportWordDocument('settlement', loan.id)}
                              className="rounded-2xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                            >
                              تنزيل Word التسوية
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>
        )}

        {activeTab === 'archive' && (
          <section className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <MiniStat label="إجمالي المعاملات" value={loans.length} />
              <MiniStat label="المسوّاة" value={stats.settled} />
              <MiniStat
                label="إجمالي المبالغ"
                value={`${reportSummary.totalRequested.toLocaleString()} ر.س`}
              />
              <MiniStat
                label="إجمالي الوفورات"
                value={`${reportSummary.totalSavings.toLocaleString()} ر.س`}
              />
            </div>

            <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-soft">
              <div className="border-b border-slate-100 px-5 py-4 text-sm font-bold text-slate-800">
                سجل المعاملات
              </div>
              <div className="divide-y divide-slate-100">
                {loans.map((loan) => (
                  <div key={loan.id} className="px-5 py-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-primary">{loan.refNumber}</p>
                        <p className="mt-1 text-slate-500">
                          {loan.employee} • {loan.activity}
                        </p>
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-slate-900">
                          {loan.amount.toLocaleString()} ر.س
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {loan.isSettled ? 'مسوّاة' : 'نشطة'} • {formatDate(loan.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {activeTab === 'reports' && (
          <section className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <MiniStat label="إجمالي السلف" value={stats.total} />
              <MiniStat label="تمت تسويتها" value={stats.settled} />
              <MiniStat label="بانتظار التسوية" value={stats.pending} />
              <MiniStat label="متأخرة" value={stats.overdue} />
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-soft">
              <h3 className="mb-4 text-base font-bold text-slate-900">الملخص المالي</h3>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <ReportTile
                  label="إجمالي السلف المطلوبة"
                  value={`${reportSummary.totalRequested.toLocaleString()} ر.س`}
                />
                <ReportTile
                  label="إجمالي المصروفات"
                  value={`${reportSummary.totalExpenses.toLocaleString()} ر.س`}
                />
                <ReportTile
                  label="إجمالي الوفورات"
                  value={`${reportSummary.totalSavings.toLocaleString()} ر.س`}
                />
                <ReportTile
                  label="إجمالي الزيادات"
                  value={`${reportSummary.totalOverage.toLocaleString()} ر.س`}
                />
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-soft">
                <h3 className="mb-4 text-base font-bold text-slate-900">توزيع البنود</h3>
                <div className="space-y-3">
                  {categoryReport.map(([category, amount]) => {
                    const percentage =
                      categoryReport.length > 0
                        ? Math.max(8, (amount / categoryReport[0][1]) * 100)
                        : 0

                    return (
                      <div key={category}>
                        <div className="mb-1 flex justify-between text-sm">
                          <span>{category}</span>
                          <span className="font-bold text-primary">
                            {amount.toLocaleString()} ر.س
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                  {categoryReport.length === 0 && (
                    <p className="py-8 text-center text-sm text-slate-400">لا توجد بيانات بعد</p>
                  )}
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-soft">
                <h3 className="mb-4 text-base font-bold text-slate-900">السلف المتأخرة</h3>
                <div className="space-y-3">
                  {loans
                    .filter((loan) => !loan.isSettled && workDaysSince(loan.endDate) > 15)
                    .map((loan) => (
                      <div
                        key={loan.id}
                        className="rounded-2xl border border-danger/20 bg-danger/5 p-4"
                      >
                        <div className="mb-1 flex items-center justify-between">
                          <span className="font-bold text-slate-900">{loan.refNumber}</span>
                          <span className="text-xs font-bold text-danger">
                            {workDaysSince(loan.endDate) - 15} يوم تأخير
                          </span>
                        </div>
                        <p className="text-sm text-slate-600">
                          {loan.activity} • {loan.employee}
                        </p>
                      </div>
                    ))}
                  {stats.overdue === 0 && (
                    <p className="py-8 text-center text-sm text-slate-400">
                      لا توجد سلف متأخرة حاليًا.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'guide' && (
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-soft">
            <div className="mb-4 rounded-[24px] bg-primary px-5 py-4 text-white">
              <h3 className="text-lg font-bold">تعليمات عامة</h3>
              <p className="mt-1 text-sm text-white/80">إرشادات مختصرة للاستخدام.</p>
            </div>

            <div className="space-y-4">
              {GUIDE_SECTIONS.map((section) => (
                <div key={section.title} className="rounded-[22px] border border-slate-200 p-4">
                  <h4 className="mb-3 font-bold text-primary">{section.title}</h4>
                  <ul className="space-y-2 text-sm text-slate-600">
                    {section.items.map((item) => (
                      <li key={item} className="rounded-2xl bg-slate-50 px-4 py-3">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {loanModalOpen && (
        <div className="modal-overlay active">
          <div className="modal-box">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
              <div>
                <h3 className="text-lg font-bold text-primary">نموذج 18 - طلب سلفة</h3>
                <p className="text-sm text-slate-500">إدخال بيانات الطلب</p>
              </div>
              <button
                type="button"
                onClick={() => setLoanModalOpen(false)}
                className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                ×
              </button>
            </div>

            <div className="space-y-5 p-5">
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="الرقم المرجعي">
                  <input value={loanForm.refNumber} readOnly className="input-shell bg-slate-100" />
                </Field>
                <Field label="اسم الموظف">
                  <input value={loanForm.employee} readOnly className="input-shell bg-slate-100" />
                </Field>
                <Field label="مكان التنفيذ">
                  <input
                    value={loanForm.location}
                    onChange={(event) =>
                      setLoanForm((current) => ({ ...current, location: event.target.value }))
                    }
                    className="input-shell"
                  />
                </Field>
                <Field label="اسم النشاط">
                  <input
                    value={loanForm.activity}
                    onChange={(event) =>
                      setLoanForm((current) => ({ ...current, activity: event.target.value }))
                    }
                    className="input-shell"
                  />
                </Field>
                <Field label="تاريخ البداية">
                  <input
                    type="date"
                    value={loanForm.startDate}
                    onChange={(event) =>
                      setLoanForm((current) => ({ ...current, startDate: event.target.value }))
                    }
                    className="input-shell"
                  />
                </Field>
                <Field label="تاريخ النهاية">
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
                  <h4 className="font-bold text-slate-900">أوجه الصرف</h4>
                  <button
                    type="button"
                    onClick={addExpense}
                    className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-white"
                  >
                    + إضافة بند
                  </button>
                </div>

                <div className="space-y-3">
                  {expenses.map((expense, index) => (
                    <div key={index} className="grid gap-3 md:grid-cols-[1fr_180px_52px]">
                      <select
                        value={expense.category}
                        onChange={(event) => updateExpense(index, 'category', event.target.value)}
                        className="input-shell"
                      >
                        <option value="">اختر بند الصرف</option>
                        {CATEGORIES.map((category) => (
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
                        placeholder="المبلغ"
                      />

                      <button
                        type="button"
                        onClick={() => removeExpense(index)}
                        className="rounded-2xl border border-danger/20 text-danger transition hover:bg-danger/5"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[24px] bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">الإجمالي</p>
                  <p className="mt-1 text-2xl font-bold text-primary">
                    {expenses
                      .reduce((sum, item) => sum + (Number.parseFloat(item.amount || '0') || 0), 0)
                      .toLocaleString()}{' '}
                    ر.س
                  </p>
                </div>
                <div className="rounded-[24px] bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">المبلغ كتابةً</p>
                  <p className="mt-1 text-sm leading-7 text-slate-700">
                    {numberToArabicWords(
                      expenses.reduce(
                        (sum, item) => sum + (Number.parseFloat(item.amount || '0') || 0),
                        0,
                      ),
                    )}
                  </p>
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
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={submitLoan}
                  disabled={isPending}
                  className="rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
                >
                  {isPending ? 'جاري الحفظ...' : 'حفظ الطلب'}
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
                <h3 className="text-lg font-bold text-secondary">نموذج 19 - تسوية سلفة</h3>
                <p className="text-sm text-slate-500">
                  {settlementLoan.refNumber} • {settlementLoan.employee}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSettlementModalOpen(false)}
                className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                ×
              </button>
            </div>

            <div className="space-y-5 p-5">
              <div className="grid gap-4 md:grid-cols-3">
                <SummaryPill label="المبلغ المعتمد" value={`${settlementLoan.amount} ر.س`} />
                <SummaryPill
                  label="الإجمالي المصروف"
                  value={`${settlementSummary.total.toFixed(2)} ر.س`}
                />
                <SummaryPill label="الوفر" value={`${settlementSummary.savings.toFixed(2)} ر.س`} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="سعر صرف الدولار">
                  <input
                    type="number"
                    step="0.01"
                    value={rates.USD}
                    onChange={(event) =>
                      setRates((current) => ({
                        ...current,
                        USD: Number.parseFloat(event.target.value || '0') || 0,
                      }))
                    }
                    className="input-shell"
                  />
                </Field>
                <Field label="سعر صرف اليورو">
                  <input
                    type="number"
                    step="0.01"
                    value={rates.EUR}
                    onChange={(event) =>
                      setRates((current) => ({
                        ...current,
                        EUR: Number.parseFloat(event.target.value || '0') || 0,
                      }))
                    }
                    className="input-shell"
                  />
                </Field>
              </div>

              <div className="space-y-4">
                {settlementItems.map((item, itemIndex) => {
                  const itemTotal = item.invoices.reduce((sum, invoice) => {
                    const amount = Number.parseFloat(invoice.amount || '0') || 0
                    const rate =
                      invoice.currency === 'USD'
                        ? rates.USD
                        : invoice.currency === 'EUR'
                          ? rates.EUR
                          : 1
                    return sum + amount * rate
                  }, 0)

                  return (
                    <div
                      key={`${item.category}-${itemIndex}`}
                      className="rounded-[24px] border border-slate-200 p-4"
                    >
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h4 className="font-bold text-slate-900">{item.category}</h4>
                          <p className="text-xs text-slate-400">
                            المعتمد: {item.budget.toLocaleString()} ر.س
                          </p>
                        </div>
                        {!item.category.includes('نثريات') && (
                          <button
                            type="button"
                            onClick={() => addInvoice(itemIndex)}
                            className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700"
                          >
                            + إضافة فاتورة
                          </button>
                        )}
                      </div>

                      <div className="space-y-3">
                        {item.category.includes('نثريات') ? (
                          <input
                            value={item.invoices[0]?.amount ?? ''}
                            onChange={(event) =>
                              updateInvoice(itemIndex, 0, 'amount', event.target.value)
                            }
                            type="number"
                            step="0.01"
                            className="input-shell"
                            placeholder="مبلغ النثريات"
                          />
                        ) : item.invoices.length > 0 ? (
                          item.invoices.map((invoice, invoiceIndex) => {
                            const amount = Number.parseFloat(invoice.amount || '0') || 0
                            const rate =
                              invoice.currency === 'USD'
                                ? rates.USD
                                : invoice.currency === 'EUR'
                                  ? rates.EUR
                                  : 1

                            return (
                              <div
                                key={invoiceIndex}
                                className="grid gap-3 md:grid-cols-[1fr_180px_180px_52px]"
                              >
                                <input
                                  type="number"
                                  step="0.01"
                                  value={invoice.amount}
                                  onChange={(event) =>
                                    updateInvoice(itemIndex, invoiceIndex, 'amount', event.target.value)
                                  }
                                  className="input-shell"
                                  placeholder="المبلغ"
                                />
                                <select
                                  value={invoice.currency}
                                  onChange={(event) =>
                                    updateInvoice(
                                      itemIndex,
                                      invoiceIndex,
                                      'currency',
                                      event.target.value as CurrencyCode,
                                    )
                                  }
                                  className="input-shell"
                                >
                                  <option value="ر.س">ر.س</option>
                                  <option value="USD">USD</option>
                                  <option value="EUR">EUR</option>
                                </select>
                                <input
                                  readOnly
                                  value={`${(amount * rate).toFixed(2)} ر.س`}
                                  className="input-shell bg-slate-100"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeInvoice(itemIndex, invoiceIndex)}
                                  className="rounded-2xl border border-danger/20 text-danger transition hover:bg-danger/5"
                                >
                                  ×
                                </button>
                              </div>
                            )
                          })
                        ) : (
                          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
                            لا توجد فواتير مضافة لهذا البند بعد.
                          </div>
                        )}
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
                        <span className="text-slate-500">الإجمالي</span>
                        <span className="font-bold text-primary">{itemTotal.toFixed(2)} ر.س</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <SummaryPill label="المؤيد" value={`${settlementSummary.supported.toFixed(2)} ر.س`} />
                <SummaryPill label="غير المؤيد" value={`${settlementSummary.unsupported.toFixed(2)} ر.س`} />
                <SummaryPill label="الإجمالي" value={`${settlementSummary.total.toFixed(2)} ر.س`} />
                <SummaryPill label="الزيادة" value={`${settlementSummary.overage.toFixed(2)} ر.س`} />
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
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={submitSettlement}
                  disabled={isPending}
                  className="rounded-2xl bg-secondary px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
                >
                  {isPending ? 'جاري الحفظ...' : 'حفظ التسوية'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
      <p className="text-xl font-bold text-primary">{value}</p>
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

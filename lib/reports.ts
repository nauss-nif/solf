import { prisma } from '@/lib/prisma'
import { dashboardLoanInclude } from '@/lib/loan-selects'

export type ItemUsageStat = {
  category: string
  requestCount: number
  requestTotal: number
  settlementCount: number
  settlementTotal: number
}

export async function getItemUsageStats(): Promise<ItemUsageStat[]> {
  const items = await prisma.loanItem.findMany({ select: { category: true, amount: true } })
  const settlements = await prisma.settlement.findMany({ select: { invoices: true } })

  const stats = new Map<string, ItemUsageStat>()
  const getEntry = (category: string) => {
    let entry = stats.get(category)
    if (!entry) {
      entry = { category, requestCount: 0, requestTotal: 0, settlementCount: 0, settlementTotal: 0 }
      stats.set(category, entry)
    }
    return entry
  }

  for (const item of items) {
    const entry = getEntry(item.category)
    entry.requestCount += 1
    entry.requestTotal += item.amount
  }

  for (const settlement of settlements) {
    const meta = settlement.invoices as { details?: Array<{ category?: string; invoices?: Array<{ sar?: number }> }> } | null
    if (!meta?.details) continue
    for (const detail of meta.details) {
      if (!detail?.category) continue
      const entry = getEntry(detail.category)
      for (const invoice of detail.invoices ?? []) {
        if (!invoice || typeof invoice.sar !== 'number' || invoice.sar <= 0) continue
        entry.settlementCount += 1
        entry.settlementTotal += invoice.sar
      }
    }
  }

  return [...stats.values()]
}

export type AgencyReportLoan = {
  refNumber: string
  employee: string
  activity: string
  location: string | null
  amount: number
  reviewStatus: string
  isSettled: boolean
  settlementTotal: number
  savings: number
  overage: number
  startDate: Date
  endDate: Date
  createdAt: Date
}

export type AgencyReportRequester = {
  employee: string
  count: number
  totalAmount: number
  settledCount: number
  totalSettlement: number
  totalSavings: number
  avgDaysToSettle: number | null   // متوسط أيام التسوية من نهاية النشاط
  overdueCount: number             // طلبات متأخرة لم تُسوَّ
}

export type AgencyReportData = {
  generatedAt: Date
  summary: {
    loanCount: number
    totalRequested: number
    totalSettled: number
    totalSavings: number
    totalOverage: number
    settledCount: number
    pendingCount: number
  }
  loans: AgencyReportLoan[]
  requesters: AgencyReportRequester[]
  itemUsage: ItemUsageStat[]
}

export async function getAgencyReportData(): Promise<AgencyReportData> {
  const loans = await prisma.loan.findMany({
    include: dashboardLoanInclude,
    orderBy: { createdAt: 'desc' },
  })

  const itemUsage = await getItemUsageStats()

  const requesterMap = new Map<string, AgencyReportRequester>()
  let totalRequested = 0
  let totalSettled = 0
  let totalSavings = 0
  let totalOverage = 0
  let settledCount = 0

  const reportLoans: AgencyReportLoan[] = loans.map((loan) => {
    totalRequested += loan.amount
    if (loan.isSettled) settledCount += 1
    if (loan.settlement) {
      totalSettled += loan.settlement.total
      totalSavings += loan.settlement.savings
      totalOverage += loan.settlement.overage
    }

    const requester = requesterMap.get(loan.employee) ?? { employee: loan.employee, count: 0, totalAmount: 0, settledCount: 0, totalSettlement: 0, totalSavings: 0, _daysToSettleSum: 0, _daysToSettleCount: 0, overdueCount: 0 }
    requester.count += 1
    requester.totalAmount += loan.amount
    if (loan.isSettled && loan.settlement) {
      requester.settledCount += 1
      requester.totalSettlement += loan.settlement.total
      requester.totalSavings += loan.settlement.savings - loan.settlement.overage
      // حساب عدد أيام التسوية من نهاية النشاط حتى رفع التسوية
      const endDate = new Date(loan.endDate)
      const settledDate = new Date((loan.settlement as { createdAt: Date }).createdAt)
      const days = Math.round((settledDate.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24))
      if (days >= 0) { requester._daysToSettleSum += days; requester._daysToSettleCount += 1 }
    } else if (!loan.isSettled) {
      const daysSinceEnd = Math.round((Date.now() - new Date(loan.endDate).getTime()) / (1000 * 60 * 60 * 24))
      if (daysSinceEnd > 7) requester.overdueCount += 1
    }
    requesterMap.set(loan.employee, requester)

    return {
      refNumber: loan.refNumber,
      employee: loan.employee,
      activity: loan.activity,
      location: loan.location,
      amount: loan.amount,
      reviewStatus: loan.reviewStatus,
      isSettled: loan.isSettled,
      settlementTotal: loan.settlement?.total ?? 0,
      savings: loan.settlement?.savings ?? 0,
      overage: loan.settlement?.overage ?? 0,
      startDate: loan.startDate,
      endDate: loan.endDate,
      createdAt: loan.createdAt,
    }
  })

  return {
    generatedAt: new Date(),
    summary: {
      loanCount: loans.length,
      totalRequested,
      totalSettled,
      totalSavings,
      totalOverage,
      settledCount,
      pendingCount: loans.length - settledCount,
    },
    loans: reportLoans,
    requesters: [...requesterMap.values()].map((r) => ({
      employee: r.employee, count: r.count, totalAmount: r.totalAmount,
      settledCount: r.settledCount, totalSettlement: r.totalSettlement, totalSavings: r.totalSavings,
      avgDaysToSettle: r._daysToSettleCount > 0 ? Math.round(r._daysToSettleSum / r._daysToSettleCount) : null,
      overdueCount: r.overdueCount,
    })).sort((a, b) => b.totalAmount - a.totalAmount),
    itemUsage,
  }
}

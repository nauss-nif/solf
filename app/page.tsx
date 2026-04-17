import { prisma } from '@/lib/prisma'
import DashboardClient, { type LoanDashboardRecord } from './DashboardClient'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const loans = await prisma.loan.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      items: true,
      settlement: true,
    },
  })

  const records: LoanDashboardRecord[] = loans.map((loan) => ({
    id: loan.id,
    refNumber: loan.refNumber,
    employee: loan.employee,
    activity: loan.activity,
    location: loan.location ?? '',
    amount: loan.amount,
    startDate: loan.startDate.toISOString(),
    endDate: loan.endDate.toISOString(),
    createdAt: loan.createdAt.toISOString(),
    isSettled: loan.isSettled,
    items: loan.items.map((item) => ({
      id: item.id,
      category: item.category,
      amount: item.amount,
    })),
    settlement: loan.settlement
      ? {
          id: loan.settlement.id,
          supported: loan.settlement.supported,
          unsupported: loan.settlement.unsupported,
          total: loan.settlement.total,
          savings: loan.settlement.savings,
          overage: loan.settlement.overage,
          createdAt: loan.settlement.createdAt.toISOString(),
          invoices: loan.settlement.invoices
            ? JSON.parse(JSON.stringify(loan.settlement.invoices))
            : null,
        }
      : null,
  }))

  return <DashboardClient initialLoans={records} />
}

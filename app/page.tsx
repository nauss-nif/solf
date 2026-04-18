import { requireSessionUser } from '@/lib/auth'
import { canManageAllLoans } from '@/lib/auth'
import { ensureDatabaseSetup } from '@/lib/database-setup'
import { prisma } from '@/lib/prisma'
import DashboardClient, { type LoanDashboardRecord } from './DashboardClient'
import { dashboardLoanInclude } from '@/lib/loan-selects'

export const dynamic = 'force-dynamic'

function serializeLoanRecord(loan: any): LoanDashboardRecord {
  return {
    ...loan,
    location: loan.location ?? '',
    budgetApproved:
      typeof loan.budgetApproved === 'boolean' ? loan.budgetApproved : null,
    reviewStatus: loan.reviewStatus ?? 'PENDING',
    reviewNote: loan.reviewNote ?? '',
    startDate: new Date(loan.startDate).toISOString(),
    endDate: new Date(loan.endDate).toISOString(),
    createdAt: new Date(loan.createdAt).toISOString(),
    updatedAt: loan.updatedAt ? new Date(loan.updatedAt).toISOString() : undefined,
    printedAt: loan.printedAt ? new Date(loan.printedAt).toISOString() : null,
    settlement: loan.settlement
      ? {
          ...loan.settlement,
          createdAt: new Date(loan.settlement.createdAt).toISOString(),
        }
      : null,
  }
}

export default async function Home() {
  const currentUser = requireSessionUser()
  await ensureDatabaseSetup()

  const loans = await prisma.loan.findMany({
    where: canManageAllLoans(currentUser) ? undefined : { userId: currentUser.userId },
    orderBy: { createdAt: 'desc' },
    include: dashboardLoanInclude,
  })

  return (
    <DashboardClient
      currentUser={currentUser}
      initialLoans={loans.map(serializeLoanRecord)}
    />
  )
}

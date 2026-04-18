import { requireSessionUser } from '@/lib/auth'
import { ensureDatabaseSetup } from '@/lib/database-setup'
import { prisma } from '@/lib/prisma'
import DashboardClient, { type LoanDashboardRecord } from './DashboardClient'

export const dynamic = 'force-dynamic'

function serializeLoanRecord(loan: any): LoanDashboardRecord {
  return {
    ...loan,
    location: loan.location ?? '',
    startDate: new Date(loan.startDate).toISOString(),
    endDate: new Date(loan.endDate).toISOString(),
    createdAt: new Date(loan.createdAt).toISOString(),
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
    where: currentUser.role === 'ADMIN' ? undefined : { userId: currentUser.userId },
    orderBy: { createdAt: 'desc' },
    include: { items: true, settlement: true },
  })

  return (
    <DashboardClient
      currentUser={currentUser}
      initialLoans={loans.map(serializeLoanRecord)}
    />
  )
}

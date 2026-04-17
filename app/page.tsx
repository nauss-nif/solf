import { requireSessionUser } from '@/lib/auth'
import DashboardClient, { type LoanDashboardRecord } from './DashboardClient'

export const dynamic = 'force-dynamic'

export default function Home() {
  const currentUser = requireSessionUser()

  return (
    <DashboardClient
      currentUser={currentUser}
      initialLoans={[] as LoanDashboardRecord[]}
    />
  )
}

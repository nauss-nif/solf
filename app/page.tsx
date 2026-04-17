import DashboardClient, { type LoanDashboardRecord } from './DashboardClient'

export const dynamic = 'force-dynamic'

export default function Home() {
  return <DashboardClient initialLoans={[] as LoanDashboardRecord[]} />
}

'use server'

import { redirect } from 'next/navigation'
import { requireSessionUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureDatabaseSetup } from '@/lib/database-setup'
import { dashboardLoanInclude } from '@/lib/loan-selects'
import DashboardHome from '@/app/dashboard/DashboardHome'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const currentUser = requireSessionUser()
  await ensureDatabaseSetup()

  const loans = await prisma.loan.findMany({
    where: ['ADMIN', 'REVIEWER'].some(r => currentUser.roles.includes(r as any))
      ? undefined
      : { userId: currentUser.userId },
    orderBy: { createdAt: 'desc' },
    include: dashboardLoanInclude,
  })

  // إشعارات غير مقروءة
  const unreadCount = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count FROM "loan_notifications"
    WHERE "userId" = ${currentUser.userId} AND "isRead" = FALSE
  `.then(r => Number(r[0]?.count ?? 0)).catch(() => 0)

  return (
    <DashboardHome
      currentUser={currentUser}
      initialLoans={loans as any}
      unreadNotifications={unreadCount}
    />
  )
}

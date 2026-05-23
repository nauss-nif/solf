import { redirect } from 'next/navigation'
import { requireSessionUser, hasRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureDatabaseSetup } from '@/lib/database-setup'
import AdminDashboard from './AdminDashboard'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  await ensureDatabaseSetup()
  const currentUser = requireSessionUser()

  if (!hasRole(currentUser, 'ADMIN') && !hasRole(currentUser, 'REVIEWER')) {
    redirect('/')
  }

  const isAdmin = hasRole(currentUser, 'ADMIN')

  // جلب جميع السلف مع التفاصيل
  const loans = await prisma.loan.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      items: true,
      settlement: { select: { id: true, total: true, savings: true, overage: true, supported: true, unsupported: true, createdAt: true } },
    },
  })

  // إحصائيات سريعة
  const now = new Date()
  const activeLoans = loans.filter(l => !l.isSettled)
  const settledLoans = loans.filter(l => l.isSettled)
  const overdueLoans = activeLoans.filter(l =>
    (l as any).settlementDeadline && new Date((l as any).settlementDeadline) < now
  )
  const pendingReview = activeLoans.filter(l => l.reviewStatus === 'PENDING')

  // بيانات الرسوم البيانية — آخر 6 أشهر
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const monthlyData = loans
    .filter(l => new Date(l.createdAt) >= sixMonthsAgo)
    .reduce((acc, loan) => {
      const month = new Date(loan.createdAt).toLocaleDateString('ar-SA', { month: 'short', year: '2-digit' })
      if (!acc[month]) acc[month] = { month, loans: 0, amount: 0, settled: 0 }
      acc[month].loans++
      acc[month].amount += loan.amount
      if (loan.isSettled) acc[month].settled++
      return acc
    }, {} as Record<string, { month: string; loans: number; amount: number; settled: number }>)

  // المستخدمون (للمدير فقط)
  const users = isAdmin ? await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, fullName: true, email: true, role: true, roles: true, status: true, createdAt: true },
  }) : []

  // الموظفون المتأخرون
  const overdueWithUsers = await prisma.loan.findMany({
    where: {
      isSettled: false,
      ...(Object.keys(prisma.loan.fields).includes('settlementDeadline')
        ? { settlementDeadline: { lt: now } }
        : {}),
    },
    include: { user: { select: { id: true, fullName: true, email: true } } },
    orderBy: { createdAt: 'asc' },
  }).catch(() => [])

  return (
    <AdminDashboard
      currentUser={currentUser}
      isAdmin={isAdmin}
      stats={{
        total: loans.length,
        active: activeLoans.length,
        settled: settledLoans.length,
        overdue: overdueLoans.length,
        pendingReview: pendingReview.length,
        totalAmount: loans.reduce((s, l) => s + l.amount, 0),
        totalSettled: settledLoans.reduce((s, l) => s + (l.settlement?.total ?? 0), 0),
        totalSavings: settledLoans.reduce((s, l) => s + (l.settlement?.savings ?? 0), 0),
      }}
      monthlyData={Object.values(monthlyData)}
      recentLoans={loans.slice(0, 20) as any}
      overdueLoans={overdueWithUsers as any}
      users={users as any}
    />
  )
}

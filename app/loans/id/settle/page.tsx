import { notFound, redirect } from 'next/navigation'
import { requireSessionUser, canManageAllLoans } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureDatabaseSetup } from '@/lib/database-setup'
import SettlementForm from './SettlementForm'

export const dynamic = 'force-dynamic'

export default async function SettlePage({ params }: { params: { id: string } }) {
  await ensureDatabaseSetup()
  const currentUser = requireSessionUser()

  const loan = await prisma.loan.findUnique({
    where: { id: params.id },
    include: { items: true, settlement: true },
  })

  if (!loan) notFound()

  if (!canManageAllLoans(currentUser) && loan.userId !== currentUser.userId) {
    notFound()
  }

  // إذا كانت السلفة مسواة مسبقاً
  if (loan.isSettled) {
    redirect(`/loans/${params.id}`)
  }

  // يجب أن تكون معتمدة قبل التسوية
  if (loan.reviewStatus !== 'REVIEWED' && !canManageAllLoans(currentUser)) {
    redirect(`/loans/${params.id}`)
  }

  return (
    <SettlementForm
      loan={{
        id: loan.id,
        refNumber: loan.refNumber,
        employee: loan.employee,
        activity: loan.activity,
        amount: loan.amount,
        startDate: loan.startDate.toISOString(),
        endDate: loan.endDate.toISOString(),
        items: loan.items,
      }}
    />
  )
}

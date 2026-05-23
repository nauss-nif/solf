import { notFound } from 'next/navigation'
import { requireSessionUser, canManageAllLoans } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureDatabaseSetup } from '@/lib/database-setup'
import EditLoanForm from './EditLoanForm'

export const dynamic = 'force-dynamic'

export default async function EditLoanPage({ params }: { params: { id: string } }) {
  await ensureDatabaseSetup()
  const currentUser = requireSessionUser()

  const loan = await prisma.loan.findUnique({
    where: { id: params.id },
    include: { items: true },
  })

  if (!loan) notFound()

  if (!canManageAllLoans(currentUser) && loan.userId !== currentUser.userId) {
    notFound()
  }

  // لا يمكن التعديل بعد الطباعة أو التسوية
  if (loan.printedAt || loan.isSettled) {
    notFound()
  }

  return (
    <EditLoanForm
      loan={{
        id: loan.id,
        refNumber: loan.refNumber,
        activity: loan.activity,
        location: loan.location ?? '',
        startDate: loan.startDate.toISOString().slice(0, 10),
        endDate: loan.endDate.toISOString().slice(0, 10),
        budgetApproved: loan.budgetApproved,
        destinationCategory: (loan as any).destinationCategory ?? 'DOMESTIC',
        amount: loan.amount,
        items: loan.items,
        files: (loan.files as any) ?? null,
      }}
    />
  )
}

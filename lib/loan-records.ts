import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireSessionUser } from '@/lib/auth'
import { ensureDatabaseSetup } from '@/lib/database-setup'

export async function getAuthorizedLoan(loanId: string) {
  await ensureDatabaseSetup()
  const currentUser = requireSessionUser()

  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: { items: true, settlement: true },
  })

  if (!loan) {
    notFound()
  }

  if (currentUser.role !== 'ADMIN' && loan.userId !== currentUser.userId) {
    notFound()
  }

  return loan
}

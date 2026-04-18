import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireSessionUser } from '@/lib/auth'
import { ensureDatabaseSetup } from '@/lib/database-setup'

export async function getAuthorizedLoan(
  loanId: string,
  options?: { markPrinted?: boolean },
) {
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

  if (options?.markPrinted && !loan.printedAt) {
    const updatedLoan = await prisma.loan.update({
      where: { id: loanId },
      data: { printedAt: new Date() },
      include: { items: true, settlement: true },
    })

    return updatedLoan
  }

  return loan
}

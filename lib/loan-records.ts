import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { canManageAllLoans, requireSessionUser } from '@/lib/auth'
import { ensureDatabaseSetup } from '@/lib/database-setup'
import { fullLoanInclude } from '@/lib/loan-selects'

export async function getAuthorizedLoan(
  loanId: string,
  options?: { markPrinted?: boolean },
) {
  await ensureDatabaseSetup()
  const currentUser = requireSessionUser()

  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: fullLoanInclude,
  })

  if (!loan) {
    notFound()
  }

  if (!canManageAllLoans(currentUser.role) && loan.userId !== currentUser.userId) {
    notFound()
  }

  if (options?.markPrinted && !loan.printedAt) {
    const updatedLoan = await prisma.loan.update({
      where: { id: loanId },
      data: { printedAt: new Date() },
      include: fullLoanInclude,
    })

    return updatedLoan
  }

  return loan
}

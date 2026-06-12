import { notFound } from 'next/navigation'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { canManageAllLoans, hasRole, normalizeRoles, requireSessionUser } from '@/lib/auth'
import { ensureDatabaseSetup } from '@/lib/database-setup'
import { fullLoanInclude } from '@/lib/loan-selects'
import { isStoredImageFile, type StoredFile } from '@/lib/loan-form-options'

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

  if (!canManageAllLoans(currentUser) && loan.userId !== currentUser.userId) {
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

// تأشيرات المراجعين: توقيعات أول 3 مستخدمين بدور "مراجع" لديهم توقيع محفوظ
export async function getReviewerSignatures(): Promise<StoredFile[]> {
  await ensureDatabaseSetup()

  const users = await prisma.user.findMany({
    where: { signatureImage: { not: Prisma.DbNull } },
    orderBy: { createdAt: 'asc' },
    select: { role: true, roles: true, signatureImage: true },
  })

  const signatures: StoredFile[] = []
  for (const user of users) {
    if (signatures.length >= 3) break
    const role = user.role as 'EMPLOYEE' | 'ADMIN' | 'REVIEWER'
    if (!hasRole({ role, roles: normalizeRoles(user.roles, role) }, 'REVIEWER')) continue
    if (isStoredImageFile(user.signatureImage)) {
      signatures.push(user.signatureImage)
    }
  }

  return signatures
}

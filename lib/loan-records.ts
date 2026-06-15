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
// إن أُعطي preferredReviewerId (اعتماد المدير بالنيابة عن مراجع محدد)، يُقدَّم توقيع ذلك المراجع أولاً
export async function getReviewerSignatures(preferredReviewerId?: string | null): Promise<StoredFile[]> {
  await ensureDatabaseSetup()

  const users = await prisma.user.findMany({
    where: { signatureImage: { not: Prisma.DbNull } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, role: true, roles: true, signatureImage: true },
  })

  const reviewers = users.filter((user) => {
    const role = user.role as 'EMPLOYEE' | 'ADMIN' | 'REVIEWER'
    return hasRole({ role, roles: normalizeRoles(user.roles, role) }, 'REVIEWER') && isStoredImageFile(user.signatureImage)
  })

  if (preferredReviewerId) {
    const preferredIndex = reviewers.findIndex((user) => user.id === preferredReviewerId)
    if (preferredIndex > 0) {
      const [preferred] = reviewers.splice(preferredIndex, 1)
      reviewers.unshift(preferred)
    }

    return reviewers.slice(0, 1).map((user) => user.signatureImage as StoredFile)
  }

  return reviewers.slice(0, 3).map((user) => user.signatureImage as StoredFile)
}

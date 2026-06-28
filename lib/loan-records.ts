import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { canManageAllLoans, normalizeRoles, requireSessionUser } from '@/lib/auth'
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

// تأشيرة المراجع الذي اعتمد المعاملة فعلياً فقط — لا تُعرض أي توقيعات لمراجعين آخرين لم يعتمدوها
export async function getReviewerSignatures(approverId?: string | null): Promise<StoredFile[]> {
  if (!approverId) return []
  await ensureDatabaseSetup()

  const approver = await prisma.user.findUnique({
    where: { id: approverId },
    select: { id: true, role: true, roles: true, signatureImage: true },
  })

  if (!approver || !isStoredImageFile(approver.signatureImage)) return []

  const role = approver.role as 'EMPLOYEE' | 'ADMIN' | 'REVIEWER'
  // أي حساب يملك صلاحية اعتماد فعلية (مراجع أو مدير) يصحّ توقيعه — لا يقتصر على صلاحية "مراجع" فقط
  if (!canManageAllLoans({ role, roles: normalizeRoles(approver.roles, role) })) return []

  return [approver.signatureImage as StoredFile]
}

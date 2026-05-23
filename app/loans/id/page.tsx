import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireSessionUser, canManageAllLoans } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureDatabaseSetup } from '@/lib/database-setup'
import { fullLoanInclude } from '@/lib/loan-selects'
import LoanDetailClient from './LoanDetailClient'

export const dynamic = 'force-dynamic'

export default async function LoanDetailPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { success?: string }
}) {
  await ensureDatabaseSetup()
  const currentUser = requireSessionUser()

  const loan = await prisma.loan.findUnique({
    where: { id: params.id },
    include: fullLoanInclude,
  })

  if (!loan) notFound()

  if (!canManageAllLoans(currentUser) && loan.userId !== currentUser.userId) {
    notFound()
  }

  return (
    <LoanDetailClient
      loan={loan as any}
      currentUser={currentUser}
      successMessage={searchParams.success === 'created' ? 'تم حفظ طلب السلفة بنجاح' : undefined}
    />
  )
}

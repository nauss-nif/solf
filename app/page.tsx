import { getSessionUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'

export const dynamic = 'force-dynamic'

export default async function Home({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const currentUser = getSessionUser()
  if (!currentUser) {
    const query = new URLSearchParams()
    Object.entries(searchParams ?? {}).forEach(([key, value]) => {
      if (typeof value === 'string') query.set(key, value)
    })
    const next = query.toString() ? `/?${query.toString()}` : '/'
    redirect(`/login?next=${encodeURIComponent(next)}`)
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: currentUser.userId },
    select: { signatureImage: true },
  })
  const hasSignature = Boolean(dbUser?.signatureImage)

  return <DashboardClient currentUser={currentUser} initialLoans={[]} hasSignature={hasSignature} />
}

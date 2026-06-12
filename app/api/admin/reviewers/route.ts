import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, hasRole, normalizeRoles } from '@/lib/auth'
import { ensureDatabaseSetup } from '@/lib/database-setup'

// قائمة المراجعين — لاستخدامها في "اعتماد بالنيابة عن" (للمدير فقط)
export async function GET() {
  try {
    await ensureDatabaseSetup()
    const currentUser = getSessionUser()
    if (!currentUser || !hasRole(currentUser, 'ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const users = await prisma.user.findMany({
      orderBy: { fullName: 'asc' },
      select: { id: true, fullName: true, role: true, roles: true },
    })

    const reviewers = users
      .filter((user) => {
        const role = user.role as 'EMPLOYEE' | 'ADMIN' | 'REVIEWER'
        return hasRole({ role, roles: normalizeRoles(user.roles, role) }, 'REVIEWER')
      })
      .map((user) => ({ id: user.id, fullName: user.fullName }))

    return NextResponse.json(reviewers)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load reviewers' },
      { status: 500 },
    )
  }
}

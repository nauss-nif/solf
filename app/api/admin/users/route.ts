import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureDefaultAdmin, getSessionUser, isSuperAdmin, normalizeRoles } from '@/lib/auth'
import { ensureAuthSetup } from '@/lib/database-setup'

export async function GET() {
  try {
    await ensureAuthSetup()
    await ensureDefaultAdmin()
    const currentUser = getSessionUser()
    if (!isSuperAdmin(currentUser)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fullName: true,
        email: true,
        mobile: true,
        extension: true,
        role: true,
        roles: true,
        status: true,
        signatureImage: true,
        createdAt: true,
      },
    })

    return NextResponse.json(
      users.map((user) => ({
        ...user,
        roles: normalizeRoles(user.roles, user.role as 'EMPLOYEE' | 'ADMIN' | 'REVIEWER'),
      })),
    )
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load users' },
      { status: 500 },
    )
  }
}

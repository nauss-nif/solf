import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  ensureDefaultAdmin,
  getPrimaryRole,
  normalizeRoles,
  setSessionCookie,
  verifyPassword,
} from '@/lib/auth'
import { ensureAuthSetup } from '@/lib/database-setup'

export async function POST(request: Request) {
  try {
    await ensureAuthSetup()
    await ensureDefaultAdmin()
    const body = await request.json()
    const email = String(body.email ?? '').trim().toLowerCase()
    const password = String(body.password ?? '')

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        roles: true,
        status: true,
        passwordHash: true,
      },
    })
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    if (user.status === 'DISABLED') {
      return NextResponse.json({ error: 'Account is disabled' }, { status: 403 })
    }

    const roles = normalizeRoles(user.roles, user.role as 'EMPLOYEE' | 'ADMIN' | 'REVIEWER')

    setSessionCookie({
      userId: user.id,
      fullName: user.fullName,
      email: user.email,
      role: getPrimaryRole(roles),
      roles,
    })

    return NextResponse.json({ success: true, role: getPrimaryRole(roles), roles })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Login failed' },
      { status: 500 },
    )
  }
}

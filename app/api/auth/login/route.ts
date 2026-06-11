import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  ensureDefaultAdmin,
  getPrimaryRole,
  normalizeRoles,
  setSessionCookie,
  verifyPassword,
} from '@/lib/auth'
import { getPublicApiError } from '@/lib/api-errors'
import { ensureAuthSetup } from '@/lib/database-setup'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

export async function POST(request: Request) {
  try {
    await ensureAuthSetup()
    await ensureDefaultAdmin()
    const body = await request.json()
    const email = String(body.email ?? '').trim().toLowerCase()
    const password = String(body.password ?? '')
    const rateLimit = checkRateLimit(`login:${getClientIp(request)}:${email || 'unknown'}`, 8, 15 * 60 * 1000)
    if (!rateLimit.ok) {
      return NextResponse.json(
        { error: 'محاولات كثيرة. حاول لاحقاً.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
      )
    }

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

    return NextResponse.json(
      { success: true, role: getPrimaryRole(roles), roles },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error('Login failed', error)

    return NextResponse.json(
      { error: getPublicApiError(error, 'Login failed') },
      { status: 500 },
    )
  }
}

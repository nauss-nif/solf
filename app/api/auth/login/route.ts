import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureDefaultAdmin, setSessionCookie, verifyPassword } from '@/lib/auth'
import { ensureDatabaseSetup } from '@/lib/database-setup'

export async function POST(request: Request) {
  try {
    await ensureDatabaseSetup()
    await ensureDefaultAdmin()
    const body = await request.json()
    const email = String(body.email ?? '').trim().toLowerCase()
    const password = String(body.password ?? '')

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    if (user.status === 'DISABLED') {
      return NextResponse.json({ error: 'Account is disabled' }, { status: 403 })
    }

    setSessionCookie({
      userId: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
    })

    return NextResponse.json({ success: true, role: user.role })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Login failed' },
      { status: 500 },
    )
  }
}

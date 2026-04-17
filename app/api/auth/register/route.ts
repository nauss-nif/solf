import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureDefaultAdmin, hashPassword, setSessionCookie } from '@/lib/auth'
import { ensureDatabaseSetup } from '@/lib/database-setup'

export async function POST(request: Request) {
  try {
    await ensureDatabaseSetup()
    await ensureDefaultAdmin()
    const body = await request.json()

    const fullName = String(body.fullName ?? '').trim()
    const email = String(body.email ?? '').trim().toLowerCase()
    const mobile = String(body.mobile ?? '').trim()
    const extension = String(body.extension ?? '').trim()
    const password = String(body.password ?? '')
    const passwordConfirm = String(body.passwordConfirm ?? '')

    if (!fullName || !email || !mobile || !extension || !password || !passwordConfirm) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    if (!email.endsWith('@nauss.edu.sa')) {
      return NextResponse.json({ error: 'Official email is required' }, { status: 400 })
    }

    if (password !== passwordConfirm) {
      return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 409 })
    }

    const user = await prisma.user.create({
      data: {
        fullName,
        email,
        mobile,
        extension,
        passwordHash: hashPassword(password),
      },
    })

    setSessionCookie({
      userId: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role as 'EMPLOYEE' | 'ADMIN',
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Registration failed' },
      { status: 500 },
    )
  }
}

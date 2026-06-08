import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'
import { ensureAuthSetup } from '@/lib/database-setup'
import { consumePasswordResetCode } from '@/lib/password-reset'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

export async function POST(request: Request) {
  try {
    await ensureAuthSetup()
    const body = await request.json()
    const email = String(body.email ?? '').trim().toLowerCase()
    const code = String(body.code ?? '').trim()
    const password = String(body.password ?? '')
    const passwordConfirm = String(body.passwordConfirm ?? '')
    const rateLimit = checkRateLimit(`password-reset-confirm:${getClientIp(request)}:${email || 'unknown'}`, 8, 30 * 60 * 1000)
    if (!rateLimit.ok) {
      return NextResponse.json(
        { error: 'محاولات كثيرة. حاول لاحقاً.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
      )
    }

    if (!email || !code || !password || !passwordConfirm) {
      return NextResponse.json({ error: 'أكمل جميع الحقول' }, { status: 400 })
    }
    if (password.length < 10) {
      return NextResponse.json({ error: 'كلمة المرور يجب أن تكون 10 أحرف على الأقل' }, { status: 400 })
    }
    if (password !== passwordConfirm) {
      return NextResponse.json({ error: 'كلمتا المرور غير متطابقتين' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
    if (!user) {
      return NextResponse.json({ error: 'كود الاستعادة غير صحيح أو منتهي' }, { status: 400 })
    }

    const valid = await consumePasswordResetCode(user.id, code)
    if (!valid) {
      return NextResponse.json({ error: 'كود الاستعادة غير صحيح أو منتهي' }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hashPassword(password) },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'تعذر تحديث كلمة المرور' },
      { status: 500 },
    )
  }
}

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureAuthSetup } from '@/lib/database-setup'
import { createResetCode, savePasswordResetCode } from '@/lib/password-reset'
import { sendPasswordResetCodeEmail } from '@/lib/notifications'

export async function POST(request: Request) {
  try {
    await ensureAuthSetup()
    const body = await request.json()
    const email = String(body.email ?? '').trim().toLowerCase()

    if (!email) {
      return NextResponse.json({ error: 'البريد الإلكتروني مطلوب' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, fullName: true, status: true },
    })

    if (user && user.status === 'ACTIVE') {
      const code = createResetCode()
      await savePasswordResetCode(user.id, code)
      await sendPasswordResetCodeEmail({ to: user.email, fullName: user.fullName, code })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'تعذر إرسال كود الاستعادة' },
      { status: 500 },
    )
  }
}

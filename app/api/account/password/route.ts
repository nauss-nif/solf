import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, hashPassword, verifyPassword } from '@/lib/auth'
import { ensureAuthSetup } from '@/lib/database-setup'

export async function PATCH(request: Request) {
  try {
    await ensureAuthSetup()
    const currentUser = getSessionUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const currentPassword = String(body.currentPassword ?? '')
    const newPassword = String(body.newPassword ?? '')

    if (newPassword.length < 10) {
      return NextResponse.json({ error: 'كلمة المرور الجديدة يجب أن تكون 10 أحرف على الأقل' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: currentUser.userId },
      select: { passwordHash: true },
    })

    if (!user || !verifyPassword(currentPassword, user.passwordHash)) {
      return NextResponse.json({ error: 'كلمة المرور الحالية غير صحيحة' }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: currentUser.userId },
      data: { passwordHash: hashPassword(newPassword) },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update password' },
      { status: 500 },
    )
  }
}

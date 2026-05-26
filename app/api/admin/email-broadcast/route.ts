import { NextResponse } from 'next/server'
import { getSessionUser, isSuperAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendCustomAdminEmail } from '@/lib/notifications'

type Audience = 'reviewers' | 'admins' | 'employees' | 'all'

async function getRecipients(audience: Audience) {
  if (audience === 'reviewers') {
    return prisma.$queryRaw<Array<{ email: string; fullName: string }>>`
      SELECT email, "fullName" FROM "users"
      WHERE "status" = 'ACTIVE' AND roles::jsonb ? 'REVIEWER'
    `
  }

  if (audience === 'admins') {
    return prisma.$queryRaw<Array<{ email: string; fullName: string }>>`
      SELECT email, "fullName" FROM "users"
      WHERE "status" = 'ACTIVE' AND roles::jsonb ? 'ADMIN'
    `
  }

  if (audience === 'employees') {
    return prisma.$queryRaw<Array<{ email: string; fullName: string }>>`
      SELECT email, "fullName" FROM "users"
      WHERE "status" = 'ACTIVE' AND roles::jsonb ? 'EMPLOYEE'
    `
  }

  return prisma.user.findMany({
    where: { status: 'ACTIVE' },
    select: { email: true, fullName: true },
  })
}

export async function POST(request: Request) {
  try {
    const currentUser = getSessionUser()
    if (!currentUser || !isSuperAdmin(currentUser)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({})) as {
      audience?: Audience
      subject?: string
      title?: string
      message?: string
    }

    const audience = body.audience ?? 'reviewers'
    const subject = body.subject?.trim() ?? ''
    const title = body.title?.trim() || subject
    const message = body.message?.trim() ?? ''

    if (!['reviewers', 'admins', 'employees', 'all'].includes(audience)) {
      return NextResponse.json({ error: 'فئة المستلمين غير صحيحة' }, { status: 400 })
    }
    if (!subject || !message) {
      return NextResponse.json({ error: 'أدخل عنوان الرسالة ومحتواها' }, { status: 400 })
    }

    const recipients = await getRecipients(audience)
    const uniqueRecipients = Array.from(
      new Map(recipients.filter((user) => user.email).map((user) => [user.email.toLowerCase(), user])).values(),
    )

    let sent = 0
    for (const recipient of uniqueRecipients) {
      const ok = await sendCustomAdminEmail({
        to: recipient.email,
        subject,
        title,
        message: message.replaceAll('{{name}}', recipient.fullName),
      })
      if (ok) sent += 1
    }

    return NextResponse.json({ success: sent > 0, sent, total: uniqueRecipients.length })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send email broadcast' },
      { status: 500 },
    )
  }
}

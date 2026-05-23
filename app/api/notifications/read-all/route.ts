// app/api/notifications/read-all/route.ts
import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST() {
  try {
    const currentUser = getSessionUser()
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await prisma.$executeRawUnsafe(
      `UPDATE "loan_notifications" SET "isRead" = TRUE WHERE "userId" = $1 AND "isRead" = FALSE`,
      currentUser.userId,
    )

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to mark notifications as read' }, { status: 500 })
  }
}

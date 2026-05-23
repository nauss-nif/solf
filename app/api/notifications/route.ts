// app/api/notifications/route.ts
import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const currentUser = getSessionUser()
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const notifications = await prisma.$queryRaw<Array<{
      id: string
      type: string
      title: string
      message: string
      isRead: boolean
      metadata: unknown
      createdAt: Date
    }>>`
      SELECT id, type, title, message, "isRead", metadata, "createdAt"
      FROM "loan_notifications"
      WHERE "userId" = ${currentUser.userId}
      ORDER BY "createdAt" DESC
      LIMIT 30
    `

    return NextResponse.json(notifications)
  } catch {
    return NextResponse.json({ error: 'Failed to load notifications' }, { status: 500 })
  }
}

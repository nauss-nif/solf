import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const currentUser = getSessionUser()
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const notifications = await prisma.loanNotification.findMany({
    where: { userId: currentUser.userId },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })

  const unreadCount = notifications.filter((notification) => !notification.isRead).length

  return NextResponse.json({ notifications, unreadCount })
}

export async function PATCH() {
  const currentUser = getSessionUser()
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await prisma.loanNotification.updateMany({
    where: { userId: currentUser.userId, isRead: false },
    data: { isRead: true },
  })

  return NextResponse.json({ success: true })
}

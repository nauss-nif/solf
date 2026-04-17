import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureDefaultAdmin, getSessionUser } from '@/lib/auth'
import { ensureDatabaseSetup } from '@/lib/database-setup'

export async function GET() {
  try {
    await ensureDatabaseSetup()
    await ensureDefaultAdmin()
    const currentUser = getSessionUser()
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fullName: true,
        email: true,
        mobile: true,
        extension: true,
        role: true,
        status: true,
        createdAt: true,
      },
    })

    return NextResponse.json(users)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load users' },
      { status: 500 },
    )
  }
}

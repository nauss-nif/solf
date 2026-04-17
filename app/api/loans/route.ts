import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth'
import { ensureDatabaseSetup } from '@/lib/database-setup'

export async function GET() {
  try {
    await ensureDatabaseSetup()
    const currentUser = getSessionUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const loans = await prisma.loan.findMany({
      where: currentUser.role === 'ADMIN' ? undefined : { userId: currentUser.userId },
      orderBy: { createdAt: 'desc' },
      include: { items: true, settlement: true },
    })
    return NextResponse.json(loans)
  } catch {
    return NextResponse.json({ error: 'Failed to load loans' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await ensureDatabaseSetup()
    const currentUser = getSessionUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const items = Array.isArray(body.items) ? body.items : []

    const loan = await prisma.loan.create({
      data: {
        refNumber: body.refNumber,
        userId: currentUser.userId,
        employee: currentUser.fullName,
        activity: body.activity,
        location: body.location,
        amount: body.amount,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        items: {
          create: items.map((item: { category: string; amount: number }) => ({
            category: item.category,
            amount: item.amount,
          })),
        },
      },
      include: { items: true },
    })

    return NextResponse.json(loan)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error creating loan' },
      { status: 500 },
    )
  }
}

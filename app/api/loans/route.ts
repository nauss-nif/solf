import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canManageAllLoans, getSessionUser } from '@/lib/auth'
import { ensureDatabaseSetup } from '@/lib/database-setup'
import { dashboardLoanInclude } from '@/lib/loan-selects'

async function getNextLoanRefNumber() {
  const loans = await prisma.loan.findMany({
    select: { refNumber: true },
    orderBy: { createdAt: 'desc' },
  })

  const nextSequence =
    loans.reduce((max, loan) => {
      const parts = loan.refNumber.split('/')
      const value = Number.parseInt(parts[2] ?? '0', 10)
      return Number.isNaN(value) ? max : Math.max(max, value)
    }, 0) + 1

  return `وت/26/${String(nextSequence).padStart(4, '0')}`
}

export async function GET() {
  try {
    await ensureDatabaseSetup()
    const currentUser = getSessionUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const loans = await prisma.loan.findMany({
      where: canManageAllLoans(currentUser.role) ? undefined : { userId: currentUser.userId },
      orderBy: { createdAt: 'desc' },
      include: dashboardLoanInclude,
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

    const requestedRefNumber = String(body.refNumber ?? '').trim()
    const refNumber =
      requestedRefNumber ||
      (await getNextLoanRefNumber())

    const existingLoan = await prisma.loan.findUnique({
      where: { refNumber },
      select: { id: true },
    })

    const loan = await prisma.loan.create({
      data: {
        refNumber: existingLoan ? await getNextLoanRefNumber() : refNumber,
        userId: currentUser.userId,
        employee: currentUser.fullName,
        activity: body.activity,
        location: body.location,
        amount: body.amount,
        budgetApproved:
          typeof body.budgetApproved === 'boolean' ? body.budgetApproved : null,
        files: body.files ?? undefined,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        items: {
          create: items.map((item: { category: string; amount: number }) => ({
            category: item.category,
            amount: item.amount,
          })),
        },
      },
      include: dashboardLoanInclude,
    })

    return NextResponse.json(loan)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error creating loan' },
      { status: 500 },
    )
  }
}

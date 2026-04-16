import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const loan = await prisma.loan.create({
      data: {
        refNumber: body.refNumber,
        employee: body.employee,
        activity: body.activity,
        location: body.location || null,
        amount: body.amount,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        items: {
          create: Array.isArray(body.items)
            ? body.items.map((item: { category: string; amount: number }) => ({
                category: item.category,
                amount: item.amount,
              }))
            : [],
        },
      },
      include: {
        items: true,
      },
    })
    return NextResponse.json(loan)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error creating loan' }, { status: 500 })
  }
}

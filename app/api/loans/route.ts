import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const loans = await prisma.loan.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json(loans);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const loan = await prisma.loan.create({
      data: {
        refNumber: body.refNumber,
        employee: body.employee,
        activity: body.activity,
        location: body.location,
        amount: body.amount,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
      }
    });
    return NextResponse.json(loan);
  } catch (error) {
    return NextResponse.json({ error: 'Error creating loan' }, { status: 500 });
  }
}
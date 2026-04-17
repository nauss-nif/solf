import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const result = await prisma.$transaction([
      prisma.settlement.create({
        data: {
          loanId: body.loanId,
          supported: body.supported,
          unsupported: body.unsupported,
          total: body.total,
          savings: body.savings,
          overage: body.overage,
          invoices: body.details
        }
      }),
      prisma.loan.update({
        where: { id: body.loanId },
        data: { isSettled: true }
      })
    ]);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: 'Settlement failed' }, { status: 500 });
  }
}
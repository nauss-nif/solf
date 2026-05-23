// app/api/admin/exceptions/route.ts
// منح استثناء للموظف للسماح بسلفتين نشطتين في آنٍ واحد
import { NextResponse } from 'next/server'
import { getSessionUser, hasRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createInternalNotification } from '@/lib/notifications'

export async function POST(request: Request) {
  try {
    const currentUser = getSessionUser()
    if (
      !currentUser ||
      (!hasRole(currentUser, 'ADMIN') && !hasRole(currentUser, 'REVIEWER'))
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { loanId, note } = body

    if (!loanId) {
      return NextResponse.json({ error: 'loanId required' }, { status: 400 })
    }

    const loan = await prisma.loan.update({
      where: { id: loanId },
      data: {
        exceptionGrantedById: currentUser.userId,
        exceptionGrantedAt: new Date(),
        exceptionNote: String(note ?? '').trim() || null,
      },
      include: { user: { select: { id: true, fullName: true } } },
    })

    // إشعار داخلي للموظف
    if (loan.userId) {
      await createInternalNotification({
        userId: loan.userId,
        type: 'EXCEPTION_GRANTED',
        title: `تم منح استثناء — ${loan.refNumber}`,
        message: `تم السماح لك بتقديم سلفة إضافية مع وجود سلفة ${loan.refNumber} النشطة.${note ? ` السبب: ${note}` : ''}`,
        metadata: { loanId: loan.id, refNumber: loan.refNumber },
      })
    }

    return NextResponse.json({ success: true, loanId: loan.id })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to grant exception' },
      { status: 500 },
    )
  }
}

// DELETE — إلغاء الاستثناء
export async function DELETE(request: Request) {
  try {
    const currentUser = getSessionUser()
    if (
      !currentUser ||
      (!hasRole(currentUser, 'ADMIN') && !hasRole(currentUser, 'REVIEWER'))
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const loanId = searchParams.get('loanId')

    if (!loanId) {
      return NextResponse.json({ error: 'loanId required' }, { status: 400 })
    }

    await prisma.loan.update({
      where: { id: loanId },
      data: {
        exceptionGrantedById: null,
        exceptionGrantedAt: null,
        exceptionNote: null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to revoke exception' },
      { status: 500 },
    )
  }
}

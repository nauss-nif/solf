// app/api/admin/alerts/route.ts
// إرسال إنذار يدوي من المدير أو المراجع
import { NextResponse } from 'next/server'
import { getSessionUser, hasRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendManualAlert } from '@/lib/notifications'

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
    const { loanId, customMessage } = body

    if (!loanId) {
      return NextResponse.json({ error: 'loanId required' }, { status: 400 })
    }

    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      include: { user: { select: { email: true, fullName: true } } },
    })

    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 })
    }

    if (!loan.user?.email) {
      return NextResponse.json(
        { error: 'لا يوجد بريد إلكتروني للموظف' },
        { status: 400 },
      )
    }

    const result = await sendManualAlert({
      loanId: loan.id,
      refNumber: loan.refNumber,
      employeeName: loan.employee,
      employeeEmail: loan.user.email,
      sentById: currentUser.userId,
      customMessage,
    })

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send alert' },
      { status: 500 },
    )
  }
}

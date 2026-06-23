import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canManageAllLoans, getSessionUser } from '@/lib/auth'
import { ensureDatabaseSetup } from '@/lib/database-setup'
import { dashboardLoanInclude } from '@/lib/loan-selects'
import { notifyRecallRequested, notifyRecallDecision } from '@/lib/notifications'

// طلب الموظف إعادة فتح معاملة معتمدة/مُسوّاة لتعديلها، بسبب يكتبه
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    await ensureDatabaseSetup()
    const currentUser = getSessionUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const loan = await prisma.loan.findUnique({ where: { id: params.id } })
    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 })
    }

    if (loan.userId !== currentUser.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (loan.reviewStatus !== 'REVIEWED' && !loan.isSettled) {
      return NextResponse.json({ error: 'لا يمكن طلب إعادة فتح معاملة لم تُعتمد بعد.' }, { status: 409 })
    }

    if (loan.recallRequested) {
      return NextResponse.json({ error: 'يوجد طلب إعادة فتح معلّق بالفعل لهذه المعاملة.' }, { status: 409 })
    }

    const reason = String((await request.json()).reason ?? '').trim()
    if (!reason) {
      return NextResponse.json({ error: 'يجب كتابة سبب طلب إعادة الفتح.' }, { status: 400 })
    }

    const updatedLoan = await prisma.loan.update({
      where: { id: loan.id },
      data: {
        recallRequested: true,
        recallReason: reason,
        recallRequestedAt: new Date(),
      },
      include: dashboardLoanInclude,
    })

    void notifyRecallRequested({
      id: loan.id,
      refNumber: loan.refNumber,
      employee: loan.employee,
      reason,
      targetLabel: loan.isSettled ? 'نموذج ١٩ (تسوية السلفة)' : 'نموذج ١٨ (طلب السلفة)',
    }).catch(console.error)

    return NextResponse.json(updatedLoan)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to request recall' },
      { status: 500 },
    )
  }
}

// قرار المراجع بشأن طلب إعادة الفتح: قبول أو رفض
// القبول يعيد فتح نموذج ١٩ (إن كانت مُسوّاة) أو نموذج ١٨ (إن لم تكن) للتعديل من جديد
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    await ensureDatabaseSetup()
    const currentUser = getSessionUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canManageAllLoans(currentUser)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const loan = await prisma.loan.findUnique({ where: { id: params.id } })
    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 })
    }

    if (!loan.recallRequested) {
      return NextResponse.json({ error: 'لا يوجد طلب إعادة فتح معلّق لهذه المعاملة.' }, { status: 409 })
    }

    const body = await request.json()
    const approved = body.decision === 'approve'

    const updatedLoan = await prisma.loan.update({
      where: { id: loan.id },
      data: {
        recallRequested: false,
        recallReason: null,
        recallRequestedAt: null,
        // القبول لا يحذف بيانات التسوية ولا يفرّغها — فقط يُنزّل حالتها من "معتمدة" إلى
        // "قيد التسوية" لتبقى نفس البيانات السابقة قابلة للتعديل (وليست مسودة فارغة جديدة)
        ...(approved
          ? loan.isSettled
            ? { settlementStatus: 'IN_PROGRESS' as const }
            : { reviewStatus: 'PENDING' as const }
          : {}),
      },
      include: dashboardLoanInclude,
    })

    if (loan.userId) {
      const owner = await prisma.user.findUnique({
        where: { id: loan.userId },
        select: { email: true },
      })

      if (owner?.email) {
        void notifyRecallDecision({
          userId: loan.userId,
          userEmail: owner.email,
          refNumber: loan.refNumber,
          loanId: loan.id,
          approved,
        }).catch(console.error)
      }
    }

    return NextResponse.json(updatedLoan)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process recall decision' },
      { status: 500 },
    )
  }
}

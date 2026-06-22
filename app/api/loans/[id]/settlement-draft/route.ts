import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canManageAllLoans, getSessionUser } from '@/lib/auth'
import { ensureDatabaseSetup } from '@/lib/database-setup'

// ─────────────────────────────────────────────────────────────
// PATCH /api/loans/[id]/settlement-draft — حفظ مسودة التسوية
// (بنود/فواتير/عملات لم تُقدَّم بعد — لا تتطلب اكتمال البيانات)
// ─────────────────────────────────────────────────────────────
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

    const loan = await prisma.loan.findUnique({
      where: { id: params.id },
      select: { id: true, userId: true, reviewStatus: true, isSettled: true },
    })

    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 })
    }

    if (!canManageAllLoans(currentUser) && loan.userId !== currentUser.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (loan.isSettled) {
      return NextResponse.json({ error: 'السلفة مسوّاة بالفعل.' }, { status: 409 })
    }

    const body = await request.json()
    const updated = await prisma.loan.update({
      where: { id: loan.id },
      data: {
        settlementDraft: body.settlementDraft ?? {},
        settlementStatus: 'IN_PROGRESS',
      },
      select: { id: true, settlementDraft: true, settlementStatus: true },
    })

    return NextResponse.json(updated)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save settlement draft' },
      { status: 500 },
    )
  }
}

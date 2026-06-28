import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, isSuperAdmin } from '@/lib/auth'
import { fullLoanInclude } from '@/lib/loan-selects'
import { syncClosureElementFromPrint } from '@/lib/closure-integration'

// POST /api/loans/[id]/admin-finalize-review
// صلاحية مطلقة للمدير العام فقط: تثبيت توقيعَي المراجعين (أو أحدهما) على
// معاملة معيّنة مباشرة بدلاً من انتظار اعتماد كل مراجع بنفسه عبر حسابه —
// يُستخدم لإقفال معاملات قديمة أو عالقة دون المرور بدورة الاعتماد الثنائي.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const currentUser = getSessionUser()
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!isSuperAdmin(currentUser)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const formType = body.formType === 'settlement' ? 'settlement' : 'advance_req'
    const firstReviewerId = String(body.firstReviewerId || '').trim()
    const secondReviewerId = String(body.secondReviewerId || '').trim() || null
    if (!firstReviewerId) return NextResponse.json({ error: 'يلزم تحديد المراجع الأول على الأقل.' }, { status: 400 })
    if (secondReviewerId && secondReviewerId === firstReviewerId) {
      return NextResponse.json({ error: 'يجب أن يكون المراجعان شخصين مختلفين.' }, { status: 400 })
    }

    const loan = await prisma.loan.findUnique({ where: { id: params.id } })
    if (!loan) return NextResponse.json({ error: 'المعاملة غير موجودة' }, { status: 404 })

    if (formType === 'settlement' && !loan.isSettled) {
      return NextResponse.json({ error: 'لا توجد تسوية محفوظة لهذه المعاملة.' }, { status: 409 })
    }

    const updated = await prisma.loan.update({
      where: { id: params.id },
      data:
        formType === 'settlement'
          ? { settlementStatus: 'APPROVED', settlementReviewedById: firstReviewerId, secondSettlementReviewedById: secondReviewerId }
          : { reviewStatus: 'REVIEWED', reviewedById: firstReviewerId, secondReviewedById: secondReviewerId },
      include: fullLoanInclude,
    })

    if (updated.courseId) {
      await syncClosureElementFromPrint(formType, updated)
    }

    return NextResponse.json({ ok: true, loan: { id: updated.id } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'فشل التنفيذ' }, { status: 500 })
  }
}

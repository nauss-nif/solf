import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canManageAllLoans, getSessionUser } from '@/lib/auth'
import { ensureDatabaseSetup } from '@/lib/database-setup'
import { fullLoanInclude } from '@/lib/loan-selects'
import { syncClosureElementFromPrint } from '@/lib/closure-integration'

// POST /api/loans/[id]/link-course
// يربط معاملة سلفة قديمة بدورة في منصة الإقفال بعد إنشائها بدون ربط،
// ثم يعيد مزامنة حالتها (طلب/تسوية) فوراً إن كانت مُعتمدة بالفعل —
// حتى تنعكس مواعيدها الحقيقية (في الوقت / متأخرة) في مؤشرات الإقفال.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    await ensureDatabaseSetup()
    const currentUser = getSessionUser()
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!canManageAllLoans(currentUser)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const courseId = String(body.courseId || '').trim()
    const courseCode = String(body.courseCode || '').trim() || null
    if (!courseId) return NextResponse.json({ error: 'courseId مطلوب' }, { status: 400 })

    const loan = await prisma.loan.findUnique({ where: { id: params.id } })
    if (!loan) return NextResponse.json({ error: 'المعاملة غير موجودة' }, { status: 404 })
    if (loan.courseId) {
      return NextResponse.json({ error: 'هذه المعاملة مرتبطة بدورة بالفعل.' }, { status: 409 })
    }

    const updated = await prisma.loan.update({
      where: { id: params.id },
      data: { courseId, courseCode },
      include: fullLoanInclude,
    })

    const syncResults: Record<string, unknown> = {}

    // إن كان طلب السلفة معتمداً بالفعل (نموذج ١٨) — زامن عنصر "طلب السلفة" بتاريخه الحقيقي
    if (updated.reviewStatus === 'REVIEWED') {
      syncResults.advance_req = await syncClosureElementFromPrint('advance_req', updated)
    }
    // إن كانت التسوية معتمدة بالفعل (نموذج ١٩) — زامن عنصر "تسوية السلفة"
    if (updated.isSettled && updated.settlementStatus === 'APPROVED') {
      syncResults.settlement = await syncClosureElementFromPrint('settlement', updated)
    }

    return NextResponse.json({ ok: true, loan: { id: updated.id, courseId: updated.courseId, courseCode: updated.courseCode }, sync: syncResults })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'فشل الربط' }, { status: 500 })
  }
}

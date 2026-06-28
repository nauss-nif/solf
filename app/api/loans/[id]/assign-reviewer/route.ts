import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, isSuperAdmin } from '@/lib/auth'

// POST /api/loans/[id]/assign-reviewer
// تعيين توقيع تاريخي بأثر رجعي لمعاملة اعتُمدت قبل إضافة تتبّع هوية
// المعتمِد الفعلي (24 يونيو 2026) — تلك المعاملات معتمَدة فعلياً لكن
// لا توجد أي وسيلة لمعرفة من اعتمدها تلقائياً، فيختار المدير الفائق
// المراجع الصحيح يدوياً مرة واحدة ليظهر توقيعه على النموذج المطبوع.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const currentUser = getSessionUser()
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!isSuperAdmin(currentUser)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const formType = body.formType === 'settlement' ? 'settlement' : 'advance_req'
    const reviewerId = String(body.reviewerId || '').trim()
    if (!reviewerId) return NextResponse.json({ error: 'reviewerId مطلوب' }, { status: 400 })

    const loan = await prisma.loan.findUnique({ where: { id: params.id } })
    if (!loan) return NextResponse.json({ error: 'المعاملة غير موجودة' }, { status: 404 })

    if (formType === 'advance_req') {
      if (loan.reviewStatus !== 'REVIEWED') {
        return NextResponse.json({ error: 'نموذج ١٨ غير معتمد لهذه المعاملة.' }, { status: 409 })
      }
      if (loan.reviewedById) {
        return NextResponse.json({ error: 'المعتمِد مُسجَّل بالفعل لنموذج ١٨.' }, { status: 409 })
      }
      const updated = await prisma.loan.update({ where: { id: params.id }, data: { reviewedById: reviewerId } })
      return NextResponse.json({ ok: true, reviewedById: updated.reviewedById })
    }

    if (!loan.isSettled || loan.settlementStatus !== 'APPROVED') {
      return NextResponse.json({ error: 'نموذج ١٩ غير معتمد لهذه المعاملة.' }, { status: 409 })
    }
    if (loan.settlementReviewedById) {
      return NextResponse.json({ error: 'المعتمِد مُسجَّل بالفعل لنموذج ١٩.' }, { status: 409 })
    }
    const updated = await prisma.loan.update({ where: { id: params.id }, data: { settlementReviewedById: reviewerId } })
    return NextResponse.json({ ok: true, settlementReviewedById: updated.settlementReviewedById })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'فشل التعيين' }, { status: 500 })
  }
}

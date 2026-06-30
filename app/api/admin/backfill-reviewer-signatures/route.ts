import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, isSuperAdmin } from '@/lib/auth'
import { fullLoanInclude } from '@/lib/loan-selects'
import { syncClosureElementFromPrint } from '@/lib/closure-integration'

// POST /api/admin/backfill-reviewer-signatures
// إعادة توقيع جماعية للمعاملات المعتمدة قديماً قبل وجود تتبّع هوية المعتمِد
// (24 يونيو 2026). المستخدم أكّد أن كل معاملة قديمة معتمدة كانت بتأشيرة
// المراجعين الاثنين معاً (نايف وأحمد) بلا تمييز بين المعاملات — لذا يُطبَّق
// كلا المعرّفين دفعة واحدة على كل السجلات المعتمدة التي ينقصها توقيع، بلا
// إعادة كتابة أي توقيع مسجَّل بالفعل.
export async function POST(request: Request) {
  try {
    const currentUser = getSessionUser()
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!isSuperAdmin(currentUser)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const firstReviewerId = String(body.firstReviewerId || '').trim()
    const secondReviewerId = String(body.secondReviewerId || '').trim()
    if (!firstReviewerId || !secondReviewerId) {
      return NextResponse.json({ error: 'يلزم تحديد المراجعين الاثنين.' }, { status: 400 })
    }
    if (firstReviewerId === secondReviewerId) {
      return NextResponse.json({ error: 'يجب أن يكون المراجعان شخصين مختلفين.' }, { status: 400 })
    }

    const [first, second] = await Promise.all([
      prisma.user.findUnique({ where: { id: firstReviewerId } }),
      prisma.user.findUnique({ where: { id: secondReviewerId } }),
    ])
    if (!first || !second) return NextResponse.json({ error: 'أحد المراجعين غير موجود' }, { status: 404 })

    const requestsToUpdate = await prisma.loan.findMany({
      where: { reviewStatus: 'REVIEWED', reviewedById: null },
      select: { id: true, courseId: true },
    })
    const settlementsToUpdate = await prisma.loan.findMany({
      where: { isSettled: true, settlementStatus: 'APPROVED', settlementReviewedById: null },
      select: { id: true, courseId: true },
    })

    const requestsResult = await prisma.loan.updateMany({
      where: { reviewStatus: 'REVIEWED', reviewedById: null },
      data: { reviewedById: firstReviewerId, secondReviewedById: secondReviewerId },
    })

    const settlementsResult = await prisma.loan.updateMany({
      where: { isSettled: true, settlementStatus: 'APPROVED', settlementReviewedById: null },
      data: { settlementReviewedById: firstReviewerId, secondSettlementReviewedById: secondReviewerId },
    })

    // مزامنة عناصر إقفال الدورات للمعاملات المرتبطة بدورة — التحديث الجماعي لا يُشغّل المزامنة تلقائياً
    const linkedRequestIds = requestsToUpdate.filter((l) => l.courseId).map((l) => l.id)
    const linkedSettlementIds = settlementsToUpdate.filter((l) => l.courseId).map((l) => l.id)

    if (linkedRequestIds.length) {
      const linkedRequests = await prisma.loan.findMany({ where: { id: { in: linkedRequestIds } }, include: fullLoanInclude })
      await Promise.all(linkedRequests.map((l) => syncClosureElementFromPrint('advance_req', l)))
    }
    if (linkedSettlementIds.length) {
      const linkedSettlements = await prisma.loan.findMany({ where: { id: { in: linkedSettlementIds } }, include: fullLoanInclude })
      await Promise.all(linkedSettlements.map((l) => syncClosureElementFromPrint('settlement', l)))
    }

    return NextResponse.json({
      ok: true,
      firstReviewerName: first.fullName,
      secondReviewerName: second.fullName,
      requestsUpdated: requestsResult.count,
      settlementsUpdated: settlementsResult.count,
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'فشل التنفيذ' }, { status: 500 })
  }
}

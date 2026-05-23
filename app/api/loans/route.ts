// app/api/loans/route.ts — النسخة المحدّثة
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canManageAllLoans, getSessionUser } from '@/lib/auth'
import { ensureDatabaseSetup } from '@/lib/database-setup'
import { dashboardLoanInclude } from '@/lib/loan-selects'
import { calcSettlementDeadline } from '@/lib/settlement-deadline'
import { notifyNewLoan } from '@/lib/notifications'
import type { DestinationCategory } from '@/lib/settlement-deadline'

// ─────────────────────────────────────────────────────────────
// الرقم المرجعي — atomic بدون race condition
// ─────────────────────────────────────────────────────────────
async function getNextRefNumber(): Promise<string> {
  const result = await prisma.$queryRaw<Array<{ ref: string }>>`
    SELECT get_next_loan_ref() AS ref
  `
  return result[0]?.ref ?? `وت/26/${Date.now()}`
}

// ─────────────────────────────────────────────────────────────
// GET /api/loans
// ─────────────────────────────────────────────────────────────
export async function GET() {
  try {
    await ensureDatabaseSetup()
    const currentUser = getSessionUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const loans = await prisma.loan.findMany({
      where: canManageAllLoans(currentUser)
        ? undefined
        : { userId: currentUser.userId },
      orderBy: { createdAt: 'desc' },
      include: dashboardLoanInclude,
    })

    return NextResponse.json(loans)
  } catch {
    return NextResponse.json({ error: 'Failed to load loans' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/loans — إنشاء سلفة جديدة
// ─────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    await ensureDatabaseSetup()
    const currentUser = getSessionUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // ─── قاعدة السلفة الواحدة ────────────────────────────────
    // تحقق: هل للموظف سلفة نشطة غير مسواة؟
    const activeLoan = await prisma.loan.findFirst({
      where: {
        userId: currentUser.userId,
        isSettled: false,
      },
      select: {
        id: true,
        refNumber: true,
        exceptionGrantedById: true,
      },
    })

    if (activeLoan) {
      // هل تم منح استثناء؟
      if (!activeLoan.exceptionGrantedById) {
        return NextResponse.json(
          {
            error: `لديك سلفة نشطة غير مسواة (${activeLoan.refNumber}). يجب تسويتها أولاً أو الحصول على استثناء من المدير.`,
            code: 'ACTIVE_LOAN_EXISTS',
            existingLoanRef: activeLoan.refNumber,
          },
          { status: 409 },
        )
      }

      // إذا كان هناك استثناء، تحقق أن السلفتين لا تزيدان عن اثنتين
      const totalActive = await prisma.loan.count({
        where: {
          userId: currentUser.userId,
          isSettled: false,
        },
      })

      if (totalActive >= 2) {
        return NextResponse.json(
          {
            error: 'لا يمكن تجاوز سلفتين نشطتين في آنٍ واحد حتى مع الاستثناء.',
            code: 'MAX_LOANS_REACHED',
          },
          { status: 409 },
        )
      }
    }

    // ─── حساب المهلة ─────────────────────────────────────────
    const destinationCategory: DestinationCategory =
      body.destinationCategory ?? 'DOMESTIC'

    const endDate = new Date(body.endDate)
    const settlementDeadline = calcSettlementDeadline(endDate, destinationCategory)

    // ─── الرقم المرجعي atomic ─────────────────────────────────
    const refNumber = await getNextRefNumber()

    // ─── إنشاء السلفة ─────────────────────────────────────────
    const items = Array.isArray(body.items) ? body.items : []

    const loan = await prisma.loan.create({
      data: {
        refNumber,
        userId: currentUser.userId,
        employee: currentUser.fullName,
        activity: String(body.activity ?? '').trim(),
        location: String(body.location ?? '').trim(),
        amount: Number(body.amount ?? 0),
        budgetApproved:
          typeof body.budgetApproved === 'boolean' ? body.budgetApproved : null,
        destinationCategory,
        settlementDeadline,
        files: body.files ?? undefined,
        startDate: new Date(body.startDate),
        endDate,
        courseId: body.courseId ?? null,
        courseCode: body.courseCode ?? null,
        items: {
          create: items.map((item: { category: string; amount: number }) => ({
            category: item.category,
            amount: item.amount,
          })),
        },
      },
      include: dashboardLoanInclude,
    })

    // ─── إشعار المراجعين ──────────────────────────────────────
    void notifyNewLoan({
      id: loan.id,
      refNumber: loan.refNumber,
      employee: loan.employee,
      amount: loan.amount,
      activity: loan.activity,
    }).catch(console.error)

    return NextResponse.json(loan)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error creating loan' },
      { status: 500 },
    )
  }
}

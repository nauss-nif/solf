// app/api/loans/route.ts — النسخة المحدّثة
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canManageAllLoans, getSessionUser } from '@/lib/auth'
import { ensureDatabaseSetup } from '@/lib/database-setup'
import { dashboardLoanInclude } from '@/lib/loan-selects'
import { calcSettlementDeadline } from '@/lib/settlement-deadline'
import { notifyNewLoan } from '@/lib/notifications'
import { validateLoanRequestFiles } from '@/lib/loan-form-options'
import type { DestinationCategory } from '@/lib/settlement-deadline'

const SEQUENCE_ID = 'singleton'

type LoanSequenceClient = {
  loanSequence: typeof prisma.loanSequence
  loan: typeof prisma.loan
}

function formatRef(nextNumber: number) {
  return `وت/26/${String(nextNumber).padStart(4, '0')}`
}

// ─────────────────────────────────────────────────────────────
// الرقم المرجعي — atomic بدون race condition
// ─────────────────────────────────────────────────────────────
async function getNextRefNumber(db: LoanSequenceClient): Promise<string> {
  await db.loanSequence.upsert({
    where: { id: SEQUENCE_ID },
    update: {},
    create: { id: SEQUENCE_ID, lastNumber: 0 },
  })

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const sequence = await db.loanSequence.update({
      where: { id: SEQUENCE_ID },
      data: { lastNumber: { increment: 1 } },
      select: { lastNumber: true },
    })
    const ref = formatRef(sequence.lastNumber)

    const existing = await db.loan.findUnique({
      where: { refNumber: ref },
      select: { id: true },
    })
    if (!existing) return ref
  }

  throw new Error('تعذر توليد رقم مرجعي غير مستخدم.')
}

// ─────────────────────────────────────────────────────────────
// GET /api/loans
// ─────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  try {
    await ensureDatabaseSetup()
    const currentUser = getSessionUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const scope = new URL(request.url).searchParams.get('scope')
    const loans = await prisma.loan.findMany({
      where: canManageAllLoans(currentUser) && scope !== 'own'
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
    const filesError = validateLoanRequestFiles(body.files)
    if (filesError) return NextResponse.json({ error: filesError }, { status: 400 })

    const activeLoansCount = await prisma.loan.count({
      where: {
        userId: currentUser.userId,
        isSettled: false,
      },
    })

    if (activeLoansCount >= 3) {
      return NextResponse.json(
        {
          error: 'لديك 3 سلف نشطة غير مسواة. يجب تسوية إحدى السلف قبل رفع طلب جديد.',
          code: 'MAX_ACTIVE_LOANS_REACHED',
        },
        { status: 409 },
      )
    }

    // ─── حساب المهلة ─────────────────────────────────────────
    const destinationCategory: DestinationCategory =
      body.destinationCategory ?? 'DOMESTIC'

    const endDate = new Date(body.endDate)
    const settlementDeadline = calcSettlementDeadline(endDate, destinationCategory)

    // ─── إنشاء السلفة ─────────────────────────────────────────
    const items = Array.isArray(body.items) ? body.items : []

    const loan = await prisma.$transaction(async (tx) => {
      const refNumber = await getNextRefNumber(tx)

      return tx.loan.create({
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
    }, { timeout: 20000 })

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

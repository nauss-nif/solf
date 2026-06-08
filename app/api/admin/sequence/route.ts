import { NextResponse } from 'next/server'
import { getSessionUser, isSuperAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const SEQUENCE_ID = 'singleton'
const REF_PREFIX = 'وت/26'

function formatRef(nextNumber: number) {
  return `${REF_PREFIX}/${String(nextNumber).padStart(4, '0')}`
}

async function findNextAvailableNumber(lastNumber: number) {
  for (let nextNumber = lastNumber + 1; nextNumber < lastNumber + 101; nextNumber += 1) {
    const existing = await prisma.loan.findUnique({
      where: { refNumber: formatRef(nextNumber) },
      select: { id: true },
    })
    if (!existing) return nextNumber
  }

  throw new Error('تعذر تحديد الرقم المرجعي القادم.')
}

function requireSuperAdminResponse() {
  const currentUser = getSessionUser()
  if (!isSuperAdmin(currentUser)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { currentUser }
}

export async function GET() {
  try {
    const auth = requireSuperAdminResponse()
    if ('error' in auth) return auth.error

    const sequence = await prisma.loanSequence.upsert({
      where: { id: SEQUENCE_ID },
      update: {},
      create: { id: SEQUENCE_ID, lastNumber: 0 },
    })

    const nextNumber = await findNextAvailableNumber(sequence.lastNumber)

    return NextResponse.json({
      lastNumber: sequence.lastNumber,
      nextNumber,
      nextRefNumber: formatRef(nextNumber),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load sequence' },
      { status: 500 },
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = requireSuperAdminResponse()
    if ('error' in auth) return auth.error

    const body = await request.json()
    const lastNumber = Number(body.lastNumber)

    if (!Number.isInteger(lastNumber) || lastNumber < 0) {
      return NextResponse.json(
        { error: 'أدخل آخر رقم مستخدم كرقم صحيح موجب.' },
        { status: 400 },
      )
    }

    const sequence = await prisma.loanSequence.upsert({
      where: { id: SEQUENCE_ID },
      update: { lastNumber },
      create: { id: SEQUENCE_ID, lastNumber },
    })

    const nextNumber = await findNextAvailableNumber(sequence.lastNumber)

    return NextResponse.json({
      lastNumber: sequence.lastNumber,
      nextNumber,
      nextRefNumber: formatRef(nextNumber),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update sequence' },
      { status: 500 },
    )
  }
}

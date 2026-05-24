import { NextResponse } from 'next/server'
import { getSessionUser, isSuperAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const SEQUENCE_ID = 'singleton'
const REF_PREFIX = 'وت/26'

function formatRef(nextNumber: number) {
  return `${REF_PREFIX}/${String(nextNumber).padStart(4, '0')}`
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

    return NextResponse.json({
      lastNumber: sequence.lastNumber,
      nextNumber: sequence.lastNumber + 1,
      nextRefNumber: formatRef(sequence.lastNumber + 1),
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

    return NextResponse.json({
      lastNumber: sequence.lastNumber,
      nextNumber: sequence.lastNumber + 1,
      nextRefNumber: formatRef(sequence.lastNumber + 1),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update sequence' },
      { status: 500 },
    )
  }
}

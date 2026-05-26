type ClosureSyncType = 'advance_req' | 'settlement'

type ClosureSyncLoan = {
  id: string
  refNumber: string
  courseId: string | null
  employee: string
  amount: number
  printedAt: Date | string | null
  user?: { email: string } | null
  settlement?: {
    total: number
  } | null
}

const CLOSURE_WEBHOOK_URL = process.env.CLOSURE_WEBHOOK_URL ?? ''
const CLOSURE_WEBHOOK_SECRET = process.env.CLOSURE_WEBHOOK_SECRET ?? process.env.WEBHOOK_SECRET ?? ''

export async function syncClosureElementFromPrint(type: ClosureSyncType, loan: ClosureSyncLoan) {
  if (!loan.courseId) return { skipped: true, reason: 'loan_not_linked_to_course' }
  if (!CLOSURE_WEBHOOK_URL || !CLOSURE_WEBHOOK_SECRET) {
    console.warn('[ClosureIntegration] Missing CLOSURE_WEBHOOK_URL or CLOSURE_WEBHOOK_SECRET')
    return { skipped: true, reason: 'integration_not_configured' }
  }

  const printedAt = loan.printedAt ? new Date(loan.printedAt).toISOString() : new Date().toISOString()
  const payload = {
    type,
    courseId: loan.courseId,
    employeeEmail: loan.user?.email,
    referenceNumber: loan.refNumber,
    amount: loan.amount,
    advanceAmount: type === 'settlement' ? loan.amount : undefined,
    spentAmount: type === 'settlement' ? loan.settlement?.total : undefined,
    printedAt,
    solfLoanId: loan.id,
  }

  try {
    const response = await fetch(CLOSURE_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${CLOSURE_WEBHOOK_SECRET}`,
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    })

    const result = await response.json().catch(() => ({}))
    if (!response.ok || !result?.ok) {
      console.error('[ClosureIntegration] Closure sync failed:', {
        status: response.status,
        type,
        courseId: loan.courseId,
        refNumber: loan.refNumber,
        result,
      })
      return { ok: false, status: response.status, result }
    }

    console.info('[ClosureIntegration] Closure sync accepted:', {
      type,
      courseId: loan.courseId,
      refNumber: loan.refNumber,
      action: result.action,
      trackingId: result.trackingId,
    })
    return { ok: true, result }
  } catch (error) {
    console.error('[ClosureIntegration] Closure sync error:', error)
    return { ok: false, error: error instanceof Error ? error.message : 'Closure sync error' }
  }
}

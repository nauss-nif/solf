import { NextResponse } from 'next/server'
import { buildSettlementDocx } from '@/lib/document-templates'
import { getAuthorizedLoan } from '@/lib/loan-records'

export async function GET(
  _: Request,
  { params }: { params: { id: string } },
) {
  try {
    const loan = await getAuthorizedLoan(params.id)

    if (!loan.settlement) {
      return NextResponse.json({ error: 'Settlement not found' }, { status: 404 })
    }

    const file = await buildSettlementDocx(loan)
    const filename = `settlement-${loan.refNumber.replaceAll('/', '-')}.doc`

    return new NextResponse(file, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, max-age=0, must-revalidate',
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to export settlement document' },
      { status: 500 },
    )
  }
}

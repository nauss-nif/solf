import { NextResponse } from 'next/server'
import { buildSettlementDocx } from '@/lib/document-templates'
import { getAuthorizedLoan } from '@/lib/loan-records'

export async function GET(
  _: Request,
  { params }: { params: { id: string } },
) {
  const loan = await getAuthorizedLoan(params.id)

  if (!loan.settlement) {
    return NextResponse.json({ error: 'Settlement not found' }, { status: 404 })
  }

  const file = await buildSettlementDocx(loan)
  const filename = `settlement-${loan.refNumber.replaceAll('/', '-')}.docx`

  return new NextResponse(file, {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(file.byteLength),
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}

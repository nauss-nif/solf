import { NextResponse } from 'next/server'
import { buildLoanRequestDocx } from '@/lib/document-templates'
import { getAuthorizedLoan } from '@/lib/loan-records'

function toSafeFilename(value: string) {
  return value.replaceAll('/', '-').replace(/[^\x20-\x7E]/g, '-').replace(/-+/g, '-')
}

export async function GET(
  _: Request,
  { params }: { params: { id: string } },
) {
  try {
    const loan = await getAuthorizedLoan(params.id, { markPrinted: true })
    const file = await buildLoanRequestDocx(loan)
    const filename = `loan-${toSafeFilename(loan.refNumber)}.doc`

    return new NextResponse(file, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, max-age=0, must-revalidate',
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to export loan document' },
      { status: 500 },
    )
  }
}

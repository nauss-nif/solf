import { NextResponse } from 'next/server'
import { buildLoanRequestDocx } from '@/lib/document-templates'
import { getAuthorizedLoan } from '@/lib/loan-records'

export async function GET(
  _: Request,
  { params }: { params: { id: string } },
) {
  const loan = await getAuthorizedLoan(params.id, { markPrinted: true })
  const file = await buildLoanRequestDocx(loan)
  const filename = `loan-${loan.refNumber.replaceAll('/', '-')}.doc`

  return new NextResponse(file, {
    headers: {
      'Content-Type': 'application/msword; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(file.byteLength),
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}

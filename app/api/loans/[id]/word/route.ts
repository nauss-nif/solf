import { NextResponse } from 'next/server'
import { buildLoanRequestDocx } from '@/lib/document-templates'
import { getAuthorizedLoan } from '@/lib/loan-records'

export async function GET(
  _: Request,
  { params }: { params: { id: string } },
) {
  const loan = await getAuthorizedLoan(params.id)
  const file = await buildLoanRequestDocx(loan)

  return new NextResponse(file, {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="loan-${loan.refNumber.replaceAll('/', '-')}.docx"`,
    },
  })
}

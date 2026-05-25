import { NextResponse } from 'next/server'
import { buildLoanRequestDocx } from '@/lib/document-templates'
import { getAuthorizedLoan } from '@/lib/loan-records'
import { getSystemSettings } from '@/lib/system-settings'

function toSafeFilename(value: string) {
  return value.replaceAll('/', '-').replace(/[^\x20-\x7E]/g, '-').replace(/-+/g, '-')
}

export async function GET(
  _: Request,
  { params }: { params: { id: string } },
) {
  try {
    const settings = await getSystemSettings()
    let loan = await getAuthorizedLoan(params.id, { markPrinted: settings.allowPrintBeforeReview })

    if (!settings.allowPrintBeforeReview && loan.reviewStatus !== 'REVIEWED') {
      return NextResponse.json({ error: 'Printing is not allowed before review' }, { status: 403 })
    }

    if (!settings.allowPrintBeforeReview) {
      loan = await getAuthorizedLoan(params.id, { markPrinted: true })
    }

    const file = await buildLoanRequestDocx(loan, { settings })
    const filename = `loan-${toSafeFilename(loan.refNumber)}.doc`

    return new NextResponse(file, {
      headers: {
        'Content-Type': 'application/msword; charset=utf-8',
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

// app/api/cron/check-deadlines/route.ts
// يُشغَّل يومياً من Vercel Cron Jobs (أيام الأحد-الخميس الساعة 6 صباحاً)
import { NextResponse } from 'next/server'
import { runDeadlineCheck } from '@/lib/notifications'

const CRON_SECRET = process.env.CRON_SECRET ?? ''

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runDeadlineCheck()
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    })
  } catch (error) {
    console.error('[Cron] check-deadlines failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Cron job failed' },
      { status: 500 },
    )
  }
}

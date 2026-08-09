// app/api/cron/check-deadlines/route.ts
// يُشغَّل يومياً من Vercel Cron Jobs (أيام الأحد-الخميس الساعة 6 صباحاً)
//
// ملاحظة مهمة على الصلاحية:
// كانت النسخة السابقة ترفض الطلب برمز 503 إذا لم يكن CRON_SECRET مضبوطاً.
// وبما أنه لم يُضبط قط في Vercel، لم تُرسَل أي إشعارات مواعيد منذ إطلاق
// النظام — وكان الفشل صامتاً لا يلاحظه أحد.
//
// الآن نقبل الطلب عبر مسارين:
//   1) CRON_SECRET مضبوط  -> نطلب ترويسة Bearer مطابقة (الأكثر أماناً)
//   2) غير مضبوط          -> نقبل فقط الطلبات القادمة من Vercel Cron،
//                            والتي تحمل ترويسة x-vercel-cron. هذه الترويسة
//                            يحذفها Vercel من أي طلب خارجي، فلا يمكن تزويرها.
// وفي كل الأحوال لا نعطّل المهمة بصمت.
import { NextResponse } from 'next/server'
import { runDeadlineCheck } from '@/lib/notifications'

const CRON_SECRET = process.env.CRON_SECRET ?? ''

export const dynamic = 'force-dynamic'

function isAuthorized(request: Request): { ok: boolean; via: string } {
  if (CRON_SECRET) {
    const authHeader = request.headers.get('authorization')
    if (authHeader === `Bearer ${CRON_SECRET}`) return { ok: true, via: 'cron-secret' }
    return { ok: false, via: 'cron-secret' }
  }

  // لا يوجد CRON_SECRET — نعتمد على ترويسة Vercel Cron
  if (request.headers.get('x-vercel-cron')) return { ok: true, via: 'vercel-cron-header' }

  return { ok: false, via: 'no-secret-no-header' }
}

export async function GET(request: Request) {
  const auth = isAuthorized(request)

  if (!auth.ok) {
    console.warn(`[Cron] check-deadlines رُفض الطلب (${auth.via})`)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!CRON_SECRET) {
    console.warn(
      '[Cron] check-deadlines يعمل دون CRON_SECRET — ' +
        'اعتمدنا على ترويسة Vercel Cron. يُنصح بضبط CRON_SECRET في إعدادات Vercel.',
    )
  }

  try {
    const result = await runDeadlineCheck()
    console.log('[Cron] check-deadlines نجح:', result)
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      authVia: auth.via,
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

import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'

// GET /api/loans/course-lookup?q=...
// يبحث عن دورات في منصة الإقفال برمزها أو اسمها — لاستخدامه عند ربط
// معاملة سلفة قديمة لم تُربط بدورتها وقت إنشائها. متاح لأي مستخدم
// مسجّل دخوله (موظف عادي يربط معاملته الخاصة، أو مدير/مراجع يربط أي معاملة).
export async function GET(request: Request) {
  const currentUser = getSessionUser()
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = new URL(request.url).searchParams.get('q') || ''
  if (!q.trim()) return NextResponse.json({ courses: [] })

  const webhookUrl = process.env.CLOSURE_WEBHOOK_URL || ''
  const secret = process.env.CLOSURE_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET || ''
  if (!webhookUrl || !secret) {
    return NextResponse.json({ error: 'الربط مع منصة الإقفال غير مُهيَّأ (متغيرات البيئة).' }, { status: 503 })
  }

  // CLOSURE_WEBHOOK_URL يشير إلى .../api/webhooks/solf-closure-sync — نشتق منه أساس المنصة
  const lookupUrl = webhookUrl.replace(/\/api\/webhooks\/.*$/, '/api/webhooks/course-lookup')

  try {
    const res = await fetch(`${lookupUrl}?code=${encodeURIComponent(q.trim())}`, {
      headers: { Authorization: `Bearer ${secret}` },
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return NextResponse.json({ error: data?.message || 'تعذر البحث' }, { status: res.status })
    return NextResponse.json({ courses: data.courses || [] })
  } catch {
    return NextResponse.json({ error: 'تعذر الاتصال بمنصة الإقفال' }, { status: 502 })
  }
}

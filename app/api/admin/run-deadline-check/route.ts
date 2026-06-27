import { NextResponse } from 'next/server'
import { canManageAllLoans, getSessionUser } from '@/lib/auth'
import { runDeadlineCheck } from '@/lib/notifications'

// POST /api/admin/run-deadline-check
// تشغيل فوري لفحص مواعيد التسوية وإرسال التذكيرات/الإنذارات — شبكة أمان مستقلة
// عن مهمة فيرسل المجدولة (Cron)، تتيح للمدير التأكد من عمل النظام فوراً
// بصلاحية جلسته الخاصة بدل الاعتماد فقط على CRON_SECRET.
export async function POST() {
  const currentUser = getSessionUser()
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageAllLoans(currentUser)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const result = await runDeadlineCheck()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'فشل تشغيل الفحص' }, { status: 500 })
  }
}

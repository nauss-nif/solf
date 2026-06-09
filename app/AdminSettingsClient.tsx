'use client'

import { useEffect, useState, useTransition } from 'react'

type SequenceState = { lastNumber: number; nextNumber: number; nextRefNumber: string }
type SystemSettings = { allowPrintBeforeReview: boolean; trainingVicePresidentName: string; financialControllerName: string }
type EmailStatus = { resendConfigured: boolean; fromEmail: string; adminEmail: string; provider: string; scopes: string[] }

export default function AdminSettingsClient() {
  const [loadError, setLoadError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [isPending, startTransition] = useTransition()
  const [sequence, setSequence] = useState<SequenceState | null>(null)
  const [sequenceDraft, setSequenceDraft] = useState('')
  const [settings, setSettings] = useState<SystemSettings | null>(null)
  const [settingsDraft, setSettingsDraft] = useState<SystemSettings | null>(null)
  const [emailStatus, setEmailStatus] = useState<EmailStatus | null>(null)
  const [testEmail, setTestEmail] = useState('')
  const [broadcastAudience, setBroadcastAudience] = useState('reviewers')
  const [broadcastCustomEmails, setBroadcastCustomEmails] = useState('')
  const [broadcastSubject, setBroadcastSubject] = useState('تم تعيينكم كمراجعين في منصة إدارة السلف')
  const [broadcastTitle, setBroadcastTitle] = useState('تم تعيينكم كمراجعين في منصة إدارة السلف')
  const [broadcastMessage, setBroadcastMessage] = useState('السلام عليكم،\n\nتم تعيينكم كمراجعين في منصة إدارة السلف، ونأمل الدخول إلى المنصة وإنشاء حساب رسمي، ثم مباشرة مراجعة معاملات طلبات السلف وتسويتها حسب الإجراءات المعتمدة.\n\nشاكرين تعاونكم.')
  const [broadcastResults, setBroadcastResults] = useState<Array<{ email: string; fullName: string; ok: boolean; id?: string; status?: number; error?: string }>>([])

  async function loadSequence() {
    const res = await fetch('/api/admin/sequence', { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok) { setLoadError(data.error ?? 'تعذر تحميل تسلسل المعاملات'); return }
    setSequence(data)
    setSequenceDraft(String(data.lastNumber))
  }

  async function loadSettings() {
    const res = await fetch('/api/admin/settings', { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok) { setLoadError(data.error ?? 'تعذر تحميل إعدادات النظام'); return }
    setSettings(data)
    setSettingsDraft(data)
  }

  async function loadEmailStatus() {
    const res = await fetch('/api/admin/email-test', { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok) return
    setEmailStatus(data)
  }

  useEffect(() => { void loadSequence(); void loadSettings(); void loadEmailStatus() }, [])

  function showSuccess(msg: string) { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 2500) }

  return (
    <div className="space-y-5 animate-fade-up">
      {loadError && <div className="alert alert-error">{loadError}</div>}
      {successMsg && <div className="alert alert-success">{successMsg}</div>}

      <div className="section-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-bold" style={{ color: '#1F3F40' }}>إعدادات السلف</h2>
            <p className="mt-1 text-sm" style={{ color: '#5A5A5A' }}>
              تتحكم هذه الإعدادات في أرقام المعاملات والأسماء الرسمية الظاهرة في نماذج السلف.
            </p>
            {settings && (
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <span className="badge badge-neutral">الطباعة قبل الاعتماد: {settings.allowPrintBeforeReview ? 'نعم' : 'لا'}</span>
                <span className="badge badge-primary">وكيل الجامعة: {settings.trainingVicePresidentName}</span>
              </div>
            )}
          </div>
          <div className="grid w-full gap-3 lg:max-w-3xl lg:grid-cols-[auto_1fr_1fr_auto] lg:items-end">
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={settingsDraft?.allowPrintBeforeReview ?? true}
                onChange={(e) => setSettingsDraft((prev) => prev ? { ...prev, allowPrintBeforeReview: e.target.checked } : prev)}
              />
              <span>السماح بالطباعة قبل الاعتماد</span>
            </label>
            <label className="block">
              <span className="field-label">اسم وكيل الجامعة للتدريب</span>
              <input
                type="text"
                value={settingsDraft?.trainingVicePresidentName ?? ''}
                onChange={(e) => setSettingsDraft((prev) => prev ? { ...prev, trainingVicePresidentName: e.target.value } : prev)}
                className="input-shell"
              />
            </label>
            <label className="block">
              <span className="field-label">اسم المراقب المالي</span>
              <input
                type="text"
                value={settingsDraft?.financialControllerName ?? ''}
                onChange={(e) => setSettingsDraft((prev) => prev ? { ...prev, financialControllerName: e.target.value } : prev)}
                className="input-shell"
              />
            </label>
            <button
              type="button"
              disabled={isPending || !settingsDraft}
              className="btn btn-primary"
              onClick={() => {
                if (!settingsDraft) return
                startTransition(async () => {
                  const res = await fetch('/api/admin/settings', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(settingsDraft),
                  })
                  const data = await res.json().catch(() => ({}))
                  if (!res.ok) { setLoadError(data.error ?? 'تعذر تحديث الإعدادات'); return }
                  setSettings(data); setSettingsDraft(data); showSuccess('تم تحديث إعدادات النظام.')
                })
              }}
            >
              حفظ الإعدادات
            </button>
          </div>
        </div>
      </div>

      <div className="section-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-bold" style={{ color: '#1F3F40' }}>تسلسل أرقام معاملات السلف</h2>
            <p className="mt-1 text-sm" style={{ color: '#5A5A5A' }}>
              استخدم هذا الحقل لضبط آخر رقم مستخدم. إذا كان آخر رقم يدوي هو 27 فسيكون الطلب القادم {sequence?.nextRefNumber ?? 'وت/26/0028'}.
            </p>
            {sequence && (
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <span className="badge badge-neutral">آخر رقم: {sequence.lastNumber}</span>
                <span className="badge badge-primary">القادم: {sequence.nextRefNumber}</span>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="block">
              <span className="field-label">آخر رقم مستخدم</span>
              <input
                type="number"
                min="0"
                value={sequenceDraft}
                onChange={(e) => setSequenceDraft(e.target.value)}
                className="input-shell"
                style={{ width: 180 }}
              />
            </label>
            <button
              type="button"
              disabled={isPending}
              className="btn btn-primary"
              onClick={() => {
                startTransition(async () => {
                  const res = await fetch('/api/admin/sequence', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ lastNumber: Number(sequenceDraft) }),
                  })
                  const data = await res.json().catch(() => ({}))
                  if (!res.ok) { setLoadError(data.error ?? 'تعذر تحديث التسلسل'); return }
                  setSequence(data); setSequenceDraft(String(data.lastNumber)); showSuccess('تم تحديث تسلسل المعاملات.')
                })
              }}
            >
              حفظ التسلسل
            </button>
          </div>
        </div>
      </div>

      <div className="section-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="font-bold" style={{ color: '#1F3F40' }}>إعدادات البريد والإشعارات</h2>
            <p className="mt-1 text-sm" style={{ color: '#5A5A5A' }}>
              فحص ربط Resend ونطاق رسائل البريد التي ترسلها المنصة.
            </p>
            {emailStatus && (
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <span className={emailStatus.resendConfigured ? 'badge badge-success' : 'badge badge-danger'}>
                  Resend: {emailStatus.resendConfigured ? 'مفعّل' : 'غير مفعّل'}
                </span>
                <span className="badge badge-neutral">المرسل: {emailStatus.fromEmail}</span>
                <span className="badge badge-neutral">بريد الإدارة: {emailStatus.adminEmail}</span>
              </div>
            )}
            {emailStatus && (
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {emailStatus.scopes.map((scope) => (
                  <div key={scope} className="rounded-lg px-3 py-2 text-sm" style={{ background: '#F9F9F9', border: '1px solid #DADBD9', color: '#5A5A5A' }}>
                    {scope}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex w-full flex-col gap-2 lg:max-w-xs">
            <input
              type="email"
              value={testEmail}
              onChange={(event) => setTestEmail(event.target.value)}
              className="input-shell"
              placeholder="بريد الاختبار"
            />
            <button
              type="button"
              disabled={isPending || !emailStatus?.resendConfigured}
              className="btn btn-primary"
              onClick={() => {
                startTransition(async () => {
                  const res = await fetch('/api/admin/email-test', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ to: testEmail.trim() || undefined }),
                  })
                  const data = await res.json().catch(() => ({}))
                  if (!res.ok || !data.sent) { setLoadError('تعذر إرسال بريد الاختبار. تحقق من RESEND_API_KEY والنطاق المرسل.'); return }
                  showSuccess(`تم إرسال بريد اختبار إلى ${data.to}.`)
                })
              }}
            >
              إرسال بريد اختبار
            </button>
          </div>
        </div>
      </div>

      <div className="section-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="font-bold" style={{ color: '#1F3F40' }}>إرسال بريد مخصص</h2>
            <p className="mt-1 text-sm" style={{ color: '#5A5A5A' }}>
              يرسل المدير رسالة بريدية حسب الفئة المختارة باستخدام قالب المنصة الرسمي. يمكن استخدام {'{{name}}'} داخل الرسالة لإظهار اسم المستلم.
            </p>
          </div>
          <div className="grid w-full gap-3 lg:max-w-2xl">
            <label className="block">
              <span className="field-label">المستلمون</span>
              <select value={broadcastAudience} onChange={(event) => setBroadcastAudience(event.target.value)} className="input-shell">
                <option value="reviewers">المراجعون</option>
                <option value="admins">المديرون</option>
                <option value="employees">الموظفون</option>
                <option value="all">جميع المستخدمين النشطين</option>
                <option value="custom">بريد محدد</option>
              </select>
            </label>
            {broadcastAudience === 'custom' && (
              <label className="block">
                <span className="field-label">البريد المحدد</span>
                <textarea
                  value={broadcastCustomEmails}
                  onChange={(event) => setBroadcastCustomEmails(event.target.value)}
                  className="input-shell min-h-[90px]"
                  placeholder="أدخل بريداً واحداً أو أكثر، وافصل بينها بفاصلة أو سطر جديد"
                />
              </label>
            )}
            <label className="block">
              <span className="field-label">موضوع البريد</span>
              <input value={broadcastSubject} onChange={(event) => setBroadcastSubject(event.target.value)} className="input-shell" />
            </label>
            <label className="block">
              <span className="field-label">عنوان الرسالة داخل البريد</span>
              <input value={broadcastTitle} onChange={(event) => setBroadcastTitle(event.target.value)} className="input-shell" />
            </label>
            <label className="block">
              <span className="field-label">نص الرسالة</span>
              <textarea value={broadcastMessage} onChange={(event) => setBroadcastMessage(event.target.value)} className="input-shell min-h-[170px]" />
            </label>
            <button
              type="button"
              disabled={isPending || !emailStatus?.resendConfigured}
              className="btn btn-primary"
              onClick={() => {
                if (!window.confirm('سيتم إرسال البريد للفئة المختارة. هل تريد المتابعة؟')) return
                startTransition(async () => {
                  const res = await fetch('/api/admin/email-broadcast', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ audience: broadcastAudience, customEmails: broadcastCustomEmails, subject: broadcastSubject, title: broadcastTitle, message: broadcastMessage }),
                  })
                  const data = await res.json().catch(() => ({}))
                  setBroadcastResults(Array.isArray(data.results) ? data.results : [])
                  if (!res.ok || !data.success) { setLoadError(data.error ?? 'تعذر إرسال البريد المخصص.'); return }
                  showSuccess(`تم إرسال البريد إلى ${data.sent} من ${data.total} مستلم.`)
                })
              }}
            >
              إرسال البريد المخصص
            </button>
            {broadcastResults.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                <p className="mb-2 font-semibold" style={{ color: '#1F3F40' }}>نتيجة الإرسال لكل مستلم</p>
                <div className="max-h-56 space-y-2 overflow-y-auto">
                  {broadcastResults.map((result) => (
                    <div key={result.email} className="rounded-lg px-3 py-2" style={{ background: result.ok ? '#ECFDF5' : '#FEF2F2', color: result.ok ? '#166534' : '#991B1B' }}>
                      <strong>{result.fullName}</strong> — {result.email}: {result.ok ? `قُبل من Resend${result.id ? ` (${result.id})` : ''}` : `فشل${result.status ? ` (${result.status})` : ''}${result.error ? `: ${result.error}` : ''}`}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

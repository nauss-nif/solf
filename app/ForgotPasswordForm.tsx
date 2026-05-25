'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'

export default function ForgotPasswordForm() {
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState<'request' | 'confirm' | 'done'>('request')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  function requestCode() {
    setError('')
    setMessage('')
    startTransition(async () => {
      const res = await fetch('/api/auth/password-reset/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? 'تعذر إرسال كود الاستعادة'); return }
      setMessage('إذا كان البريد مسجلاً فسيصلك كود استعادة كلمة المرور خلال لحظات.')
      setStep('confirm')
    })
  }

  function confirmReset() {
    setError('')
    setMessage('')
    startTransition(async () => {
      const res = await fetch('/api/auth/password-reset/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code, password, passwordConfirm }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? 'تعذر تحديث كلمة المرور'); return }
      setStep('done')
      setMessage('تم تحديث كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول.')
    })
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault()
        if (step === 'request') requestCode()
        if (step === 'confirm') confirmReset()
      }}
    >
      <div>
        <label className="field-label">البريد الإلكتروني المسجل</label>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="input-shell"
          placeholder="name@nauss.edu.sa"
          autoComplete="email"
          disabled={step !== 'request'}
          required
        />
      </div>

      {step !== 'request' && step !== 'done' && (
        <>
          <div>
            <label className="field-label">كود الاستعادة</label>
            <input value={code} onChange={(event) => setCode(event.target.value)} className="input-shell" inputMode="numeric" required />
          </div>
          <div>
            <label className="field-label">كلمة المرور الجديدة</label>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="input-shell" autoComplete="new-password" required />
          </div>
          <div>
            <label className="field-label">تأكيد كلمة المرور</label>
            <input type="password" value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} className="input-shell" autoComplete="new-password" required />
          </div>
        </>
      )}

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      {step !== 'done' ? (
        <button type="submit" disabled={isPending} className="btn btn-primary btn-lg w-full">
          {isPending ? 'جاري المعالجة...' : step === 'request' ? 'إرسال كود الاستعادة' : 'تحديث كلمة المرور'}
        </button>
      ) : (
        <Link href="/login" className="btn btn-primary btn-lg w-full">العودة لتسجيل الدخول</Link>
      )}
    </form>
  )
}

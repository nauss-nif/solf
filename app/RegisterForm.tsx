'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export default function RegisterForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    fullName: '', email: '', mobile: '', extension: '',
    password: '', passwordConfirm: '',
  })

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault()
        setError('')
        startTransition(async () => {
          const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
          })
          const data = await response.json().catch(() => ({}))
          if (!response.ok) {
            setError(data.error ?? 'تعذر إنشاء الحساب')
            return
          }
          router.push('/')
        })
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="الاسم الثلاثي *">
          <input value={form.fullName} onChange={update('fullName')}
            className="input-shell" placeholder="محمد عبدالله الأحمد" required />
        </Field>
        <Field label="البريد الإلكتروني الرسمي *">
          <input type="email" value={form.email} onChange={update('email')}
            className="input-shell" placeholder="name@nauss.edu.sa" required />
        </Field>
        <Field label="رقم الجوال *">
          <input value={form.mobile} onChange={update('mobile')}
            className="input-shell" placeholder="05xxxxxxxx" required />
        </Field>
        <Field label="رقم التحويلة الداخلية *">
          <input value={form.extension} onChange={update('extension')}
            className="input-shell" placeholder="1234" required />
        </Field>
        <Field label="كلمة المرور *">
          <input type="password" value={form.password} onChange={update('password')}
            className="input-shell" required />
        </Field>
        <Field label="تأكيد كلمة المرور *">
          <input type="password" value={form.passwordConfirm} onChange={update('passwordConfirm')}
            className="input-shell" required />
        </Field>
      </div>

      <div className="alert alert-info text-xs">
        يُشترط استخدام البريد الإلكتروني الرسمي المنتهي بـ <strong>@nauss.edu.sa</strong> فقط.
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <button type="submit" disabled={isPending} className="btn btn-primary btn-lg w-full">
        {isPending ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            جاري إنشاء الحساب...
          </span>
        ) : 'إنشاء الحساب'}
      </button>
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
    </label>
  )
}

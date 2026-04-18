'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export default function RegisterForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    mobile: '',
    extension: '',
    password: '',
    passwordConfirm: '',
  })

  return (
    <form
      className="space-y-4"
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
        <Field label="الاسم الثلاثي">
          <input
            value={form.fullName}
            onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
            className="input-shell"
          />
        </Field>
        <Field label="البريد الرسمي">
          <input
            type="email"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            className="input-shell"
            placeholder="name@nauss.edu.sa"
          />
        </Field>
        <Field label="رقم الجوال">
          <input
            value={form.mobile}
            onChange={(event) => setForm((current) => ({ ...current, mobile: event.target.value }))}
            className="input-shell"
          />
        </Field>
        <Field label="رقم التحويلة">
          <input
            value={form.extension}
            onChange={(event) => setForm((current) => ({ ...current, extension: event.target.value }))}
            className="input-shell"
          />
        </Field>
        <Field label="كلمة المرور">
          <input
            type="password"
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            className="input-shell"
          />
        </Field>
        <Field label="تأكيد كلمة المرور">
          <input
            type="password"
            value={form.passwordConfirm}
            onChange={(event) =>
              setForm((current) => ({ ...current, passwordConfirm: event.target.value }))
            }
            className="input-shell"
          />
        </Field>
      </div>

      {error && <div className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-2xl bg-primary px-4 py-3 text-base font-medium text-white disabled:opacity-60"
      >
        {isPending ? 'جاري إنشاء الحساب...' : 'إنشاء حساب جديد'}
      </button>
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-normal text-slate-600">{label}</span>
      {children}
    </label>
  )
}

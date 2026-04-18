'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        setError('')

        startTransition(async () => {
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          })

          const data = await response.json().catch(() => ({}))
          if (!response.ok) {
            setError(data.error ?? 'تعذر تسجيل الدخول')
            return
          }

          router.push('/')
          router.refresh()
        })
      }}
    >
      <div>
        <label className="mb-2 block text-sm font-normal text-slate-600">البريد الرسمي</label>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="input-shell"
          placeholder="name@nauss.edu.sa"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-normal text-slate-600">كلمة المرور</label>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="input-shell"
        />
      </div>

      {error && <div className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-2xl bg-primary px-4 py-3 text-base font-medium text-white disabled:opacity-60"
      >
        {isPending ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
      </button>
    </form>
  )
}

'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'

const SYSTEM_ADMIN_EMAIL = 'od@nauss.edu.sa'

export default function LoginForm({ nextPath = '/' }: { nextPath?: string }) {
  const [isPending, startTransition] = useTransition()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [adminNotice, setAdminNotice] = useState(false)

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault()
        setError('')
        setAdminNotice(false)
        startTransition(async () => {
          const normalizedEmail = email.trim().toLowerCase()
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: normalizedEmail, password }),
          })
          const data = await response.json().catch(() => ({}))
          if (!response.ok) {
            setAdminNotice(normalizedEmail === SYSTEM_ADMIN_EMAIL && response.status >= 500)
            setError(data.error ?? 'تعذر تسجيل الدخول')
            return
          }
          window.location.replace(nextPath)
        })
      }}
    >
      <div>
        <label className="field-label">البريد الإلكتروني الرسمي</label>
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setAdminNotice(false) }}
          className="input-shell"
          placeholder="name@nauss.edu.sa"
          autoComplete="email"
          required
        />
      </div>

      <div>
        <label className="field-label">كلمة المرور</label>
        <div style={{ position: 'relative' }}>
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-shell"
            style={{ paddingLeft: '2.5rem' }}
            autoComplete="current-password"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{
              position: 'absolute', left: '0.75rem', top: '50%',
              transform: 'translateY(-50%)', background: 'none',
              border: 'none', cursor: 'pointer', color: '#5A5A5A', padding: '0.25rem',
            }}
          >
            {showPassword ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            )}
          </button>
        </div>
        <div className="mt-2 text-left">
          <Link href="/forgot-password" className="text-sm font-semibold" style={{ color: '#2A6364' }}>
            نسيت كلمة المرور؟
          </Link>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      {adminNotice && (
        <div className="alert alert-warning">
          تنبيه: يبدو أن قاعدة البيانات أو إعدادات الاتصال غير جاهزة. افحص <code>/api/health</code> وتحقق من متغيرات <code>DATABASE_URL</code> في Vercel.
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="btn btn-primary btn-lg w-full"
      >
        {isPending ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            جاري تسجيل الدخول...
          </span>
        ) : 'تسجيل الدخول'}
      </button>
    </form>
  )
}

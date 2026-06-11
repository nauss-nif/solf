'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

type PreviewForm = '18' | '19'

export default function ReviewActions({ loanId, form, disabled }: { loanId: string; form: PreviewForm; disabled: boolean }) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [isPending, startTransition] = useTransition()

  function approve() {
    setError('')
    setMessage('')
    startTransition(async () => {
      const res = await fetch(`/api/loans/${loanId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewStatus: 'REVIEWED', reviewNote: '', closureType: form === '19' ? 'settlement' : 'advance_req' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data?.error === 'string' ? data.error : 'تعذر تحديث حالة المراجعة.')
        return
      }

      setMessage(form === '19' ? 'تم اعتماد نموذج ١٩.' : 'تم اعتماد نموذج ١٨.')
      router.refresh()
    })
  }

  return (
    <div className="section-card p-5">
      <h3 className="mb-3 text-base font-bold" style={{ color: '#1F3F40' }}>اعتماد المراجع</h3>
      <p className="text-sm" style={{ color: '#5A5A5A' }}>راجع البيانات والمرفقات، ثم اعتمد النموذج من هنا.</p>
      {error && <div className="alert alert-error mt-3">{error}</div>}
      {message && <div className="alert alert-success mt-3">{message}</div>}
      <button type="button" onClick={approve} disabled={isPending || disabled} className="btn btn-success btn-sm mt-4 w-full">
        {form === '19' ? 'اعتماد نموذج ١٩' : 'اعتماد نموذج ١٨'}
      </button>
      {disabled && <p className="mt-3 text-xs" style={{ color: '#5A5A5A' }}>هذا النموذج غير متاح للاعتماد حالياً.</p>}
    </div>
  )
}

'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

type PreviewForm = '18' | '19'

export default function ReviewActions({ loanId, form, disabled, isApproved }: { loanId: string; form: PreviewForm; disabled: boolean; isApproved: boolean }) {
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

  function returnToEmployee() {
    const note = window.prompt('سبب الإعادة للموظف:')
    if (note === null) return
    const reviewNote = note.trim()
    if (!reviewNote) {
      setError('اكتب سبب الإعادة قبل إرسالها للموظف.')
      return
    }

    setError('')
    setMessage('')
    startTransition(async () => {
      const res = await fetch(`/api/loans/${loanId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewStatus: 'RETURNED', reviewNote }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data?.error === 'string' ? data.error : 'تعذر إعادة المعاملة للموظف.')
        return
      }

      setMessage('تمت إعادة المعاملة للموظف.')
      router.refresh()
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {error && <div className="alert alert-error mt-3">{error}</div>}
      {message && <div className="alert alert-success mt-3">{message}</div>}
      <button type="button" onClick={approve} disabled={isPending || disabled || isApproved} className="btn btn-success btn-sm">
        {isApproved ? 'تم الاعتماد' : isPending ? 'جاري الاعتماد...' : 'اعتماد'}
      </button>
      <button type="button" onClick={returnToEmployee} disabled={isPending} className="btn btn-warning btn-sm">
        إعادة للموظف
      </button>
      {disabled && <p className="text-xs" style={{ color: '#5A5A5A' }}>هذا النموذج غير متاح للاعتماد حالياً.</p>}
    </div>
  )
}

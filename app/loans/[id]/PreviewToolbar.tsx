'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import ReviewActions from './ReviewActions'

type PreviewForm = '18' | '19'

export default function PreviewToolbar({
  loanId,
  activeForm,
  hasSettlement,
  canReview,
  isApproved,
  isOnHold,
  holdReason,
  returnTab,
  returnFilter,
}: {
  loanId: string
  activeForm: PreviewForm
  hasSettlement: boolean
  canReview: boolean
  isApproved: boolean
  isOnHold: boolean
  holdReason?: string | null
  returnTab?: string
  returnFilter?: string
}) {
  const router = useRouter()
  const [target, setTarget] = useState<PreviewForm | 'home' | null>(null)
  const [isPending, startTransition] = useTransition()
  const [holdPending, setHoldPending] = useState(false)
  const [showHoldDialog, setShowHoldDialog] = useState(false)
  const [holdInput, setHoldInput] = useState(holdReason ?? '')
  const [currentHold, setCurrentHold] = useState(isOnHold)
  const [currentHoldReason, setCurrentHoldReason] = useState(holdReason ?? '')

  async function toggleHold() {
    if (!currentHold) { setShowHoldDialog(true); return }
    setHoldPending(true)
    await fetch(`/api/loans/${loanId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isOnHold: false, holdReason: null }) })
    setCurrentHold(false)
    setCurrentHoldReason('')
    setHoldPending(false)
    router.refresh()
  }

  async function confirmHold() {
    setHoldPending(true)
    setShowHoldDialog(false)
    await fetch(`/api/loans/${loanId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isOnHold: true, holdReason: holdInput }) })
    setCurrentHold(true)
    setCurrentHoldReason(holdInput)
    setHoldPending(false)
    router.refresh()
  }

  function go(nextTarget: PreviewForm | 'home') {
    setTarget(nextTarget)
    startTransition(() => {
      if (nextTarget === 'home') {
        const query = new URLSearchParams()
        if (returnTab) query.set('tab', returnTab)
        if (returnFilter) query.set('filter', returnFilter)
        const queryString = query.toString()
        router.push(queryString ? `/?${queryString}` : '/')
        return
      }
      const query = new URLSearchParams({ form: nextTarget })
      if (returnTab) query.set('returnTab', returnTab)
      if (returnFilter) query.set('returnFilter', returnFilter)
      router.push(`/loans/${loanId}?${query.toString()}`)
    })
  }

  return (
    <>
    {showHoldDialog && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="w-96 rounded-2xl bg-white p-6 shadow-xl" dir="rtl">
          <h3 className="mb-3 text-lg font-bold text-amber-700">⏸ تعليق السلفة</h3>
          <p className="mb-3 text-sm text-gray-600">أدخل سبب التعليق (مثل: انتظار موافقة معالي الرئيس على النثريات)</p>
          <textarea className="textarea textarea-bordered w-full text-sm" rows={3} value={holdInput} onChange={e => setHoldInput(e.target.value)} placeholder="سبب التعليق..." />
          <div className="mt-4 flex gap-2">
            <button className="btn btn-warning btn-sm flex-1" onClick={confirmHold} disabled={!holdInput.trim()}>تأكيد التعليق</button>
            <button className="btn btn-outline btn-sm" onClick={() => setShowHoldDialog(false)}>إلغاء</button>
          </div>
        </div>
      </div>
    )}
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => go('home')} disabled={isPending} className="btn btn-outline btn-sm">
          {isPending && target === 'home' ? 'جاري العودة...' : 'العودة للوحة'}
        </button>
        <button type="button" onClick={() => go('18')} disabled={isPending || activeForm === '18'} className={`btn btn-sm ${activeForm === '18' ? 'btn-primary' : 'btn-outline'}`}>
          {isPending && target === '18' ? 'جاري فتح نموذج ١٨...' : 'معاينة نموذج ١٨'}
        </button>
        {hasSettlement ? (
          <button type="button" onClick={() => go('19')} disabled={isPending || activeForm === '19'} className={`btn btn-sm ${activeForm === '19' ? 'btn-primary' : 'btn-outline'}`}>
            {isPending && target === '19' ? 'جاري فتح نموذج ١٩...' : 'معاينة نموذج ١٩'}
          </button>
        ) : (
          <span className="btn btn-outline btn-sm opacity-60" aria-disabled="true">لم تُرفع التسوية بعد</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={activeForm === '19' ? `/print/settlements/${loanId}` : `/print/loans/${loanId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-outline btn-sm"
        >
          🖨️ طباعة نموذج {activeForm === '19' ? '١٩' : '١٨'}
        </a>
        {canReview && (
          <>
            {currentHold && (
              <span className="badge badge-warning gap-1 text-xs" title={currentHoldReason}>⏸ موقوفة{currentHoldReason ? `: ${currentHoldReason.slice(0, 30)}${currentHoldReason.length > 30 ? '…' : ''}` : ''}</span>
            )}
            <button type="button" onClick={toggleHold} disabled={holdPending} className={`btn btn-sm ${currentHold ? 'btn-success' : 'btn-warning'}`}>
              {holdPending ? '...' : currentHold ? '▶ رفع التعليق' : '⏸ تعليق'}
            </button>
            <ReviewActions
              loanId={loanId}
              form={activeForm}
              disabled={activeForm === '19' && !hasSettlement}
              isApproved={isApproved}
            />
          </>
        )}
      </div>
    </div>
    </>
  )
}

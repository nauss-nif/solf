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
}: {
  loanId: string
  activeForm: PreviewForm
  hasSettlement: boolean
  canReview: boolean
}) {
  const router = useRouter()
  const [target, setTarget] = useState<PreviewForm | 'home' | null>(null)
  const [isPending, startTransition] = useTransition()

  function go(nextTarget: PreviewForm | 'home') {
    setTarget(nextTarget)
    startTransition(() => {
      router.push(nextTarget === 'home' ? '/' : `/loans/${loanId}?form=${nextTarget}`)
    })
  }

  return (
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
      {canReview && (
        <ReviewActions
          loanId={loanId}
          form={activeForm}
          disabled={activeForm === '19' && !hasSettlement}
        />
      )}
    </div>
  )
}

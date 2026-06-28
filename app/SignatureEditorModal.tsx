'use client'

import { useEffect, useRef, useState } from 'react'
import { readFileAsDataUrl } from '@/lib/client-files'
import { type StoredFile } from '@/lib/loan-form-options'

const DISPLAY_WIDTH = 460
const WHITE_THRESHOLD = 235

type Rect = { x: number; y: number; w: number; h: number }

export default function SignatureEditorModal({ file, onCancel, onSave }: {
  file: File
  onCancel: () => void
  onSave: (stored: StoredFile) => void
}) {
  const [imageUrl, setImageUrl] = useState('')
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 })
  const [displayHeight, setDisplayHeight] = useState(0)
  const [removeBg, setRemoveBg] = useState(true)
  const [crop, setCrop] = useState<Rect>({ x: 0, y: 0, w: DISPLAY_WIDTH, h: 0 })
  const [error, setError] = useState('')
  const dragRef = useRef<{ mode: 'move' | 'resize'; startX: number; startY: number; orig: Rect } | null>(null)

  useEffect(() => {
    let active = true
    readFileAsDataUrl(file).then((url) => {
      const img = new window.Image()
      img.onload = () => {
        if (!active) return
        const h = Math.round((img.height / img.width) * DISPLAY_WIDTH)
        setNaturalSize({ w: img.width, h: img.height })
        setDisplayHeight(h)
        setImageUrl(url)
        setCrop({ x: 0, y: 0, w: DISPLAY_WIDTH, h })
      }
      img.onerror = () => setError('تعذر قراءة الصورة.')
      img.src = url
    }).catch(() => setError('تعذر قراءة الصورة.'))
    return () => { active = false }
  }, [file])

  function clampRect(r: Rect): Rect {
    const w = Math.max(20, Math.min(r.w, DISPLAY_WIDTH))
    const h = Math.max(20, Math.min(r.h, displayHeight))
    const x = Math.max(0, Math.min(r.x, DISPLAY_WIDTH - w))
    const y = Math.max(0, Math.min(r.y, displayHeight - h))
    return { x, y, w, h }
  }

  function onPointerDownMove(e: React.PointerEvent) {
    e.preventDefault()
    dragRef.current = { mode: 'move', startX: e.clientX, startY: e.clientY, orig: crop }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  function onPointerDownResize(e: React.PointerEvent) {
    e.preventDefault(); e.stopPropagation()
    dragRef.current = { mode: 'resize', startX: e.clientX, startY: e.clientY, orig: crop }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  function onPointerMove(e: PointerEvent) {
    const drag = dragRef.current; if (!drag) return
    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY
    if (drag.mode === 'move') {
      setCrop(clampRect({ ...drag.orig, x: drag.orig.x + dx, y: drag.orig.y + dy }))
    } else {
      setCrop(clampRect({ ...drag.orig, w: drag.orig.w + dx, h: drag.orig.h + dy }))
    }
  }

  function onPointerUp() {
    dragRef.current = null
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
  }

  async function handleSave() {
    setError('')
    try {
      const img = new window.Image()
      await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error('تعذر معالجة الصورة.')); img.src = imageUrl })

      const scale = naturalSize.w / DISPLAY_WIDTH
      const sx = crop.x * scale
      const sy = crop.y * scale
      const sw = crop.w * scale
      const sh = crop.h * scale

      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(sw))
      canvas.height = Math.max(1, Math.round(sh))
      const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('تعذر تهيئة معالجة الصورة.')
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)

      if (removeBg) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data
        for (let i = 0; i < data.length; i += 4) {
          const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3
          if (brightness >= WHITE_THRESHOLD) data[i + 3] = 0
          else if (brightness >= WHITE_THRESHOLD - 30) data[i + 3] = Math.round(data[i + 3] * ((WHITE_THRESHOLD - brightness) / 30))
        }
        ctx.putImageData(imageData, 0, 0)
      }

      const dataUrl = canvas.toDataURL('image/png')
      onSave({ name: file.name.replace(/\.[^.]+$/, '') + '.png', type: 'image/png', size: Math.round((dataUrl.length * 3) / 4), dataUrl })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ التوقيع.')
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-modal">
        <h3 className="font-bold text-base" style={{ color: '#1F3F40' }}>تعديل التوقيع</h3>
        <p className="text-xs mt-1" style={{ color: '#5A5A5A' }}>
          اسحب المربع لتحديد منطقة التوقيع فقط، واسحب من الزاوية لتغيير المقاس. الحجم المناسب: عرض إلى ارتفاع بنسبة تقريبية 3:1 (مثل توقيع مستطيل عريض)، بلا فراغات كبيرة حول الخط.
        </p>

        {error && <div className="alert alert-error mt-2">{error}</div>}

        {imageUrl && (
          <div className="mt-3 flex justify-center">
            <div
              style={{ position: 'relative', width: DISPLAY_WIDTH, height: displayHeight, background: '#F9F9F9', border: '1px solid #DADBD9', backgroundImage: `url(${imageUrl})`, backgroundSize: '100% 100%', borderRadius: 8, overflow: 'hidden' }}
            >
              <div
                onPointerDown={onPointerDownMove}
                style={{
                  position: 'absolute', left: crop.x, top: crop.y, width: crop.w, height: crop.h,
                  border: '2px dashed #2A6364', background: 'rgba(42,99,100,0.08)', cursor: 'move',
                }}
              >
                <div
                  onPointerDown={onPointerDownResize}
                  style={{ position: 'absolute', right: -6, bottom: -6, width: 14, height: 14, background: '#2A6364', borderRadius: 4, cursor: 'nwse-resize' }}
                />
              </div>
            </div>
          </div>
        )}

        <label className="flex items-center gap-2 mt-3 text-sm cursor-pointer select-none">
          <input type="checkbox" checked={removeBg} onChange={(e) => setRemoveBg(e.target.checked)} />
          <span style={{ color: '#1F3F40' }}>إزالة الخلفية البيضاء تلقائياً (موصى به)</span>
        </label>

        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={onCancel} className="btn btn-outline btn-sm">إلغاء</button>
          <button type="button" onClick={() => void handleSave()} disabled={!imageUrl} className="btn btn-primary btn-sm">حفظ التوقيع</button>
        </div>
      </div>
    </div>
  )
}

'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const CURRENCIES = [
  { code: 'ر.س', name: 'ريال سعودي' },
  { code: 'USD', name: 'دولار أمريكي' },
  { code: 'EUR', name: 'يورو' },
]

export default function SettlementForm({ loan }: { loan: any }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const [items, setItems] = useState(
    (loan.items || []).map((item: any) => ({
      category: item.category,
      budget: item.amount,
      invoices: [] as Array<{ amount?: number | string; currency?: string; sar?: number }>,
    })),
  )

  const [rates, setRates] = useState({ USD: 3.75, EUR: 4.1 })

  const handleInvoiceChange = (itemIndex: number, invoiceIndex: number, field: string, value: any) => {
    const newItems = [...items]
    if (!newItems[itemIndex].invoices[invoiceIndex]) newItems[itemIndex].invoices[invoiceIndex] = {}
    newItems[itemIndex].invoices[invoiceIndex][field as 'amount'] = value

    const inv = newItems[itemIndex].invoices[invoiceIndex]
    const rate = inv.currency === 'USD' ? rates.USD : inv.currency === 'EUR' ? rates.EUR : 1
    inv.sar = (parseFloat(String(inv.amount || 0)) || 0) * rate

    setItems(newItems)
  }

  const addInvoice = (itemIndex: number) => {
    const newItems = [...items]
    if (!newItems[itemIndex].invoices) newItems[itemIndex].invoices = []
    newItems[itemIndex].invoices.push({ amount: 0, currency: 'ر.س', sar: 0 })
    setItems(newItems)
  }

  const calculations = items.reduce(
    (acc, item) => {
      const totalItem = item.invoices.reduce((sum, inv) => sum + (inv.sar || 0), 0)
      const isNath = item.category.includes('نثريات')

      acc.total += totalItem
      if (isNath) acc.unsupported += totalItem
      else acc.supported += totalItem

      return acc
    },
    { total: 0, supported: 0, unsupported: 0 },
  )

  const savings = Math.max(0, loan.amount - calculations.total)
  const overage = Math.max(0, calculations.total - loan.amount)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const payload = {
      loanId: loan.id,
      supported: calculations.supported,
      unsupported: calculations.unsupported,
      total: calculations.total,
      savings,
      overage,
      details: items,
    }

    const res = await fetch('/api/settlements', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    })

    if (res.ok) {
      alert('تمت التسوية بنجاح')
      router.push('/')
    } else {
      alert('حدث خطأ أثناء الحفظ')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded bg-white p-6 shadow">
      <h3 className="border-b pb-2 text-lg font-bold">نموذج 19 - تسوية سلفة</h3>

      <div className="grid grid-cols-1 gap-4 rounded border bg-gray-50 p-4 md:grid-cols-3">
        <div>
          <span className="text-gray-500">المبلغ المعتمد:</span> <b>{loan.amount}</b>
        </div>
        <div>
          <span className="text-gray-500">المصروف:</span> <b className="text-primary">{calculations.total.toFixed(2)}</b>
        </div>
        <div>
          <span className="text-gray-500">الوفر:</span> <b className="text-success">{savings.toFixed(2)}</b>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 rounded border p-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs">سعر صرف الدولار</label>
          <input
            type="number"
            step="0.01"
            value={rates.USD}
            onChange={(e) => setRates((prev) => ({ ...prev, USD: parseFloat(e.target.value || '0') }))}
            className="w-full rounded border p-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs">سعر صرف اليورو</label>
          <input
            type="number"
            step="0.01"
            value={rates.EUR}
            onChange={(e) => setRates((prev) => ({ ...prev, EUR: parseFloat(e.target.value || '0') }))}
            className="w-full rounded border p-2"
          />
        </div>
      </div>

      {items.map((item, idx) => (
        <div key={idx} className="rounded border p-4">
          <div className="mb-2 flex justify-between gap-2">
            <h4 className="font-bold">{item.category}</h4>
            <span className="text-sm text-gray-500">الميزانية: {item.budget}</span>
          </div>

          {!item.category.includes('نثريات') && (
            <button type="button" onClick={() => addInvoice(idx)} className="mb-2 rounded bg-gray-200 px-2 py-1 text-xs">
              + إضافة فاتورة
            </button>
          )}

          <div className="space-y-2">
            {item.category.includes('نثريات') ? (
              <input
                type="number"
                placeholder="مبلغ النثريات"
                className="w-full rounded border p-2"
                onChange={(e) => {
                  handleInvoiceChange(idx, 0, 'amount', e.target.value)
                  handleInvoiceChange(idx, 0, 'currency', 'ر.س')
                }}
              />
            ) : item.invoices.length > 0 ? (
              item.invoices.map((inv, invIdx) => (
                <div key={invIdx} className="grid grid-cols-1 gap-2 md:grid-cols-4">
                  <input
                    type="number"
                    placeholder="المبلغ"
                    className="rounded border p-1"
                    onChange={(e) => handleInvoiceChange(idx, invIdx, 'amount', e.target.value)}
                  />
                  <select
                    className="rounded border p-1"
                    defaultValue={inv.currency || 'ر.س'}
                    onChange={(e) => handleInvoiceChange(idx, invIdx, 'currency', e.target.value)}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code}
                      </option>
                    ))}
                  </select>
                  <input type="text" readOnly value={inv.sar?.toFixed(2) || '0'} className="rounded border bg-gray-100 p-1" />
                  <button
                    type="button"
                    className="text-xs text-red-500"
                    onClick={() => {
                      const newItems = [...items]
                      newItems[idx].invoices.splice(invIdx, 1)
                      setItems(newItems)
                    }}
                  >
                    حذف
                  </button>
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-500">لم تتم إضافة فواتير لهذا البند بعد</div>
            )}
          </div>
        </div>
      ))}

      {items.length === 0 && <div className="rounded border p-4 text-sm text-gray-500">لا توجد بنود مرتبطة بهذه السلفة.</div>}

      <div className="flex justify-end gap-2 pt-4">
        <button type="button" onClick={() => router.back()} className="rounded border px-4 py-2 text-sm">
          إلغاء
        </button>
        <button type="submit" disabled={loading} className="rounded bg-success px-4 py-2 font-bold text-white disabled:opacity-50">
          {loading ? 'جاري الحفظ...' : 'تأكيد التسوية'}
        </button>
      </div>
    </form>
  )
}

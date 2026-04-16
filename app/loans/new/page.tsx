'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const DEFAULT_CATEGORIES = [
  'مواصلات متدربين',
  'مواصلات مدربين',
  'سكن',
  'رسوم تأشيرات',
  'ترجمة',
  'نثريات',
  'أخرى',
]

export default function NewLoanPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)

    const items = DEFAULT_CATEGORIES.map((category) => ({
      category,
      amount: parseFloat((formData.get(`item_${category}`) as string) || '0'),
    })).filter((item) => item.amount > 0)

    const data = {
      refNumber: formData.get('ref') as string,
      employee: formData.get('employee') as string,
      activity: formData.get('activity') as string,
      amount: parseFloat(formData.get('amount') as string),
      location: formData.get('location') as string,
      startDate: formData.get('startDate') as string,
      endDate: formData.get('endDate') as string,
      items,
    }

    const res = await fetch('/api/loans', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
    })

    if (res.ok) {
      router.push('/')
    } else {
      alert('حدث خطأ')
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto mt-10 max-w-3xl rounded bg-white p-6 shadow">
      <h2 className="mb-6 text-xl font-bold text-primary">نموذج 18 - طلب سلفة</h2>
      <form action={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs">الرقم المرجعي</label>
            <input name="ref" required className="w-full rounded border p-2" />
          </div>
          <div>
            <label className="mb-1 block text-xs">المبلغ</label>
            <input name="amount" type="number" step="0.01" required className="w-full rounded border p-2" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs">اسم الموظف</label>
          <input name="employee" required className="w-full rounded border p-2" />
        </div>
        <div>
          <label className="mb-1 block text-xs">النشاط</label>
          <input name="activity" required className="w-full rounded border p-2" />
        </div>
        <div>
          <label className="mb-1 block text-xs">المكان</label>
          <input name="location" className="w-full rounded border p-2" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs">من تاريخ</label>
            <input name="startDate" type="date" required className="w-full rounded border p-2" />
          </div>
          <div>
            <label className="mb-1 block text-xs">إلى تاريخ</label>
            <input name="endDate" type="date" required className="w-full rounded border p-2" />
          </div>
        </div>

        <div className="rounded border p-4">
          <h3 className="mb-3 font-bold text-primary">بنود السلفة التقديرية</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {DEFAULT_CATEGORIES.map((category) => (
              <div key={category}>
                <label className="mb-1 block text-xs">{category}</label>
                <input name={`item_${category}`} type="number" step="0.01" defaultValue="0" className="w-full rounded border p-2" />
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-4">
          <button type="button" onClick={() => router.back()} className="rounded border px-4 py-2 text-sm">
            إلغاء
          </button>
          <button type="submit" disabled={loading} className="rounded bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            {loading ? 'جاري الحفظ...' : 'حفظ السلفة'}
          </button>
        </div>
      </form>
    </main>
  )
}

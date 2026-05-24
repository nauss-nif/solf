'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewLoanPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    const data = {
      refNumber: formData.get('ref') as string,
      employee: formData.get('employee') as string,
      activity: formData.get('activity') as string,
      amount: parseFloat(formData.get('amount') as string),
      location: formData.get('location') as string,
      startDate: formData.get('startDate') as string,
      endDate: formData.get('endDate') as string,
    };

    const res = await fetch('/api/loans', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' }
    });

    if (res.ok) {
      router.push('/');
    } else {
      alert('حدث خطأ');
      setLoading(false);
    }
  }

  return (
    <main className="max-w-2xl mx-auto p-6 bg-white rounded shadow mt-10">
      <h2 className="text-xl font-bold mb-6 text-primary">نموذج 18 - طلب سلفة</h2>
      <form action={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs mb-1">الرقم المرجعي</label>
            <input name="ref" required className="w-full border rounded p-2" />
          </div>
          <div>
            <label className="block text-xs mb-1">المبلغ</label>
            <input name="amount" type="number" required className="w-full border rounded p-2" />
          </div>
        </div>
        <div>
          <label className="block text-xs mb-1">اسم الموظف</label>
          <input name="employee" required className="w-full border rounded p-2" />
        </div>
        <div>
          <label className="block text-xs mb-1">النشاط</label>
          <input name="activity" required className="w-full border rounded p-2" />
        </div>
        <div>
          <label className="block text-xs mb-1">المكان</label>
          <input name="location" className="w-full border rounded p-2" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs mb-1">من تاريخ</label>
            <input name="startDate" type="date" required className="w-full border rounded p-2" />
          </div>
          <div>
            <label className="block text-xs mb-1">إلى تاريخ</label>
            <input name="endDate" type="date" required className="w-full border rounded p-2" />
          </div>
        </div>
        
        <div className="flex gap-2 pt-4">
          <button type="button" onClick={() => router.back()} className="px-4 py-2 border rounded-lg text-sm">إلغاء</button>
          <button type="submit" disabled={loading} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold disabled:opacity-50">
            {loading ? 'جاري الحفظ...' : 'حفظ السلفة'}
          </button>
        </div>
      </form>
    </main>
  );
}

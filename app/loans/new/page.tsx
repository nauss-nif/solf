'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function NewLoanPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // محاكاة عملية الحفظ (بدون قاعدة بيانات)
    setTimeout(() => {
      alert('هذه نسخة عرض. لن يتم حفظ البيانات فعلياً.');
      setLoading(false);
      router.push('/');
    }, 1000);
  }

  return (
    <main className="max-w-2xl mx-auto p-6 bg-white rounded shadow mt-10">
      <h2 className="text-xl font-bold mb-6 text-primary">نموذج 18 - طلب سلفة (وضع العرض)</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
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
        
        <div className="flex gap-2 pt-4">
          <button type="button" onClick={() => router.back()} className="px-4 py-2 border rounded-lg text-sm">إلغاء</button>
          <button type="submit" disabled={loading} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold disabled:opacity-50">
            {loading ? 'جاري الحفظ...' : 'حفظ (عرض فقط)'}
          </button>
        </div>
      </form>
    </main>
  );
}
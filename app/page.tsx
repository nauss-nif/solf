import Link from 'next/link';
import { prisma } from '@/lib/prisma';

// هذا السطر ضروري لمنع الخطأ
export const dynamic = 'force-dynamic';

// بيانات تجريبية للعرض فقط (بدون قاعدة بيانات)
const demoLoans = [
  { id: '1', refNumber: 'وت/26/0001', employee: 'محمد أحمد', activity: 'دورة تدريبية', amount: 5000, isSettled: false },
  { id: '2', refNumber: 'وت/26/0002', employee: 'سعيد علي', activity: 'مؤتمر', amount: 3000, isSettled: true },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
        
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-primary">نظام السلف النقدية</h1>
            <p className="text-sm text-gray-500">وكالة التدريب - نسخة عرض</p>
          </div>
          <Link href="/loans/new" className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold shadow">
            + طلب سلفة جديدة
          </Link>
        </header>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm text-center">
            <p className="text-gray-500 text-sm">إجمالي السلف</p>
            <p className="text-3xl font-bold mt-2">{demoLoans.length}</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm text-center">
            <p className="text-gray-500 text-sm">فعالة</p>
            <p className="text-3xl font-bold mt-2 text-warning">{demoLoans.filter(l => !l.isSettled).length}</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm text-center">
            <p className="text-gray-500 text-sm">مسواة</p>
            <p className="text-3xl font-bold mt-2 text-success">{demoLoans.filter(l => l.isSettled).length}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="p-4 border-b font-bold">آخر السلف (للعرض)</div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="text-right p-3">الرقم</th>
                <th className="text-right p-3">الموظف</th>
                <th className="text-right p-3">المبلغ</th>
                <th className="text-right p-3">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {demoLoans.map((loan) => (
                <tr key={loan.id} className="hover:bg-gray-50">
                  <td className="p-3 font-bold text-primary">{loan.refNumber}</td>
                  <td className="p-3">{loan.employee}</td>
                  <td className="p-3">{loan.amount.toLocaleString()} ر.س</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded-full text-xs ${loan.isSettled ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                      {loan.isSettled ? 'مسواة' : 'فعالة'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </main>
  );
}
import Link from 'next/link'
import { prisma } from '@/lib/prisma'

export default async function Home() {
  const loans = await prisma.loan.findMany({ orderBy: { createdAt: 'desc' } })
  const stats = {
    total: loans.length,
    active: loans.filter((l) => !l.isSettled).length,
    settled: loans.filter((l) => l.isSettled).length,
  }

  return (
    <main className="min-h-screen p-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary">نظام السلف النقدية</h1>
        <Link href="/loans/new" className="rounded-lg bg-primary px-4 py-2 text-sm text-white">
          + طلب سلفة جديد
        </Link>
      </header>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded bg-white p-4 text-center shadow">
          <p className="text-sm text-gray-500">إجمالي السلف</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="rounded bg-white p-4 text-center shadow">
          <p className="text-sm text-gray-500">سلف فعالة</p>
          <p className="text-2xl font-bold text-warning">{stats.active}</p>
        </div>
        <div className="rounded bg-white p-4 text-center shadow">
          <p className="text-sm text-gray-500">تمت تسويتها</p>
          <p className="text-2xl font-bold text-success">{stats.settled}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded bg-white shadow">
        <div className="border-b p-3 text-sm font-bold">سجل السلف</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="p-2 text-right">الرقم</th>
                <th className="p-2 text-right">الموظف</th>
                <th className="p-2 text-right">المبلغ</th>
                <th className="p-2 text-right">الحالة</th>
                <th className="p-2 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {loans.map((loan) => (
                <tr key={loan.id} className="border-b hover:bg-gray-50">
                  <td className="p-2 font-bold text-primary">{loan.refNumber}</td>
                  <td className="p-2">{loan.employee}</td>
                  <td className="p-2">{loan.amount.toLocaleString()} ر.س</td>
                  <td className="p-2">
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${loan.isSettled ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}
                    >
                      {loan.isSettled ? 'مسواة' : 'فعالة'}
                    </span>
                  </td>
                  <td className="p-2">
                    <Link href={`/loans/${loan.id}`} className="text-xs text-primary hover:underline">
                      {loan.isSettled ? 'عرض' : 'تسوية'}
                    </Link>
                  </td>
                </tr>
              ))}
              {loans.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-gray-500">
                    لا توجد سلف مسجلة حالياً
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}

import { prisma } from '@/lib/prisma'
import SettlementForm from './SettlementForm'

export default async function LoanDetailPage({ params }: { params: { id: string } }) {
  const loan = await prisma.loan.findUnique({
    where: { id: params.id },
    include: { settlement: true, items: true },
  })

  if (!loan) return <div className="p-6">السلفة غير موجودة</div>

  if (loan.isSettled) {
    return (
      <div className="mx-auto mt-10 max-w-2xl rounded bg-white p-6 shadow">
        <h2 className="mb-4 text-xl font-bold text-success">تمت تسوية السلفة</h2>
        <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
          <div>
            المبلغ الموفر: <b>{loan.settlement?.savings}</b>
          </div>
          <div>
            الزيادة: <b>{loan.settlement?.overage}</b>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-4 rounded bg-white p-4 shadow">
        <h2 className="font-bold">تفاصيل السلفة: {loan.refNumber}</h2>
        <p>
          الموظف: {loan.employee} | المبلغ: {loan.amount}
        </p>
      </div>

      <SettlementForm loan={loan} />
    </div>
  )
}

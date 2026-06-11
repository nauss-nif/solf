import { prisma } from '@/lib/prisma'
import { canManageAllLoans, requireSessionUser } from '@/lib/auth'
import { LOAN_ATTACHMENT_DEFINITIONS, isStoredImageFile, type LoanRequestFiles } from '@/lib/loan-form-options'
import { formatCurrencySar } from '@/lib/utils'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import ReviewActions from './ReviewActions'

function formatDate(value: Date | string) {
  return new Date(value).toLocaleDateString('en-GB')
}

function getLoanFiles(files: unknown): LoanRequestFiles {
  if (!files || typeof files !== 'object' || Array.isArray(files)) return {}
  return files as LoanRequestFiles
}

function getSettlementDetails(invoices: unknown) {
  if (!invoices || typeof invoices !== 'object' || Array.isArray(invoices)) return []
  const details = (invoices as { details?: unknown }).details
  return Array.isArray(details) ? details : []
}

function AttachmentPreview({ file }: { file: unknown }) {
  const dataUrl = file && typeof file === 'object' && 'dataUrl' in file ? String(file.dataUrl ?? '') : ''
  const name = file && typeof file === 'object' && 'name' in file ? String(file.name ?? 'مرفق') : 'مرفق'
  const size = file && typeof file === 'object' && 'size' in file ? Number(file.size ?? 0) : 0

  if (!dataUrl) return <p className="text-sm" style={{ color: '#5A5A5A' }}>لا يوجد مرفق.</p>

  if (!isStoredImageFile(file)) {
    return (
      <div className="rounded-xl border bg-white p-4">
        <p className="mb-3 text-sm" style={{ color: '#5A5A5A' }}>هذا المرفق محفوظ من نسخة سابقة وليس صورة.</p>
        <a href={dataUrl} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">فتح المرفق</a>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-white">
      <a href={file.dataUrl} target="_blank" rel="noreferrer" className="block bg-[#F9F9F9] p-2">
        <img src={file.dataUrl} alt={name} className="max-h-[520px] w-full rounded-lg object-contain" />
      </a>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-xs" style={{ color: '#2D4D40' }}>
        <span>{name} - {Math.round(size / 1024)} KB</span>
        <a href={file.dataUrl} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">تكبير</a>
      </div>
    </div>
  )
}

export default async function LoanDetailPage({ params, searchParams }: { params: { id: string }; searchParams?: { form?: string } }) {
  const currentUser = requireSessionUser()
  const loan = await prisma.loan.findUnique({
    where: { id: params.id },
    include: { settlement: true, items: true },
  })

  if (!loan) return <div className="p-6">السلفة غير موجودة</div>

  const canReview = canManageAllLoans(currentUser)
  if (!canReview && loan.userId !== currentUser.userId) redirect('/')

  const reviewBadge = loan.reviewStatus === 'REVIEWED'
    ? { label: 'تمت المراجعة', cls: 'badge-success' }
    : loan.reviewStatus === 'RETURNED'
      ? { label: 'معادة للموظف', cls: 'badge-warning' }
      : { label: 'بانتظار المراجعة', cls: 'badge-danger' }
  const files = getLoanFiles(loan.files)
  const activeForm = searchParams?.form === '19' ? '19' : '18'
  const settlementDetails = getSettlementDetails(loan.settlement?.invoices)
  const canApproveActiveForm = canReview && (activeForm === '18' || Boolean(loan.settlement))

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="btn btn-outline btn-sm">العودة للوحة</Link>
        <div className="flex flex-wrap gap-2">
          <span className="badge badge-gold">معاينة نموذج {activeForm === '19' ? '١٩' : '١٨'}</span>
          <span className={`badge ${reviewBadge.cls}`}>{reviewBadge.label}</span>
          <span className="badge badge-primary">{loan.refNumber}</span>
          {loan.courseCode && <span className="badge badge-neutral">دورة {loan.courseCode}</span>}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <div className="section-card p-6">
            <h1 className="text-2xl font-bold" style={{ color: '#1F3F40' }}>{loan.activity}</h1>
            <p className="mt-1 text-sm" style={{ color: '#5A5A5A' }}>{loan.employee} - {loan.location || 'بدون موقع'}</p>
            <div className="mt-5 grid gap-3 text-sm md:grid-cols-3" style={{ color: '#2D4D40' }}>
              <div>المبلغ: <b>{formatCurrencySar(loan.amount)}</b></div>
              <div>الفترة: <b>{formatDate(loan.startDate)} - {formatDate(loan.endDate)}</b></div>
              <div>الموازنة: <b>{loan.budgetApproved === true ? 'معتمدة' : loan.budgetApproved === false ? 'غير معتمدة' : 'غير محددة'}</b></div>
            </div>
          </div>

          {activeForm === '18' ? (
            <>
              <div className="section-card p-6">
                <h2 className="mb-4 text-lg font-bold" style={{ color: '#1F3F40' }}>مرفقات نموذج ١٨</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {LOAN_ATTACHMENT_DEFINITIONS.map((attachment) => (
                    <div key={attachment.key} className="rounded-xl border p-4">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <h3 className="text-sm font-bold" style={{ color: '#1F3F40' }}>{attachment.label}</h3>
                        <span className="badge badge-neutral">{attachment.required ? 'إلزامي' : 'اختياري'}</span>
                      </div>
                      <AttachmentPreview file={files[attachment.key]} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="section-card p-6">
                <h2 className="mb-4 text-lg font-bold" style={{ color: '#1F3F40' }}>بنود الصرف في نموذج ١٨</h2>
                <div className="space-y-2">
                  {loan.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm">
                      <span>{item.category}</span>
                      <strong>{formatCurrencySar(item.amount)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : loan.settlement ? (
            <>
              <div className="section-card p-6">
                <h2 className="mb-4 text-lg font-bold" style={{ color: '#1F3F40' }}>ملخص نموذج ١٩</h2>
                <div className="grid gap-3 text-sm md:grid-cols-4" style={{ color: '#2D4D40' }}>
                  <div>مبلغ السلفة: <b>{formatCurrencySar(loan.amount)}</b></div>
                  <div>المصروف المؤيد: <b>{formatCurrencySar(loan.settlement.supported)}</b></div>
                  <div>المصروف غير المؤيد: <b>{formatCurrencySar(loan.settlement.unsupported)}</b></div>
                  <div>الإجمالي: <b>{formatCurrencySar(loan.settlement.total)}</b></div>
                  <div>الوفر: <b>{formatCurrencySar(loan.settlement.savings)}</b></div>
                  <div>الزيادة: <b>{formatCurrencySar(loan.settlement.overage)}</b></div>
                </div>
              </div>

              <div className="section-card p-6">
                <h2 className="mb-4 text-lg font-bold" style={{ color: '#1F3F40' }}>تفاصيل ومرفقات نموذج ١٩</h2>
                {settlementDetails.length === 0 ? (
                  <p className="text-sm" style={{ color: '#5A5A5A' }}>لا توجد تفاصيل فواتير محفوظة.</p>
                ) : (
                  <div className="space-y-4">
                    {settlementDetails.map((item, itemIndex) => {
                      const record = item as { category?: unknown; budget?: unknown; invoices?: unknown }
                      const invoices = Array.isArray(record.invoices) ? record.invoices : []
                      return (
                        <div key={itemIndex} className="rounded-xl border p-4">
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <h3 className="font-bold" style={{ color: '#1F3F40' }}>{String(record.category ?? 'بند')}</h3>
                            <span className="text-sm" style={{ color: '#5A5A5A' }}>الميزانية: {formatCurrencySar(Number(record.budget ?? 0))}</span>
                          </div>
                          <div className="grid gap-3 md:grid-cols-2">
                            {invoices.map((invoice, invoiceIndex) => {
                              const inv = invoice as { amount?: unknown; sar?: unknown; issuer?: unknown; invoiceDate?: unknown; attachment?: unknown }
                              return (
                                <div key={invoiceIndex} className="rounded-xl border bg-[#F9F9F9] p-3">
                                  <div className="mb-3 grid gap-1 text-sm" style={{ color: '#2D4D40' }}>
                                    <span>المبلغ: <b>{formatCurrencySar(Number(inv.sar ?? inv.amount ?? 0))}</b></span>
                                    <span>الجهة: {String(inv.issuer ?? 'غير محددة')}</span>
                                    <span>التاريخ: {inv.invoiceDate ? String(inv.invoiceDate) : 'غير محدد'}</span>
                                  </div>
                                  <AttachmentPreview file={inv.attachment} />
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="alert alert-warning">لا توجد تسوية محفوظة لهذه السلفة، لذلك لا يمكن معاينة نموذج ١٩.</div>
          )}
        </div>

        <aside className="space-y-4">
          {canReview && <ReviewActions loanId={loan.id} form={activeForm} disabled={!canApproveActiveForm} />}
          {loan.reviewNote && (
            <div className="alert alert-warning text-sm">
              <strong>ملاحظة المراجع:</strong> {loan.reviewNote}
            </div>
          )}
          <div className="section-card p-5 text-sm" style={{ color: '#2D4D40' }}>
            <h3 className="mb-3 font-bold" style={{ color: '#1F3F40' }}>معلومات الطلب</h3>
            <p>تاريخ الإنشاء: {formatDate(loan.createdAt)}</p>
            <p>آخر تحديث: {formatDate(loan.updatedAt)}</p>
            <p>حالة التسوية: {loan.isSettled ? 'مسواة' : 'غير مسواة'}</p>
          </div>
        </aside>
      </div>
    </div>
  )
}

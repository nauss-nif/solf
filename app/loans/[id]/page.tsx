import { prisma } from '@/lib/prisma'
import { canManageAllLoans, requireSessionUser } from '@/lib/auth'
import { LOAN_ATTACHMENT_DEFINITIONS, isStoredImageFile, type LoanRequestFiles } from '@/lib/loan-form-options'
import { formatCurrencySar } from '@/lib/utils'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import AttachmentOpenButton from './AttachmentOpenButton'
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

function InfoTile({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-2xl border border-[#DADBD9] bg-[#F9F9F9] px-4 py-3">
      <p className="text-xs" style={{ color: '#6B5A4A' }}>{label}</p>
      <p className={strong ? 'mt-1 text-base font-bold' : 'mt-1 text-sm font-semibold'} style={{ color: '#1F3F40' }}>{value || 'غير محدد'}</p>
    </div>
  )
}

function AttachmentPreview({ file }: { file: unknown }) {
  const dataUrl = file && typeof file === 'object' && 'dataUrl' in file ? String(file.dataUrl ?? '') : ''
  const name = file && typeof file === 'object' && 'name' in file ? String(file.name ?? 'مرفق') : 'مرفق'
  const size = file && typeof file === 'object' && 'size' in file ? Number(file.size ?? 0) : 0

  if (!dataUrl) {
    return (
      <div className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-[#B5BDBE] bg-[#F9F9F9] p-4 text-sm" style={{ color: '#5A5A5A' }}>
        لا يوجد مرفق.
      </div>
    )
  }

  if (!isStoredImageFile(file)) {
    return (
      <div className="rounded-2xl border border-[#DADBD9] bg-white p-4">
        <p className="mb-3 text-sm" style={{ color: '#5A5A5A' }}>هذا المرفق محفوظ من نسخة سابقة وليس صورة، ويمكن فتحه في تبويب مستقل.</p>
        <AttachmentOpenButton dataUrl={dataUrl} />
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[#DADBD9] bg-white">
      <div className="block bg-[#F9F9F9] p-2">
        <img src={file.dataUrl} alt={name} className="max-h-[520px] w-full rounded-lg object-contain" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-xs" style={{ color: '#2D4D40' }}>
        <span>{name} - {Math.round(size / 1024)} KB</span>
        <AttachmentOpenButton dataUrl={file.dataUrl} label="فتح / تكبير" />
      </div>
    </div>
  )
}

export default async function LoanDetailPage({ params, searchParams }: { params: { id: string }; searchParams?: { form?: string } }) {
  const currentUser = requireSessionUser()
  const loan = await prisma.loan.findUnique({
    where: { id: params.id },
    include: { settlement: true, items: true, user: { select: { email: true, fullName: true } } },
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
  const formTitle = activeForm === '19' ? 'معاينة نموذج ١٩، تسوية السلفة' : 'معاينة نموذج ١٨، طلب السلفة'
  const requesterName = loan.user?.fullName || loan.employee
  const requesterEmail = loan.user?.email || 'غير محدد'

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <span className="badge badge-gold">{formTitle}</span>
          <span className={`badge ${reviewBadge.cls}`}>{reviewBadge.label}</span>
          <span className="badge badge-primary">{loan.refNumber}</span>
          {loan.courseCode && <span className="badge badge-neutral">دورة {loan.courseCode}</span>}
        </div>
        <Link href="/" className="btn btn-outline btn-sm">العودة للوحة</Link>
      </div>

      <section className="section-card overflow-hidden p-0">
        <div className="px-6 py-5" style={{ background: '#F3EDE3', borderBottom: '1px solid #DADBD9' }}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold" style={{ color: '#6B5A4A' }}>{formTitle}</p>
              <h1 className="mt-2 max-w-4xl text-3xl font-bold leading-tight" style={{ color: '#1F3F40' }}>{loan.activity}</h1>
              <p className="mt-2 text-base" style={{ color: '#5A5A5A' }}>طالب السلفة: <strong style={{ color: '#1F3F40' }}>{requesterName}</strong></p>
            </div>
            <div className="rounded-2xl bg-white px-5 py-4 text-left shadow-sm" dir="ltr">
              <p className="text-xs" style={{ color: '#6B5A4A' }}>رقم المعاملة</p>
              <p className="text-2xl font-bold" style={{ color: '#2A6364' }}>{loan.refNumber}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 p-6 md:grid-cols-2 xl:grid-cols-4">
          <InfoTile label="طالب السلفة / المشرف" value={requesterName} strong />
          <InfoTile label="البريد" value={requesterEmail} />
          <InfoTile label="الموقع" value={loan.location || 'غير محدد'} />
          <InfoTile label="المبلغ المطلوب" value={formatCurrencySar(loan.amount)} strong />
          <InfoTile label="تاريخ البداية" value={formatDate(loan.startDate)} />
          <InfoTile label="تاريخ النهاية" value={formatDate(loan.endDate)} />
          <InfoTile label="اعتماد الموازنة" value={loan.budgetApproved === true ? 'معتمدة' : loan.budgetApproved === false ? 'غير معتمدة' : 'غير محددة'} />
          <InfoTile label="كود الدورة" value={loan.courseCode || 'طلب مباشر'} />
          <InfoTile label="تاريخ إنشاء الطلب" value={formatDate(loan.createdAt)} />
          <InfoTile label="آخر تحديث" value={formatDate(loan.updatedAt)} />
          <InfoTile label="حالة التسوية" value={loan.isSettled ? 'مسواة' : 'غير مسواة'} />
          <InfoTile label="النموذج المفتوح" value={activeForm === '19' ? 'نموذج ١٩' : 'نموذج ١٨'} />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          {activeForm === '18' ? (
            <>
              <div className="section-card p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-xl font-bold" style={{ color: '#1F3F40' }}>مرفقات نموذج ١٨</h2>
                  <p className="text-sm" style={{ color: '#5A5A5A' }}>افتح كل مرفق وتأكد من مطابقته قبل الاعتماد.</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {LOAN_ATTACHMENT_DEFINITIONS.map((attachment) => (
                    <div key={attachment.key} className="rounded-2xl border border-[#DADBD9] p-4">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <h3 className="text-base font-bold" style={{ color: '#1F3F40' }}>{attachment.label}</h3>
                        <span className="badge badge-neutral">{attachment.required ? 'إلزامي' : 'اختياري'}</span>
                      </div>
                      <AttachmentPreview file={files[attachment.key]} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="section-card p-6">
                <h2 className="mb-4 text-xl font-bold" style={{ color: '#1F3F40' }}>بنود الصرف في نموذج ١٨</h2>
                <div className="space-y-2">
                  {loan.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[#DADBD9] bg-[#F9F9F9] px-4 py-3 text-sm">
                      <span className="font-semibold" style={{ color: '#1F3F40' }}>{item.category}</span>
                      <strong style={{ color: '#2A6364' }}>{formatCurrencySar(item.amount)}</strong>
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

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          {canReview && <ReviewActions loanId={loan.id} form={activeForm} disabled={!canApproveActiveForm} />}
          {loan.reviewNote && (
            <div className="alert alert-warning text-sm">
              <strong>ملاحظة المراجع:</strong> {loan.reviewNote}
            </div>
          )}
          <div className="section-card p-5 text-sm" style={{ color: '#2D4D40' }}>
            <h3 className="mb-3 font-bold" style={{ color: '#1F3F40' }}>اختصار القرار</h3>
            <p>راجع رقم المعاملة، بيانات طالب السلفة، التواريخ، المبلغ، المرفقات، ثم البنود.</p>
            <div className="mt-4 space-y-2">
              <Link href={`/loans/${loan.id}?form=18`} className={`btn btn-sm ${activeForm === '18' ? 'btn-primary' : 'btn-outline'} w-full`}>معاينة نموذج ١٨</Link>
              <Link href={`/loans/${loan.id}?form=19`} className={`btn btn-sm ${activeForm === '19' ? 'btn-primary' : 'btn-outline'} w-full`}>معاينة نموذج ١٩</Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

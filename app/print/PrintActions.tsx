'use client'

export default function PrintActions({ pdfHref }: { pdfHref?: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm print:hidden">
      <p className="text-sm text-slate-500">
        {pdfHref
          ? 'يُفضَّل تحميل PDF لضمان هوامش وتوقيعات مطابقة للنموذج الرسمي تماماً.'
          : 'يمكنك الطباعة مباشرة من النموذج الرسمي.'}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {pdfHref ? (
          <a
            href={pdfHref}
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl bg-primary px-4 py-2 text-sm text-white"
          >
            تحميل PDF
          </a>
        ) : null}
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-2xl border border-slate-300 px-4 py-2 text-sm text-slate-600"
        >
          طباعة من المتصفح
        </button>
      </div>
    </div>
  )
}

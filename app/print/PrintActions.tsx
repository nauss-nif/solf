'use client'

export default function PrintActions({ pdfHref }: { pdfHref?: string }) {
  void pdfHref
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm print:hidden">
      <p className="text-sm text-slate-500">يمكنك الطباعة مباشرة من النموذج الرسمي.</p>
      <div className="flex flex-wrap items-center gap-2">
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

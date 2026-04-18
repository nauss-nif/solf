'use client'

export default function PrintActions({ wordHref }: { wordHref: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm print:hidden">
      <p className="text-sm text-slate-500">يمكنك الطباعة مباشرة أو تنزيل نسخة Word.</p>
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={wordHref}
          className="rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-700"
        >
          تنزيل Word
        </a>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-2xl bg-primary px-4 py-2 text-sm text-white"
        >
          طباعة
        </button>
      </div>
    </div>
  )
}

'use client'

export default function PrintActions({ pdfHref, printBlocked, printBlockedReason }: { pdfHref?: string; printBlocked?: boolean; printBlockedReason?: string }) {
  void pdfHref
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm print:hidden">
      {printBlocked ? (
        <p className="text-sm font-semibold" style={{ color: '#B45309' }}>
          🔒 {printBlockedReason ?? 'لا يمكن الطباعة حتى يكتمل اعتماد جميع المراجعين'}
        </p>
      ) : (
        <p className="text-sm text-slate-500">يمكنك الطباعة مباشرة من النموذج الرسمي.</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {printBlocked ? (
          <span
            className="rounded-2xl border px-4 py-2 text-sm cursor-not-allowed"
            style={{ borderColor: '#D97706', color: '#D97706', background: '#FFFBEB', opacity: 0.7 }}
            title={printBlockedReason}
          >
            🔒 الطباعة محجوبة
          </span>
        ) : (
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-2xl border border-slate-300 px-4 py-2 text-sm text-slate-600"
          >
            طباعة من المتصفح
          </button>
        )}
      </div>
    </div>
  )
}

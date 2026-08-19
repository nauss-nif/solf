'use client'

// بيان المطابقة — واجهة دور «المراقب»
//
// الغرض: اطّلاع ومطابقة فقط. لا اعتماد ولا تعديل ولا حذف، ولا فتح لنموذجي
// ١٨ و ١٩ الرسميين — المراقب يحتاج أرقاماً مصفوفة يقارنها بسجلاته، لا نماذج.
// الحماية الفعلية في الخادم (canManageAllLoans لا تشمل المراقب)، وهذه
// الواجهة لا تعرض أصلاً أي زر إجراء.

import { useMemo, useState } from 'react'
import type { LoanDashboardRecord } from './DashboardClient'

const REVIEW_LABEL: Record<string, string> = {
  PENDING: 'بانتظار الاعتماد',
  AWAITING_SECOND_REVIEW: 'بانتظار المراجع الثاني',
  RETURNED: 'مُعاد للتعديل',
  REVIEWED: 'معتمد',
}

const SETTLEMENT_LABEL: Record<string, string> = {
  NOT_STARTED: 'لم تبدأ',
  IN_PROGRESS: 'قيد الإعداد',
  SUBMITTED: 'مرفوعة',
  AWAITING_SECOND_REVIEW: 'بانتظار المراجع الثاني',
  APPROVED: 'معتمدة',
  OVERDUE: 'متأخرة',
}

const money = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const shortDate = (v?: string | null) => (v ? String(v).slice(0, 10) : '—')

type StatusFilter = 'all' | 'settled' | 'unsettled'

export default function MonitorStatement({ loans }: { loans: LoanDashboardRecord[] }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const rows = useMemo(() => {
    let list = loans.filter((l) => !l.isDraft)
    if (statusFilter === 'settled') list = list.filter((l) => l.isSettled)
    if (statusFilter === 'unsettled') list = list.filter((l) => !l.isSettled)

    const q = search.trim()
    if (q) {
      list = list.filter((l) =>
        [l.refNumber, l.employee, l.activity, l.location, l.user?.employeeNumber ?? '']
          .join(' ')
          .includes(q),
      )
    }
    return list
  }, [loans, search, statusFilter])

  const totals = useMemo(() => {
    const advanced = rows.reduce((s, l) => s + (l.amount || 0), 0)
    const settled = rows.reduce((s, l) => s + (l.isSettled ? l.settlement?.total ?? 0 : 0), 0)
    const savings = rows.reduce((s, l) => s + (l.isSettled ? l.settlement?.savings ?? 0 : 0), 0)
    const overage = rows.reduce((s, l) => s + (l.isSettled ? l.settlement?.overage ?? 0 : 0), 0)
    const open = rows.filter((l) => !l.isSettled)
    const openAmount = open.reduce((s, l) => s + (l.amount || 0), 0)
    return { advanced, settled, savings, overage, openCount: open.length, openAmount, count: rows.length }
  }, [rows])

  const COLUMNS = [
    'الرقم المرجعي', 'اسم الموظف', 'الرقم الوظيفي', 'النشاط', 'مكان التنفيذ',
    'مبلغ السلفة', 'من', 'إلى', 'مهلة التسوية',
    'المبلغ المسوّى', 'الوفر', 'العجز', 'حالة الاعتماد', 'حالة التسوية',
  ]

  const rowCells = (l: LoanDashboardRecord) => [
    l.refNumber,
    l.employee,
    l.user?.employeeNumber ?? '',
    l.activity,
    l.location || '',
    money(l.amount || 0),
    shortDate(l.startDate),
    shortDate(l.endDate),
    shortDate(l.settlementDeadline),
    l.isSettled ? money(l.settlement?.total ?? 0) : '—',
    l.isSettled ? money(l.settlement?.savings ?? 0) : '—',
    l.isSettled ? money(l.settlement?.overage ?? 0) : '—',
    REVIEW_LABEL[l.reviewStatus] ?? l.reviewStatus,
    l.isSettled ? 'مسوّاة' : (SETTLEMENT_LABEL[l.settlementStatus] ?? l.settlementStatus),
  ]

  function buildHtmlTable() {
    const head = COLUMNS.map((c) => `<th>${c}</th>`).join('')
    const body = rows
      .map((l) => `<tr>${rowCells(l).map((c) => `<td>${String(c)}</td>`).join('')}</tr>`)
      .join('')
    const foot = `<tr>
      <td colspan="5"><b>الإجمالي (${totals.count} معاملة)</b></td>
      <td><b>${money(totals.advanced)}</b></td>
      <td colspan="3"></td>
      <td><b>${money(totals.settled)}</b></td>
      <td><b>${money(totals.savings)}</b></td>
      <td><b>${money(totals.overage)}</b></td>
      <td colspan="2"></td>
    </tr>`
    return { head, body, foot }
  }

  function exportExcel() {
    const { head, body, foot } = buildHtmlTable()
    const html = `<html dir="rtl"><head><meta charset="utf-8"></head><body>
      <h3>بيان مطابقة السلف والتسويات — ${new Date().toISOString().slice(0, 10)}</h3>
      <table border="1"><thead><tr>${head}</tr></thead><tbody>${body}</tbody><tfoot>${foot}</tfoot></table>
    </body></html>`

    const blob = new Blob(['﻿', html], { type: 'application/vnd.ms-excel;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `بيان-المطابقة-${new Date().toISOString().slice(0, 10)}.xls`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  function printStatement() {
    const { head, body, foot } = buildHtmlTable()
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<html dir="rtl"><head><meta charset="utf-8"><title>بيان المطابقة</title>
      <style>
        body { font-family: "Segoe UI", Tahoma, sans-serif; direction: rtl; padding: 16px; }
        h3 { color:#1F3F40; margin:0 0 4px; }
        p.meta { color:#666; font-size:12px; margin:0 0 12px; }
        table { width:100%; border-collapse:collapse; font-size:11px; }
        th, td { border:1px solid #999; padding:4px 5px; text-align:center; }
        thead th { background:#E7F3EE; }
        tfoot td { background:#F3F5F4; }
        @page { size: A4 landscape; margin: 10mm; }
      </style></head><body>
      <h3>بيان مطابقة السلف والتسويات</h3>
      <p class="meta">تاريخ الإصدار: ${new Date().toISOString().slice(0, 10)} · عدد المعاملات: ${totals.count}</p>
      <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody><tfoot>${foot}</tfoot></table>
      </body></html>`)
    win.document.close()
    win.focus()
    win.print()
  }

  const cards = [
    { label: 'إجمالي المصروف كسلف', value: money(totals.advanced), color: '#2A6364' },
    { label: 'إجمالي المسوّى',       value: money(totals.settled),  color: '#4F8F7A' },
    { label: 'إجمالي الوفر',          value: money(totals.savings),  color: '#2E6F8E' },
    { label: 'إجمالي العجز',          value: money(totals.overage),  color: '#8A6D00' },
    { label: 'غير مسوّاة',            value: `${totals.openCount} · ${money(totals.openAmount)}`, color: '#73384B' },
  ]

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="section-card p-5">
        <h2 className="font-bold text-lg" style={{ color: '#1F3F40' }}>بيان مطابقة السلف والتسويات</h2>
        <p className="text-xs mt-1" style={{ color: '#5A5A5A' }}>
          عرض للاطّلاع والمطابقة — جميع المعاملات مع حالتها. لا يشمل النماذج الرسمية.
        </p>
      </div>

      {/* ملخص مالي */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="stat-card">
            <p className="stat-label">{c.label}</p>
            <p className="stat-value mt-1" style={{ color: c.color, fontSize: '1.05rem' }}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* أدوات */}
      <div className="section-card p-4 flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 بحث بالرقم المرجعي أو الاسم أو الرقم الوظيفي أو النشاط..."
          className="input-shell"
          style={{ flex: '1 1 280px', minWidth: 220 }}
        />
        <div className="flex gap-1">
          {([
            { v: 'all', l: 'الكل' },
            { v: 'settled', l: 'المسوّاة' },
            { v: 'unsettled', l: 'غير المسوّاة' },
          ] as Array<{ v: StatusFilter; l: string }>).map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => setStatusFilter(o.v)}
              className={statusFilter === o.v ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
            >
              {o.l}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={exportExcel} className="btn btn-outline btn-sm">⬇️ تصدير Excel</button>
          <button type="button" onClick={printStatement} className="btn btn-outline btn-sm">🖨️ طباعة البيان</button>
        </div>
      </div>

      {/* الجدول */}
      <div className="section-card p-0 overflow-hidden">
        {rows.length === 0 ? (
          <div className="empty-state py-12">
            <p className="empty-state-icon text-3xl">🗂️</p>
            <p className="empty-state-title">لا توجد معاملات مطابقة للبحث</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', whiteSpace: 'nowrap' }}>
              <thead>
                <tr style={{ background: '#E7F3EE' }}>
                  {COLUMNS.map((c) => (
                    <th key={c} style={{ border: '1px solid #DADBD9', padding: '7px 8px', color: '#1F3F40', fontWeight: 700 }}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => {
                  const cells = rowCells(l)
                  return (
                    <tr key={l.id} style={{ background: l.isSettled ? '#fff' : '#FCF8F2' }}>
                      {cells.map((c, i) => (
                        <td
                          key={i}
                          style={{
                            border: '1px solid #E6E8E7',
                            padding: '6px 8px',
                            textAlign: i === 1 || i === 3 ? 'right' : 'center',
                            color: '#333',
                            fontWeight: i === 0 ? 600 : 400,
                          }}
                        >
                          {c || '—'}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: '#F3F5F4', fontWeight: 700 }}>
                  <td colSpan={5} style={{ border: '1px solid #DADBD9', padding: '7px 8px', textAlign: 'right' }}>
                    الإجمالي ({totals.count} معاملة)
                  </td>
                  <td style={{ border: '1px solid #DADBD9', padding: '7px 8px', textAlign: 'center' }}>{money(totals.advanced)}</td>
                  <td colSpan={3} style={{ border: '1px solid #DADBD9' }} />
                  <td style={{ border: '1px solid #DADBD9', padding: '7px 8px', textAlign: 'center' }}>{money(totals.settled)}</td>
                  <td style={{ border: '1px solid #DADBD9', padding: '7px 8px', textAlign: 'center' }}>{money(totals.savings)}</td>
                  <td style={{ border: '1px solid #DADBD9', padding: '7px 8px', textAlign: 'center' }}>{money(totals.overage)}</td>
                  <td colSpan={2} style={{ border: '1px solid #DADBD9' }} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

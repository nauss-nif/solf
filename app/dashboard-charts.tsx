'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts'
import { formatCurrencySar, formatEnglishNumber } from '@/lib/utils'

const CHART_COLORS = ['#2A6364', '#C7B08C', '#2E6F8E', '#C7B08C', '#5A5A5A', '#C7B08C', '#B5BDBE', '#5A5A5A']

const tooltipStyle = { borderRadius: 8, border: '1px solid #C8D9D0', fontSize: 12 }
const legendFormatter = (v: string) => <span style={{ fontSize: 11, color: '#5A5A5A' }}>{v}</span>

export function MonthlyAmountsChart({ data, height = 220 }: { data: Array<{ name: string; requested: number; settled: number }>; height?: number }) {
  if (data.length === 0) {
    return <div className="flex items-center justify-center text-sm" style={{ height, color: '#5A5A5A' }}>لا توجد بيانات كافية</div>
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#DADBD9" />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#5A5A5A' }} />
        <YAxis tick={{ fontSize: 10, fill: '#5A5A5A' }} width={60} />
        <Tooltip formatter={(v) => [formatCurrencySar(Number(v)), '']} contentStyle={tooltipStyle} />
        <Bar dataKey="requested" name="مطلوب" fill="#2A6364" radius={[4, 4, 0, 0]} />
        <Bar dataKey="settled" name="مسوّى" fill="#C7B08C" radius={[4, 4, 0, 0]} />
        <Legend iconType="circle" iconSize={8} formatter={legendFormatter} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function StatusDistributionChart({ data, height = 220 }: { data: Array<{ name: string; value: number; color: string }>; height?: number }) {
  if (data.length === 0) {
    return <div className="flex items-center justify-center text-sm" style={{ height, color: '#5A5A5A' }}>لا توجد بيانات</div>
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
          {data.map((entry, index) => <Cell key={index} fill={entry.color} />)}
        </Pie>
        <Tooltip formatter={(v) => [Number(v), 'طلب']} contentStyle={tooltipStyle} />
        <Legend iconType="circle" iconSize={8} formatter={legendFormatter} />
      </PieChart>
    </ResponsiveContainer>
  )
}

type ItemUsageStat = { category: string; requestCount: number; requestTotal: number; settlementCount: number; settlementTotal: number }

export function ItemUsageInsights({ data }: { data: ItemUsageStat[] }) {
  if (data.length === 0) {
    return <div className="flex items-center justify-center text-sm h-[160px]" style={{ color: '#5A5A5A' }}>لا توجد بيانات كافية بعد</div>
  }

  const bySettlement = [...data].filter((d) => d.settlementCount > 0).sort((a, b) => b.settlementCount - a.settlementCount)
  const mostUsed = bySettlement.slice(0, 5)
  const leastUsed = [...bySettlement].reverse().slice(0, 5)
  const byRequestTotal = [...data].sort((a, b) => b.requestTotal - a.requestTotal).slice(0, 5)

  const Table = ({ title, rows, valueLabel, valueKey }: { title: string; rows: ItemUsageStat[]; valueLabel: string; valueKey: 'requestTotal' | 'settlementTotal' }) => (
    <div className="section-card p-4">
      <h3 className="text-sm font-semibold mb-3" style={{ color: '#2D4D40' }}>{title}</h3>
      {rows.length === 0 ? (
        <div className="flex items-center justify-center text-sm h-[120px]" style={{ color: '#5A5A5A' }}>لا توجد بيانات كافية</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr style={{ color: '#5A5A5A' }}>
              <th className="text-right py-1 font-medium">البند</th>
              <th className="text-right py-1 font-medium">عدد المرات</th>
              <th className="text-right py-1 font-medium">{valueLabel}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.category} style={{ borderTop: '1px solid #EDEEEC' }}>
                <td className="py-1.5" style={{ color: '#2D4D40' }}>{row.category}</td>
                <td className="py-1.5">{formatEnglishNumber(valueKey === 'requestTotal' ? row.requestCount : row.settlementCount)}</td>
                <td className="py-1.5" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{formatCurrencySar(row[valueKey])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Table title="أعلى البنود طلبًا (حسب المبلغ)" rows={byRequestTotal} valueLabel="إجمالي الطلب" valueKey="requestTotal" />
      <Table title="أكثر البنود استخدامًا في التسويات" rows={mostUsed} valueLabel="إجمالي الصرف" valueKey="settlementTotal" />
      <Table title="أقل البنود استخدامًا في التسويات" rows={leastUsed} valueLabel="إجمالي الصرف" valueKey="settlementTotal" />
    </div>
  )
}

type SettlementUrgencyEntry = { employee: string; indicator: number; days: number; overdue: boolean }

export function SettlementUrgencyRadarChart({ data, height = 280 }: { data: SettlementUrgencyEntry[]; height?: number }) {
  if (data.length === 0) {
    return <div className="flex items-center justify-center text-sm" style={{ height, color: '#5A5A5A' }}>لا توجد سلف مفتوحة بانتظار التسوية حالياً</div>
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} outerRadius="70%">
        <PolarGrid gridType="circle" stroke="#DADBD9" />
        <PolarAngleAxis dataKey="employee" tick={{ fontSize: 11, fill: '#2D4D40' }} />
        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
        <Tooltip
          formatter={(_v, _n, item) => {
            const p = item.payload as SettlementUrgencyEntry
            return [p.overdue ? `متأخر ${formatEnglishNumber(p.days)} يوم` : `متبقي ${formatEnglishNumber(p.days)} يوم`, p.employee]
          }}
          contentStyle={tooltipStyle}
        />
        <Radar dataKey="indicator" name="درجة الاستعجال" stroke="#73384B" fill="#73384B" fillOpacity={0.45} dot={{ r: 4, fillOpacity: 1 }} />
      </RadarChart>
    </ResponsiveContainer>
  )
}

export function CategoryUsageChart({ data, height = 220, emptyText = 'لا توجد بيانات كافية' }: { data: Array<[string, number]>; height?: number; emptyText?: string }) {
  if (data.length === 0) {
    return <div className="flex items-center justify-center text-sm" style={{ height, color: '#5A5A5A' }}>{emptyText}</div>
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data.map(([name, value]) => ({ name, value }))} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#DADBD9" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10, fill: '#5A5A5A' }} width={80} tickFormatter={(v) => formatEnglishNumber(v)} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#2D4D40' }} width={120} />
        <Tooltip formatter={(v) => [formatCurrencySar(Number(v)), 'الإجمالي']} contentStyle={tooltipStyle} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {data.map((_, index) => <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

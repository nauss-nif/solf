'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
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

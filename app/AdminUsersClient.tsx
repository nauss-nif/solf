'use client'

import { useEffect, useState, useTransition } from 'react'

type Role = 'EMPLOYEE' | 'ADMIN' | 'REVIEWER'
type AdminUser = { id: string; fullName: string; email: string; mobile: string; extension: string; role: Role; roles?: Role[]; status: 'ACTIVE' | 'DISABLED'; createdAt: string }

const ROLE_OPTIONS: Array<{ value: Role; label: string; color: string }> = [
  { value: 'EMPLOYEE', label: 'موظف',    color: '#1B4332' },
  { value: 'REVIEWER', label: 'مراجع',   color: '#2563EB' },
  { value: 'ADMIN',    label: 'مدير',    color: '#C9943A' },
]

export default function AdminUsersClient() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loadError, setLoadError] = useState('')
  const [isPending, startTransition] = useTransition()
  const [successMsg, setSuccessMsg] = useState('')

  async function loadUsers() {
    const res = await fetch('/api/admin/users', { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok) { setLoadError(data.error ?? 'تعذر تحميل الحسابات'); return }
    setLoadError(''); setUsers(data)
  }

  useEffect(() => { void loadUsers() }, [])

  function showSuccess(msg: string) { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 2500) }

  return (
    <div className="space-y-5 animate-fade-up">
      {loadError  && <div className="alert alert-error">{loadError}</div>}
      {successMsg && <div className="alert alert-success">{successMsg}</div>}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'إجمالي الحسابات', value: users.length, color: '#1B4332', bg: '#D1FAE5' },
          { label: 'حسابات نشطة',     value: users.filter((u) => u.status === 'ACTIVE').length, color: '#059669', bg: '#D1FAE5' },
          { label: 'حسابات معطلة',    value: users.filter((u) => u.status === 'DISABLED').length, color: '#DC2626', bg: '#FEE2E2' },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <p className="stat-label">{s.label}</p>
            <p className="stat-value mt-1" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="section-card p-0 overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #E4EDE8' }}>
          <h2 className="font-bold" style={{ color: '#0D1F18' }}>قائمة المستخدمين</h2>
          <span className="badge badge-neutral">{users.length} حساب</span>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>البريد الإلكتروني</th>
                <th>الجوال</th>
                <th>التحويلة</th>
                <th>الصلاحيات</th>
                <th>الحالة</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const activeRoles = user.roles?.length ? user.roles : [user.role]
                return (
                  <tr key={user.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ background: '#D1FAE5', color: '#1B4332' }}>
                          {user.fullName.charAt(0)}
                        </div>
                        <span className="font-medium text-sm" style={{ color: '#0D1F18' }}>{user.fullName}</span>
                      </div>
                    </td>
                    <td className="text-sm" style={{ color: '#4A7A65' }}>{user.email}</td>
                    <td className="text-sm">{user.mobile}</td>
                    <td className="text-sm">{user.extension}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {ROLE_OPTIONS.map((opt) => {
                          const checked = activeRoles.includes(opt.value)
                          return (
                            <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={checked}
                                className="w-3.5 h-3.5 rounded"
                                onChange={(e) => {
                                  const nextRoles = e.target.checked
                                    ? [...new Set([...activeRoles, opt.value])]
                                    : activeRoles.filter((r) => r !== opt.value)
                                  if (nextRoles.length === 0) return
                                  startTransition(async () => {
                                    await fetch(`/api/admin/users/${user.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roles: nextRoles }) })
                                    await loadUsers(); showSuccess('تم تحديث الصلاحيات.')
                                  })
                                }}
                              />
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: checked ? (opt.color === '#1B4332' ? '#D1FAE5' : opt.color === '#2563EB' ? '#DBEAFE' : '#FEF3C7') : '#F0F5F2', color: checked ? opt.color : '#6B9A88' }}>
                                {opt.label}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    </td>
                    <td>
                      <select
                        value={user.status}
                        className="input-shell text-xs py-1 px-2"
                        style={{ width: 'auto', minWidth: 90 }}
                        onChange={(e) => {
                          const status = e.target.value
                          startTransition(async () => {
                            await fetch(`/api/admin/users/${user.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
                            await loadUsers(); showSuccess('تم تحديث حالة الحساب.')
                          })
                        }}
                      >
                        <option value="ACTIVE">نشط ✓</option>
                        <option value="DISABLED">معطل ✗</option>
                      </select>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => {
                            const password = window.prompt('أدخل كلمة المرور الجديدة:')
                            if (!password || password.trim().length < 6) { if (password !== null) window.alert('كلمة المرور يجب أن تكون 6 أحرف على الأقل.'); return }
                            startTransition(async () => {
                              await fetch(`/api/admin/users/${user.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) })
                              showSuccess('تم تغيير كلمة المرور.')
                            })
                          }}
                          className="btn btn-outline btn-sm"
                        >
                          🔑 كلمة المرور
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => {
                            if (!window.confirm(`حذف حساب "${user.fullName}"؟ لا يمكن التراجع عن هذا الإجراء.`)) return
                            startTransition(async () => {
                              await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' })
                              await loadUsers(); showSuccess('تم حذف الحساب.')
                            })
                          }}
                          className="btn btn-danger btn-sm"
                        >
                          🗑️ حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <div className="empty-state">
                      <p className="empty-state-icon text-3xl">👥</p>
                      <p className="empty-state-title">لا توجد حسابات مسجلة</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

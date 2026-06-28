'use client'

import { useEffect, useState, useTransition } from 'react'
import { optimizeSignatureImage } from '@/lib/client-files'
import { type StoredFile } from '@/lib/loan-form-options'

type Role = 'EMPLOYEE' | 'ADMIN' | 'REVIEWER'
type AdminUser = { id: string; fullName: string; email: string; mobile: string; extension: string; role: Role; roles?: Role[]; status: 'ACTIVE' | 'DISABLED'; signatureImage?: StoredFile | null; createdAt: string }

const ROLE_OPTIONS: Array<{ value: Role; label: string; color: string }> = [
  { value: 'EMPLOYEE', label: 'موظف',    color: '#2A6364' },
  { value: 'REVIEWER', label: 'مراجع',   color: '#2E6F8E' },
  { value: 'ADMIN',    label: 'مدير',    color: '#C7B08C' },
]

export default function AdminUsersClient() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loadError, setLoadError] = useState('')
  const [isPending, startTransition] = useTransition()
  const [successMsg, setSuccessMsg] = useState('')
  const [signatureUploadingId, setSignatureUploadingId] = useState<string | null>(null)
  const [signatureError, setSignatureError] = useState('')

  async function loadUsers() {
    const res = await fetch('/api/admin/users', { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok) { setLoadError(data.error ?? 'تعذر تحميل الحسابات'); return }
    setLoadError(''); setUsers(data)
  }

  useEffect(() => { void loadUsers() }, [])

  function showSuccess(msg: string) { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 2500) }

  async function handleSignatureUpload(userId: string, fileList: FileList | null) {
    const file = fileList?.[0]; if (!file) return
    setSignatureUploadingId(userId); setSignatureError('')
    try {
      const stored = await optimizeSignatureImage(file)
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ signatureImage: stored }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setSignatureError(typeof data?.error === 'string' ? data.error : 'تعذر حفظ التوقيع.'); return }
      await loadUsers(); showSuccess('تم حفظ التوقيع الإلكتروني.')
    } catch (err) {
      setSignatureError(err instanceof Error ? err.message : 'تعذر رفع التوقيع.')
    } finally {
      setSignatureUploadingId(null)
    }
  }

  return (
    <div className="space-y-5 animate-fade-up">
      {loadError  && <div className="alert alert-error">{loadError}</div>}
      {signatureError && <div className="alert alert-error">{signatureError}</div>}
      {successMsg && <div className="alert alert-success">{successMsg}</div>}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'إجمالي الحسابات', value: users.length, color: '#2A6364', bg: '#E7F3EE' },
          { label: 'حسابات نشطة',     value: users.filter((u) => u.status === 'ACTIVE').length, color: '#4F8F7A', bg: '#E7F3EE' },
          { label: 'حسابات معطلة',    value: users.filter((u) => u.status === 'DISABLED').length, color: '#73384B', bg: '#F3E7EB' },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <p className="stat-label">{s.label}</p>
            <p className="stat-value mt-1" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="section-card p-0 overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #DADBD9' }}>
          <h2 className="font-bold" style={{ color: '#1F3F40' }}>قائمة المستخدمين</h2>
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
                <th>التوقيع الإلكتروني</th>
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
                          style={{ background: '#E7F3EE', color: '#2A6364' }}>
                          {user.fullName.charAt(0)}
                        </div>
                        <span className="font-medium text-sm" style={{ color: '#1F3F40' }}>{user.fullName}</span>
                      </div>
                    </td>
                    <td className="text-sm" style={{ color: '#5A5A5A' }}>{user.email}</td>
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
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: checked ? (opt.color === '#2A6364' ? '#E7F3EE' : opt.color === '#2E6F8E' ? '#E4EEF3' : '#F3EDE3') : '#F9F9F9', color: checked ? opt.color : '#5A5A5A' }}>
                                {opt.label}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    </td>
                    <td>
                      {user.signatureImage ? (
                        <div className="flex items-center gap-1.5">
                          <img src={user.signatureImage.dataUrl} alt="توقيع" style={{ width: 56, height: 28, objectFit: 'contain', border: '1px solid #DADBD9', borderRadius: 6, background: '#fff', flexShrink: 0 }} />
                          <label className="btn btn-outline btn-sm cursor-pointer" title="تغيير التوقيع" style={{ padding: '0.25rem 0.5rem' }}>
                            ✏️
                            <input type="file" className="hidden" accept="image/*" onChange={(e) => void handleSignatureUpload(user.id, e.target.files)} />
                          </label>
                          <button
                            type="button"
                            disabled={isPending}
                            title="حذف التوقيع"
                            onClick={() => {
                              startTransition(async () => {
                                await fetch(`/api/admin/users/${user.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ signatureImage: null }) })
                                await loadUsers(); showSuccess('تم حذف التوقيع.')
                              })
                            }}
                            className="btn btn-danger btn-sm"
                            style={{ padding: '0.25rem 0.5rem' }}
                          >
                            🗑️
                          </button>
                        </div>
                      ) : (
                        <label className="btn btn-outline btn-sm cursor-pointer">
                          {signatureUploadingId === user.id ? 'جاري الرفع...' : 'رفع توقيع'}
                          <input type="file" className="hidden" accept="image/*" onChange={(e) => void handleSignatureUpload(user.id, e.target.files)} />
                        </label>
                      )}
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
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          disabled={isPending}
                          title="تغيير كلمة المرور"
                          onClick={() => {
                            const password = window.prompt('أدخل كلمة المرور الجديدة:')
                            if (!password || password.trim().length < 6) { if (password !== null) window.alert('كلمة المرور يجب أن تكون 6 أحرف على الأقل.'); return }
                            startTransition(async () => {
                              await fetch(`/api/admin/users/${user.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) })
                              showSuccess('تم تغيير كلمة المرور.')
                            })
                          }}
                          className="btn btn-outline btn-sm"
                          style={{ padding: '0.25rem 0.5rem' }}
                        >
                          🔑
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          title="حذف الحساب"
                          onClick={() => {
                            if (!window.confirm(`حذف حساب "${user.fullName}"؟ لا يمكن التراجع عن هذا الإجراء.`)) return
                            startTransition(async () => {
                              await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' })
                              await loadUsers(); showSuccess('تم حذف الحساب.')
                            })
                          }}
                          className="btn btn-danger btn-sm"
                          style={{ padding: '0.25rem 0.5rem' }}
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12">
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

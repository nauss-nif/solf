'use client'

import { useEffect, useState, useTransition } from 'react'
import { type StoredFile } from '@/lib/loan-form-options'
import SignatureEditorModal from './SignatureEditorModal'

type Role = 'EMPLOYEE' | 'ADMIN' | 'REVIEWER'
type AdminUser = { id: string; fullName: string; email: string; mobile: string; extension: string; role: Role; roles?: Role[]; status: 'ACTIVE' | 'DISABLED'; signatureImage?: StoredFile | null; profileImage?: StoredFile | null; createdAt: string }

const ROLE_OPTIONS: Array<{ value: Role; label: string; color: string; bg: string }> = [
  { value: 'EMPLOYEE', label: 'موظف',  color: '#2A6364', bg: '#E7F3EE' },
  { value: 'REVIEWER', label: 'مراجع', color: '#2E6F8E', bg: '#E4EEF3' },
  { value: 'ADMIN',    label: 'مدير',  color: '#8A6D00', bg: '#F3EDE3' },
]

export default function AdminUsersClient() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loadError, setLoadError] = useState('')
  const [isPending, startTransition] = useTransition()
  const [successMsg, setSuccessMsg] = useState('')
  const [signatureUploadingId, setSignatureUploadingId] = useState<string | null>(null)
  const [signatureError, setSignatureError] = useState('')
  const [signatureEditTarget, setSignatureEditTarget] = useState<{ userId: string; file: File } | null>(null)
  const [profileImageUploadingId, setProfileImageUploadingId] = useState<string | null>(null)

  async function loadUsers() {
    const res = await fetch('/api/admin/users', { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok) { setLoadError(data.error ?? 'تعذر تحميل الحسابات'); return }
    setLoadError(''); setUsers(data)
  }

  useEffect(() => { void loadUsers() }, [])

  function showSuccess(msg: string) { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 2500) }

  function handleSignatureFileSelected(userId: string, fileList: FileList | null) {
    const file = fileList?.[0]; if (!file) return
    setSignatureError('')
    setSignatureEditTarget({ userId, file })
  }

  async function handleProfileImageUpload(userId: string, fileList: FileList | null) {
    const file = fileList?.[0]; if (!file) return
    setProfileImageUploadingId(userId)
    try {
      const { fileToStoredFile } = await import('@/lib/client-files')
      const stored = await fileToStoredFile(file)
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profileImage: stored }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { showSuccess(typeof data?.error === 'string' ? data.error : 'تعذر رفع الصورة.'); return }
      await loadUsers(); showSuccess('تم حفظ الصورة الشخصية.')
    } finally {
      setProfileImageUploadingId(null)
    }
  }

  async function handleRemoveProfileImage(userId: string) {
    setProfileImageUploadingId(userId)
    try {
      await fetch(`/api/admin/users/${userId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profileImage: null }) })
      await loadUsers(); showSuccess('تم حذف الصورة الشخصية.')
    } finally {
      setProfileImageUploadingId(null)
    }
  }

  async function handleSignatureSaved(userId: string, stored: StoredFile) {
    setSignatureEditTarget(null)
    setSignatureUploadingId(userId); setSignatureError('')
    try {
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'إجمالي الحسابات', value: users.length, color: '#2A6364' },
          { label: 'حسابات نشطة',     value: users.filter((u) => u.status === 'ACTIVE').length, color: '#4F8F7A' },
          { label: 'حسابات معطلة',    value: users.filter((u) => u.status === 'DISABLED').length, color: '#73384B' },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <p className="stat-label">{s.label}</p>
            <p className="stat-value mt-1" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* User cards */}
      <div className="section-card p-0 overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #DADBD9' }}>
          <h2 className="font-bold" style={{ color: '#1F3F40' }}>قائمة المستخدمين</h2>
          <span className="badge badge-neutral">{users.length} حساب</span>
        </div>

        {users.length === 0 ? (
          <div className="empty-state py-12">
            <p className="empty-state-icon text-3xl">👥</p>
            <p className="empty-state-title">لا توجد حسابات مسجلة</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#DADBD9' }}>
            {users.map((user) => {
              const activeRoles = user.roles?.length ? user.roles : [user.role]
              return (
                <div key={user.id} className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    {/* Identity */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative group flex-shrink-0">
                        {user.profileImage ? (
                          <img src={user.profileImage.dataUrl} alt={user.fullName} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: '2px solid #C8D9D0' }} />
                        ) : (
                          <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                            style={{ background: '#E7F3EE', color: '#2A6364' }}>
                            {user.fullName.charAt(0)}
                          </div>
                        )}
                        <label className="absolute inset-0 rounded-full cursor-pointer flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity" title="تغيير الصورة الشخصية">
                          {profileImageUploadingId === user.id ? <span className="text-white text-[10px]">...</span> : <span className="text-white text-[10px]">📷</span>}
                          <input type="file" className="hidden" accept="image/*" disabled={profileImageUploadingId === user.id} onChange={(e) => void handleProfileImageUpload(user.id, e.target.files)} />
                        </label>
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate" style={{ color: '#1F3F40' }}>{user.fullName}</p>
                        <p className="text-xs truncate" style={{ color: '#5A5A5A' }}>{user.email}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#8A8A8A' }}>📞 {user.mobile}{user.extension ? ` · تحويلة ${user.extension}` : ''}</p>
                      </div>
                    </div>

                    {/* Status + account actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <select
                        value={user.status}
                        className="input-shell text-xs py-1.5 px-2"
                        style={{ width: 'auto', minWidth: 90, height: 'auto' }}
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
                        style={{ padding: '0.375rem 0.5rem' }}
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
                        style={{ padding: '0.375rem 0.5rem' }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-4">
                    {/* Roles */}
                    <div className="flex flex-wrap gap-1.5">
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
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: checked ? opt.bg : '#F9F9F9', color: checked ? opt.color : '#5A5A5A' }}>
                              {opt.label}
                            </span>
                          </label>
                        )
                      })}
                    </div>

                    <div className="h-4 w-px" style={{ background: '#DADBD9' }} />

                    {/* Profile Image */}
                    {user.profileImage && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs" style={{ color: '#8A8A8A' }}>الصورة:</span>
                        <button
                          type="button"
                          disabled={profileImageUploadingId === user.id}
                          title="حذف الصورة الشخصية"
                          onClick={() => void handleRemoveProfileImage(user.id)}
                          className="btn btn-danger btn-sm"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.65rem' }}
                        >
                          حذف الصورة
                        </button>
                      </div>
                    )}

                    <div className="h-4 w-px" style={{ background: '#DADBD9' }} />

                    {/* Signature */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs" style={{ color: '#8A8A8A' }}>التوقيع:</span>
                      {user.signatureImage ? (
                        <>
                          <img src={user.signatureImage.dataUrl} alt="توقيع" style={{ width: 52, height: 26, objectFit: 'contain', border: '1px solid #DADBD9', borderRadius: 6, background: '#fff' }} />
                          <label className="btn btn-outline btn-sm cursor-pointer" title="تغيير التوقيع" style={{ padding: '0.25rem 0.5rem' }}>
                            ✏️
                            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleSignatureFileSelected(user.id, e.target.files)} />
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
                        </>
                      ) : (
                        <label className="btn btn-outline btn-sm cursor-pointer">
                          {signatureUploadingId === user.id ? 'جاري الرفع...' : 'رفع توقيع'}
                          <input type="file" className="hidden" accept="image/*" onChange={(e) => handleSignatureFileSelected(user.id, e.target.files)} />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {signatureEditTarget && (
        <SignatureEditorModal
          file={signatureEditTarget.file}
          onCancel={() => setSignatureEditTarget(null)}
          onSave={(stored) => void handleSignatureSaved(signatureEditTarget.userId, stored)}
        />
      )}
    </div>
  )
}

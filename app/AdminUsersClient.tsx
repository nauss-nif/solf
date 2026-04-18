'use client'

import { useEffect, useState, useTransition } from 'react'

type Role = 'EMPLOYEE' | 'ADMIN' | 'REVIEWER'

type AdminUser = {
  id: string
  fullName: string
  email: string
  mobile: string
  extension: string
  role: Role
  roles?: Role[]
  status: 'ACTIVE' | 'DISABLED'
  createdAt: string
}

const ROLE_OPTIONS: Array<{ value: Role; label: string }> = [
  { value: 'EMPLOYEE', label: 'موظف' },
  { value: 'REVIEWER', label: 'مراجع / مدقق' },
  { value: 'ADMIN', label: 'مدير النظام' },
]

export default function AdminUsersClient() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loadError, setLoadError] = useState('')
  const [isPending, startTransition] = useTransition()

  async function loadUsers() {
    const response = await fetch('/api/admin/users', { cache: 'no-store' })
    const data = await response.json()
    if (!response.ok) {
      setLoadError(data.error ?? 'تعذر تحميل الحسابات')
      return
    }

    setLoadError('')
    setUsers(data)
  }

  useEffect(() => {
    void loadUsers()
  }, [])

  return (
    <div className="space-y-4">
      {loadError && (
        <div className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">{loadError}</div>
      )}

      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-soft">
        <div className="grid grid-cols-6 gap-3 border-b border-slate-100 px-5 py-4 text-sm font-bold text-slate-700">
          <div>الاسم</div>
          <div>البريد</div>
          <div>الجوال</div>
          <div>التحويلة</div>
          <div>الصلاحيات</div>
          <div>الإجراءات</div>
        </div>

        <div className="divide-y divide-slate-100">
          {users.map((user) => {
            const activeRoles = user.roles?.length ? user.roles : [user.role]

            return (
              <div key={user.id} className="grid grid-cols-6 gap-3 px-5 py-4 text-sm">
                <div>{user.fullName}</div>
                <div className="truncate">{user.email}</div>
                <div>{user.mobile}</div>
                <div>{user.extension}</div>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {ROLE_OPTIONS.map((roleOption) => {
                      const checked = activeRoles.includes(roleOption.value)

                      return (
                        <label
                          key={roleOption.value}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => {
                              const nextRoles = event.target.checked
                                ? [...new Set([...activeRoles, roleOption.value])]
                                : activeRoles.filter((role) => role !== roleOption.value)

                              if (nextRoles.length === 0) return

                              startTransition(async () => {
                                await fetch(`/api/admin/users/${user.id}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ roles: nextRoles }),
                                })
                                await loadUsers()
                              })
                            }}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          <span>{roleOption.label}</span>
                        </label>
                      )
                    })}
                  </div>

                  <select
                    value={user.status}
                    onChange={(event) => {
                      const status = event.target.value
                      startTransition(async () => {
                        await fetch(`/api/admin/users/${user.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ status }),
                        })
                        await loadUsers()
                      })
                    }}
                    className="input-shell !px-3 !py-2 !text-xs"
                  >
                    <option value="ACTIVE">نشط</option>
                    <option value="DISABLED">معطل</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      const password = window.prompt('أدخل كلمة المرور الجديدة')
                      if (!password) return

                      startTransition(async () => {
                        await fetch(`/api/admin/users/${user.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ password }),
                        })
                        await loadUsers()
                      })
                    }}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"
                  >
                    كلمة المرور
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      if (!window.confirm(`حذف الحساب: ${user.fullName}؟`)) return

                      startTransition(async () => {
                        await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' })
                        await loadUsers()
                      })
                    }}
                    className="rounded-xl border border-danger/20 px-3 py-2 text-xs font-bold text-danger"
                  >
                    حذف
                  </button>
                </div>
              </div>
            )
          })}

          {users.length === 0 && (
            <div className="px-5 py-12 text-center text-sm text-slate-500">لا توجد حسابات</div>
          )}
        </div>
      </div>
    </div>
  )
}

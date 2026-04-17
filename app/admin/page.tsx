import Link from 'next/link'
import AdminUsersClient from '@/app/AdminUsersClient'
import { requireAdminUser } from '@/lib/auth'

export default function AdminPage() {
  const user = requireAdminUser()

  return (
    <main className="min-h-screen bg-app-gradient px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between rounded-[28px] border border-slate-200 bg-white px-6 py-5 shadow-soft">
          <div>
            <h1 className="text-2xl font-bold text-primary">إدارة الحسابات</h1>
            <p className="mt-1 text-sm text-slate-500">
              {user.fullName} • {user.email}
            </p>
          </div>
          <Link
            href="/"
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600"
          >
            العودة للمنصة
          </Link>
        </div>

        <AdminUsersClient />
      </div>
    </main>
  )
}

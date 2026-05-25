import { requireSuperAdminUser } from '@/lib/auth'
import AdminSettingsClient from '@/app/AdminSettingsClient'
import Link from 'next/link'
import Image from 'next/image'

export default function AdminSettingsPage() {
  const user = requireSuperAdminUser()

  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <div className="sidebar-logo">
          <Image src="/nauss-login-brand.png" alt="جامعة نايف العربية للعلوم الأمنية" width={330} height={95} className="h-auto w-full max-w-[205px]" priority />
          <p className="text-xs mt-3" style={{ color: '#D4A853' }}>منصة السلف المؤقتة</p>
        </div>
        <nav className="flex-1 py-3">
          <p className="sidebar-section-label">القائمة الرئيسية</p>
          <Link href="/" className="nav-item">
            <span>📋</span> لوحة التحكم
          </Link>
          <p className="sidebar-section-label mt-4">الإدارة</p>
          <Link href="/admin" className="nav-item">
            <span>👥</span> إدارة المستخدمين
          </Link>
          <Link href="/admin/settings" className="nav-item active">
            <span>⚙️</span> إعدادات النظام
          </Link>
        </nav>
        <div style={{ borderTop: '1px solid #1A3527', padding: '1rem' }}>
          <div className="flex items-center gap-3 mb-3">
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#C9943A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', color: '#fff', fontWeight: 700, flexShrink: 0 }}>
              {user.fullName.charAt(0)}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <p className="text-sm font-semibold truncate" style={{ color: '#E4EDE8' }}>{user.fullName}</p>
              <p className="text-xs" style={{ color: '#4A7A65' }}>مدير النظام</p>
            </div>
          </div>
          <Link href="/" className="block w-full text-center text-xs font-semibold py-2 rounded-lg transition"
            style={{ background: 'rgba(27,67,50,0.3)', color: '#A8C5B8', border: '1px solid #1A3527' }}>
            العودة للوحة التحكم
          </Link>
        </div>
      </aside>

      <div className="app-content">
        <header className="app-topbar">
          <div>
            <h1 className="text-base font-bold" style={{ color: '#0D1F18' }}>إعدادات النظام</h1>
            <p className="text-xs" style={{ color: '#6B9A88' }}>{user.fullName} • {user.email}</p>
          </div>
        </header>
        <main className="app-main">
          <AdminSettingsClient />
        </main>
      </div>
    </div>
  )
}

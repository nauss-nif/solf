import { requireSessionUser } from '@/lib/auth'
import AccountClient from '@/app/AccountClient'
import Link from 'next/link'
import Image from 'next/image'

export default function AccountPage() {
  const user = requireSessionUser()

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="app-sidebar">
        <div className="sidebar-logo">
          <Image src="/nauss-login-brand.png" alt="جامعة نايف العربية للعلوم الأمنية" width={330} height={95} className="h-auto w-full max-w-[205px]" priority />
          <p className="text-xs mt-3" style={{ color: '#C7B08C' }}>منصة السلف المؤقتة</p>
        </div>
        <nav className="flex-1 py-3">
          <p className="sidebar-section-label">القائمة الرئيسية</p>
          <Link href="/" className="nav-item">
            <span>📋</span> لوحة التحكم
          </Link>
          <p className="sidebar-section-label mt-4">الحساب</p>
          <Link href="/account" className="nav-item active">
            <span>👤</span> الملف الشخصي
          </Link>
        </nav>
        <div style={{ borderTop: '1px solid rgba(218,219,217,0.18)', padding: '1rem' }}>
          <div className="flex items-center gap-3 mb-3">
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#2A6364', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', color: '#E8ECEB', fontWeight: 700, flexShrink: 0 }}>
              {user.fullName.charAt(0)}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <p className="text-sm font-semibold truncate" style={{ color: '#DADBD9' }}>{user.fullName}</p>
              <p className="text-xs truncate" style={{ color: '#5A5A5A' }}>{user.email}</p>
            </div>
          </div>
          <Link href="/" className="block w-full text-center text-xs font-semibold py-2 rounded-lg transition"
            style={{ background: 'rgba(42,99,100,0.28)', color: '#E8ECEB', border: '1px solid rgba(218,219,217,0.18)' }}>
            العودة للوحة التحكم
          </Link>
        </div>
      </aside>

      {/* Content */}
      <div className="app-content">
        <header className="app-topbar">
          <div>
            <h1 className="text-base font-bold" style={{ color: '#1F3F40' }}>الملف الشخصي</h1>
            <p className="text-xs" style={{ color: '#5A5A5A' }}>{user.fullName} • {user.email}</p>
          </div>
        </header>
        <main className="app-main">
          <AccountClient />
        </main>
      </div>
    </div>
  )
}

import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import LoginForm from '@/app/LoginForm'
import { getSessionUser } from '@/lib/auth'

export default function LoginPage() {
  if (getSessionUser()) redirect('/')

  return (
    <main className="min-h-screen flex" style={{ background: '#F9F9F9' }}>
      {/* Panel — left side */}
      <div className="hidden lg:flex lg:w-[46%] xl:w-[52%] relative overflow-hidden"
           style={{ background: 'linear-gradient(160deg, #203F40 0%, #2A6364 55%, #2E6F8E 100%)' }}>
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(circle at 20% 80%, rgba(199,176,140,0.18) 0%, transparent 60%)',
        }} />
        <div className="relative z-10 flex w-full flex-col items-center justify-center p-10 text-center">
          <Image
            src="/nauss-login-brand.png"
            alt="جامعة نايف العربية للعلوم الأمنية"
            width={520}
            height={150}
            className="h-auto w-full max-w-[420px]"
            priority
          />
          <div className="mt-12 flex flex-col items-center">
            <h1 className="text-3xl xl:text-4xl font-bold text-white leading-snug mb-4">
              منصة طلب<br />السلف المؤقتة
            </h1>
            <p className="text-base text-white/70 leading-7 max-w-sm text-center">
              إدارة طلبات السلف والتسويات المالية بشكل رقمي متكامل مع إنتاج النماذج الرسمية المعتمدة جاهزة للتوقيع.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3">
              {['نموذج ١٨ — طلب صرف سلفة مؤقتة', 'نموذج ١٩ — تسوية السلفة المؤقتة', 'تصدير Word وطباعة النماذج الرسمية'].map((feat) => (
                <div key={feat} className="flex items-center justify-center gap-3 text-sm text-white/80">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(199,176,140,0.28)' }}>
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-yellow-400">
                      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd"/>
                    </svg>
                  </span>
                  {feat}
                </div>
              ))}
            </div>
          </div>
          <p className="mt-12 text-xs text-white/40">وكالة التدريب — جامعة نايف العربية للعلوم الأمنية</p>
        </div>
      </div>

      {/* Form — right side */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10">
        {/* Mobile logo */}
        <div className="lg:hidden mb-8 text-center">
          <Image src="/nauss-login-brand.png" alt="الجامعة" width={360} height={104} className="h-auto w-[280px] mx-auto" priority />
        </div>

        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="text-2xl font-bold" style={{ color: '#1F3F40' }}>تسجيل الدخول</h2>
            <p className="text-sm mt-1" style={{ color: '#5A5A5A' }}>أنشئ حساباً جديداً إذا لم يكن لديك حساب سابق في المنصة.</p>
          </div>

          <div className="card p-8">
            <LoginForm />
          </div>

          <p className="mt-5 text-center text-sm" style={{ color: '#5A5A5A' }}>
            ليس لديك حساب؟{' '}
            <Link href="/register" className="font-semibold" style={{ color: '#2A6364' }}>
              إنشاء حساب جديد
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}

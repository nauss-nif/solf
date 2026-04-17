import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import LoginForm from '@/app/LoginForm'
import { getSessionUser } from '@/lib/auth'

export default function LoginPage() {
  if (getSessionUser()) {
    redirect('/')
  }

  return (
    <main className="min-h-screen bg-app-gradient px-4 py-8 md:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 rounded-[34px] border border-white/60 bg-[#123f41] px-6 py-7 shadow-soft md:px-10">
          <div className="flex flex-col items-center gap-6 text-center">
            <Image
              src="/nauss-login-brand.png"
              alt="شعار جامعة نايف العربية للعلوم الأمنية"
              width={540}
              height={170}
              className="h-auto w-full max-w-[540px]"
              priority
            />
            <div className="space-y-3 text-white">
              <h1 className="text-3xl font-medium md:text-5xl">منصة طلب السلف المؤقتة</h1>
              <p className="text-base text-white/80 md:text-lg">
                وكالة التدريب بجامعة نايف العربية للعلوم الأمنية
              </p>
            </div>
          </div>
        </header>

        <section className="mx-auto max-w-xl rounded-[36px] border border-slate-200 bg-white p-8 shadow-soft md:p-10">
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-medium text-primary">تسجيل الدخول</h2>
          </div>

          <LoginForm />

          <p className="mt-6 text-center text-sm text-slate-500">
            ليس لديك حساب؟{' '}
            <Link href="/register" className="font-medium text-primary">
              إنشاء حساب جديد
            </Link>
          </p>
        </section>
      </div>
    </main>
  )
}

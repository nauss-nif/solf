import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import RegisterForm from '@/app/RegisterForm'
import { getSessionUser } from '@/lib/auth'

export default function RegisterPage() {
  if (getSessionUser()) {
    redirect('/')
  }

  return (
    <main className="min-h-screen bg-app-gradient px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 overflow-hidden rounded-[32px] border border-white/60 bg-[#123f41] px-5 py-7 text-center shadow-soft md:px-8 md:py-8">
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-4">
            <Image
              src="/logo-footer.png"
              alt="شعار جامعة نايف العربية للعلوم الأمنية"
              width={520}
              height={110}
              className="h-auto w-full max-w-[520px]"
              priority
            />
            <div className="space-y-1.5 text-white">
              <h1 className="text-2xl font-semibold md:text-4xl">منصة طلب السلف المؤقتة</h1>
              <p className="text-sm text-white/90 md:text-lg">
                وكالة التدريب بجامعة نايف العربية للعلوم الأمنية
              </p>
            </div>
          </div>
        </header>

        <section className="mx-auto max-w-3xl rounded-[32px] border border-slate-200 bg-white p-6 shadow-soft md:p-8">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-semibold text-primary md:text-3xl">إنشاء حساب جديد</h2>
          </div>

          <RegisterForm />

          <p className="mt-5 text-center text-sm text-slate-500">
            لديك حساب بالفعل؟{' '}
            <Link href="/login" className="font-semibold text-primary">
              تسجيل الدخول
            </Link>
          </p>
        </section>
      </div>
    </main>
  )
}

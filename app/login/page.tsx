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
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <section className="overflow-hidden rounded-[36px] border border-white/60 bg-[#113f41] text-white shadow-soft">
          <div className="relative h-full overflow-hidden px-8 py-10 md:px-10 md:py-12">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(208,178,132,0.34),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.08),transparent_22%)]" />
            <div className="relative z-10 flex h-full flex-col justify-between gap-10">
              <div className="flex flex-col gap-8">
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <p className="text-sm font-semibold tracking-[0.28em] text-[#d0b284]">
                      NAUSS
                    </p>
                    <h1 className="mt-3 text-3xl font-bold leading-tight md:text-5xl">
                      نظام السلف المؤقتة
                    </h1>
                    <p className="mt-4 max-w-xl text-sm leading-8 text-white/80 md:text-base">
                      بوابة جامعة نايف العربية للعلوم الأمنية الخاصة بطلب السلفة وتسويتها.
                    </p>
                  </div>

                  <div className="hidden rounded-[28px] border border-white/10 bg-white/5 p-4 backdrop-blur md:block">
                    <Image
                      src="/nauss-login-brand.png"
                      alt="هوية جامعة نايف العربية للعلوم الأمنية"
                      width={260}
                      height={82}
                      className="h-auto w-[240px]"
                      priority
                    />
                  </div>
                </div>

                <div className="block rounded-[28px] border border-white/10 bg-white/5 p-4 backdrop-blur md:hidden">
                  <Image
                    src="/nauss-login-brand.png"
                    alt="هوية جامعة نايف العربية للعلوم الأمنية"
                    width={260}
                    height={82}
                    className="h-auto w-full"
                    priority
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs text-white/65">الدخول</p>
                  <p className="mt-2 text-lg font-bold">بريد رسمي وكلمة مرور</p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs text-white/65">الطلبات</p>
                  <p className="mt-2 text-lg font-bold">تقديم السلفة من الحساب نفسه</p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs text-white/65">التسوية</p>
                  <p className="mt-2 text-lg font-bold">إقفال السلفة من نفس المنصة</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[36px] border border-slate-200 bg-white p-8 shadow-soft md:p-10">
          <div className="mb-8">
            <p className="text-sm font-semibold text-[#b89a68]">بوابة الدخول الرسمية</p>
            <h2 className="mt-3 text-3xl font-bold text-primary">تسجيل الدخول</h2>
            <p className="mt-2 text-sm leading-7 text-slate-500">
              استخدم البريد الرسمي للدخول إلى المنصة.
            </p>
          </div>

          <LoginForm />

          <p className="mt-6 text-center text-sm text-slate-500">
            ليس لديك حساب؟{' '}
            <Link href="/register" className="font-bold text-primary">
              إنشاء حساب جديد
            </Link>
          </p>
        </section>
      </div>
    </main>
  )
}

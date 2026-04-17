import Link from 'next/link'
import { redirect } from 'next/navigation'
import LoginForm from '@/app/LoginForm'
import { getSessionUser } from '@/lib/auth'

export default function LoginPage() {
  if (getSessionUser()) {
    redirect('/')
  }

  return (
    <main className="min-h-screen bg-app-gradient px-4 py-10">
      <div className="mx-auto max-w-xl rounded-[32px] border border-slate-200 bg-white p-8 shadow-soft">
        <h1 className="text-2xl font-bold text-primary">تسجيل الدخول</h1>
        <p className="mt-2 text-sm text-slate-500">الدخول إلى منصة السلف المؤقتة</p>
        <div className="mt-6">
          <LoginForm />
        </div>
        <p className="mt-6 text-center text-sm text-slate-500">
          ليس لديك حساب؟ <Link href="/register" className="font-bold text-primary">إنشاء حساب جديد</Link>
        </p>
      </div>
    </main>
  )
}

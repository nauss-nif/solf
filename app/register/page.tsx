import Link from 'next/link'
import { redirect } from 'next/navigation'
import RegisterForm from '@/app/RegisterForm'
import { getSessionUser } from '@/lib/auth'

export default function RegisterPage() {
  if (getSessionUser()) {
    redirect('/')
  }

  return (
    <main className="min-h-screen bg-app-gradient px-4 py-10">
      <div className="mx-auto max-w-3xl rounded-[32px] border border-slate-200 bg-white p-8 shadow-soft">
        <h1 className="text-2xl font-bold text-primary">إنشاء حساب جديد</h1>
        <p className="mt-2 text-sm text-slate-500">التسجيل كباحث أو موظف داخل المنصة</p>
        <div className="mt-6">
          <RegisterForm />
        </div>
        <p className="mt-6 text-center text-sm text-slate-500">
          لديك حساب بالفعل؟ <Link href="/login" className="font-bold text-primary">تسجيل الدخول</Link>
        </p>
      </div>
    </main>
  )
}

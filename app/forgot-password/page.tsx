import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import ForgotPasswordForm from '@/app/ForgotPasswordForm'
import { getSessionUser } from '@/lib/auth'

export default function ForgotPasswordPage() {
  if (getSessionUser()) redirect('/')

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-10" style={{ background: '#F9F9F9' }}>
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Image src="/nauss-login-brand.png" alt="جامعة نايف العربية للعلوم الأمنية" width={360} height={104} className="h-auto w-[280px] mx-auto" priority />
          <h1 className="mt-8 text-2xl font-bold" style={{ color: '#1F3F40' }}>استعادة كلمة المرور</h1>
          <p className="mt-2 text-sm" style={{ color: '#5A5A5A' }}>أدخل بريدك المسجل ليصلك كود إعادة تعيين كلمة المرور.</p>
        </div>
        <div className="card p-8">
          <ForgotPasswordForm />
        </div>
        <p className="mt-5 text-center text-sm" style={{ color: '#5A5A5A' }}>
          تذكرت كلمة المرور؟{' '}
          <Link href="/login" className="font-semibold" style={{ color: '#2A6364' }}>تسجيل الدخول</Link>
        </p>
      </div>
    </main>
  )
}

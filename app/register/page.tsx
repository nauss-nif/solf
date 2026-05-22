import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import RegisterForm from '@/app/RegisterForm'
import { getSessionUser } from '@/lib/auth'

export default function RegisterPage() {
  if (getSessionUser()) redirect('/')

  return (
    <main className="min-h-screen flex items-start justify-center py-10 px-4"
          style={{ background: '#F0F5F2' }}>
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <Image src="/logo-footer.png" alt="الجامعة" width={320} height={70} className="h-auto w-[220px] mx-auto mb-5" priority />
          <h1 className="text-2xl font-bold" style={{ color: '#0D1F18' }}>إنشاء حساب جديد</h1>
          <p className="text-sm mt-1" style={{ color: '#6B9A88' }}>أدخل بياناتك الوظيفية لإنشاء حسابك على المنصة</p>
        </div>

        <div className="card p-8">
          <RegisterForm />
        </div>

        <p className="mt-5 text-center text-sm" style={{ color: '#6B9A88' }}>
          لديك حساب بالفعل؟{' '}
          <Link href="/login" className="font-semibold" style={{ color: '#1B4332' }}>
            تسجيل الدخول
          </Link>
        </p>
      </div>
    </main>
  )
}

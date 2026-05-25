import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import RegisterForm from '@/app/RegisterForm'
import { getSessionUser } from '@/lib/auth'

export default function RegisterPage() {
  if (getSessionUser()) redirect('/')

  return (
    <main className="min-h-screen flex items-start justify-center py-10 px-4"
          style={{ background: '#F9F9F9' }}>
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <Image src="/logo-footer.png" alt="الجامعة" width={320} height={70} className="h-auto w-[220px] mx-auto mb-5" priority />
          <h1 className="text-2xl font-bold" style={{ color: '#1F3F40' }}>إنشاء حساب جديد</h1>
          <p className="text-sm mt-1" style={{ color: '#5A5A5A' }}>أدخل بياناتك الوظيفية لإنشاء حسابك على المنصة</p>
        </div>

        <div className="card p-8">
          <RegisterForm />
        </div>

        <p className="mt-5 text-center text-sm" style={{ color: '#5A5A5A' }}>
          لديك حساب بالفعل؟{' '}
          <Link href="/login" className="font-semibold" style={{ color: '#2A6364' }}>
            تسجيل الدخول
          </Link>
        </p>
      </div>
    </main>
  )
}

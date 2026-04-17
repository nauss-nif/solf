import type { Metadata } from 'next'
import { Cairo } from 'next/font/google'
import './globals.css'

const cairo = Cairo({
  subsets: ['arabic'],
  weight: ['400', '500', '600'],
})

export const metadata: Metadata = {
  title: 'منصة طلب السلف المؤقتة',
  description: 'وكالة التدريب بجامعة نايف العربية للعلوم الأمنية',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className={cairo.className}>{children}</body>
    </html>
  )
}

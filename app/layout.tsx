import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'منصة السلف المؤقتة — وكالة التدريب',
  description: 'نظام إدارة طلبات السلف المؤقتة والتسويات المالية — جامعة نايف العربية للعلوم الأمنية',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
      </head>
      <body>{children}</body>
    </html>
  )
}

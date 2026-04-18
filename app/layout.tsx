import type { Metadata } from 'next'
import '@fontsource/cairo/400.css'
import '@fontsource/cairo/600.css'
import '@fontsource/cairo/700.css'
import './globals.css'

export const metadata: Metadata = {
  title: 'منصة طلب السلف المؤقتة',
  description: 'وكالة التدريب بجامعة نايف العربية للعلوم الامنية',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  )
}

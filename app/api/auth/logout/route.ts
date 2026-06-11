import { NextResponse } from 'next/server'
import { clearSessionCookie } from '@/lib/auth'

export async function POST() {
  clearSessionCookie()
  return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } })
}

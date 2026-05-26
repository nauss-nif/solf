import { NextResponse } from 'next/server'
import { getSessionUser, isSuperAdmin } from '@/lib/auth'
import { getEmailConfigurationStatus, sendTestEmail } from '@/lib/notifications'

function requireSuperAdminResponse() {
  const currentUser = getSessionUser()
  if (!isSuperAdmin(currentUser)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { currentUser }
}

export async function GET() {
  const auth = requireSuperAdminResponse()
  if ('error' in auth) return auth.error

  return NextResponse.json(getEmailConfigurationStatus())
}

export async function POST(request: Request) {
  const auth = requireSuperAdminResponse()
  if ('error' in auth) return auth.error
  const currentUser = auth.currentUser
  if (!currentUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  const targetEmail = typeof body.to === 'string' && body.to.trim()
    ? body.to.trim().toLowerCase()
    : currentUser.email

  const sent = await sendTestEmail({
    to: targetEmail,
    fullName: currentUser.fullName,
  })

  return NextResponse.json({ sent, to: targetEmail })
}

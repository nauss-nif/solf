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

export async function POST() {
  const auth = requireSuperAdminResponse()
  if ('error' in auth) return auth.error
  const currentUser = auth.currentUser
  if (!currentUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sent = await sendTestEmail({
    to: currentUser.email,
    fullName: currentUser.fullName,
  })

  return NextResponse.json({ sent, to: currentUser.email })
}

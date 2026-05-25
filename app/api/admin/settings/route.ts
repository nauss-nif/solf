import { NextResponse } from 'next/server'
import { getSessionUser, isSuperAdmin } from '@/lib/auth'
import { getSystemSettings, updateSystemSettings } from '@/lib/system-settings'

function requireSuperAdminResponse() {
  const currentUser = getSessionUser()
  if (!isSuperAdmin(currentUser)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { currentUser }
}

export async function GET() {
  try {
    const auth = requireSuperAdminResponse()
    if ('error' in auth) return auth.error

    return NextResponse.json(await getSystemSettings())
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load settings' },
      { status: 500 },
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = requireSuperAdminResponse()
    if ('error' in auth) return auth.error

    const body = await request.json()
    const settings = await updateSystemSettings({
      allowPrintBeforeReview: typeof body.allowPrintBeforeReview === 'boolean'
        ? body.allowPrintBeforeReview
        : undefined,
      trainingVicePresidentName: typeof body.trainingVicePresidentName === 'string'
        ? body.trainingVicePresidentName
        : undefined,
      financialControllerName: typeof body.financialControllerName === 'string'
        ? body.financialControllerName
        : undefined,
    })

    return NextResponse.json(settings)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update settings' },
      { status: 500 },
    )
  }
}

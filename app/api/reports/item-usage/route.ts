import { NextResponse } from 'next/server'
import { canManageAllLoans, getSessionUser } from '@/lib/auth'
import { ensureDatabaseSetup } from '@/lib/database-setup'
import { getItemUsageStats } from '@/lib/reports'

export async function GET() {
  await ensureDatabaseSetup()
  const currentUser = getSessionUser()
  if (!currentUser || !canManageAllLoans(currentUser)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const stats = await getItemUsageStats()
  return NextResponse.json(stats)
}

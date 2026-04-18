import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  getPrimaryRole,
  getSessionUser,
  hasRole,
  hashPassword,
  normalizeRoles,
} from '@/lib/auth'
import { ensureAuthSetup } from '@/lib/database-setup'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    await ensureAuthSetup()
    const currentUser = getSessionUser()
    if (!hasRole(currentUser, 'ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!currentUser) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const data: Record<string, unknown> = {}

    if (body.fullName) data.fullName = String(body.fullName).trim()
    if (body.email) data.email = String(body.email).trim().toLowerCase()
    if (body.mobile) data.mobile = String(body.mobile).trim()
    if (body.extension) data.extension = String(body.extension).trim()
    if (body.status) data.status = body.status
    if (body.password) data.passwordHash = hashPassword(String(body.password))
    if (body.role || body.roles) {
      const roles = normalizeRoles(body.roles, (body.role ?? 'EMPLOYEE') as 'EMPLOYEE' | 'ADMIN' | 'REVIEWER')
      data.roles = roles
      data.role = getPrimaryRole(roles)
    }

    const user = await prisma.user.update({
      where: { id: params.id },
      data,
      select: {
        id: true,
        fullName: true,
        email: true,
        mobile: true,
        extension: true,
        role: true,
        roles: true,
        status: true,
      },
    })

    return NextResponse.json({
      ...user,
      roles: normalizeRoles(user.roles, user.role as 'EMPLOYEE' | 'ADMIN' | 'REVIEWER'),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update user' },
      { status: 500 },
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    await ensureAuthSetup()
    const currentUser = getSessionUser()
    if (!hasRole(currentUser, 'ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!currentUser) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (currentUser.userId === params.id) {
      return NextResponse.json({ error: 'Cannot delete current admin' }, { status: 400 })
    }

    await prisma.user.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete user' },
      { status: 500 },
    )
  }
}

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, hashPassword } from '@/lib/auth'
import { ensureDatabaseSetup } from '@/lib/database-setup'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    await ensureDatabaseSetup()
    const currentUser = getSessionUser()
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const data: Record<string, string> = {}

    if (body.fullName) data.fullName = String(body.fullName).trim()
    if (body.email) data.email = String(body.email).trim().toLowerCase()
    if (body.mobile) data.mobile = String(body.mobile).trim()
    if (body.extension) data.extension = String(body.extension).trim()
    if (body.role) data.role = body.role
    if (body.status) data.status = body.status
    if (body.password) data.passwordHash = hashPassword(String(body.password))

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
        status: true,
      },
    })

    return NextResponse.json(user)
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
    await ensureDatabaseSetup()
    const currentUser = getSessionUser()
    if (!currentUser || currentUser.role !== 'ADMIN') {
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

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  getPrimaryRole,
  getSessionUser,
  hashPassword,
  isSuperAdmin,
  normalizeRoles,
} from '@/lib/auth'
import { ensureAuthSetup } from '@/lib/database-setup'
import { isStoredImageFile } from '@/lib/loan-form-options'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    await ensureAuthSetup()
    const currentUser = getSessionUser()
    if (!isSuperAdmin(currentUser)) {
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
    if (body.password) {
      const password = String(body.password)
      if (password.length < 10) {
        return NextResponse.json({ error: 'كلمة المرور يجب أن تكون 10 أحرف على الأقل' }, { status: 400 })
      }
      data.passwordHash = hashPassword(password)
    }
    if (body.role || body.roles) {
      const roles = normalizeRoles(body.roles, (body.role ?? 'EMPLOYEE') as 'EMPLOYEE' | 'ADMIN' | 'REVIEWER')
      data.roles = roles
      data.role = getPrimaryRole(roles)
    }
    if ('signatureImage' in body) {
      if (body.signatureImage === null) {
        data.signatureImage = null
      } else if (isStoredImageFile(body.signatureImage)) {
        data.signatureImage = body.signatureImage
      } else {
        return NextResponse.json({ error: 'التوقيع يجب أن يكون صورة فقط.' }, { status: 400 })
      }
    }
    if ('profileImage' in body) {
      if (body.profileImage === null) {
        data.profileImage = null
      } else if (isStoredImageFile(body.profileImage)) {
        data.profileImage = body.profileImage
      } else {
        return NextResponse.json({ error: 'الصورة الشخصية يجب أن تكون صورة فقط.' }, { status: 400 })
      }
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
        signatureImage: true,
        profileImage: true,
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
    if (!isSuperAdmin(currentUser)) {
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

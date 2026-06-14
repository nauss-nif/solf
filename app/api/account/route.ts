import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, setSessionCookie } from '@/lib/auth'
import { ensureAuthSetup } from '@/lib/database-setup'
import { isStoredImageFile } from '@/lib/loan-form-options'

export async function GET() {
  try {
    await ensureAuthSetup()
    const currentUser = getSessionUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: currentUser.userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        mobile: true,
        extension: true,
        role: true,
        roles: true,
        profileImage: true,
        signatureImage: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load account' },
      { status: 500 },
    )
  }
}

export async function PATCH(request: Request) {
  try {
    await ensureAuthSetup()
    const currentUser = getSessionUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data: Record<string, unknown> = {}

    if (body.fullName) data.fullName = String(body.fullName).trim()
    if (body.mobile) data.mobile = String(body.mobile).trim()
    if (body.extension) data.extension = String(body.extension).trim()

    if ('profileImage' in body) {
      if (body.profileImage === null) {
        data.profileImage = null
      } else if (isStoredImageFile(body.profileImage)) {
        data.profileImage = body.profileImage
      } else {
        return NextResponse.json({ error: 'الصورة الشخصية يجب أن تكون صورة فقط.' }, { status: 400 })
      }
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

    const user = await prisma.user.update({
      where: { id: currentUser.userId },
      data,
      select: {
        id: true,
        fullName: true,
        email: true,
        mobile: true,
        extension: true,
        role: true,
        roles: true,
        profileImage: true,
        signatureImage: true,
      },
    })

    setSessionCookie({
      userId: user.id,
      fullName: user.fullName,
      email: user.email,
      role: currentUser.role,
      roles: currentUser.roles,
    })

    return NextResponse.json(user)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update account' },
      { status: 500 },
    )
  }
}

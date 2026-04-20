import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ensureAuthSetup, isRuntimeDatabaseSetupEnabled } from '@/lib/database-setup'

const SESSION_COOKIE = 'naif_session'
const AUTH_SECRET = process.env.AUTH_SECRET ?? 'change-this-auth-secret'
let defaultAdminPromise: Promise<void> | null = null

export type SessionRole = 'EMPLOYEE' | 'ADMIN' | 'REVIEWER'

export type SessionUser = {
  userId: string
  fullName: string
  email: string
  role: SessionRole
  roles: SessionRole[]
}

export function normalizeRoles(
  value: unknown,
  fallbackRole: SessionRole = 'EMPLOYEE',
): SessionRole[] {
  const source = Array.isArray(value) ? value : [fallbackRole]
  const roles = source.filter(
    (item): item is SessionRole =>
      item === 'EMPLOYEE' || item === 'ADMIN' || item === 'REVIEWER',
  )

  return roles.length > 0 ? Array.from(new Set(roles)) : [fallbackRole]
}

export function getPrimaryRole(roles: SessionRole[]) {
  if (roles.includes('ADMIN')) return 'ADMIN'
  if (roles.includes('REVIEWER')) return 'REVIEWER'
  return 'EMPLOYEE'
}

export function hasRole(
  user: Pick<SessionUser, 'role' | 'roles'> | null | undefined,
  role: SessionRole,
) {
  if (!user) return false
  return normalizeRoles(user.roles, user.role).includes(role)
}

export function canManageAllLoans(user: Pick<SessionUser, 'role' | 'roles'> | SessionRole) {
  if (typeof user === 'string') {
    return user === 'ADMIN' || user === 'REVIEWER'
  }

  return hasRole(user, 'ADMIN') || hasRole(user, 'REVIEWER')
}

function toBase64Url(value: string) {
  return Buffer.from(value).toString('base64url')
}

function fromBase64Url(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function signValue(value: string) {
  return createHmac('sha256', AUTH_SECRET).update(value).digest('base64url')
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const derived = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${derived}`
}

export function verifyPassword(password: string, storedHash: string) {
  const [salt, storedDerived] = storedHash.split(':')
  if (!salt || !storedDerived) return false

  const computed = scryptSync(password, salt, 64)
  const storedBuffer = Buffer.from(storedDerived, 'hex')

  if (computed.length !== storedBuffer.length) return false

  return timingSafeEqual(computed, storedBuffer)
}

export function createSessionToken(user: SessionUser) {
  const payload = toBase64Url(JSON.stringify(user))
  const signature = signValue(payload)
  return `${payload}.${signature}`
}

export function readSessionToken(token?: string | null): SessionUser | null {
  if (!token) return null

  const [payload, signature] = token.split('.')
  if (!payload || !signature) return null
  if (signValue(payload) !== signature) return null

  try {
    const parsed = JSON.parse(fromBase64Url(payload)) as Partial<SessionUser>
    if (
      typeof parsed.userId !== 'string' ||
      typeof parsed.fullName !== 'string' ||
      typeof parsed.email !== 'string' ||
      typeof parsed.role !== 'string'
    ) {
      return null
    }

    const role = parsed.role as SessionRole
    const roles = normalizeRoles(parsed.roles, role)

    return {
      userId: parsed.userId,
      fullName: parsed.fullName,
      email: parsed.email,
      role: getPrimaryRole(roles),
      roles,
    }
  } catch {
    return null
  }
}

export function getSessionUser() {
  const token = cookies().get(SESSION_COOKIE)?.value
  return readSessionToken(token)
}

export function requireSessionUser() {
  const user = getSessionUser()
  if (!user) redirect('/login')
  return user
}

export function requireAdminUser() {
  const user = requireSessionUser()
  if (!hasRole(user, 'ADMIN')) redirect('/')
  return user
}

export function setSessionCookie(user: SessionUser) {
  cookies().set(SESSION_COOKIE, createSessionToken(user), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })
}

export function clearSessionCookie() {
  cookies().delete(SESSION_COOKIE)
}

export async function ensureDefaultAdmin() {
  if (!isRuntimeDatabaseSetupEnabled()) return

  if (!defaultAdminPromise) {
    defaultAdminPromise = (async () => {
      await ensureAuthSetup()
      const adminEmail = 'od@nauss.edu.sa'
      const existing = await prisma.user.findUnique({
        where: { email: adminEmail },
        select: { id: true },
      })

      if (existing) return

      await prisma.user.create({
        data: {
          fullName: 'مدير النظام',
          email: adminEmail,
          mobile: '0500000000',
          extension: '0000',
          passwordHash: hashPassword('Zx.321321'),
          role: 'ADMIN',
          roles: ['EMPLOYEE', 'ADMIN'],
          status: 'ACTIVE',
        },
      })
    })().catch((error) => {
      defaultAdminPromise = null
      throw error
    })
  }

  await defaultAdminPromise
}

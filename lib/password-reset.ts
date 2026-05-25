import { createHash, randomInt } from 'node:crypto'
import { prisma } from '@/lib/prisma'

const RESET_CODE_TTL_MINUTES = 15

function hashResetCode(code: string) {
  return createHash('sha256').update(code).digest('hex')
}

export function createResetCode() {
  return String(randomInt(100000, 1000000))
}

async function ensurePasswordResetTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "password_reset_codes" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "userId" TEXT NOT NULL,
      "codeHash" TEXT NOT NULL,
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "usedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `)

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "password_reset_codes_userId_idx"
    ON "password_reset_codes" ("userId", "createdAt");
  `)
}

export async function savePasswordResetCode(userId: string, code: string) {
  await ensurePasswordResetTable()
  await prisma.$executeRaw`
    INSERT INTO "password_reset_codes" ("userId", "codeHash", "expiresAt")
    VALUES (${userId}, ${hashResetCode(code)}, NOW() + (${`${RESET_CODE_TTL_MINUTES} minutes`})::interval)
  `
}

export async function consumePasswordResetCode(userId: string, code: string) {
  await ensurePasswordResetTable()

  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "password_reset_codes"
    WHERE "userId" = ${userId}
      AND "codeHash" = ${hashResetCode(code)}
      AND "usedAt" IS NULL
      AND "expiresAt" > NOW()
    ORDER BY "createdAt" DESC
    LIMIT 1
  `

  const match = rows[0]
  if (!match) return false

  await prisma.$executeRaw`
    UPDATE "password_reset_codes"
    SET "usedAt" = NOW()
    WHERE "id" = ${match.id}
  `

  return true
}

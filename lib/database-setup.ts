import { prisma } from '@/lib/prisma'

let setupPromise: Promise<void> | null = null
let authSetupPromise: Promise<void> | null = null

async function runAuthSetup() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "users" (
      "id" TEXT PRIMARY KEY,
      "fullName" TEXT NOT NULL,
      "email" TEXT NOT NULL UNIQUE,
      "mobile" TEXT NOT NULL,
      "extension" TEXT NOT NULL,
      "passwordHash" TEXT NOT NULL,
      "role" TEXT NOT NULL DEFAULT 'EMPLOYEE',
      "status" TEXT NOT NULL DEFAULT 'ACTIVE',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `)

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "users"
    ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'EMPLOYEE';
  `)

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "users"
    ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE';
  `)
}

async function runSetup() {
  await runAuthSetup()

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "loans" (
      "id" TEXT PRIMARY KEY,
      "refNumber" TEXT NOT NULL UNIQUE,
      "userId" TEXT,
      "employee" TEXT NOT NULL,
      "activity" TEXT NOT NULL,
      "location" TEXT,
      "amount" DOUBLE PRECISION NOT NULL,
      "startDate" TIMESTAMP(3) NOT NULL,
      "endDate" TIMESTAMP(3) NOT NULL,
      "files" JSONB,
      "isSettled" BOOLEAN NOT NULL DEFAULT FALSE,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "printedAt" TIMESTAMP(3)
    );
  `)

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "loans"
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
  `)

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "loans"
    ADD COLUMN IF NOT EXISTS "printedAt" TIMESTAMP(3);
  `)

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "loans_refNumber_key" ON "loans"("refNumber");
  `)

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "loan_items" (
      "id" TEXT PRIMARY KEY,
      "category" TEXT NOT NULL,
      "amount" DOUBLE PRECISION NOT NULL,
      "loanId" TEXT NOT NULL REFERENCES "loans"("id") ON DELETE CASCADE
    );
  `)

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "settlements" (
      "id" TEXT PRIMARY KEY,
      "supported" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "unsupported" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "savings" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "overage" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "invoices" JSONB,
      "loanId" TEXT NOT NULL UNIQUE REFERENCES "loans"("id") ON DELETE CASCADE,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `)

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "settlements_loanId_key" ON "settlements"("loanId");
  `)
}

export async function ensureAuthSetup() {
  if (!authSetupPromise) {
    authSetupPromise = runAuthSetup().catch((error) => {
      authSetupPromise = null
      throw error
    })
  }

  await authSetupPromise
}

export async function ensureDatabaseSetup() {
  if (!setupPromise) {
    setupPromise = runSetup().catch((error) => {
      setupPromise = null
      throw error
    })
  }

  await setupPromise
}

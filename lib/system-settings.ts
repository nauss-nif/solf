import { prisma } from '@/lib/prisma'

export type SystemSettings = {
  allowPrintBeforeReview: boolean
  trainingVicePresidentName: string
  financialControllerName: string
}

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  allowPrintBeforeReview: true,
  trainingVicePresidentName: 'د. عبدالرزاق عبدالعزيز المرجان',
  financialControllerName: 'شريف محمد مصطفى الغزولي',
}

const SETTING_KEYS = Object.keys(DEFAULT_SYSTEM_SETTINGS) as Array<keyof SystemSettings>

async function ensureSettingsTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "system_settings" (
      "key" TEXT PRIMARY KEY,
      "value" TEXT NOT NULL,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `)
}

function parseSettingValue<K extends keyof SystemSettings>(
  key: K,
  value: string | null | undefined,
): SystemSettings[K] {
  if (key === 'allowPrintBeforeReview') {
    return (String(value ?? DEFAULT_SYSTEM_SETTINGS[key]) === 'true') as SystemSettings[K]
  }

  return (value?.trim() || DEFAULT_SYSTEM_SETTINGS[key]) as SystemSettings[K]
}

export async function getSystemSettings(): Promise<SystemSettings> {
  await ensureSettingsTable()

  const rows = await prisma.$queryRaw<Array<{ key: string; value: string }>>`
    SELECT "key", "value" FROM "system_settings"
  `
  const byKey = new Map(rows.map((row) => [row.key, row.value]))

  return SETTING_KEYS.reduce<SystemSettings>((settings, key) => ({
    ...settings,
    [key]: parseSettingValue(key, byKey.get(key)),
  }), DEFAULT_SYSTEM_SETTINGS)
}

export async function updateSystemSettings(input: Partial<SystemSettings>) {
  await ensureSettingsTable()

  const next: Partial<Record<keyof SystemSettings, string>> = {}

  if (typeof input.allowPrintBeforeReview === 'boolean') {
    next.allowPrintBeforeReview = String(input.allowPrintBeforeReview)
  }
  if (typeof input.trainingVicePresidentName === 'string') {
    next.trainingVicePresidentName = input.trainingVicePresidentName.trim() || DEFAULT_SYSTEM_SETTINGS.trainingVicePresidentName
  }
  if (typeof input.financialControllerName === 'string') {
    next.financialControllerName = input.financialControllerName.trim() || DEFAULT_SYSTEM_SETTINGS.financialControllerName
  }

  for (const [key, value] of Object.entries(next)) {
    await prisma.$executeRaw`
      INSERT INTO "system_settings" ("key", "value", "updatedAt")
      VALUES (${key}, ${value}, NOW())
      ON CONFLICT ("key") DO UPDATE
      SET "value" = EXCLUDED."value", "updatedAt" = NOW()
    `
  }

  return getSystemSettings()
}

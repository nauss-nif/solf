import { PrismaClient } from '@prisma/client'
import fs from 'node:fs'

function loadEnvFile(path) {
  if (!fs.existsSync(path)) return
  const lines = fs.readFileSync(path, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const index = trimmed.indexOf('=')
    const key = trimmed.slice(0, index).trim()
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, '')
    if (key && process.env[key] === undefined) process.env[key] = value
  }
}

loadEnvFile('.env')
loadEnvFile('.env.local')

const prisma = new PrismaClient()

function readArg(name) {
  const prefix = `${name}=`
  const value = process.argv.find((arg) => arg.startsWith(prefix))
  return value ? value.slice(prefix.length) : ''
}

const apply = process.argv.includes('--apply')
const sinceArg = readArg('--since')
const closureWebhookUrl = process.env.CLOSURE_WEBHOOK_URL ?? ''
const closureWebhookSecret = process.env.CLOSURE_WEBHOOK_SECRET ?? process.env.WEBHOOK_SECRET ?? ''

function buildPayload(type, loan) {
  const printedAt = loan.printedAt ? loan.printedAt.toISOString() : new Date().toISOString()
  return {
    type,
    courseId: loan.courseId,
    employeeEmail: loan.user?.email,
    referenceNumber: loan.refNumber,
    amount: loan.amount,
    advanceAmount: type === 'settlement' ? loan.amount : undefined,
    spentAmount: type === 'settlement' ? loan.settlement?.total : undefined,
    printedAt,
    solfLoanId: loan.id,
  }
}

async function send(payload) {
  const response = await fetch(closureWebhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${closureWebhookSecret}`,
    },
    body: JSON.stringify(payload),
  })
  const result = await response.json().catch(() => ({}))
  return { ok: response.ok && result?.ok, status: response.status, result }
}

async function main() {
  if (apply && (!closureWebhookUrl || !closureWebhookSecret)) {
    throw new Error('Missing CLOSURE_WEBHOOK_URL or CLOSURE_WEBHOOK_SECRET.')
  }

  const since = sinceArg ? new Date(sinceArg) : null
  if (since && Number.isNaN(since.getTime())) {
    throw new Error(`Invalid --since value: ${sinceArg}`)
  }

  const loans = await prisma.loan.findMany({
    where: {
      courseId: { not: null },
      ...(since ? { updatedAt: { gte: since } } : {}),
    },
    include: {
      settlement: true,
      user: { select: { email: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  const jobs = loans.flatMap((loan) => {
    const items = []
    if (loan.reviewStatus === 'REVIEWED') items.push({ type: 'advance_req', loan })
    if (loan.settlementStatus === 'APPROVED' && loan.settlement) items.push({ type: 'settlement', loan })
    return items
  })

  console.log(`${apply ? 'Applying' : 'Dry run'} closure resync for ${jobs.length} element(s).`)

  let failed = 0
  for (const job of jobs) {
    const payload = buildPayload(job.type, job.loan)
    const label = `${job.type} ${job.loan.refNumber} course=${job.loan.courseId}`

    if (!apply) {
      console.log(`[dry-run] ${label}`)
      continue
    }

    const result = await send(payload)
    if (result.ok) {
      console.log(`[ok] ${label}`)
    } else {
      failed += 1
      console.error(`[failed] ${label}`, result)
    }
  }

  if (failed > 0) {
    process.exitCode = 1
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

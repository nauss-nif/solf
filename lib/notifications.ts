// lib/notifications.ts
// ─────────────────────────────────────────────────────────────
// نظام الإشعارات الداخلية + البريد الإلكتروني عبر Resend
// ─────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { workingDaysUntilDeadline } from '@/lib/settlement-deadline'

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? ''
const FROM_EMAIL = 'نظام السلف المؤقتة <loans@nauss.edu.sa>'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@nauss.edu.sa'

// ─────────────────────────────────────────────────────────────
// إرسال بريد إلكتروني عبر Resend
// ─────────────────────────────────────────────────────────────
async function sendEmail(options: {
  to: string
  subject: string
  html: string
}): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn('[Notifications] RESEND_API_KEY not set — skipping email')
    return false
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: options.to,
        subject: options.subject,
        html: options.html,
      }),
    })

    return response.ok
  } catch (error) {
    console.error('[Notifications] Email send failed:', error)
    return false
  }
}

// ─────────────────────────────────────────────────────────────
// قالب البريد الإلكتروني
// ─────────────────────────────────────────────────────────────
function emailTemplate(options: {
  title: string
  body: string
  actionUrl?: string
  actionLabel?: string
  isUrgent?: boolean
}): string {
  const urgentBanner = options.isUrgent
    ? `<div style="background:#dc2626;color:#fff;padding:10px 20px;text-align:center;font-weight:bold;font-size:14px;">
        ⚠️ إشعار عاجل — يتطلب إجراءً فورياً
       </div>`
    : ''

  const actionButton = options.actionUrl
    ? `<div style="text-align:center;margin:24px 0;">
        <a href="${options.actionUrl}"
           style="background:#016564;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px;">
          ${options.actionLabel ?? 'عرض التفاصيل'}
        </a>
       </div>`
    : ''

  return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8"/></head>
<body style="font-family:Tahoma,Arial,sans-serif;background:#f3f4f6;margin:0;padding:20px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">
    ${urgentBanner}
    <div style="background:#016564;padding:20px 28px;">
      <h1 style="color:#fff;margin:0;font-size:18px;">نظام السلف المؤقتة</h1>
      <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:13px;">وكالة التدريب — جامعة نايف العربية للعلوم الأمنية</p>
    </div>
    <div style="padding:28px;">
      <h2 style="color:#0f172a;margin:0 0 16px;font-size:16px;">${options.title}</h2>
      <div style="color:#374151;font-size:14px;line-height:1.8;">${options.body}</div>
      ${actionButton}
    </div>
    <div style="background:#f8fafc;padding:14px 28px;border-top:1px solid #e2e8f0;text-align:center;font-size:12px;color:#94a3b8;">
      هذا بريد إلكتروني تلقائي من نظام السلف المؤقتة — يرجى عدم الرد عليه
    </div>
  </div>
</body>
</html>`
}

// ─────────────────────────────────────────────────────────────
// إنشاء إشعار داخلي
// ─────────────────────────────────────────────────────────────
export async function createInternalNotification(options: {
  userId: string
  type: string
  title: string
  message: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "loan_notifications" ("id","userId","type","title","message","metadata","createdAt")
     VALUES (gen_random_uuid()::text, $1, $2::\"NotificationType\", $3, $4, $5, NOW())`,
    options.userId,
    options.type,
    options.title,
    options.message,
    options.metadata ? JSON.stringify(options.metadata) : null,
  )
}

// ─────────────────────────────────────────────────────────────
// إشعار: سلفة جديدة → للمراجعين والمدير
// ─────────────────────────────────────────────────────────────
export async function notifyNewLoan(loan: {
  id: string
  refNumber: string
  employee: string
  amount: number
  activity: string
}): Promise<void> {
  // جلب المراجعين والمدراء
  const reviewers = await prisma.$queryRaw<Array<{ id: string; email: string; fullName: string }>>`
    SELECT id, email, "fullName"
    FROM "users"
    WHERE "status" = 'ACTIVE'
      AND (
        roles::jsonb ? 'ADMIN'
        OR roles::jsonb ? 'REVIEWER'
      )
  `

  const message = `طلب سلفة جديد من ${loan.employee} بمبلغ ${loan.amount.toLocaleString('ar-SA')} ر.س — ${loan.activity}`

  for (const reviewer of reviewers) {
    await createInternalNotification({
      userId: reviewer.id,
      type: 'LOAN_CREATED',
      title: `طلب سلفة جديد — ${loan.refNumber}`,
      message,
      metadata: { loanId: loan.id, refNumber: loan.refNumber },
    })
  }
}

// ─────────────────────────────────────────────────────────────
// إشعار: تمت مراجعة السلفة → للموظف
// ─────────────────────────────────────────────────────────────
export async function notifyLoanReviewed(options: {
  userId: string
  userEmail: string
  refNumber: string
  loanId: string
  status: 'REVIEWED' | 'RETURNED'
  note?: string
}): Promise<void> {
  const isReturned = options.status === 'RETURNED'
  const title = isReturned
    ? `أُعيد طلبك للمراجعة — ${options.refNumber}`
    : `تمت مراجعة طلبك — ${options.refNumber}`

  const message = isReturned
    ? `تمت إعادة طلب السلفة ${options.refNumber} للمراجعة${options.note ? `: ${options.note}` : ''}`
    : `تمت مراجعة واعتماد طلب السلفة ${options.refNumber}`

  await createInternalNotification({
    userId: options.userId,
    type: isReturned ? 'LOAN_RETURNED' : 'LOAN_REVIEWED',
    title,
    message,
    metadata: { loanId: options.loanId, refNumber: options.refNumber },
  })

  // بريد إلكتروني
  await sendEmail({
    to: options.userEmail,
    subject: title,
    html: emailTemplate({
      title,
      body: `<p>${message}</p>`,
      isUrgent: isReturned,
    }),
  })
}

// ─────────────────────────────────────────────────────────────
// إشعار: تذكير بالتسوية (3 أيام قبل المهلة)
// ─────────────────────────────────────────────────────────────
export async function sendSettlementReminder(loan: {
  id: string
  refNumber: string
  userId: string | null
  employee: string
  settlementDeadline: Date
  user?: { email: string } | null
}): Promise<void> {
  if (!loan.userId) return

  const daysLeft = workingDaysUntilDeadline(loan.settlementDeadline)
  const deadlineStr = loan.settlementDeadline.toLocaleDateString('ar-SA')

  const title = `تذكير: تسوية السلفة ${loan.refNumber} تنتهي خلال ${daysLeft} أيام عمل`
  const message = `المهلة القانونية لتسوية السلفة ${loan.refNumber} هي ${deadlineStr}. يرجى إتمام التسوية في أقرب وقت.`

  await createInternalNotification({
    userId: loan.userId,
    type: 'SETTLEMENT_REMINDER',
    title,
    message,
    metadata: { loanId: loan.id, refNumber: loan.refNumber, daysLeft },
  })

  if (loan.user?.email) {
    await sendEmail({
      to: loan.user.email,
      subject: title,
      html: emailTemplate({
        title,
        body: `<p>${message}</p><p>تاريخ المهلة: <strong>${deadlineStr}</strong></p>`,
        isUrgent: daysLeft <= 1,
      }),
    })
  }

  // سجّل الإنذار
  await prisma.$executeRawUnsafe(
    `INSERT INTO "loan_alerts" ("id","loanId","alertType","sentAt","emailSent","emailTo")
     VALUES (gen_random_uuid()::text, $1, 'REMINDER_3DAYS', NOW(), $2, $3)`,
    loan.id,
    loan.user?.email ? true : false,
    loan.user?.email ?? null,
  )
}

// ─────────────────────────────────────────────────────────────
// إشعار: تأخر التسوية (تجاوز المهلة)
// ─────────────────────────────────────────────────────────────
export async function sendOverdueAlert(loan: {
  id: string
  refNumber: string
  userId: string | null
  employee: string
  settlementDeadline: Date
  user?: { email: string } | null
}): Promise<void> {
  if (!loan.userId) return

  const overdueDays = Math.abs(workingDaysUntilDeadline(loan.settlementDeadline))
  const deadlineStr = loan.settlementDeadline.toLocaleDateString('ar-SA')

  const title = `⚠️ تأخر التسوية — ${loan.refNumber} (${overdueDays} أيام عمل)`
  const message = `تجاوزت سلفة ${loan.refNumber} المهلة القانونية بـ ${overdueDays} أيام عمل. المهلة كانت ${deadlineStr}. يتطلب إجراءً فورياً.`

  // إشعار للموظف
  await createInternalNotification({
    userId: loan.userId,
    type: 'SETTLEMENT_OVERDUE',
    title,
    message,
    metadata: { loanId: loan.id, refNumber: loan.refNumber, overdueDays },
  })

  // إشعار للمدراء
  const admins = await prisma.$queryRaw<Array<{ id: string; email: string }>>`
    SELECT id, email FROM "users"
    WHERE "status" = 'ACTIVE'
      AND (roles::jsonb ? 'ADMIN' OR roles::jsonb ? 'REVIEWER')
  `

  for (const admin of admins) {
    await createInternalNotification({
      userId: admin.id,
      type: 'SETTLEMENT_OVERDUE',
      title: `⚠️ موظف متأخر في التسوية — ${loan.employee}`,
      message,
      metadata: { loanId: loan.id, refNumber: loan.refNumber, overdueDays },
    })
  }

  // بريد للموظف
  if (loan.user?.email) {
    await sendEmail({
      to: loan.user.email,
      subject: title,
      html: emailTemplate({
        title,
        body: `
          <p>${message}</p>
          <p style="color:#dc2626;font-weight:bold;">
            التأخر في تسوية السلف النقدية مخالف للوائح المالية ويعرضك للمساءلة الإدارية.
          </p>
        `,
        isUrgent: true,
      }),
    })
  }

  // بريد للمدير
  await sendEmail({
    to: ADMIN_EMAIL,
    subject: `[إدارة] تأخر التسوية — ${loan.employee} — ${loan.refNumber}`,
    html: emailTemplate({
      title: `موظف متأخر في تسوية السلفة`,
      body: `
        <p>الموظف: <strong>${loan.employee}</strong></p>
        <p>رقم السلفة: <strong>${loan.refNumber}</strong></p>
        <p>المهلة كانت: <strong>${deadlineStr}</strong></p>
        <p>التأخر: <strong>${overdueDays} أيام عمل</strong></p>
      `,
      isUrgent: true,
    }),
  })

  // سجّل الإنذار
  await prisma.$executeRawUnsafe(
    `INSERT INTO "loan_alerts" ("id","loanId","alertType","sentAt","emailSent","emailTo")
     VALUES (gen_random_uuid()::text, $1, 'OVERDUE', NOW(), TRUE, $2)`,
    loan.id,
    loan.user?.email ?? ADMIN_EMAIL,
  )
}

// ─────────────────────────────────────────────────────────────
// إنذار يدوي — يرسله المدير/المراجع من الداشبورد
// ─────────────────────────────────────────────────────────────
export async function sendManualAlert(options: {
  loanId: string
  refNumber: string
  employeeName: string
  employeeEmail: string
  sentById: string
  customMessage?: string
}): Promise<{ success: boolean }> {
  const defaultMessage = `نذكركم بضرورة تسوية السلفة ${options.refNumber} في أقرب وقت ممكن. التأخر في التسوية مخالف للوائح المالية.`
  const message = options.customMessage ?? defaultMessage

  const emailSent = await sendEmail({
    to: options.employeeEmail,
    subject: `تنبيه: تسوية السلفة ${options.refNumber}`,
    html: emailTemplate({
      title: `تنبيه بتسوية السلفة ${options.refNumber}`,
      body: `<p>${message}</p>`,
      isUrgent: true,
    }),
  })

  await prisma.$executeRawUnsafe(
    `INSERT INTO "loan_alerts" ("id","loanId","alertType","sentAt","sentById","emailSent","emailTo")
     VALUES (gen_random_uuid()::text, $1, 'MANUAL', NOW(), $2, $3, $4)`,
    options.loanId,
    options.sentById,
    emailSent,
    options.employeeEmail,
  )

  return { success: emailSent }
}

// ─────────────────────────────────────────────────────────────
// Cron Job: يُشغَّل يومياً لفحص المهل
// استدعاء من: /api/cron/check-deadlines
// ─────────────────────────────────────────────────────────────
export async function runDeadlineCheck(): Promise<{
  reminders: number
  overdueAlerts: number
}> {
  const today = new Date()

  // السلف غير المسواة
  const openLoans = await prisma.$queryRaw<Array<{
    id: string
    refNumber: string
    userId: string | null
    employee: string
    settlementDeadline: Date | null
    userEmail: string | null
  }>>`
    SELECT
      l.id,
      l."refNumber",
      l."userId",
      l.employee,
      l."settlementDeadline",
      u.email as "userEmail"
    FROM "loans" l
    LEFT JOIN "users" u ON l."userId" = u.id
    WHERE l."isSettled" = FALSE
      AND l."settlementDeadline" IS NOT NULL
  `

  let reminders = 0
  let overdueAlerts = 0

  for (const loan of openLoans) {
    if (!loan.settlementDeadline) continue

    const daysLeft = workingDaysUntilDeadline(loan.settlementDeadline)

    // تحقق إذا أُرسل إنذار اليوم لهذه السلفة
    const alreadyAlerted = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "loan_alerts"
      WHERE "loanId" = ${loan.id}
        AND "sentAt"::date = CURRENT_DATE
    `

    if (alreadyAlerted.length > 0) continue

    if (daysLeft < 0) {
      // تأخر
      await sendOverdueAlert({
        id: loan.id,
        refNumber: loan.refNumber,
        userId: loan.userId,
        employee: loan.employee,
        settlementDeadline: loan.settlementDeadline,
        user: loan.userEmail ? { email: loan.userEmail } : null,
      })

      // تحديث الحالة
      await prisma.$executeRawUnsafe(
        `UPDATE "loans" SET "settlementStatus" = 'OVERDUE' WHERE id = $1`,
        loan.id,
      )
      overdueAlerts++
    } else if (daysLeft <= 3) {
      // تذكير قبل 3 أيام
      await sendSettlementReminder({
        id: loan.id,
        refNumber: loan.refNumber,
        userId: loan.userId,
        employee: loan.employee,
        settlementDeadline: loan.settlementDeadline,
        user: loan.userEmail ? { email: loan.userEmail } : null,
      })
      reminders++
    }
  }

  return { reminders, overdueAlerts }
}

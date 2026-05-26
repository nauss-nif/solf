// lib/notifications.ts
// ─────────────────────────────────────────────────────────────
// نظام الإشعارات الداخلية + البريد الإلكتروني عبر Resend
// ─────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { workingDaysUntilDeadline } from '@/lib/settlement-deadline'

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? ''
const FROM_EMAIL = process.env.FROM_EMAIL
  ?? (process.env.RESEND_FROM_EMAIL
    ? `منصة إدارة السلف <${process.env.RESEND_FROM_EMAIL}>`
    : 'منصة إدارة السلف <noreply@od-nauss.win>')
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@nauss.edu.sa'
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_URL ?? '').replace(/\/$/, '')
const LOGO_URL = SITE_URL
  ? `${SITE_URL.startsWith('http') ? SITE_URL : `https://${SITE_URL}`}/nauss-login-brand.png`
  : ''

// ─────────────────────────────────────────────────────────────
// إرسال بريد إلكتروني عبر Resend
// ─────────────────────────────────────────────────────────────
type EmailSendResult = { ok: boolean; id?: string; status?: number; error?: string }

async function sendEmailDetailed(options: {
  to: string
  subject: string
  html: string
}): Promise<EmailSendResult> {
  if (!RESEND_API_KEY) {
    console.warn('[Notifications] RESEND_API_KEY not set — skipping email')
    return { ok: false, error: 'RESEND_API_KEY not set' }
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

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      console.error('[Notifications] Resend rejected email:', {
        status: response.status,
        to: options.to,
        from: FROM_EMAIL,
        error: errorText,
      })
      return { ok: false, status: response.status, error: errorText }
    }

    const result = await response.json().catch(() => null) as { id?: string } | null
    console.info('[Notifications] Resend accepted email:', {
      id: result?.id,
      to: options.to,
      from: FROM_EMAIL,
      subject: options.subject,
    })

    return { ok: true, id: result?.id }
  } catch (error) {
    console.error('[Notifications] Email send failed:', error)
    return { ok: false, error: error instanceof Error ? error.message : 'Email send failed' }
  }
}

async function sendEmail(options: {
  to: string
  subject: string
  html: string
}): Promise<boolean> {
  const result = await sendEmailDetailed(options)
  return result.ok
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
    ? `<div style="background:#73384B;color:#fff;padding:10px 20px;text-align:center;font-weight:700;font-size:14px;font-family:Cairo,Tahoma,Arial,sans-serif;">
        ⚠️ إشعار عاجل — يتطلب إجراءً فورياً
       </div>`
    : ''

  const actionButton = options.actionUrl
    ? `<div style="text-align:center;margin:24px 0;">
        <a href="${options.actionUrl}"
           style="background:#2A6364;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;font-family:Cairo,Tahoma,Arial,sans-serif;display:inline-block;">
          ${options.actionLabel ?? 'عرض التفاصيل'}
        </a>
       </div>`
    : ''

  return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet"/>
</head>
<body style="font-family:Cairo,Tahoma,Arial,sans-serif;background:#F9F9F9;margin:0;padding:24px;direction:rtl;text-align:right;">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(42,99,100,0.12);border:1px solid #DADBD9;">
    ${urgentBanner}
    <div style="background:linear-gradient(135deg,#2A6364 0%,#2E6F8E 100%);padding:24px 30px;border-bottom:4px solid #C7B08C;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
        <tr>
          <td style="vertical-align:middle;text-align:right;">
            <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;line-height:1.5;font-family:Cairo,Tahoma,Arial,sans-serif;">منصة إدارة السلف</h1>
            <p style="color:rgba(255,255,255,0.84);margin:4px 0 0;font-size:13px;line-height:1.8;font-family:Cairo,Tahoma,Arial,sans-serif;">وكالة التدريب — جامعة نايف العربية للعلوم الأمنية</p>
          </td>
          ${LOGO_URL ? `<td style="vertical-align:middle;text-align:left;width:150px;"><img src="${LOGO_URL}" alt="جامعة نايف العربية للعلوم الأمنية" width="138" style="display:block;width:138px;height:auto;margin-right:auto;"/></td>` : ''}
        </tr>
      </table>
    </div>
    <div style="padding:32px 30px;">
      <div style="width:48px;height:4px;background:#C7B08C;border-radius:99px;margin:0 0 18px auto;"></div>
      <h2 style="color:#1F3F40;margin:0 0 18px;font-size:20px;font-weight:700;line-height:1.6;font-family:Cairo,Tahoma,Arial,sans-serif;">${options.title}</h2>
      <div style="color:#5A5A5A;font-size:15px;line-height:2;font-family:Cairo,Tahoma,Arial,sans-serif;">${options.body}</div>
      ${actionButton}
    </div>
    <div style="background:#F9F9F9;padding:16px 28px;border-top:1px solid #DADBD9;text-align:center;font-size:12px;color:#5A5A5A;font-family:Cairo,Tahoma,Arial,sans-serif;line-height:1.8;">
      هذا بريد إلكتروني تلقائي من منصة إدارة السلف — يرجى عدم الرد عليه
    </div>
  </div>
</body>
</html>`
}

export function getEmailConfigurationStatus() {
  return {
    resendConfigured: Boolean(RESEND_API_KEY),
    fromEmail: FROM_EMAIL,
    adminEmail: ADMIN_EMAIL,
    provider: 'Resend',
    scopes: [
      'ترحيب إنشاء الحساب',
      'كود إكمال التسجيل',
      'كود استعادة كلمة المرور',
      'إشعار طلب سلفة جديد للمراجعين والمدير',
      'إشعار مراجعة أو إعادة طلب السلفة للموظف',
      'تذكير قرب انتهاء مهلة التسوية',
      'تنبيه تأخر التسوية للموظف والإدارة',
      'تنبيه يدوي من الإدارة',
    ],
  }
}

export async function sendTestEmail(options: { to: string; fullName: string }) {
  return sendEmail({
    to: options.to,
    subject: 'اختبار بريد منصة طلبات السلف',
    html: emailTemplate({
      title: 'اختبار إعدادات البريد',
      body: `
        <p>مرحباً ${options.fullName}،</p>
        <p>هذه رسالة اختبار للتأكد من عمل ربط Resend مع منصة طلبات السلف.</p>
        <p>إذا وصلتك هذه الرسالة فهذا يعني أن إعدادات الإرسال تعمل بنجاح.</p>
      `,
    }),
  })
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function sendCustomAdminEmail(options: {
  to: string
  subject: string
  title: string
  message: string
}) {
  return sendEmailDetailed({
    to: options.to,
    subject: options.subject,
    html: emailTemplate({
      title: escapeHtml(options.title),
      body: escapeHtml(options.message)
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .map((line) => `<p>${line}</p>`)
        .join(''),
    }),
  })
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
     VALUES (gen_random_uuid()::text, $1, $2::\"NotificationType\", $3, $4, $5::jsonb, NOW())`,
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

    await sendEmail({
      to: reviewer.email,
      subject: `طلب سلفة جديد — ${loan.refNumber}`,
      html: emailTemplate({
        title: `طلب سلفة جديد — ${loan.refNumber}`,
        body: `<p>${message}</p>`,
      }),
    })
  }
}

export async function notifyLoanFollowUpRequest(loan: {
  id: string
  refNumber: string
  employee: string
  amount: number
  activity: string
}): Promise<void> {
  const reviewers = await prisma.$queryRaw<Array<{ id: string; email: string; fullName: string }>>`
    SELECT id, email, "fullName"
    FROM "users"
    WHERE "status" = 'ACTIVE'
      AND (
        roles::jsonb ? 'ADMIN'
        OR roles::jsonb ? 'REVIEWER'
      )
  `

  const title = `تذكير متابعة طلب سلفة — ${loan.refNumber}`
  const message = `يرجو الموظف ${loan.employee} متابعة طلب السلفة ${loan.refNumber} بمبلغ ${loan.amount.toLocaleString('ar-SA')} ر.س — ${loan.activity}. الطلب جاهز للمراجعة.`

  for (const reviewer of reviewers) {
    await createInternalNotification({
      userId: reviewer.id,
      type: 'SYSTEM',
      title,
      message,
      metadata: { loanId: loan.id, refNumber: loan.refNumber },
    })

    await sendEmail({
      to: reviewer.email,
      subject: title,
      html: emailTemplate({
        title,
        body: `<p>${message}</p>`,
      }),
    })
  }
}

export async function sendWelcomeEmail(options: {
  to: string
  fullName: string
}): Promise<boolean> {
  return sendEmail({
    to: options.to,
    subject: 'مرحباً بك في منصة طلبات السلف',
    html: emailTemplate({
      title: `مرحباً ${options.fullName}`,
      body: `
        <p>تم إنشاء حسابك في منصة طلبات السلف بنجاح.</p>
        <p>يمكنك الآن الدخول للنظام وتقديم طلبات السلف ومتابعة حالتها وتسويتها.</p>
      `,
    }),
  })
}

export async function sendRegistrationCodeEmail(options: {
  to: string
  fullName: string
  code: string
}): Promise<boolean> {
  return sendEmail({
    to: options.to,
    subject: 'كود إكمال التسجيل في منصة طلبات السلف',
    html: emailTemplate({
      title: 'كود إكمال التسجيل',
      body: `
        <p>مرحباً ${options.fullName}،</p>
        <p>كود إكمال التسجيل الخاص بك هو:</p>
        <p style="font-size:24px;font-weight:bold;letter-spacing:4px;text-align:center;color:#2A6364;">${options.code}</p>
        <p>ينتهي هذا الكود خلال مدة محدودة. إذا لم تطلب التسجيل فتجاهل هذه الرسالة.</p>
      `,
    }),
  })
}

export async function sendPasswordResetCodeEmail(options: {
  to: string
  fullName: string
  code: string
}): Promise<boolean> {
  return sendEmail({
    to: options.to,
    subject: 'كود استعادة كلمة المرور لمنصة طلبات السلف',
    html: emailTemplate({
      title: 'استعادة كلمة المرور',
      body: `
        <p>مرحباً ${options.fullName}،</p>
        <p>كود استعادة كلمة المرور الخاص بك هو:</p>
        <p style="font-size:24px;font-weight:bold;letter-spacing:4px;text-align:center;color:#2A6364;">${options.code}</p>
        <p>إذا لم تطلب استعادة كلمة المرور فتجاهل هذه الرسالة.</p>
      `,
      isUrgent: true,
    }),
  })
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
  employeeUserId?: string | null
  sentById: string
  customMessage?: string
}): Promise<{ success: boolean }> {
  const defaultMessage = `نذكركم بضرورة تسوية السلفة ${options.refNumber} في أقرب وقت ممكن. التأخر في التسوية مخالف للوائح المالية.`
  const message = options.customMessage ?? defaultMessage

  if (options.employeeUserId) {
    await createInternalNotification({
      userId: options.employeeUserId,
      type: 'SETTLEMENT_REMINDER',
      title: `تنبيه: تسوية السلفة ${options.refNumber}`,
      message,
      metadata: { loanId: options.loanId, refNumber: options.refNumber },
    })
  }

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

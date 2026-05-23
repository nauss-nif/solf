// lib/settlement-deadline.ts
// ─────────────────────────────────────────────────────────────
// حساب مهلة التسوية حسب تصنيف الوجهة
// ─────────────────────────────────────────────────────────────

export type DestinationCategory =
  | 'DOMESTIC'        // داخل المملكة   : +1 قبل +1 بعد
  | 'ARAB'            // دول عربية       : +2 قبل +2 بعد
  | 'EUROPE_MAGHREB'  // أوروبا/المغرب   : +3 قبل +3 بعد
  | 'AMERICAS_FAR'    // أمريكا/أستراليا : +4 قبل +4 بعد

export const DESTINATION_CATEGORIES: Array<{
  value: DestinationCategory
  label: string
  daysAfter: number
  daysBefore: number
  examples: string
}> = [
  {
    value: 'DOMESTIC',
    label: 'داخل المملكة',
    daysBefore: 1,
    daysAfter: 1,
    examples: 'الرياض، جدة، الدمام، مكة، المدينة...',
  },
  {
    value: 'ARAB',
    label: 'الدول العربية',
    daysBefore: 2,
    daysAfter: 2,
    examples: 'الإمارات، مصر، الأردن، المغرب، تونس...',
  },
  {
    value: 'EUROPE_MAGHREB',
    label: 'أوروبا والمغرب العربي',
    daysBefore: 3,
    daysAfter: 3,
    examples: 'فرنسا، ألمانيا، إسبانيا، إيطاليا، الجزائر...',
  },
  {
    value: 'AMERICAS_FAR',
    label: 'أمريكا، كندا، أستراليا، آسيا البعيدة',
    daysBefore: 4,
    daysAfter: 4,
    examples: 'الولايات المتحدة، كندا، أستراليا، كوريا، اليابان...',
  },
]

/**
 * هل اليوم يوم عمل؟ (يتجاهل الجمعة والسبت)
 */
function isWorkingDay(date: Date): boolean {
  const day = date.getDay()
  return day !== 5 && day !== 6 // 5=جمعة، 6=سبت
}

/**
 * أضف عدداً من أيام العمل لتاريخ معين
 */
export function addWorkingDays(startDate: Date, workingDays: number): Date {
  const result = new Date(startDate)
  let added = 0

  while (added < workingDays) {
    result.setDate(result.getDate() + 1)
    if (isWorkingDay(result)) {
      added++
    }
  }

  return result
}

/**
 * احسب مهلة التسوية
 *
 * المعادلة:
 *   deadline = endDate + daysAfter(category) + 10 أيام عمل
 *
 * مثال (EUROPE_MAGHREB):
 *   endDate = 2025-06-10
 *   +3 أيام = 2025-06-13
 *   +10 أيام عمل = 2025-06-26 (مع تجاهل الجمعة والسبت)
 */
export function calcSettlementDeadline(
  endDate: Date,
  category: DestinationCategory,
): Date {
  const meta = DESTINATION_CATEGORIES.find((c) => c.value === category)
  const daysAfter = meta?.daysAfter ?? 1

  // نقطة البداية: بعد أيام الإقفال
  const startPoint = new Date(endDate)
  startPoint.setDate(startPoint.getDate() + daysAfter)

  // أضف 10 أيام عمل
  return addWorkingDays(startPoint, 10)
}

/**
 * كم يوم عمل تبقى حتى المهلة؟
 * قيمة سالبة = تأخر
 */
export function workingDaysUntilDeadline(deadline: Date): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const deadlineDay = new Date(deadline)
  deadlineDay.setHours(0, 0, 0, 0)

  if (deadlineDay <= today) {
    // احسب التأخر (سالب)
    let count = 0
    const cursor = new Date(deadlineDay)
    while (cursor < today) {
      cursor.setDate(cursor.getDate() + 1)
      if (isWorkingDay(cursor)) count++
    }
    return -count
  }

  // أيام عمل متبقية
  let count = 0
  const cursor = new Date(today)
  while (cursor < deadlineDay) {
    cursor.setDate(cursor.getDate() + 1)
    if (isWorkingDay(cursor)) count++
  }
  return count
}

/**
 * حالة المهلة للعرض في الواجهة
 */
export type DeadlineStatus =
  | 'safe'      // أكثر من 3 أيام عمل
  | 'warning'   // 1-3 أيام عمل
  | 'critical'  // اليوم أو غداً
  | 'overdue'   // تجاوز المهلة

export function getDeadlineStatus(
  deadline: Date | null | undefined,
  isSettled: boolean,
): DeadlineStatus | null {
  if (isSettled || !deadline) return null

  const days = workingDaysUntilDeadline(deadline)

  if (days < 0)  return 'overdue'
  if (days <= 1) return 'critical'
  if (days <= 3) return 'warning'
  return 'safe'
}

export const DEADLINE_STATUS_CONFIG = {
  safe: {
    label: 'ضمن المهلة',
    color: 'text-success',
    bg: 'bg-success/10',
    border: 'border-success/20',
  },
  warning: {
    label: 'قارب المهلة',
    color: 'text-warning',
    bg: 'bg-warning/10',
    border: 'border-warning/20',
  },
  critical: {
    label: 'المهلة وشيكة',
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
  },
  overdue: {
    label: 'تجاوز المهلة',
    color: 'text-danger',
    bg: 'bg-danger/10',
    border: 'border-danger/20',
  },
} as const

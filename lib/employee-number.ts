// التحقق من الرقم الوظيفي وتوحيد شكله
//
// السياسة المتفق عليها: أرقام فقط. تُحوَّل الأرقام العربية-الهندية (١٢٣) والفارسية
// إلى أرقام إنجليزية تلقائياً حتى لا يختلف شكل الرقم بين موظف وآخر حسب لوحة
// المفاتيح المستخدمة، فيظهر موحّداً في نموذجي ١٨ و ١٩.

const ARABIC_INDIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'

/** يحوّل الأرقام العربية والفارسية إلى إنجليزية ويزيل المسافات الزائدة */
export function toEnglishDigits(value: string): string {
  return value.replace(/[٠-٩۰-۹]/g, (char) => {
    const arabicIndex = ARABIC_INDIC_DIGITS.indexOf(char)
    if (arabicIndex > -1) return String(arabicIndex)
    return String(PERSIAN_DIGITS.indexOf(char))
  })
}

/**
 * ينظّف الرقم الوظيفي ويتحقق منه.
 * @returns السلسلة النظيفة عند الصحة، أو '' إذا كان فارغاً، أو null إذا كان غير صالح
 */
export function normalizeEmployeeNumber(raw: unknown): string | null {
  if (raw === null || raw === undefined) return ''
  const trimmed = toEnglishDigits(String(raw)).trim()
  if (!trimmed) return ''
  if (!/^\d+$/.test(trimmed)) return null
  return trimmed
}

/** رسالة الخطأ الموحّدة — تُعرض في الواجهة وفي ردود الـ API */
export const EMPLOYEE_NUMBER_ERROR = 'الرقم الوظيفي يجب أن يحتوي على أرقام فقط.'

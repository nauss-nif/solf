export const EXPENSE_CATEGORIES = [
  'مواصلات متدربين',
  'مواصلات مدربين',
  'مواصلات منسقين',
  'سكن مدربين',
  'سكن منسقين',
  'رسوم تأشيرات',
  'رسوم حكومية وتصاريح',
  'رخص وتصاريح',
  'ترجمة تحريرية',
  'ترجمة فورية',
  'إيجار أجهزة ترجمة',
  'شحن جوي',
  'شحن بري',
  'طباعة ونسخ',
  'قرطاسية',
  'حفل عشاء',
  'حفل غداء',
  'ضيافة',
  'وجبات متدربين',
  'إيجار قاعات',
  'إيجار معدات',
  'إيجار راوتر',
  'شرائح اتصال',
  'أتعاب فنيين',
  'أتعاب عاملين',
  'أتعاب استشارية',
  'برمجيات',
  'مصروفات تقنية',
  'مصروفات تشغيلية',
  'نثريات',
  'أخرى',
] as const

export const SETTLEMENT_DOCUMENT_TYPES = [
  'إيصال',
  'سند',
  'كشف حساب',
  'إيصال بنكي',
] as const

export const CURRENCY_OPTIONS = [
  // الريال السعودي أولًا
  { code: 'SAR', label: 'ريال سعودي',         symbol: 'ر.س'  },
  // دول الخليج
  { code: 'AED', label: 'درهم إماراتي',        symbol: 'AED'  },
  { code: 'KWD', label: 'دينار كويتي',         symbol: 'KWD'  },
  { code: 'BHD', label: 'دينار بحريني',        symbol: 'BHD'  },
  { code: 'OMR', label: 'ريال عماني',          symbol: 'OMR'  },
  { code: 'QAR', label: 'ريال قطري',          symbol: 'QAR'  },
  // الدول العربية
  { code: 'JOD', label: 'دينار أردني',         symbol: 'JOD'  },
  { code: 'EGP', label: 'جنيه مصري',          symbol: 'EGP'  },
  { code: 'MAD', label: 'درهم مغربي',          symbol: 'MAD'  },
  { code: 'TND', label: 'دينار تونسي',         symbol: 'TND'  },
  { code: 'DZD', label: 'دينار جزائري',        symbol: 'DZD'  },
  { code: 'LYD', label: 'دينار ليبي',          symbol: 'LYD'  },
  { code: 'IQD', label: 'دينار عراقي',         symbol: 'IQD'  },
  { code: 'LBP', label: 'ليرة لبنانية',        symbol: 'LBP'  },
  { code: 'SDG', label: 'جنيه سوداني',         symbol: 'SDG'  },
  { code: 'YER', label: 'ريال يمني',           symbol: 'YER'  },
  // عملات رئيسية
  { code: 'USD', label: 'دولار أمريكي',        symbol: 'USD'  },
  { code: 'EUR', label: 'يورو',                symbol: 'EUR'  },
  { code: 'GBP', label: 'جنيه إسترليني',       symbol: 'GBP'  },
  { code: 'CHF', label: 'فرنك سويسري',         symbol: 'CHF'  },
  { code: 'CAD', label: 'دولار كندي',          symbol: 'CAD'  },
  { code: 'AUD', label: 'دولار أسترالي',       symbol: 'AUD'  },
  { code: 'SEK', label: 'كرون سويدي',          symbol: 'SEK'  },
  { code: 'NOK', label: 'كرون نرويجي',         symbol: 'NOK'  },
  { code: 'DKK', label: 'كرون دنماركي',        symbol: 'DKK'  },
  // آسيا
  { code: 'CNY', label: 'يوان صيني',           symbol: 'CNY'  },
  { code: 'JPY', label: 'ين ياباني',           symbol: 'JPY'  },
  { code: 'KRW', label: 'وون كوري جنوبي',      symbol: 'KRW'  },
  { code: 'INR', label: 'روبية هندية',         symbol: 'INR'  },
  { code: 'PKR', label: 'روبية باكستانية',     symbol: 'PKR'  },
  { code: 'MYR', label: 'رينغيت ماليزي',      symbol: 'MYR'  },
  { code: 'IDR', label: 'روبية إندونيسية',    symbol: 'IDR'  },
  { code: 'SGD', label: 'دولار سنغافوري',      symbol: 'SGD'  },
  { code: 'THB', label: 'بات تايلاندي',        symbol: 'THB'  },
  { code: 'TRY', label: 'ليرة تركية',          symbol: 'TRY'  },
  // أخرى
  { code: 'ZAR', label: 'راند جنوب أفريقي',   symbol: 'ZAR'  },
  { code: 'RUB', label: 'روبل روسي',           symbol: 'RUB'  },
] as const

export const LOAN_ATTACHMENT_DEFINITIONS = [
  {
    key: 'grandApproval',
    label: 'موافقة المعالي على الانتداب',
    required: true,
  },
  {
    key: 'nomineeAdjustment',
    label: 'موافقة الوكيل على تعديل المرشح',
    required: false,
  },
  {
    key: 'otherAttachments',
    label: 'مرفقات أخرى',
    required: false,
  },
] as const

export const GUIDE_SECTIONS = [
  {
    title: 'شروط طلب السلفة',
    items: [
      'إرفاق موافقة المعالي على الانتداب كمتطلب إلزامي قبل إرسال الطلب.',
      'يمكن إرفاق موافقة الوكيل على تعديل المرشح عند الحاجة بشكل اختياري.',
      'تحديد مدة النشاط ومكان التنفيذ والموظف المسؤول وأوجه الصرف بدقة.',
    ],
  },
  {
    title: 'إجراءات الطلب',
    items: [
      'يُنشئ الموظف طلب السلفة مباشرة من لوحة الطلبات.',
      'يُحسب إجمالي أوجه الصرف والمبلغ كتابةً بشكل آلي داخل النموذج.',
      'يبقى الطلب قابلًا للتعديل أو الحذف قبل الطباعة، ثم يُقفل بعد الطباعة أو التصدير.',
    ],
  },
  {
    title: 'إجراءات التسوية',
    items: [
      'تُعرّف العملات المستخدمة وأسعار صرفها أولًا، ثم تختار كل فاتورة عملتها من القائمة نفسها.',
      'يُحوّل مبلغ كل فاتورة تلقائيًا إلى الريال السعودي حسب سعر الصرف المُدخل.',
      'تُرفق صورة أو ملف مؤيد لكل فاتورة، وتُحتسب الوفورات والزيادة مباشرةً داخل النموذج.',
    ],
  },
] as const

export const FILE_SIZE_LIMIT_BYTES = 12 * 1024 * 1024
export const IMAGE_TARGET_MAX_BYTES = 450 * 1024
export const IMAGE_MAX_DIMENSION = 1800

export type CurrencyCode = (typeof CURRENCY_OPTIONS)[number]['code']
export type SettlementDocumentType = (typeof SETTLEMENT_DOCUMENT_TYPES)[number]
export type LoanAttachmentKey = (typeof LOAN_ATTACHMENT_DEFINITIONS)[number]['key']

export type StoredFile = {
  name: string
  type: string
  size: number
  dataUrl: string
}

export type LoanRequestFiles = Partial<Record<LoanAttachmentKey, StoredFile[]>>

export function isStoredImageFile(value: unknown): value is StoredFile {
  if (!value || typeof value !== 'object') return false
  const file = value as Partial<StoredFile>
  return (
    typeof file.name === 'string' &&
    typeof file.type === 'string' &&
    file.type.startsWith('image/') &&
    typeof file.size === 'number' &&
    typeof file.dataUrl === 'string' &&
    file.dataUrl.startsWith('data:image/')
  )
}

// يدعم القيمة القديمة (صورة واحدة) والقيمة الجديدة (مصفوفة صور) لنفس مفتاح المرفق
export function toStoredFileArray(value: unknown): StoredFile[] {
  if (value == null) return []
  if (Array.isArray(value)) return value.filter(isStoredImageFile)
  return isStoredImageFile(value) ? [value] : []
}

export function validateLoanRequestFiles(files: unknown) {
  if (files == null) return null
  if (typeof files !== 'object' || Array.isArray(files)) return 'صيغة مرفقات الطلب غير صحيحة.'

  const source = files as Record<string, unknown>
  for (const attachment of LOAN_ATTACHMENT_DEFINITIONS) {
    const value = source[attachment.key]
    if (value == null) continue
    if (!Array.isArray(value)) return `${attachment.label} يجب أن يكون قائمة صور.`
    for (const file of value) {
      if (!isStoredImageFile(file)) return `${attachment.label} يجب أن تكون جميع المرفقات صورًا فقط.`
    }
  }

  return null
}

export function validateSettlementAttachments(details: unknown, pettyCashApproval: unknown) {
  if (pettyCashApproval != null && !isStoredImageFile(pettyCashApproval)) {
    return 'موافقة المعالي في التسوية يجب أن تكون صورة فقط.'
  }

  if (!Array.isArray(details)) return null
  for (const item of details) {
    if (!item || typeof item !== 'object') continue
    const category = String((item as { category?: unknown }).category ?? 'البند')
    const invoices = (item as { invoices?: unknown }).invoices
    if (!Array.isArray(invoices)) continue
    for (const invoice of invoices) {
      if (!invoice || typeof invoice !== 'object') continue
      const attachment = (invoice as { attachment?: unknown }).attachment
      if (attachment != null && !isStoredImageFile(attachment)) return `مرفق ${category} يجب أن يكون صورة فقط.`
    }
  }

  return null
}

export type SettlementCurrencyRate = {
  currencyCode: CurrencyCode
  rate: number
}

export type SettlementInvoiceRecord = {
  amount: number
  currencyCode: CurrencyCode
  exchangeRate: number
  sar: number
  documentType: SettlementDocumentType
  invoiceDate: string
  issuer: string
  attachment: StoredFile | null
}

export type SettlementDetailRecord = {
  category: string
  budget: number
  invoices: SettlementInvoiceRecord[]
}

export type SettlementMetaRecord = {
  currencyRates: SettlementCurrencyRate[]
  details: SettlementDetailRecord[]
  receiptNumber?: string
  receiptDate?: string
  overageReason?: string
  pettyCashApproval?: StoredFile | null
}

export function getCurrencyMeta(code: CurrencyCode) {
  return CURRENCY_OPTIONS.find((currency) => currency.code === code) ?? CURRENCY_OPTIONS[0]
}

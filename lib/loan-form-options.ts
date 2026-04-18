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
  { code: 'SAR', label: 'ريال سعودي', symbol: 'ر.س' },
  { code: 'USD', label: 'دولار أمريكي', symbol: 'USD' },
  { code: 'EUR', label: 'يورو', symbol: 'EUR' },
  { code: 'GBP', label: 'جنيه إسترليني', symbol: 'GBP' },
  { code: 'AED', label: 'درهم إماراتي', symbol: 'AED' },
  { code: 'KWD', label: 'دينار كويتي', symbol: 'KWD' },
  { code: 'BHD', label: 'دينار بحريني', symbol: 'BHD' },
  { code: 'OMR', label: 'ريال عماني', symbol: 'OMR' },
  { code: 'QAR', label: 'ريال قطري', symbol: 'QAR' },
  { code: 'JOD', label: 'دينار أردني', symbol: 'JOD' },
  { code: 'EGP', label: 'جنيه مصري', symbol: 'EGP' },
  { code: 'TRY', label: 'ليرة تركية', symbol: 'TRY' },
  { code: 'CHF', label: 'فرنك سويسري', symbol: 'CHF' },
  { code: 'JPY', label: 'ين ياباني', symbol: 'JPY' },
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
export const IMAGE_TARGET_MAX_BYTES = 900 * 1024
export const IMAGE_MAX_DIMENSION = 2200

export type CurrencyCode = (typeof CURRENCY_OPTIONS)[number]['code']
export type SettlementDocumentType = (typeof SETTLEMENT_DOCUMENT_TYPES)[number]
export type LoanAttachmentKey = (typeof LOAN_ATTACHMENT_DEFINITIONS)[number]['key']

export type StoredFile = {
  name: string
  type: string
  size: number
  dataUrl: string
}

export type LoanRequestFiles = Partial<Record<LoanAttachmentKey, StoredFile | null>>

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

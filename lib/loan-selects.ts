export const dashboardLoanInclude = {
  items: true,
  settlement: {
    select: {
      id: true,
      supported: true,
      unsupported: true,
      total: true,
      savings: true,
      overage: true,
      createdAt: true,
    },
  },
  reviewedBy: { select: { id: true, fullName: true } },
  secondReviewedBy: { select: { id: true, fullName: true } },
  settlementReviewedBy: { select: { id: true, fullName: true } },
  secondSettlementReviewedBy: { select: { id: true, fullName: true } },
  user: { select: { email: true, fullName: true, profileImage: true, employeeNumber: true } },
  // آخر تنبيه أُرسل — يمنع انهيال تنبيهات متعددة على الموظف في اليوم نفسه
  alerts: {
    orderBy: { sentAt: 'desc' },
    take: 1,
    select: { sentAt: true, sentBy: { select: { fullName: true } } },
  },
} as const

export const fullLoanInclude = {
  items: true,
  settlement: true,
  user: { select: { email: true, signatureImage: true, employeeNumber: true } },
  reviewedBy: { select: { id: true, fullName: true } },
  secondReviewedBy: { select: { id: true, fullName: true } },
  settlementReviewedBy: { select: { id: true, fullName: true } },
  secondSettlementReviewedBy: { select: { id: true, fullName: true } },
} as const

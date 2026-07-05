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
  // مطلوب لحساب التأخر بشكل صحيح (10 أيام عمل بعد نهاية النشاط)
  settlementDeadline: true,
  reviewedBy: { select: { id: true, fullName: true } },
  secondReviewedBy: { select: { id: true, fullName: true } },
  settlementReviewedBy: { select: { id: true, fullName: true } },
  secondSettlementReviewedBy: { select: { id: true, fullName: true } },
  user: { select: { email: true, fullName: true, profileImage: true } },
} as const

export const fullLoanInclude = {
  items: true,
  settlement: true,
  user: { select: { email: true, signatureImage: true } },
  reviewedBy: { select: { id: true, fullName: true } },
  secondReviewedBy: { select: { id: true, fullName: true } },
  settlementReviewedBy: { select: { id: true, fullName: true } },
  secondSettlementReviewedBy: { select: { id: true, fullName: true } },
} as const

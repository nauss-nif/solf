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
  settlementReviewedBy: { select: { id: true, fullName: true } },
  user: { select: { email: true, fullName: true } },
} as const

export const fullLoanInclude = {
  items: true,
  settlement: true,
  user: { select: { email: true } },
  reviewedBy: { select: { id: true, fullName: true } },
  settlementReviewedBy: { select: { id: true, fullName: true } },
} as const

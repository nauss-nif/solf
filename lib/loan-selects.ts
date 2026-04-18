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
} as const

export const fullLoanInclude = {
  items: true,
  settlement: true,
} as const

export function isDatabaseConnectionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)

  return (
    message.includes('Error querying the database') ||
    message.includes('Tenant or user not found') ||
    message.includes('Can\'t reach database server') ||
    message.includes('Timed out fetching a new connection') ||
    message.includes('password authentication failed')
  )
}

export function getPublicApiError(error: unknown, fallback: string) {
  if (isDatabaseConnectionError(error)) {
    return 'تعذر الاتصال بقاعدة البيانات. يرجى التحقق من إعدادات الاتصال في الخادم.'
  }

  return error instanceof Error ? error.message : fallback
}

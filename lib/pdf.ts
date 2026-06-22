import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'

// يبني صفحة HTML كاملة ويحوّلها إلى PDF عبر Chromium مباشرة على السيرفر،
// متجاوزاً مربع حوار طباعة المتصفح وإعدادات هوامشه غير الموثوقة.
// preferCSSPageSize يجعل Chromium يلتزم بقواعد @page { size; margin } الموجودة في الـ HTML حرفياً.
export async function renderHtmlToPdf(bodyHtml: string): Promise<Buffer> {
  const fullHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8" /></head>
<body>${bodyHtml}</body>
</html>`

  const isLocal = !process.env.AWS_LAMBDA_FUNCTION_NAME && !process.env.VERCEL

  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: isLocal
      ? process.env.CHROME_EXECUTABLE_PATH ?? (await chromium.executablePath())
      : await chromium.executablePath(),
    headless: true,
  })

  try {
    const page = await browser.newPage()
    await page.setContent(fullHtml, { waitUntil: 'load' })
    const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}

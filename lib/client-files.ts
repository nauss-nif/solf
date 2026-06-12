'use client'

import { FILE_SIZE_LIMIT_BYTES, IMAGE_MAX_DIMENSION, IMAGE_TARGET_MAX_BYTES, type StoredFile } from '@/lib/loan-form-options'

export async function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result ?? '')); r.onerror = () => reject(new Error('تعذر قراءة الملف.')); r.readAsDataURL(file) })
}

export async function optimizeImageFile(file: File): Promise<StoredFile> {
  const sourceUrl = await readFileAsDataUrl(file)
  const image = await new Promise<HTMLImageElement>((resolve, reject) => { const el = new window.Image(); el.onload = () => resolve(el); el.onerror = () => reject(new Error('تعذر معالجة الصورة.')); el.src = sourceUrl })
  const maxSide = Math.max(image.width, image.height)
  const ratio = maxSide > IMAGE_MAX_DIMENSION ? IMAGE_MAX_DIMENSION / maxSide : 1
  const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.width * ratio)); canvas.height = Math.max(1, Math.round(image.height * ratio))
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('تعذر تهيئة معالجة الصورة.')
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  let quality = 0.92; let dataUrl = canvas.toDataURL('image/jpeg', quality)
  while (dataUrl.length > IMAGE_TARGET_MAX_BYTES * 1.37 && quality > 0.45) { quality -= 0.08; dataUrl = canvas.toDataURL('image/jpeg', quality) }
  return { name: file.name.replace(/\.[^.]+$/, '') + '.jpg', type: 'image/jpeg', size: Math.round((dataUrl.length * 3) / 4), dataUrl }
}

export async function fileToStoredFile(file: File): Promise<StoredFile> {
  if (file.size > FILE_SIZE_LIMIT_BYTES) throw new Error('حجم الملف كبير جدًا، الحد الأقصى 12 ميجابايت.')
  if (!file.type.startsWith('image/')) throw new Error('المرفقات تقبل الصور فقط، ولا تقبل ملفات PDF.')
  return optimizeImageFile(file)
}

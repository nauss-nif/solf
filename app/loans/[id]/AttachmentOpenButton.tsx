'use client'

function dataUrlToBlob(dataUrl: string) {
  const [header, payload] = dataUrl.split(',')
  const mime = header.match(/data:([^;]+)/)?.[1] || 'application/octet-stream'
  const binary = atob(payload || '')
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new Blob([bytes], { type: mime })
}

export default function AttachmentOpenButton({ dataUrl, label = 'فتح المرفق' }: { dataUrl: string; label?: string }) {
  function openAttachment() {
    const url = URL.createObjectURL(dataUrlToBlob(dataUrl))
    window.open(url, '_blank', 'noopener,noreferrer')
    window.setTimeout(() => URL.revokeObjectURL(url), 60000)
  }

  return <button type="button" onClick={openAttachment} className="btn btn-outline btn-sm">{label}</button>
}

'use client'

import { useEffect, useState } from 'react'
import { fileToStoredFile } from '@/lib/client-files'
import { type StoredFile } from '@/lib/loan-form-options'
import SignatureEditorModal from './SignatureEditorModal'

type Role = 'EMPLOYEE' | 'ADMIN' | 'REVIEWER'
type Account = {
  id: string
  fullName: string
  email: string
  mobile: string
  extension: string
  role: Role
  roles?: Role[]
  profileImage?: StoredFile | null
  signatureImage?: StoredFile | null
}

const ROLE_LABELS: Record<Role, string> = { EMPLOYEE: 'موظف', REVIEWER: 'مراجع', ADMIN: 'مدير' }

export default function AccountClient() {
  const [account, setAccount] = useState<Account | null>(null)
  const [loadError, setLoadError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [fullName, setFullName] = useState('')
  const [mobile, setMobile] = useState('')
  const [extension, setExtension] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileError, setProfileError] = useState('')

  const [profileImageUploading, setProfileImageUploading] = useState(false)
  const [profileImageError, setProfileImageError] = useState('')

  const [signatureUploading, setSignatureUploading] = useState(false)
  const [signatureError, setSignatureError] = useState('')
  const [signatureEditFile, setSignatureEditFile] = useState<File | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')

  async function loadAccount() {
    const res = await fetch('/api/account', { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok) { setLoadError(data.error ?? 'تعذر تحميل بيانات الحساب'); return }
    setLoadError('')
    setAccount(data)
    setFullName(data.fullName)
    setMobile(data.mobile)
    setExtension(data.extension)
  }

  useEffect(() => { void loadAccount() }, [])

  function showSuccess(msg: string) { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 2500) }

  async function handleSaveProfile() {
    setSavingProfile(true); setProfileError('')
    try {
      const res = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, mobile, extension }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setProfileError(typeof data?.error === 'string' ? data.error : 'تعذر حفظ البيانات.'); return }
      await loadAccount(); showSuccess('تم حفظ البيانات الشخصية.')
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'تعذر حفظ البيانات.')
    } finally {
      setSavingProfile(false)
    }
  }

  async function handleProfileImageUpload(fileList: FileList | null) {
    const file = fileList?.[0]; if (!file) return
    setProfileImageUploading(true); setProfileImageError('')
    try {
      const stored = await fileToStoredFile(file)
      const res = await fetch('/api/account', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profileImage: stored }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setProfileImageError(typeof data?.error === 'string' ? data.error : 'تعذر حفظ الصورة.'); return }
      await loadAccount(); showSuccess('تم حفظ الصورة الشخصية.')
    } catch (err) {
      setProfileImageError(err instanceof Error ? err.message : 'تعذر رفع الصورة.')
    } finally {
      setProfileImageUploading(false)
    }
  }

  async function handleRemoveProfileImage() {
    setProfileImageUploading(true); setProfileImageError('')
    try {
      await fetch('/api/account', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profileImage: null }) })
      await loadAccount(); showSuccess('تم حذف الصورة الشخصية.')
    } finally {
      setProfileImageUploading(false)
    }
  }

  function handleSignatureFileSelected(fileList: FileList | null) {
    const file = fileList?.[0]; if (!file) return
    setSignatureError('')
    setSignatureEditFile(file)
  }

  async function handleSignatureSaved(stored: StoredFile) {
    setSignatureEditFile(null)
    setSignatureUploading(true); setSignatureError('')
    try {
      const res = await fetch('/api/account', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ signatureImage: stored }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setSignatureError(typeof data?.error === 'string' ? data.error : 'تعذر حفظ التوقيع.'); return }
      await loadAccount(); showSuccess('تم حفظ التوقيع الإلكتروني.')
    } catch (err) {
      setSignatureError(err instanceof Error ? err.message : 'تعذر رفع التوقيع.')
    } finally {
      setSignatureUploading(false)
    }
  }

  async function handleRemoveSignature() {
    setSignatureUploading(true); setSignatureError('')
    try {
      await fetch('/api/account', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ signatureImage: null }) })
      await loadAccount(); showSuccess('تم حذف التوقيع.')
    } finally {
      setSignatureUploading(false)
    }
  }

  async function handleChangePassword() {
    setPasswordError('')
    if (newPassword.length < 10) { setPasswordError('كلمة المرور الجديدة يجب أن تكون 10 أحرف على الأقل.'); return }
    if (newPassword !== confirmPassword) { setPasswordError('كلمتا المرور الجديدتان غير متطابقتين.'); return }

    setSavingPassword(true)
    try {
      const res = await fetch('/api/account/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setPasswordError(typeof data?.error === 'string' ? data.error : 'تعذر تغيير كلمة المرور.'); return }
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
      showSuccess('تم تغيير كلمة المرور بنجاح.')
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'تعذر تغيير كلمة المرور.')
    } finally {
      setSavingPassword(false)
    }
  }

  if (loadError) return <div className="alert alert-error">{loadError}</div>
  if (!account) return <div className="text-sm" style={{ color: '#5A5A5A' }}>جاري التحميل...</div>

  const activeRoles = account.roles?.length ? account.roles : [account.role]

  return (
    <div className="space-y-5 animate-fade-up">
      {successMsg && <div className="alert alert-success">{successMsg}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* الصورة الشخصية */}
      <div className="section-card p-5 space-y-3">
        <h2 className="font-bold" style={{ color: '#1F3F40' }}>الصورة الشخصية</h2>
        {profileImageError && <div className="alert alert-error">{profileImageError}</div>}
        <div className="flex items-center gap-4">
          {account.profileImage ? (
            <img src={account.profileImage.dataUrl} alt="الصورة الشخصية" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: '50%', border: '1px solid #DADBD9' }} />
          ) : (
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#E7F3EE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 700, color: '#2A6364' }}>
              {account.fullName.charAt(0)}
            </div>
          )}
          <div className="flex gap-2">
            <label className="btn btn-outline btn-sm cursor-pointer">
              {profileImageUploading ? 'جاري الرفع...' : account.profileImage ? 'تغيير الصورة' : 'رفع صورة'}
              <input type="file" className="hidden" accept="image/*" disabled={profileImageUploading} onChange={(e) => void handleProfileImageUpload(e.target.files)} />
            </label>
            {account.profileImage && (
              <button type="button" disabled={profileImageUploading} onClick={() => void handleRemoveProfileImage()} className="btn btn-danger btn-sm">
                حذف
              </button>
            )}
          </div>
        </div>
      </div>

      {/* البيانات الشخصية */}
      <div className="section-card p-5 space-y-3">
        <h2 className="font-bold" style={{ color: '#1F3F40' }}>البيانات الشخصية</h2>
        {profileError && <div className="alert alert-error">{profileError}</div>}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold block mb-1" style={{ color: '#5A5A5A' }}>الاسم الكامل</label>
            <input type="text" className="input-shell" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1" style={{ color: '#5A5A5A' }}>البريد الإلكتروني</label>
            <input type="text" className="input-shell" value={account.email} disabled style={{ opacity: 0.6 }} />
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1" style={{ color: '#5A5A5A' }}>رقم الجوال</label>
            <input type="text" className="input-shell" value={mobile} onChange={(e) => setMobile(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1" style={{ color: '#5A5A5A' }}>التحويلة</label>
            <input type="text" className="input-shell" value={extension} onChange={(e) => setExtension(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {activeRoles.map((r) => (
            <span key={r} className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: r === 'ADMIN' ? '#F3EDE3' : r === 'REVIEWER' ? '#E4EEF3' : '#E7F3EE', color: r === 'ADMIN' ? '#C7B08C' : r === 'REVIEWER' ? '#2E6F8E' : '#2A6364' }}>
              {ROLE_LABELS[r]}
            </span>
          ))}
        </div>
        <button type="button" disabled={savingProfile} onClick={() => void handleSaveProfile()} className="btn btn-primary btn-sm">
          {savingProfile ? 'جاري الحفظ...' : 'حفظ البيانات'}
        </button>
      </div>

      {/* التوقيع الإلكتروني */}
      <div className="section-card p-5 space-y-3">
        <h2 className="font-bold" style={{ color: '#1F3F40' }}>التوقيع الإلكتروني</h2>
        <p className="text-xs" style={{ color: '#5A5A5A' }}>
          يُفضَّل تصوير التوقيع على ورقة بيضاء بإضاءة جيدة. عند الرفع ستتمكن من قص الفراغات الزائدة حول التوقيع وتغيير مقاسه، وإزالة الخلفية البيضاء تلقائياً.
        </p>
        {signatureError && <div className="alert alert-error">{signatureError}</div>}
        <div className="flex items-center gap-4">
          {account.signatureImage ? (
            <img src={account.signatureImage.dataUrl} alt="التوقيع" style={{ width: 120, height: 60, objectFit: 'contain', border: '1px solid #DADBD9', borderRadius: 6, background: '#fff' }} />
          ) : (
            <div className="text-sm" style={{ color: '#5A5A5A' }}>لا يوجد توقيع محفوظ.</div>
          )}
          <div className="flex gap-2">
            <label className="btn btn-outline btn-sm cursor-pointer">
              {signatureUploading ? 'جاري الحفظ...' : account.signatureImage ? 'تغيير التوقيع' : 'رفع توقيع'}
              <input type="file" className="hidden" accept="image/*" disabled={signatureUploading} onChange={(e) => handleSignatureFileSelected(e.target.files)} />
            </label>
            {account.signatureImage && (
              <button type="button" disabled={signatureUploading} onClick={() => void handleRemoveSignature()} className="btn btn-danger btn-sm">
                حذف
              </button>
            )}
          </div>
        </div>
      </div>

      {/* تغيير كلمة المرور */}
      <div className="section-card p-5 space-y-3">
        <h2 className="font-bold" style={{ color: '#1F3F40' }}>تغيير كلمة المرور</h2>
        {passwordError && <div className="alert alert-error">{passwordError}</div>}
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="text-xs font-semibold block mb-1" style={{ color: '#5A5A5A' }}>كلمة المرور الحالية</label>
            <input type="password" className="input-shell" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1" style={{ color: '#5A5A5A' }}>كلمة المرور الجديدة</label>
            <input type="password" className="input-shell" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1" style={{ color: '#5A5A5A' }}>تأكيد كلمة المرور الجديدة</label>
            <input type="password" className="input-shell" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
        </div>
        <button type="button" disabled={savingPassword} onClick={() => void handleChangePassword()} className="btn btn-primary btn-sm">
          {savingPassword ? 'جاري الحفظ...' : 'تغيير كلمة المرور'}
        </button>
      </div>
      </div>

      {signatureEditFile && (
        <SignatureEditorModal
          file={signatureEditFile}
          onCancel={() => setSignatureEditFile(null)}
          onSave={(stored) => void handleSignatureSaved(stored)}
        />
      )}
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/app/components/Sidebar'
import Forbidden from '@/app/components/Forbidden'
import { canManageSettings } from '@/lib/roles'

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px', color: '#1a1a1a' }}>
        {label}
      </label>
      {hint && <p style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>{hint}</p>}
      {children}
    </div>
  )
}

function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: '100%', padding: '10px 14px', border: '1px solid #e2e2e2', borderRadius: '8px',
        fontSize: '14px', outline: 'none', backgroundColor: 'white'
      }}
    />
  )
}

function Textarea({ ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      style={{
        width: '100%', padding: '10px 14px', border: '1px solid #e2e2e2', borderRadius: '8px',
        fontSize: '14px', outline: 'none', backgroundColor: 'white', minHeight: '80px', resize: 'vertical'
      }}
    />
  )
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid #e2e2e2' }}>
      <h2 style={{ fontSize: '17px', fontWeight: 600, color: '#1a1a1a' }}>{title}</h2>
      {description && <p style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>{description}</p>}
    </div>
  )
}

export default function SettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [orgId, setOrgId] = useState('')
  const [token, setToken] = useState('')
  const [roles, setRoles] = useState<string[]>([])
  const [forbidden, setForbidden] = useState(false)

  const [form, setForm] = useState({
    name: '',
    description: '',
    email: '',
    phone: '',
    logoUrl: '',
    bannerUrl: '',
    brandColor: '#085041',
  })

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }))

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const t = session.access_token
      setToken(t)

      const orgRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/mine`, {
        headers: { Authorization: `Bearer ${t}` }
      })
      if (!orgRes.ok) { router.push('/onboarding'); return }
      const org = await orgRes.json()
      setOrgId(org.id)

      const roleRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${org.id}/my-role`, {
        headers: { Authorization: `Bearer ${t}` }
      })
      const myRoles: string[] = roleRes.ok ? (await roleRes.json()).roles : []
      setRoles(myRoles)

      if (!canManageSettings(myRoles)) {
        setForbidden(true)
        setLoading(false)
        return
      }

      setForm({
        name: org.name ?? '',
        description: org.description ?? '',
        email: org.email ?? '',
        phone: org.phone ?? '',
        logoUrl: org.logo_url ?? '',
        bannerUrl: org.banner_url ?? '',
        brandColor: org.brand_color ?? '#085041',
      })
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  const uploadImage = async (file: File, folder: 'org-logos' | 'org-banners'): Promise<string | null> => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return null
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB')
      return null
    }

    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const path = `${folder}/${orgId}-${Date.now()}.${ext}`

    const { data, error: uploadError } = await supabase.storage
      .from('teacher-photos')
      .upload(path, file, { upsert: false })

    if (uploadError) {
      setError(`Upload failed: ${uploadError.message}`)
      return null
    }

    const { data: { publicUrl } } = supabase.storage.from('teacher-photos').getPublicUrl(data.path)
    return publicUrl
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setUploadingLogo(true)
    const url = await uploadImage(file, 'org-logos')
    if (url) update('logoUrl', url)
    setUploadingLogo(false)
  }

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setUploadingBanner(true)
    const url = await uploadImage(file, 'org-banners')
    if (url) update('bannerUrl', url)
    setUploadingBanner(false)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Studio name is required'); return }
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: form.name,
          description: form.description || null,
          email: form.email || null,
          phone: form.phone || null,
          logo_url: form.logoUrl || null,
          banner_url: form.bannerUrl || null,
          brand_color: form.brandColor || null,
        })
      })

      if (res.ok) {
        setSuccess('Settings saved.')
      } else {
        setError('Failed to save. Please try again.')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar active="settings" />
        <div style={{ marginLeft: '240px', flex: 1, padding: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: '#666' }}>Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f4f4f4' }}>
      <Sidebar active="settings" roles={roles} />

      <div style={{ marginLeft: '240px', flex: 1, padding: '32px', maxWidth: '760px' }}>
        {forbidden ? <Forbidden /> : <>

        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700 }}>Settings</h1>
          <p style={{ color: '#666', fontSize: '14px', marginTop: '4px' }}>
            Your studio's profile — what members see on your booking page
          </p>
        </div>

        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '32px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>

          <SectionHeader title="Branding" description="Your logo and banner appear on your public booking page and teacher pages" />

          <Field label="Logo">
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '72px', height: '72px', borderRadius: '12px', backgroundColor: '#f4f4f4',
                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                border: '1px solid #e2e2e2', flexShrink: 0
              }}>
                {form.logoUrl ? (
                  <img src={form.logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '24px' }}>🏢</span>
                )}
              </div>
              <label style={{
                padding: '8px 16px', backgroundColor: '#f4f4f4', borderRadius: '8px',
                fontSize: '13px', fontWeight: 500, color: '#444', cursor: uploadingLogo ? 'not-allowed' : 'pointer'
              }}>
                {uploadingLogo ? 'Uploading...' : form.logoUrl ? 'Replace logo' : 'Upload logo'}
                <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={uploadingLogo} style={{ display: 'none' }} />
              </label>
              {form.logoUrl && (
                <button
                  onClick={() => update('logoUrl', '')}
                  style={{ background: 'none', border: 'none', fontSize: '13px', color: '#8b1a1a', cursor: 'pointer' }}
                >
                  Remove
                </button>
              )}
            </div>
          </Field>

          <Field label="Banner" hint="Wide image shown at the top of your booking page. 1200×400px or similar works best.">
            <div>
              <div style={{
                width: '100%', height: '140px', borderRadius: '12px', backgroundColor: '#f4f4f4',
                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                border: '1px solid #e2e2e2', marginBottom: '12px'
              }}>
                {form.bannerUrl ? (
                  <img src={form.bannerUrl} alt="Banner" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '13px', color: '#999' }}>No banner uploaded</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <label style={{
                  padding: '8px 16px', backgroundColor: '#f4f4f4', borderRadius: '8px',
                  fontSize: '13px', fontWeight: 500, color: '#444', cursor: uploadingBanner ? 'not-allowed' : 'pointer'
                }}>
                  {uploadingBanner ? 'Uploading...' : form.bannerUrl ? 'Replace banner' : 'Upload banner'}
                  <input type="file" accept="image/*" onChange={handleBannerUpload} disabled={uploadingBanner} style={{ display: 'none' }} />
                </label>
                {form.bannerUrl && (
                  <button
                    onClick={() => update('bannerUrl', '')}
                    style={{ background: 'none', border: 'none', fontSize: '13px', color: '#8b1a1a', cursor: 'pointer' }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </Field>

          <Field label="Brand colour" hint="Used as the accent colour on your public pages">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input
                type="color"
                value={form.brandColor}
                onChange={e => update('brandColor', e.target.value)}
                style={{ width: '44px', height: '36px', border: '1px solid #e2e2e2', borderRadius: '8px', padding: '2px', cursor: 'pointer' }}
              />
              <Input value={form.brandColor} onChange={e => update('brandColor', e.target.value)} style={{ maxWidth: '140px' }} />
            </div>
          </Field>

          <SectionHeader title="Studio profile" />

          <Field label="Studio name">
            <Input value={form.name} onChange={e => update('name', e.target.value)} />
          </Field>

          <Field label="Description" hint="Shown on your public booking page">
            <Textarea value={form.description} onChange={e => update('description', e.target.value)} />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Field label="Contact email">
              <Input type="email" value={form.email} onChange={e => update('email', e.target.value)} />
            </Field>
            <Field label="Phone">
              <Input value={form.phone} onChange={e => update('phone', e.target.value)} />
            </Field>
          </div>

          {error && (
            <div style={{ padding: '12px 16px', backgroundColor: '#fdecea', borderRadius: '8px', color: '#8b1a1a', fontSize: '14px', marginBottom: '24px' }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ padding: '12px 16px', backgroundColor: '#e8f5ee', borderRadius: '8px', color: '#085041', fontSize: '14px', marginBottom: '24px' }}>
              {success}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '24px', borderTop: '1px solid #e2e2e2' }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '10px 24px', backgroundColor: saving ? '#9fd6b8' : '#085041', color: 'white',
                border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer'
              }}
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>
        </>}
      </div>
    </div>
  )
}

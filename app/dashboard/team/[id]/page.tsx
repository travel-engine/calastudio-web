'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '../../../components/Sidebar'
import { displayName } from '@/lib/names'
import styles from '@/app/dashboard/dashboard.module.css'

interface TeacherData {
  id: string
  first_name: string
  last_name: string
  email: string
  roles: string[]
  profile: {
    slug: string
    display_name: string
    tagline: string | null
    bio: string | null
    photo_url: string | null
    photos: string[] | null
    specialties: string[] | null
    certifications: string[] | null
    years_experience: number | null
    instagram_url: string | null
    website_url: string | null
    is_page_published: boolean
    show_on_studio_page: boolean
  } | null
}

function Field({ label, hint, children }: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
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
    <input {...props} style={{
      width: '100%', padding: '10px 14px', border: '1px solid #e2e2e2',
      borderRadius: '8px', fontSize: '14px', outline: 'none', backgroundColor: 'white'
    }} />
  )
}

function Textarea({ ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea {...props} style={{
      width: '100%', padding: '10px 14px', border: '1px solid #e2e2e2',
      borderRadius: '8px', fontSize: '14px', outline: 'none', backgroundColor: 'white',
      minHeight: '120px', resize: 'vertical'
    }} />
  )
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid #e2e2e2' }}>
      <h2 style={{ fontSize: '17px', fontWeight: 600 }}>{title}</h2>
      {description && <p style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>{description}</p>}
    </div>
  )
}

function Toggle({ checked, onChange, label }: {
  checked: boolean; onChange: (val: boolean) => void; label: string
}) {
  return (
    <div onClick={() => onChange(!checked)} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', userSelect: 'none' }}>
      <div style={{ width: '44px', height: '24px', borderRadius: '99px', backgroundColor: checked ? '#085041' : '#e2e2e2', position: 'relative', transition: 'background-color 0.2s' }}>
        <div style={{ position: 'absolute', top: '2px', left: checked ? '22px' : '2px', width: '20px', height: '20px', borderRadius: '50%', backgroundColor: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </div>
      <span style={{ fontSize: '14px', color: '#1a1a1a' }}>{label}</span>
    </div>
  )
}

function RoleCheckbox({ role, label, description, checked, onChange }: {
  role: string; label: string; description: string; checked: boolean; onChange: (role: string, checked: boolean) => void
}) {
  return (
    <div onClick={() => onChange(role, !checked)} style={{ display: 'flex', gap: '12px', padding: '16px', border: `2px solid ${checked ? '#085041' : '#e2e2e2'}`, borderRadius: '10px', cursor: 'pointer', backgroundColor: checked ? '#e8f5ee' : 'white', marginBottom: '8px' }}>
      <div style={{ width: '20px', height: '20px', borderRadius: '4px', border: `2px solid ${checked ? '#085041' : '#ccc'}`, backgroundColor: checked ? '#085041' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
        {checked && <span style={{ color: 'white', fontSize: '12px', fontWeight: 700 }}>✓</span>}
      </div>
      <div>
        <div style={{ fontWeight: 600, fontSize: '14px', color: '#1a1a1a' }}>{label}</div>
        <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>{description}</div>
      </div>
    </div>
  )
}

export default function EditTeacherPage() {
  const router = useRouter()
  const params = useParams()
  const teacherId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [orgId, setOrgId] = useState('')
  const [orgSlug, setOrgSlug] = useState('')
  const [token, setToken] = useState('')
  const [roles, setRoles] = useState<string[]>([])
  const [teacher, setTeacher] = useState<TeacherData | null>(null)

  const [form, setForm] = useState({
    display_name: '',
    tagline: '',
    bio: '',
    specialties: '',
    certifications: '',
    years_experience: '',
    instagram_url: '',
    website_url: '',
    is_page_published: false,
    show_on_studio_page: true,
    roles: [] as string[],
    photos: [] as string[],
    newPhotoUrl: '',
  })

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
      setOrgSlug(org.slug ?? '')

      const roleRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${org.id}/my-role`, {
        headers: { Authorization: `Bearer ${t}` }
      })
      if (roleRes.ok) setRoles((await roleRes.json()).roles)

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${org.id}/teachers/${teacherId}`,
        { headers: { Authorization: `Bearer ${t}` } }
      )
      if (!res.ok) { router.push('/dashboard/team'); return }
      const data: TeacherData = await res.json()
      setTeacher(data)

      setForm({
        display_name: data.profile?.display_name ?? displayName(data),
        tagline: data.profile?.tagline ?? '',
        bio: data.profile?.bio ?? '',
        specialties: data.profile?.specialties?.join(', ') ?? '',
        certifications: data.profile?.certifications?.join(', ') ?? '',
        years_experience: data.profile?.years_experience?.toString() ?? '',
        instagram_url: data.profile?.instagram_url ?? '',
        website_url: data.profile?.website_url ?? '',
        is_page_published: data.profile?.is_page_published ?? false,
        show_on_studio_page: data.profile?.show_on_studio_page ?? true,
        roles: data.roles ?? [],
        // The profile stores a single photo_url; older data may still have a photos[] array.
        // Keep photo_url first — it's the one the public pages render.
        photos: data.profile?.photo_url
          ? [data.profile.photo_url, ...(data.profile.photos ?? []).filter(u => u !== data.profile!.photo_url)]
          : (data.profile?.photos ?? []),
        newPhotoUrl: '',
      })

      setLoading(false)
    }
    load()
  }, [teacherId, router])

  const update = (key: string, value: string | boolean | string[]) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const handleRoleChange = (role: string, checked: boolean) => {
    const newRoles = checked
      ? [...form.roles, role]
      : form.roles.filter(r => r !== role)
    update('roles', newRoles)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB')
      return
    }

    // Show local preview immediately
    const localPreview = URL.createObjectURL(file)
    setForm(prev => ({ ...prev, photos: [...prev.photos, localPreview] }))

    setUploading(true)
    setError('')

    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()
      const filename = `${teacherId}/${Date.now()}.${ext}`

      const { data, error: uploadError } = await supabase.storage
        .from('teacher-photos')
        .upload(filename, file, { upsert: false })

      if (uploadError) {
        setForm(prev => ({ ...prev, photos: prev.photos.filter(p => p !== localPreview) }))
        setError(`Upload failed: ${uploadError.message}`)
        return
      }

      const { data: { publicUrl } } = supabase.storage
        .from('teacher-photos')
        .getPublicUrl(data.path)

      // Replace local preview with real URL
      setForm(prev => ({
        ...prev,
        photos: prev.photos.map(p => p === localPreview ? publicUrl : p)
      }))

    } catch {
      setForm(prev => ({ ...prev, photos: prev.photos.filter(p => p !== localPreview) }))
      setError('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }

    e.target.value = ''
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}/teachers/${teacherId}/profile`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            display_name: form.display_name,
            tagline: form.tagline || null,
            bio: form.bio || null,
            specialties: form.specialties ? form.specialties.split(',').map(s => s.trim()).filter(Boolean) : null,
            certifications: form.certifications ? form.certifications.split(',').map(s => s.trim()).filter(Boolean) : null,
            years_experience: form.years_experience ? parseInt(form.years_experience) : null,
            instagram_url: form.instagram_url || null,
            website_url: form.website_url || null,
            is_page_published: form.is_page_published,
            show_on_studio_page: form.show_on_studio_page,
            // The profile model holds a single photo — the first one is what shows publicly.
            photo_url: form.photos[0] || null,
            photos: form.photos.length > 0 ? form.photos : null,
          })
        }
      )

      if (res.ok) {
        setSuccess('Profile saved successfully')
        setTimeout(() => setSuccess(''), 3000)
      } else {
        setError('Failed to save. Please try again.')
      }
    } catch {
      setError('Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  const teacherRoles = [
    { role: 'teacher_super', label: 'Super teacher', description: 'Full studio access within their teaching context. Can view all members, issue passes, process bookings.' },
    { role: 'teacher_general', label: 'Teacher', description: 'Can view and manage their own sessions and the students booked into them.' },
    { role: 'teacher_basic', label: 'Basic teacher', description: 'Can add students to their sessions and mark attendance only. No access to member details.' },
    { role: 'front_desk', label: 'Front desk', description: 'Can view the full schedule and check in members. No financial data.' },
    { role: 'member', label: 'Member', description: 'Can book sessions and manage their own passes and bookings.' },
  ]

  if (loading || !teacher) {
    return (
      <div className={styles.shell}>
        <Sidebar active="team" />
        <div className={styles.main} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: '#666' }}>Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.shell}>
      <Sidebar active="team" roles={roles} />

      <div className={styles.main} style={{ maxWidth: '800px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <a href="/dashboard/team" style={{ color: '#666', textDecoration: 'none', fontSize: '14px' }}>
              ← Team
            </a>
            <h1 style={{ fontSize: '24px', fontWeight: 700 }}>{displayName(teacher)}</h1>
          </div>
          {form.is_page_published && teacher.profile && orgSlug && (
            <a href={`/${orgSlug}/teachers/${teacher.profile.slug}`} target="_blank" style={{ padding: '8px 16px', border: '1px solid #085041', borderRadius: '8px', color: '#085041', textDecoration: 'none', fontSize: '13px', fontWeight: 500 }}>
              View landing page
            </a>
          )}
        </div>

        {/* Roles */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '32px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '24px' }}>
          <SectionHeader title="Roles" description="This person can have multiple roles. Changes take effect immediately." />
          {teacherRoles.map(item => (
            <RoleCheckbox key={item.role} role={item.role} label={item.label} description={item.description} checked={form.roles.includes(item.role)} onChange={handleRoleChange} />
          ))}
        </div>

        {/* Profile */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '32px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '24px' }}>
          <SectionHeader title="Landing page profile" description="This information appears on their public teacher page." />

          <Field label="Display name">
            <Input placeholder="e.g. Sarah Jones" value={form.display_name} onChange={e => update('display_name', e.target.value)} />
          </Field>

          <Field label="Tagline" hint="One line shown under their name.">
            <Input placeholder="e.g. Vinyasa & Yin specialist" value={form.tagline} onChange={e => update('tagline', e.target.value)} />
          </Field>

          <Field label="Bio" hint="Full biography. Markdown supported.">
            <Textarea placeholder="Tell students about this teacher..." value={form.bio} onChange={e => update('bio', e.target.value)} />
          </Field>

          <div className={styles.formGrid} style={{ gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Field label="Specialties" hint="Comma separated">
              <Input placeholder="Vinyasa, Yin, Meditation" value={form.specialties} onChange={e => update('specialties', e.target.value)} />
            </Field>
            <Field label="Certifications" hint="Comma separated">
              <Input placeholder="RYT-200, NASM-CPT" value={form.certifications} onChange={e => update('certifications', e.target.value)} />
            </Field>
          </div>

          <div className={styles.formGrid} style={{ gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Field label="Years of experience">
              <Input type="number" min="0" placeholder="e.g. 8" value={form.years_experience} onChange={e => update('years_experience', e.target.value)} />
            </Field>
            <Field label="Instagram URL">
              <Input placeholder="https://instagram.com/sarahjones" value={form.instagram_url} onChange={e => update('instagram_url', e.target.value)} />
            </Field>
          </div>

          <Field label="Personal website">
            <Input placeholder="https://sarahjones.com" value={form.website_url} onChange={e => update('website_url', e.target.value)} />
          </Field>

          {/* Photos */}
          <Field label="Photos" hint="The first photo is shown on the teacher's public pages; the rest are extra gallery images.">

            {/* Photo grid */}
            {form.photos.length > 0 && (
              <div className={styles.formGrid} style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
                {form.photos.map((url, i) => (
                  <div key={`${url}-${i}`} style={{ position: 'relative' }}>
                    <img
                      src={url}
                      alt={`Photo ${i + 1}`}
                      style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e2e2e2' }}
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                    {/* Uploading overlay */}
                    {url.startsWith('blob:') && (
                      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ color: 'white', fontSize: '12px', fontWeight: 600 }}>Uploading...</span>
                      </div>
                    )}
                    {/* Remove button — only show when not uploading */}
                    {!url.startsWith('blob:') && (
                      <button
                        onClick={() => setForm(prev => ({ ...prev, photos: prev.photos.filter((_, idx) => idx !== i) }))}
                        style={{ position: 'absolute', top: '6px', right: '6px', width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Upload area */}
            <div style={{ border: '2px dashed #e2e2e2', borderRadius: '10px', padding: '20px', backgroundColor: '#fafafa' }}>

              {/* File upload button */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', backgroundColor: uploading ? '#9fd6b8' : '#085041', color: 'white', borderRadius: '8px', cursor: uploading ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 500 }}>
                  <span>{uploading ? '⏳' : '📁'}</span>
                  <span>{uploading ? 'Uploading...' : 'Upload from computer'}</span>
                  <input type="file" accept="image/*" onChange={handleFileUpload} disabled={uploading} style={{ display: 'none' }} />
                </label>
                <p style={{ fontSize: '11px', color: '#999', textAlign: 'center', marginTop: '6px' }}>JPG, PNG, WebP — max 5MB</p>
              </div>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e2e2' }} />
                <span style={{ fontSize: '12px', color: '#999' }}>or add by URL</span>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e2e2' }} />
              </div>

              {/* URL input */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="url"
                  placeholder="https://example.com/photo.jpg"
                  value={form.newPhotoUrl}
                  onChange={e => update('newPhotoUrl', e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && form.newPhotoUrl.trim()) {
                      setForm(prev => ({ ...prev, photos: [...prev.photos, prev.newPhotoUrl.trim()], newPhotoUrl: '' }))
                    }
                  }}
                  style={{ flex: 1, padding: '10px 14px', border: '1px solid #e2e2e2', borderRadius: '8px', fontSize: '14px', outline: 'none', backgroundColor: 'white' }}
                />
                <button
                  onClick={() => {
                    if (form.newPhotoUrl.trim()) {
                      setForm(prev => ({ ...prev, photos: [...prev.photos, prev.newPhotoUrl.trim()], newPhotoUrl: '' }))
                    }
                  }}
                  style={{ padding: '10px 16px', backgroundColor: '#f4f4f4', color: '#444', border: '1px solid #e2e2e2', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap' }}
                >
                  Add
                </button>
              </div>
            </div>
          </Field>
        </div>

        {/* Visibility */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '32px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '24px' }}>
          <SectionHeader title="Visibility" description="Control where this teacher appears." />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <Toggle checked={form.is_page_published} onChange={val => update('is_page_published', val)} label="Publish landing page — make this teacher's page publicly visible" />
            <Toggle checked={form.show_on_studio_page} onChange={val => update('show_on_studio_page', val)} label="Show in studio teacher directory" />
          </div>
          {form.is_page_published && teacher.profile && (
            <div style={{ marginTop: '16px', padding: '12px 16px', backgroundColor: '#e8f5ee', borderRadius: '8px', fontSize: '13px', color: '#085041' }}>
              Landing page URL: <strong>{'{studio}'}.calastudio.app/teachers/{teacher.profile.slug}</strong>
            </div>
          )}
        </div>

        {/* Error / Success */}
        {error && (
          <div style={{ padding: '12px 16px', backgroundColor: '#fdecea', borderRadius: '8px', color: '#8b1a1a', fontSize: '14px', marginBottom: '16px' }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ padding: '12px 16px', backgroundColor: '#e8f5ee', borderRadius: '8px', color: '#085041', fontSize: '14px', marginBottom: '16px' }}>
            {success}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <a href="/dashboard/team" style={{ padding: '10px 24px', border: '1px solid #e2e2e2', borderRadius: '8px', fontSize: '14px', color: '#444', textDecoration: 'none', fontWeight: 500 }}>
            Cancel
          </a>
          <button onClick={handleSave} disabled={saving || uploading} style={{ padding: '10px 24px', backgroundColor: saving ? '#9fd6b8' : '#085041', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

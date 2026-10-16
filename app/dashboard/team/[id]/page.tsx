'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getOrgContext } from '@/lib/orgContext'
import Sidebar from '../../../components/Sidebar'
import { displayName } from '@/lib/names'
import { STUDIO_DOMAIN, studioUrl } from '@/lib/seo'
import { ExternalLink, Upload, X } from 'lucide-react'
import { color, radius, space, tabularNums } from '@/lib/ui/tokens'
import { Breadcrumb, Button, Chip, Field, PageHeader, Toggle, buttonStyle, cardStyle, controlStyle, type ChipTone } from '@/app/components/admin'
import ui from '@/app/components/admin/admin.module.css'
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
    is_primary: boolean
  } | null
}

function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...controlStyle, ...(props.type === 'number' ? tabularNums : {}), ...props.style }} />
}

function Textarea({ ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} style={{ ...controlStyle, padding: '10px 12px', minHeight: 140, resize: 'vertical', lineHeight: 1.5, ...props.style }} />
}

const ROLE_INFO: Record<string, { label: string; tone: ChipTone; description: string }> = {
  admin: { label: 'Admin', tone: 'warn', description: 'Runs the studio: settings, team, sessions, passes and payments.' },
  teacher_super: { label: 'Super teacher', tone: 'primary', description: 'Full studio access within their teaching context. Can view all members, issue passes, process bookings.' },
  teacher_general: { label: 'Teacher', tone: 'info', description: 'Can view and manage their own sessions and the students booked into them.' },
  teacher_basic: { label: 'Basic teacher', tone: 'neutral', description: 'Can add students to their sessions and mark attendance only. No access to member details.' },
  front_desk: { label: 'Front desk', tone: 'neutral', description: 'Can view the full schedule and check in members. No financial data.' },
  member: { label: 'Member', tone: 'neutral', description: 'Can book sessions and manage their own passes and bookings.' },
}

// Staff roles first, Member last.
const ROLE_ORDER = Object.keys(ROLE_INFO)

function SectionCard({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`${id}-heading`} style={{ ...cardStyle, padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: space.formGap }}>
      <div>
        <h2 id={`${id}-heading`} style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{title}</h2>
        {description && <p style={{ margin: '4px 0 0', fontSize: 14, color: color.muted, lineHeight: 1.45 }}>{description}</p>}
      </div>
      {children}
    </section>
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
  const [isPrimary, setIsPrimary] = useState(false)
  const [settingPrimary, setSettingPrimary] = useState(false)
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
      const ctx = await getOrgContext()
      if (ctx.status === 'signed-out') { router.push('/login'); return }
      if (ctx.status === 'no-org') { router.push('/onboarding'); return }

      const t = ctx.token
      setToken(t)
      const org = ctx.org
      setOrgId(org.id)
      setOrgSlug(org.slug ?? '')
      setRoles(ctx.roles)

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
      setIsPrimary(data.profile?.is_primary ?? false)

      setLoading(false)
    }
    load()
  }, [teacherId, router])

  const update = (key: string, value: string | boolean | string[]) =>
    setForm(prev => ({ ...prev, [key]: value }))

  // Immediate action — one primary per studio, so this also clears it on everyone else.
  const handleMakePrimary = async () => {
    setSettingPrimary(true)
    setError('')
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}/teachers/${teacherId}/primary`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` } }
      )
      if (res.ok) {
        setIsPrimary(true)
        setSuccess("Set as the studio's primary teacher.")
        setTimeout(() => setSuccess(''), 3000)
      } else {
        const data = await res.json().catch(() => null)
        setError(data?.error ?? 'Could not set the primary teacher.')
      }
    } catch {
      setError('Something went wrong.')
    } finally {
      setSettingPrimary(false)
    }
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
            // The first photo is the hero; the rest are the gallery.
            photo_url: form.photos[0] || null,
            photos: form.photos.length > 0 ? form.photos : null,
          })
        }
      )

      if (res.ok) {
        setSuccess('Profile saved successfully')
        setTimeout(() => setSuccess(''), 3000)
      } else {
        const data = await res.json().catch(() => null)
        setError(data?.error ?? 'Failed to save. Please try again.')
      }
    } catch {
      setError('Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  const addPhotoUrl = () => {
    if (form.newPhotoUrl.trim()) setForm(prev => ({ ...prev, photos: [...prev.photos, prev.newPhotoUrl.trim()], newPhotoUrl: '' }))
  }
  const photoBadge: React.CSSProperties = {
    position: 'absolute', bottom: 6, left: 6, minHeight: 28, padding: '0 10px', borderRadius: radius.chip, border: 'none',
    fontFamily: 'inherit', fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center',
  }

  if (loading || !teacher) {
    return (
      <div className={styles.shell}>
        <Sidebar active="team" />
        <div className={styles.main} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: color.muted }}>Loading…</div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.shell}>
      <Sidebar active="team" roles={roles} />

      <div className={styles.main}>
        <div style={{ maxWidth: 820, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: space.cardGap }}>
          <Breadcrumb items={[{ label: 'Team', href: '/dashboard/team' }, { label: displayName(teacher) }]} />
          <PageHeader
            title={displayName(teacher)}
            actions={form.is_page_published && teacher.profile && orgSlug ? (
              <Button href={studioUrl(orgSlug, `/teachers/${teacher.profile.slug}`)} target="_blank" icon={<ExternalLink size={16} strokeWidth={2} aria-hidden />}>
                View landing page
              </Button>
            ) : undefined}
          >
            <span style={{ fontSize: 15, color: color.muted }}>{teacher.email}</span>
          </PageHeader>

          <SectionCard id="roles" title="Roles" description="What this person can see and do in the dashboard. A person can hold more than one role.">
            <div style={{ border: `1px solid ${color.border}`, borderRadius: radius.control, overflow: 'hidden' }}>
              {[...form.roles].sort((x, y) => ROLE_ORDER.indexOf(x) - ROLE_ORDER.indexOf(y)).map((r, i) => {
                const info = ROLE_INFO[r] ?? { label: r, tone: 'neutral' as ChipTone, description: '' }
                return (
                  <div key={r} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 14px', padding: '12px 16px', borderTop: i ? `1px solid ${color.divider}` : 'none' }}>
                    <Chip tone={info.tone}>{info.label}</Chip>
                    <span style={{ flex: '1 1 260px', fontSize: 14, color: color.ink2, lineHeight: 1.4 }}>{info.description}</span>
                  </div>
                )
              })}
            </div>
            <p style={{ margin: 0, fontSize: 13, color: color.muted }}>Changing someone&apos;s role isn&apos;t available here yet.</p>
          </SectionCard>

          <SectionCard id="profile" title="Landing page profile" description="This information appears on their public teacher page.">
            <Field label="Display name" htmlFor="t-name">
              <Input id="t-name" placeholder="e.g. Sarah Jones" value={form.display_name} onChange={e => update('display_name', e.target.value)} />
            </Field>
            <Field label="Tagline" htmlFor="t-tag" hint="One line shown under their name.">
              <Input id="t-tag" aria-describedby="t-tag-hint" placeholder="e.g. Vinyasa & Yin specialist" value={form.tagline} onChange={e => update('tagline', e.target.value)} />
            </Field>
            <Field label="Bio" htmlFor="t-bio" hint="Full biography. Markdown supported.">
              <Textarea id="t-bio" aria-describedby="t-bio-hint" placeholder="Tell students about this teacher…" value={form.bio} onChange={e => update('bio', e.target.value)} />
            </Field>
            <div className={styles.formGrid} style={{ gridTemplateColumns: '1fr 1fr', gap: space.formGap }}>
              <Field label="Specialties" htmlFor="t-spec" hint="Comma separated">
                <Input id="t-spec" aria-describedby="t-spec-hint" placeholder="Vinyasa, Yin, Meditation" value={form.specialties} onChange={e => update('specialties', e.target.value)} />
              </Field>
              <Field label="Certifications" htmlFor="t-cert" hint="Comma separated">
                <Input id="t-cert" aria-describedby="t-cert-hint" placeholder="RYT-200, NASM-CPT" value={form.certifications} onChange={e => update('certifications', e.target.value)} />
              </Field>
            </div>
            <div className={styles.formGrid} style={{ gridTemplateColumns: '1fr 1fr', gap: space.formGap }}>
              <Field label="Years of experience" htmlFor="t-years">
                <Input id="t-years" type="number" min="0" placeholder="e.g. 8" value={form.years_experience} onChange={e => update('years_experience', e.target.value)} />
              </Field>
              <Field label="Instagram URL" htmlFor="t-ig">
                <Input id="t-ig" type="url" placeholder="https://instagram.com/sarahjones" value={form.instagram_url} onChange={e => update('instagram_url', e.target.value)} />
              </Field>
            </div>
            <Field label="Personal website" htmlFor="t-web">
              <Input id="t-web" type="url" placeholder="https://sarahjones.com" value={form.website_url} onChange={e => update('website_url', e.target.value)} />
            </Field>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Photos</span>
              <span style={{ fontSize: 13, color: color.muted, lineHeight: 1.4 }}>The first photo is the hero at the top of the page; the rest appear in a gallery below the bio. Up to 10.</span>
              {form.photos.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginTop: 6 }}>
                  {form.photos.map((url, i) => (
                    <div key={`${url}-${i}`} style={{ position: 'relative' }}>
                      <img src={url} alt={`Photo ${i + 1}`}
                        style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: radius.control, border: `1px solid ${color.border}`, display: 'block' }}
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                      {url.startsWith('blob:') ? (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(23,32,28,0.45)', borderRadius: radius.control, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', fontSize: 14, fontWeight: 600 }}>
                          Uploading…
                        </div>
                      ) : (
                        <>
                          <button type="button" aria-label={`Remove photo ${i + 1}`} className={ui.focusable}
                            onClick={() => setForm(prev => ({ ...prev, photos: prev.photos.filter((_, idx) => idx !== i) }))}
                            style={{ position: 'absolute', top: 6, right: 6, width: 32, height: 32, borderRadius: '50%', background: 'rgba(23,32,28,0.7)', color: '#FFFFFF', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                            <X size={16} strokeWidth={2.5} aria-hidden />
                          </button>
                          {i === 0 ? (
                            <span style={{ ...photoBadge, background: color.primary, color: '#FFFFFF' }}>Hero</span>
                          ) : (
                            <button type="button" className={ui.focusable}
                              onClick={() => setForm(prev => ({ ...prev, photos: [prev.photos[i], ...prev.photos.filter((_, idx) => idx !== i)] }))}
                              style={{ ...photoBadge, background: 'rgba(23,32,28,0.7)', color: '#FFFFFF', cursor: 'pointer' }}>
                              Make hero
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 8 }}>
                <label className={`${ui.button} ${ui.focusable}`} style={{ ...buttonStyle('secondary', 'md'), position: 'relative', cursor: uploading ? 'not-allowed' : 'pointer' }}>
                  <Upload size={16} strokeWidth={2} aria-hidden />
                  {uploading ? 'Uploading…' : 'Upload photo'}
                  <input type="file" accept="image/*" onChange={handleFileUpload} disabled={uploading} style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} />
                </label>
                <span style={{ fontSize: 13, color: color.muted }}>JPG, PNG or WebP, up to 5 MB</span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <Input type="url" aria-label="Add a photo by URL" placeholder="Or paste a photo URL" value={form.newPhotoUrl}
                  onChange={e => update('newPhotoUrl', e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addPhotoUrl() }} style={{ flex: 1 }} />
                <Button onClick={addPhotoUrl} disabled={!form.newPhotoUrl.trim()}>Add</Button>
              </div>
            </div>
          </SectionCard>

          <SectionCard id="visibility" title="Visibility" description="Where this teacher appears.">
            <Toggle checked={form.is_page_published} onChange={val => update('is_page_published', val)} label="Publish landing page — make this teacher's page publicly visible" />
            <Toggle checked={form.show_on_studio_page} onChange={val => update('show_on_studio_page', val)} label="Show in studio teacher directory" />
            {form.is_page_published && teacher.profile && (
              <p style={{ margin: 0, fontSize: 14, color: color.ink2 }}>
                Page address: <strong style={{ fontWeight: 600 }}>{orgSlug || '{studio}'}.{STUDIO_DOMAIN}/teachers/{teacher.profile.slug}</strong>
              </p>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', paddingTop: 16, borderTop: `1px solid ${color.divider}` }}>
              <div style={{ flex: '1 1 300px' }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>Primary teacher</div>
                <div style={{ fontSize: 13, color: color.muted, marginTop: 2, lineHeight: 1.4 }}>Shown first in the studio directory. One per studio — setting this clears it on any other teacher.</div>
              </div>
              {isPrimary ? <Chip tone="primary">Primary teacher</Chip> : (
                <Button onClick={handleMakePrimary} disabled={settingPrimary}>{settingPrimary ? 'Setting…' : 'Make primary'}</Button>
              )}
            </div>
          </SectionCard>

          {error && <div role="alert" style={{ padding: '12px 16px', background: color.dangerBg, borderRadius: radius.control, color: color.dangerInk, fontSize: 15 }}>{error}</div>}
          {success && <div role="status" style={{ padding: '12px 16px', background: color.primarySoft, borderRadius: radius.control, color: color.primaryInk, fontSize: 15 }}>{success}</div>}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Button href="/dashboard/team">Cancel</Button>
            <Button variant="primary" onClick={handleSave} disabled={saving || uploading}>{saving ? 'Saving…' : 'Save changes'}</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

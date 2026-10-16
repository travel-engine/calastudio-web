'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Building2, ChevronDown, ChevronRight, Lock, TriangleAlert, X } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { getOrgContext, clearOrgContext } from '@/lib/orgContext'
import Sidebar from '@/app/components/Sidebar'
import Forbidden from '@/app/components/Forbidden'
import { canManageSettings } from '@/lib/roles'
import { scanForMojibake } from '@/lib/mojibake'
import ThemePicker from '@/app/components/ThemePicker'
import type { ThemeKey } from '@/lib/studioTheme'
import { color, font, radius, space, tabularNums } from '@/lib/ui/tokens'
import { Button, Chip, PageHeader, Toggle, buttonStyle, cardStyle, controlStyle, smallCapsStyle } from '@/app/components/admin'
import ui from '@/app/components/admin/admin.module.css'
import styles from '@/app/dashboard/dashboard.module.css'

// IANA zone names straight from the runtime — an empty list (older browser) falls back to free text.
const TIMEZONES: string[] = (() => {
  try {
    return (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? []
  } catch {
    return []
  }
})()

const browserZone = (): string => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone ?? '' } catch { return '' }
}

// ISO 3166-1 alpha-2 → display name, for showing the onboarding-set country read-only.
const COUNTRY_NAMES: Record<string, string> = {
  AU: 'Australia', US: 'United States', GB: 'United Kingdom', NZ: 'New Zealand',
  CA: 'Canada', SG: 'Singapore', IN: 'India', IE: 'Ireland', ZA: 'South Africa',
}
const countryLabel = (code: string) => {
  if (!code) return '—'
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? COUNTRY_NAMES[code] ?? code
  } catch {
    return COUNTRY_NAMES[code] ?? code
  }
}

function Field({ label, hint, htmlFor, children }: { label: string; hint?: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label htmlFor={htmlFor} style={{ fontSize: 14, fontWeight: 600, color: color.ink }}>{label}</label>
      {children}
      {hint && <p style={{ margin: 0, fontSize: 13, lineHeight: 1.4, color: color.muted }}>{hint}</p>}
    </div>
  )
}

function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...controlStyle, ...(props.type === 'number' ? tabularNums : {}), ...props.style }} />
}

function Textarea({ ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} style={{ ...controlStyle, padding: '10px 12px', minHeight: 88, resize: 'vertical', lineHeight: 1.5, ...props.style }} />
}

// Tax rate dates are plain YYYY-MM-DD days; show the year, since rates span years.
const formatRateDate = (d: string) => {
  const [y, m, day] = d.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

const grid2: React.CSSProperties = { gridTemplateColumns: '1fr 1fr', gap: space.formGap }
const smallLinkButton: React.CSSProperties = {
  background: 'none', border: 0, padding: '6px 0', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer',
}

type FormState = {
  name: string; description: string; email: string; phone: string
  logoUrl: string; bannerUrl: string; brandColor: string; theme: string
  tagline: string; heroHeadline: string; heroHeadlineEmphasis: string; heroLead: string; heroCtaLabel: string; heroImageUrl: string
  aboutHeading: string; aboutBody: string; aboutImageUrl: string; aboutCtaLabel: string
  passesHeading: string; passesBlurb: string; contactEmail: string
  instagramUrl: string; facebookUrl: string; tiktokUrl: string; youtubeUrl: string
  galleryUrls: string[]
  taxEnabled: boolean; taxLabel: string; taxRegistrationNumber: string
  addressLine1: string; addressLine2: string; addressCity: string; addressState: string; addressPostcode: string
  timezone: string; locale: string; country: string
  cancellationHours: string; bookingWindowDays: string; minAdvanceBookingHours: string
  lateCancelCreditsForfeited: boolean; liabilityWaiverRequired: boolean
}
type Key = keyof FormState

const EMPTY_FORM: FormState = {
  name: '', description: '', email: '', phone: '',
  logoUrl: '', bannerUrl: '', brandColor: '#085041', theme: 'classic',
  tagline: '', heroHeadline: '', heroHeadlineEmphasis: '', heroLead: '', heroCtaLabel: '', heroImageUrl: '',
  aboutHeading: '', aboutBody: '', aboutImageUrl: '', aboutCtaLabel: '',
  passesHeading: '', passesBlurb: '', contactEmail: '',
  instagramUrl: '', facebookUrl: '', tiktokUrl: '', youtubeUrl: '',
  galleryUrls: [],
  taxEnabled: false, taxLabel: '', taxRegistrationNumber: '',
  addressLine1: '', addressLine2: '', addressCity: '', addressState: '', addressPostcode: '',
  timezone: '', locale: '', country: '',
  cancellationHours: '', bookingWindowDays: '', minAdvanceBookingHours: '',
  lateCancelCreditsForfeited: true, liabilityWaiverRequired: true,
}

// Which fields each card saves. Every save still sends the whole organisation (see saveSection).
const SECTION_KEYS = {
  profile: ['name', 'description', 'email', 'phone', 'addressLine1', 'addressLine2', 'addressCity', 'addressState', 'addressPostcode'],
  region: ['timezone', 'locale'],
  policy: ['cancellationHours', 'bookingWindowDays', 'minAdvanceBookingHours', 'lateCancelCreditsForfeited'],
  waiver: ['liabilityWaiverRequired'],
  tax: ['taxEnabled', 'taxLabel', 'taxRegistrationNumber'],
  branding: ['logoUrl', 'brandColor'],
  theme: ['theme'],
  content: ['tagline', 'heroHeadline', 'heroHeadlineEmphasis', 'heroLead', 'heroCtaLabel', 'heroImageUrl', 'aboutHeading', 'aboutBody',
    'aboutImageUrl', 'aboutCtaLabel', 'passesHeading', 'passesBlurb', 'contactEmail', 'instagramUrl', 'facebookUrl', 'tiktokUrl',
    'youtubeUrl', 'galleryUrls'],
} satisfies Record<string, Key[]>
type SectionId = keyof typeof SECTION_KEYS

// The full PATCH body (UpdateOrganisationRequest). Always sent whole, never partially.
function orgBody(f: FormState) {
  return {
    name: f.name,
    description: f.description || null,
    email: f.email || null,
    phone: f.phone || null,
    logo_url: f.logoUrl || null,
    banner_url: f.bannerUrl || null,
    brand_color: f.brandColor || null,
    theme: f.theme || null,
    // Public-page content — nested `page_content` object (PageContentDto, snake_case).
    page_content: {
      tagline: f.tagline || null,
      hero_headline: f.heroHeadline || null,
      hero_headline_emphasis: f.heroHeadlineEmphasis || null,
      hero_lead: f.heroLead || null,
      hero_cta_label: f.heroCtaLabel || null,
      hero_image_url: f.heroImageUrl || null,
      about_heading: f.aboutHeading || null,
      about_body: f.aboutBody.split(/\n{2,}/).map(s => s.trim()).filter(Boolean),
      about_image_url: f.aboutImageUrl || null,
      about_cta_label: f.aboutCtaLabel || null,
      passes_heading: f.passesHeading || null,
      passes_blurb: f.passesBlurb || null,
      contact_email: f.contactEmail || null,
      instagram_url: f.instagramUrl || null,
      facebook_url: f.facebookUrl || null,
      tiktok_url: f.tiktokUrl || null,
      youtube_url: f.youtubeUrl || null,
      gallery: f.galleryUrls.map(url => ({ url, alt: f.name })),
    },
    tax_enabled: f.taxEnabled,
    tax_label: f.taxLabel || null,
    tax_registration_number: f.taxRegistrationNumber || null,
    address_line1: f.addressLine1 || null,
    address_line2: f.addressLine2 || null,
    address_city: f.addressCity || null,
    address_state: f.addressState || null,
    address_postcode: f.addressPostcode || null,
    timezone: f.timezone || null,
    locale: f.locale || null,
    cancellation_hours: f.cancellationHours !== '' ? parseInt(f.cancellationHours, 10) : null,
    booking_window_days: f.bookingWindowDays !== '' ? parseInt(f.bookingWindowDays, 10) : null,
    min_advance_booking_hours: f.minAdvanceBookingHours !== '' ? parseInt(f.minAdvanceBookingHours, 10) : null,
    late_cancel_credits_forfeited: f.lateCancelCreditsForfeited,
    liability_waiver_required: f.liabilityWaiverRequired,
  }
}

const STUDIO_SECTIONS: { id: string; label: string }[] = [
  { id: 'profile', label: 'Studio profile' },
  { id: 'region', label: 'Region & time zone' },
  { id: 'policy', label: 'Booking policy' },
  { id: 'waiver', label: 'Liability waiver' },
  { id: 'payments', label: 'Payments' },
  { id: 'tax', label: 'Tax (GST)' },
]

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className={styles.shell}>
        <Sidebar active="settings" />
        <div className={styles.main} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: color.muted }}>Loading…</div>
        </div>
      </div>
    }>
      <SettingsPageContent />
    </Suspense>
  )
}

function SettingsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [tab, setTab] = useState<'studio' | 'page'>('studio')
  const [error, setError] = useState('') // upload problems; section saves report on their own card
  const [orgId, setOrgId] = useState('')
  const [token, setToken] = useState('')
  const [roles, setRoles] = useState<string[]>([])
  const [forbidden, setForbidden] = useState(false)

  // `form` is what's on screen; `savedForm` is what the server has. A card's Save sends the saved
  // values with only that card's fields replaced, so unsaved edits elsewhere never ride along.
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [savedForm, setSavedForm] = useState<FormState>(EMPTY_FORM)
  const [sectionState, setSectionState] = useState<Partial<Record<SectionId, { busy?: boolean; ok?: boolean; msg?: string }>>>({})

  // The waiver text is edited and saved on its own — PATCH /liability-waiver, separate from the
  // main settings save, because every edit bumps the version and re-prompts every member to accept.
  const [waiverText, setWaiverText] = useState('')
  const [initialWaiverText, setInitialWaiverText] = useState('')
  const [waiverVersion, setWaiverVersion] = useState<number | null>(null)
  const [savingWaiver, setSavingWaiver] = useState(false)
  const [waiverMsg, setWaiverMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const [taxRates, setTaxRates] = useState<{ id: string; rate: number; effective_from: string; effective_until: string | null; notes: string | null }[]>([])
  const [showAddRate, setShowAddRate] = useState(false)
  const [addRateForm, setAddRateForm] = useState({ rate: '', effectiveFrom: '', notes: '' })
  const [addingRate, setAddingRate] = useState(false)
  const [rateError, setRateError] = useState('')

  // Set at onboarding, not editable here — shown read-only alongside timezone/locale.
  const [currency, setCurrency] = useState('')

  const [stripeOnboardingComplete, setStripeOnboardingComplete] = useState(false)
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null)
  const [connectingStripe, setConnectingStripe] = useState(false)
  const [stripeError, setStripeError] = useState('')
  const [stripeBanner, setStripeBanner] = useState<'success' | 'failure' | null>(null)

  const [openContentRow, setOpenContentRow] = useState<string | null>(null)
  const [zone, setZone] = useState('')
  useEffect(() => { setZone(browserZone()) }, [])

  const update = (key: Key, value: string | boolean) => setForm(prev => ({ ...prev, [key]: value }))
  const isDirty = (id: SectionId) => (SECTION_KEYS[id] as Key[]).some(k => JSON.stringify(form[k]) !== JSON.stringify(savedForm[k]))

  // Flag any free-text field that looks like it has an encoding problem — usually text pasted from
  // a source where a character was already double-encoded (see lib/mojibake). Warn, don't block.
  const encodingIssues = useMemo(() => scanForMojibake({
    'Studio name': form.name,
    'Description': form.description,
    'Tagline': form.tagline,
    'Headline': form.heroHeadline,
    'Emphasised word': form.heroHeadlineEmphasis,
    'Intro paragraph': form.heroLead,
    'Hero button label': form.heroCtaLabel,
    'About heading': form.aboutHeading,
    'About text': form.aboutBody,
    'About button label': form.aboutCtaLabel,
    'Passes heading': form.passesHeading,
    'Passes blurb': form.passesBlurb,
    'Contact email': form.contactEmail,
  }), [form])

  useEffect(() => {
    const connected = searchParams.get('stripe_connected')
    if (connected === 'true') setStripeBanner('success')
    else if (connected === 'false') setStripeBanner('failure')
    if (connected !== null) router.replace('/dashboard/settings')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const load = async () => {
      // fresh: this page edits the org, so never pre-fill the form from the cached copy.
      const ctx = await getOrgContext({ fresh: true })
      if (ctx.status === 'signed-out') { router.push('/login'); return }
      if (ctx.status === 'no-org') { router.push('/onboarding'); return }

      const t = ctx.token
      setToken(t)
      const org = ctx.org
      setOrgId(org.id)
      setRoles(ctx.roles)

      if (!canManageSettings(ctx.roles)) {
        setForbidden(true)
        setLoading(false)
        return
      }

      // GET /api/organisations/mine currently returns page_content: null even when it's set
      // (backend mapping gap) — GET /api/public/{slug} always has it. Pull both from there,
      // preferring `mine`'s values when it actually provides them.
      let theme = org.theme
      let pageContent = org.page_content
      const [pubRes, ratesRes] = await Promise.all([
        org.slug ? fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/public/${org.slug}`).catch(() => null) : Promise.resolve(null),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${org.id}/tax-rates`, { headers: { Authorization: `Bearer ${t}` } }),
      ])
      if (pubRes?.ok) {
        const pub = await pubRes.json()
        theme = theme ?? pub.theme
        pageContent = pageContent ?? pub.page_content
      }

      const pc = pageContent ?? {}
      const loaded: FormState = {
        name: org.name ?? '',
        description: org.description ?? '',
        email: org.email ?? '',
        phone: org.phone ?? '',
        logoUrl: org.logo_url ?? '',
        bannerUrl: org.banner_url ?? '',
        brandColor: org.brand_color ?? '#085041',
        theme: theme ?? 'classic',
        tagline: pc.tagline ?? '',
        heroHeadline: pc.hero_headline ?? '',
        heroHeadlineEmphasis: pc.hero_headline_emphasis ?? '',
        heroLead: pc.hero_lead ?? '',
        heroCtaLabel: pc.hero_cta_label ?? '',
        heroImageUrl: pc.hero_image_url ?? '',
        aboutHeading: pc.about_heading ?? '',
        aboutBody: Array.isArray(pc.about_body) ? pc.about_body.join('\n\n') : '',
        aboutImageUrl: pc.about_image_url ?? '',
        aboutCtaLabel: pc.about_cta_label ?? '',
        passesHeading: pc.passes_heading ?? '',
        passesBlurb: pc.passes_blurb ?? '',
        contactEmail: pc.contact_email ?? '',
        instagramUrl: pc.instagram_url ?? '',
        facebookUrl: pc.facebook_url ?? '',
        tiktokUrl: pc.tiktok_url ?? '',
        youtubeUrl: pc.youtube_url ?? '',
        galleryUrls: Array.isArray(pc.gallery) ? pc.gallery.map((g: { url: string }) => g.url).filter(Boolean) : [],
        taxEnabled: org.tax_enabled ?? false,
        taxLabel: org.tax_label ?? '',
        taxRegistrationNumber: org.tax_registration_number ?? '',
        addressLine1: org.address_line1 ?? '',
        addressLine2: org.address_line2 ?? '',
        addressCity: org.address_city ?? '',
        addressState: org.address_state ?? '',
        addressPostcode: org.address_postcode ?? '',
        timezone: org.timezone ?? '',
        locale: org.locale ?? '',
        country: org.country ?? '',
        cancellationHours: org.cancellation_hours != null ? String(org.cancellation_hours) : '',
        bookingWindowDays: org.booking_window_days != null ? String(org.booking_window_days) : '',
        minAdvanceBookingHours: org.min_advance_booking_hours != null ? String(org.min_advance_booking_hours) : '',
        lateCancelCreditsForfeited: org.late_cancel_credits_forfeited ?? true,
        liabilityWaiverRequired: org.liability_waiver_required ?? true,
      }
      setForm(loaded)
      setSavedForm(loaded)
      setWaiverText(org.liability_waiver_text ?? '')
      setInitialWaiverText(org.liability_waiver_text ?? '')
      setWaiverVersion(org.liability_waiver_version ?? null)
      setCurrency(org.currency ?? '')
      setStripeOnboardingComplete(org.stripe_onboarding_complete ?? false)
      setStripeAccountId(org.stripe_account_id ?? null)
      if (ratesRes.ok) setTaxRates(await ratesRes.json())

      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  const reloadTaxRates = async () => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}/tax-rates`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (res.ok) setTaxRates(await res.json())
  }

  const handleConnectStripe = async () => {
    setConnectingStripe(true)
    setStripeError('')

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}/stripe/connect`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (res.ok) {
        const { url } = await res.json()
        window.location.href = url
      } else {
        const data = await res.json().catch(() => null)
        setStripeError(data?.error ?? 'Could not start Stripe Connect. Please try again.')
        setConnectingStripe(false)
      }
    } catch {
      setStripeError('Could not start Stripe Connect. Please try again.')
      setConnectingStripe(false)
    }
  }

  const openAddRate = () => {
    setRateError('')
    setAddRateForm({ rate: '', effectiveFrom: '', notes: '' })
    setShowAddRate(true)
  }

  const handleAddRate = async () => {
    if (!addRateForm.rate || !addRateForm.effectiveFrom) {
      setRateError('Rate and start date are both required')
      return
    }

    setAddingRate(true)
    setRateError('')

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}/tax-rates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          rate: parseFloat(addRateForm.rate),
          effective_from: addRateForm.effectiveFrom,
          notes: addRateForm.notes || null,
        })
      })

      if (res.ok) {
        setShowAddRate(false)
        await reloadTaxRates()
      } else {
        const data = await res.json().catch(() => null)
        setRateError(data?.error ?? 'Could not add this rate.')
      }
    } catch {
      setRateError('Could not add this rate.')
    } finally {
      setAddingRate(false)
    }
  }

  const uploadImage = async (file: File, folder: 'org-logos' | 'org-banners' | 'org-content'): Promise<string | null> => {
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

  // Public-page content images (hero, about). Uploads to the shared bucket, then stores the URL.
  const [contentImgBusy, setContentImgBusy] = useState('')
  const handleContentImage = async (e: React.ChangeEvent<HTMLInputElement>, field: 'heroImageUrl' | 'aboutImageUrl') => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    setContentImgBusy(field)
    const url = await uploadImage(file, 'org-content')
    if (url) update(field, url)
    setContentImgBusy('')
  }

  const handleGalleryAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    setError('')
    setContentImgBusy('gallery')
    for (const file of files) {
      const url = await uploadImage(file, 'org-content')
      if (url) setForm(prev => ({ ...prev, galleryUrls: [...prev.galleryUrls, url] }))
    }
    setContentImgBusy('')
  }

  // Save one card. The request is the full organisation — the last saved values with only this
  // card's fields taken from the screen — so a field can never be dropped or nulled by omission,
  // and other cards' unsaved edits stay unsaved. `override` lets an action save a value directly.
  const saveSection = async (id: SectionId, override?: Partial<FormState>) => {
    const setState = (s: { busy?: boolean; ok?: boolean; msg?: string }) => setSectionState(prev => ({ ...prev, [id]: s }))
    const fromScreen = Object.fromEntries((SECTION_KEYS[id] as Key[]).map(k => [k, form[k]])) as Partial<FormState>
    const next: FormState = { ...savedForm, ...fromScreen, ...override }

    if (id === 'profile' && !next.name.trim()) { setState({ ok: false, msg: 'Studio name is required.' }); return }
    if (id === 'region' && next.timezone && TIMEZONES.length > 0 && !TIMEZONES.includes(next.timezone)) {
      setState({ ok: false, msg: `"${next.timezone}" isn't a time zone. Pick one from the list, e.g. Australia/Brisbane.` })
      return
    }

    setState({ busy: true })
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(orgBody(next)),
      })
      if (res.ok) {
        clearOrgContext() // other pages re-read currency, timezone etc.
        setSavedForm(next)
        if (override) setForm(prev => ({ ...prev, ...override }))
        setState({ ok: true, msg: 'Saved.' })
      } else {
        const data = await res.json().catch(() => null)
        setState({ ok: false, msg: data?.error ?? 'Could not save. Please try again.' })
      }
    } catch {
      setState({ ok: false, msg: 'Something went wrong. Please try again.' })
    }
  }

  const handleSaveWaiver = async () => {
    if (!waiverText.trim()) { setWaiverMsg({ ok: false, text: 'Waiver text cannot be empty.' }); return }
    setSavingWaiver(true)
    setWaiverMsg(null)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}/liability-waiver`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: waiverText }),
      })
      if (res.ok) {
        clearOrgContext()
        const org = await res.json().catch(() => null)
        setInitialWaiverText(waiverText)
        setWaiverVersion(org?.liability_waiver_version ?? (waiverVersion != null ? waiverVersion + 1 : null))
        setWaiverMsg({ ok: true, text: 'Published. Members will be asked to accept the new version before their next booking.' })
      } else {
        const data = await res.json().catch(() => null)
        setWaiverMsg({ ok: false, text: data?.error ?? 'Could not publish the waiver. Please try again.' })
      }
    } catch {
      setWaiverMsg({ ok: false, text: 'Could not publish the waiver. Please try again.' })
    } finally {
      setSavingWaiver(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.shell}>
        <Sidebar active="settings" />
        <div className={styles.main} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: color.muted }}>Loading…</div>
        </div>
      </div>
    )
  }

  // A card with its own Save. `saveId` wires the button to that section's fields; it's enabled
  // only when the section has unsaved changes.
  const sectionCard = (id: string, title: string, description: string | null, body: React.ReactNode, saveId?: SectionId, extraFooter?: React.ReactNode) => {
    const st = saveId ? sectionState[saveId] : undefined
    const dirty = saveId ? isDirty(saveId) : false
    return (
      <section id={id} aria-labelledby={`${id}-heading`} style={{ ...cardStyle, scrollMarginTop: 24 }}>
        <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: space.formGap }}>
          <div>
            <h2 id={`${id}-heading`} style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{title}</h2>
            {description && <p style={{ margin: '4px 0 0', fontSize: 14, color: color.muted, lineHeight: 1.45 }}>{description}</p>}
          </div>
          {body}
        </div>
        {(saveId || extraFooter) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: 12, padding: '14px 24px', borderTop: `1px solid ${color.divider}` }}>
            {st?.msg && !st.busy && (
              <span role={st.ok ? 'status' : 'alert'} style={{ fontSize: 14, color: st.ok ? color.primaryInk : color.dangerInk, marginRight: 'auto' }}>{st.msg}</span>
            )}
            {extraFooter}
            {saveId && (
              <>
                {dirty && !st?.busy && (
                  <button type="button" className={ui.focusable} style={{ ...smallLinkButton, color: color.muted }}
                    onClick={() => setForm(prev => ({ ...prev, ...Object.fromEntries((SECTION_KEYS[saveId] as Key[]).map(k => [k, savedForm[k]])) }))}>
                    Discard
                  </button>
                )}
                <Button variant="primary" onClick={() => saveSection(saveId)} disabled={!dirty || st?.busy}>
                  {st?.busy ? 'Saving…' : 'Save'}
                </Button>
              </>
            )}
          </div>
        )}
      </section>
    )
  }

  const imageBox = (url: string, w: number, h: number, label: string) => (
    <div style={{ width: w, height: h, borderRadius: radius.control, background: color.bg, border: `1px solid ${color.border}`, overflow: 'hidden', flex: 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center', color: color.muted }}>
      {url ? <img src={url} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Building2 size={22} strokeWidth={1.6} aria-hidden />}
    </div>
  )
  const uploadLabel = (text: string, busy: boolean, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, multiple = false) => (
    <label className={`${ui.button} ${ui.focusable}`} style={{ ...buttonStyle('secondary', 'sm'), cursor: busy ? 'not-allowed' : 'pointer' }}>
      {busy ? 'Uploading…' : text}
      <input type="file" accept="image/*" multiple={multiple} onChange={onChange} disabled={busy} style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} />
    </label>
  )
  const removeButton = (onClick: () => void) => (
    <button type="button" onClick={onClick} className={ui.focusable} style={{ ...smallLinkButton, color: color.dangerInk }}>Remove</button>
  )

  const zones = zone && TIMEZONES.includes(zone) ? [zone, ...TIMEZONES.filter(z => z !== zone)] : TIMEZONES
  const currentRateId = taxRates.find(r => !r.effective_until)?.id
  const tabs = [['studio', 'Studio'], ['page', 'Booking page']] as const

  // Booking page content as rows — each opens its group of fields.
  const contentRows: { id: string; label: string; summary: string; fields: React.ReactNode }[] = [
    {
      id: 'hero', label: 'Hero', summary: form.heroHeadline || 'Not written yet',
      fields: (
        <>
          <Field label="Tagline" htmlFor="c-tagline" hint="Small line above the headline, e.g. “Mysore · Ashtanga · Vinyasa · Workshops”">
            <Input id="c-tagline" value={form.tagline} onChange={e => update('tagline', e.target.value)} />
          </Field>
          <div className={styles.formGrid} style={grid2}>
            <Field label="Headline" htmlFor="c-headline" hint="The big line in your hero.">
              <Input id="c-headline" value={form.heroHeadline} onChange={e => update('heroHeadline', e.target.value)} />
            </Field>
            <Field label="Emphasised word" htmlFor="c-emph" hint="A word inside the headline shown bolder (optional).">
              <Input id="c-emph" value={form.heroHeadlineEmphasis} onChange={e => update('heroHeadlineEmphasis', e.target.value)} />
            </Field>
          </div>
          <Field label="Intro paragraph" htmlFor="c-lead">
            <Textarea id="c-lead" value={form.heroLead} onChange={e => update('heroLead', e.target.value)} rows={3} />
          </Field>
          <Field label="Hero button label" htmlFor="c-cta" hint="Second hero button, links to your teacher page, e.g. “About Ravi”">
            <Input id="c-cta" value={form.heroCtaLabel} onChange={e => update('heroCtaLabel', e.target.value)} />
          </Field>
        </>
      ),
    },
    {
      id: 'heroPhoto', label: 'Hero photo', summary: form.heroImageUrl ? 'Photo added' : 'No photo',
      fields: (
        <Field label="Hero photo" hint="Portrait works best. Shown full-screen on the Photo First theme, beside the text on the others.">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            {imageBox(form.heroImageUrl, 96, 120, 'Hero photo')}
            {uploadLabel(form.heroImageUrl ? 'Replace photo' : 'Upload photo', contentImgBusy === 'heroImageUrl', e => handleContentImage(e, 'heroImageUrl'))}
            {form.heroImageUrl && removeButton(() => update('heroImageUrl', ''))}
          </div>
        </Field>
      ),
    },
    {
      id: 'about', label: 'About', summary: form.aboutHeading || 'Not written yet',
      fields: (
        <>
          <Field label="About heading" htmlFor="c-about-h">
            <Input id="c-about-h" value={form.aboutHeading} onChange={e => update('aboutHeading', e.target.value)} />
          </Field>
          <Field label="About text" htmlFor="c-about-b" hint="Leave a blank line between paragraphs.">
            <Textarea id="c-about-b" value={form.aboutBody} onChange={e => update('aboutBody', e.target.value)} rows={5} />
          </Field>
          <div className={styles.formGrid} style={grid2}>
            <Field label="About button label" htmlFor="c-about-cta" hint="Optional, e.g. “Read more”">
              <Input id="c-about-cta" value={form.aboutCtaLabel} onChange={e => update('aboutCtaLabel', e.target.value)} />
            </Field>
            <Field label="About photo">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                {imageBox(form.aboutImageUrl, 72, 72, 'About photo')}
                {uploadLabel(form.aboutImageUrl ? 'Replace' : 'Upload', contentImgBusy === 'aboutImageUrl', e => handleContentImage(e, 'aboutImageUrl'))}
                {form.aboutImageUrl && removeButton(() => update('aboutImageUrl', ''))}
              </div>
            </Field>
          </div>
        </>
      ),
    },
    {
      id: 'passes', label: 'Passes intro', summary: form.passesHeading || 'Default heading',
      fields: (
        <>
          <div className={styles.formGrid} style={grid2}>
            <Field label="Passes heading" htmlFor="c-pass-h" hint="Above the pass prices. Defaults to “Passes, or pay as you go”.">
              <Input id="c-pass-h" value={form.passesHeading} onChange={e => update('passesHeading', e.target.value)} />
            </Field>
            <Field label="Contact email" htmlFor="c-contact" hint="Shown in the page footer.">
              <Input id="c-contact" type="email" value={form.contactEmail} onChange={e => update('contactEmail', e.target.value)} />
            </Field>
          </div>
          <Field label="Passes blurb" htmlFor="c-pass-b">
            <Textarea id="c-pass-b" value={form.passesBlurb} onChange={e => update('passesBlurb', e.target.value)} rows={2} />
          </Field>
        </>
      ),
    },
    {
      id: 'gallery', label: 'Photo gallery', summary: form.galleryUrls.length ? `${form.galleryUrls.length} photo${form.galleryUrls.length === 1 ? '' : 's'}` : 'No photos',
      fields: (
        <Field label="Photo gallery" hint="Square photos shown on your home and teacher pages.">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {form.galleryUrls.map((url, i) => (
              <div key={url + i} style={{ position: 'relative', width: 84, height: 84, borderRadius: radius.control, overflow: 'hidden', border: `1px solid ${color.border}` }}>
                <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, galleryUrls: prev.galleryUrls.filter((_, j) => j !== i) }))}
                  aria-label={`Remove photo ${i + 1}`}
                  className={ui.focusable}
                  style={{ position: 'absolute', top: 4, right: 4, width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'rgba(23,32,28,0.7)', color: '#FFFFFF', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                ><X size={14} strokeWidth={2.5} aria-hidden /></button>
              </div>
            ))}
            <label className={ui.focusable} style={{ position: 'relative', width: 84, height: 84, borderRadius: radius.control, border: `1px dashed ${color.control}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: color.muted, cursor: 'pointer', textAlign: 'center' }}>
              {contentImgBusy === 'gallery' ? '…' : '+ Add'}
              <input type="file" accept="image/*" multiple onChange={handleGalleryAdd} disabled={contentImgBusy === 'gallery'} style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} />
            </label>
          </div>
        </Field>
      ),
    },
    {
      id: 'social', label: 'Social links', summary: [form.instagramUrl && 'Instagram', form.facebookUrl && 'Facebook', form.tiktokUrl && 'TikTok', form.youtubeUrl && 'YouTube'].filter(Boolean).join(', ') || 'None added',
      fields: (
        <>
          <p style={{ margin: 0, fontSize: 14, color: color.muted }}>Shown in the footer of your public pages. Leave any blank to hide it.</p>
          <div className={styles.formGrid} style={grid2}>
            <Field label="Instagram" htmlFor="s-ig"><Input id="s-ig" type="url" placeholder="https://instagram.com/yourstudio" value={form.instagramUrl} onChange={e => update('instagramUrl', e.target.value)} /></Field>
            <Field label="Facebook" htmlFor="s-fb"><Input id="s-fb" type="url" placeholder="https://facebook.com/yourstudio" value={form.facebookUrl} onChange={e => update('facebookUrl', e.target.value)} /></Field>
          </div>
          <div className={styles.formGrid} style={grid2}>
            <Field label="TikTok" htmlFor="s-tt"><Input id="s-tt" type="url" placeholder="https://tiktok.com/@yourstudio" value={form.tiktokUrl} onChange={e => update('tiktokUrl', e.target.value)} /></Field>
            <Field label="YouTube" htmlFor="s-yt"><Input id="s-yt" type="url" placeholder="https://youtube.com/@yourstudio" value={form.youtubeUrl} onChange={e => update('youtubeUrl', e.target.value)} /></Field>
          </div>
        </>
      ),
    },
  ]

  return (
    <div className={styles.shell}>
      <Sidebar active="settings" roles={roles} />

      <div className={styles.main}>
        {forbidden ? <Forbidden /> : (
          <div style={{ maxWidth: space.pageMaxWidth, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: space.cardGap }}>
            <PageHeader eyebrow="Settings" title={tab === 'studio' ? 'Studio settings' : 'Booking page'} />

            {/* A live-data problem worth fixing first: everything time-related uses this zone. */}
            {!savedForm.timezone && (
              <div role="alert" style={{
                display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, padding: '14px 18px',
                background: '#FBF4E6', border: '1px solid #EBD9B4', borderRadius: radius.card,
              }}>
                <TriangleAlert size={20} strokeWidth={2} color={color.warnInk} aria-hidden />
                <span style={{ flex: '1 1 280px', fontSize: 15, color: '#4A2E05' }}>
                  <strong style={{ fontWeight: 600 }}>Your studio has no time zone set.</strong> Class times, pass expiry and emails need one.
                </span>
                {zone && TIMEZONES.includes(zone) && (
                  <Button size="sm" onClick={() => saveSection('region', { timezone: zone })} disabled={sectionState.region?.busy}>Set to {zone}</Button>
                )}
              </div>
            )}

            <div role="tablist" aria-label="Settings" style={{ display: 'flex', flexWrap: 'wrap', gap: 4, borderBottom: `1px solid ${color.border}` }}>
              {tabs.map(([k, label]) => (
                <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={ui.focusable}
                  style={{
                    minHeight: space.target, padding: '0 12px', marginBottom: -1, border: 'none', background: 'transparent', cursor: 'pointer',
                    borderBottom: `2px solid ${tab === k ? color.primary : 'transparent'}`,
                    color: tab === k ? color.primaryInk : color.muted, fontFamily: 'inherit', fontSize: 15, fontWeight: 600,
                  }}>
                  {label}
                </button>
              ))}
            </div>

            {error && (
              <div role="alert" style={{ padding: '12px 16px', background: color.dangerBg, borderRadius: radius.control, color: color.dangerInk, fontSize: 15 }}>{error}</div>
            )}
            {encodingIssues.length > 0 && (
              <div role="alert" style={{ padding: '12px 16px', background: color.warnBg, borderRadius: radius.control, color: color.warnInk, fontSize: 14 }}>
                <strong>Possible encoding problem</strong> in {encodingIssues.join(', ')}: the text looks like it was pasted from a source
                where a character was already garbled. Retype the affected value before saving.
              </div>
            )}

            {tab === 'studio' ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: space.cardGap, alignItems: 'flex-start' }}>
                {/* Section index */}
                <nav aria-label="Settings sections" style={{ ...cardStyle, flex: '1 1 200px', maxWidth: 260, padding: 10, position: 'sticky', top: 24 }}>
                  {STUDIO_SECTIONS.map(sct => (
                    <a key={sct.id} href={`#${sct.id}`} className={`${ui.rowLink} ${ui.focusable}`}
                      style={{ display: 'flex', alignItems: 'center', minHeight: 40, padding: '0 12px', borderRadius: radius.control, fontSize: 15, fontWeight: 500, color: color.ink2, textDecoration: 'none', ['--hover-bg' as string]: color.bg }}>
                      {sct.label}
                    </a>
                  ))}
                </nav>

                <div style={{ flex: '999 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: space.cardGap }}>
                  {sectionCard('profile', 'Studio profile', 'Your name, contact details and the business address on receipts and invoices.', (
                    <>
                      <Field label="Studio name" htmlFor="f-name"><Input id="f-name" value={form.name} onChange={e => update('name', e.target.value)} /></Field>
                      <Field label="Description" htmlFor="f-desc" hint="Shown on your public booking page.">
                        <Textarea id="f-desc" value={form.description} onChange={e => update('description', e.target.value)} />
                      </Field>
                      <div className={styles.formGrid} style={grid2}>
                        <Field label="Contact email" htmlFor="f-email"><Input id="f-email" type="email" value={form.email} onChange={e => update('email', e.target.value)} /></Field>
                        <Field label="Phone" htmlFor="f-phone"><Input id="f-phone" value={form.phone} onChange={e => update('phone', e.target.value)} /></Field>
                      </div>
                      <div style={{ ...smallCapsStyle, marginTop: 4 }}>Business address</div>
                      <Field label="Address line 1" htmlFor="f-a1"><Input id="f-a1" value={form.addressLine1} onChange={e => update('addressLine1', e.target.value)} /></Field>
                      <Field label="Address line 2" htmlFor="f-a2"><Input id="f-a2" value={form.addressLine2} onChange={e => update('addressLine2', e.target.value)} /></Field>
                      <div className={styles.formGrid} style={{ gridTemplateColumns: '2fr 1fr 1fr', gap: space.formGap }}>
                        <Field label="City / suburb" htmlFor="f-city"><Input id="f-city" value={form.addressCity} onChange={e => update('addressCity', e.target.value)} /></Field>
                        <Field label="State" htmlFor="f-state"><Input id="f-state" value={form.addressState} onChange={e => update('addressState', e.target.value)} /></Field>
                        <Field label="Postcode" htmlFor="f-post"><Input id="f-post" value={form.addressPostcode} onChange={e => update('addressPostcode', e.target.value)} /></Field>
                      </div>
                    </>
                  ), 'profile')}

                  {sectionCard('region', 'Region & time zone', 'The time zone drives class times, pass expiry and the times in every email.', (
                    <>
                      <div className={styles.formGrid} style={grid2}>
                        <Field label="Time zone" htmlFor="f-tz" hint={zone ? `Your computer is on ${zone}.` : undefined}>
                          <Input id="f-tz" list="tz-options" placeholder="Start typing, e.g. Brisbane" value={form.timezone} onChange={e => update('timezone', e.target.value)} />
                          <datalist id="tz-options">{zones.map(z => <option key={z} value={z} />)}</datalist>
                        </Field>
                        <Field label="Locale" htmlFor="f-locale" hint="Controls date and number formatting on receipts and emails, e.g. en-AU.">
                          <Input id="f-locale" placeholder="en-AU" value={form.locale} onChange={e => update('locale', e.target.value)} />
                        </Field>
                      </div>
                      <div className={styles.formGrid} style={grid2}>
                        {[['Country', countryLabel(form.country), 'Set at sign-up. It drives tax rules and your Stripe payout account.'],
                          ['Currency', currency || '—', 'Set at sign-up. Every price and Stripe charge uses it.']].map(([label, value, hint]) => (
                          <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <span style={{ fontSize: 14, fontWeight: 600 }}>{label}</span>
                            <span style={{ ...controlStyle, display: 'inline-flex', alignItems: 'center', gap: 8, background: color.bg, color: color.ink2 }}>
                              <Lock size={16} strokeWidth={1.8} aria-hidden />{value}<span className={styles.srOnly}> (can't be changed)</span>
                            </span>
                            <span style={{ fontSize: 13, color: color.muted, lineHeight: 1.4 }}>{hint}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ), 'region')}

                  {sectionCard('policy', 'Booking policy', 'Studio-wide defaults. Individual sessions can override them.', (
                    <>
                      <div className={styles.formGrid} style={grid2}>
                        <Field label="Cancellation window (hours)" htmlFor="f-cancel" hint="Members can cancel free of charge up to this many hours before a class.">
                          <Input id="f-cancel" type="number" min="0" value={form.cancellationHours} onChange={e => update('cancellationHours', e.target.value)} />
                        </Field>
                        <Field label="Booking closes (hours before)" htmlFor="f-minadv" hint="Members can't book a class starting sooner than this.">
                          <Input id="f-minadv" type="number" min="0" value={form.minAdvanceBookingHours} onChange={e => update('minAdvanceBookingHours', e.target.value)} />
                        </Field>
                      </div>
                      <Field label="Book up to (days ahead)" htmlFor="f-window" hint="How far ahead members can book.">
                        <Input id="f-window" type="number" min="0" value={form.bookingWindowDays} onChange={e => update('bookingWindowDays', e.target.value)} style={{ maxWidth: 200 }} />
                      </Field>
                      <Toggle checked={form.lateCancelCreditsForfeited} onChange={v => update('lateCancelCreditsForfeited', v)}
                        label="Late cancellations forfeit the pass credit" />
                    </>
                  ), 'policy')}

                  {sectionCard('waiver', 'Liability waiver', "Your studio's own waiver. The platform Terms & Conditions are CalaStudio's and the same for every studio.", (
                    <>
                      <Toggle checked={form.liabilityWaiverRequired} onChange={v => update('liabilityWaiverRequired', v)}
                        label="Members must accept the waiver before their first booking" />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                          <label htmlFor="f-waiver" style={{ fontSize: 14, fontWeight: 600 }}>Waiver wording</label>
                          {waiverVersion != null && <Chip tone="primary">Version {waiverVersion} live</Chip>}
                        </div>
                        <Textarea id="f-waiver" value={waiverText} onChange={e => setWaiverText(e.target.value)} style={{ minHeight: 220, fontSize: 14, lineHeight: 1.6 }} />
                        <p style={{ margin: 0, fontSize: 13, color: color.warnInk, lineHeight: 1.4 }}>
                          Publishing new wording creates the next version, and every member is asked to accept it again before their next booking.
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 4 }}>
                          <Button onClick={handleSaveWaiver} disabled={savingWaiver || waiverText === initialWaiverText || !waiverText.trim()}>
                            {savingWaiver ? 'Publishing…' : `Publish version ${waiverVersion != null ? waiverVersion + 1 : 1}`}
                          </Button>
                          {waiverText !== initialWaiverText && !savingWaiver && (
                            <button type="button" onClick={() => { setWaiverText(initialWaiverText); setWaiverMsg(null) }} className={ui.focusable} style={{ ...smallLinkButton, color: color.muted }}>
                              Discard wording changes
                            </button>
                          )}
                          {waiverMsg && <span role={waiverMsg.ok ? 'status' : 'alert'} style={{ fontSize: 14, color: waiverMsg.ok ? color.primaryInk : color.dangerInk }}>{waiverMsg.text}</span>}
                        </div>
                      </div>
                    </>
                  ), 'waiver')}

                  {sectionCard('payments', 'Payments', 'Members pay for classes and passes through Stripe. Money goes straight to your bank account; CalaStudio takes no commission.', (
                    <>
                      {stripeBanner === 'success' && (
                        <div role="status" style={{ padding: '12px 16px', background: color.primarySoft, borderRadius: radius.control, color: color.primaryInk, fontSize: 15 }}>Stripe connected.</div>
                      )}
                      {stripeBanner === 'failure' && (
                        <div role="alert" style={{ padding: '12px 16px', background: color.dangerBg, borderRadius: radius.control, color: color.dangerInk, fontSize: 15 }}>Stripe connection failed or was cancelled. Please try again.</div>
                      )}
                      <div style={{ border: `1px solid ${color.border}`, borderRadius: radius.card, padding: 18, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                          <span aria-hidden style={{ width: 44, height: 44, background: '#635BFF', borderRadius: radius.control, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', fontWeight: 700, fontSize: 18, flex: 'none' }}>S</span>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 15 }}>Stripe</div>
                            {stripeOnboardingComplete ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                                <Chip tone="primary">Connected</Chip>
                                {stripeAccountId && <span style={{ fontSize: 14, color: color.muted, ...tabularNums }}>Account ending {stripeAccountId.slice(-4)}</span>}
                              </div>
                            ) : (
                              <div style={{ fontSize: 14, color: color.muted, marginTop: 2 }}>Not connected</div>
                            )}
                          </div>
                        </div>
                        {!stripeOnboardingComplete && (
                          <Button variant="primary" onClick={handleConnectStripe} disabled={connectingStripe}>{connectingStripe ? 'Connecting…' : 'Connect with Stripe'}</Button>
                        )}
                      </div>
                      {stripeError && <p role="alert" style={{ margin: 0, fontSize: 14, color: color.dangerInk }}>{stripeError}</p>}
                    </>
                  ))}

                  {sectionCard('tax', 'Tax (GST)', 'How tax is calculated and shown on bookings and receipts.', (
                    <>
                      <div>
                        <Toggle checked={form.taxEnabled} onChange={v => update('taxEnabled', v)} label="Charge tax on bookings" />
                        {taxRates.length === 0 && (
                          <p style={{ margin: '4px 0 0', fontSize: 13, color: color.dangerInk }}>Add a tax rate below before turning tax on.</p>
                        )}
                      </div>
                      <div className={styles.formGrid} style={grid2}>
                        <Field label="Tax name" htmlFor="f-taxlabel" hint='Shown on prices and receipts, e.g. "GST".'>
                          <Input id="f-taxlabel" placeholder="GST" value={form.taxLabel} onChange={e => update('taxLabel', e.target.value)} />
                        </Field>
                        <Field label="ABN / tax number" htmlFor="f-taxreg" hint="Shown on receipts.">
                          <Input id="f-taxreg" value={form.taxRegistrationNumber} onChange={e => update('taxRegistrationNumber', e.target.value)} />
                        </Field>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 600 }}>Rates</span>
                        {taxRates.length === 0 ? (
                          <p style={{ margin: 0, fontSize: 14, color: color.muted }}>No tax rates yet.</p>
                        ) : (
                          <div style={{ border: `1px solid ${color.border}`, borderRadius: radius.control, overflow: 'hidden' }}>
                            {taxRates.map((r, i) => (
                              <div key={r.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 12px', padding: '10px 14px', borderTop: i ? `1px solid ${color.divider}` : 'none', fontSize: 15 }}>
                                <strong style={{ fontWeight: 600, ...tabularNums }}>{r.rate}%</strong>
                                <span style={{ color: color.ink2, ...tabularNums }}>
                                  from {formatRateDate(r.effective_from)}{r.effective_until ? ` to ${formatRateDate(r.effective_until)}` : ''}
                                </span>
                                {r.id === currentRateId && <Chip tone="primary">Current</Chip>}
                                {r.notes && <span style={{ color: color.muted, fontSize: 14 }}>{r.notes}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                        <div><Button size="sm" onClick={openAddRate}>{taxRates.length ? 'Add a future rate' : 'Add a rate'}</Button></div>
                        <p style={{ margin: 0, fontSize: 13, color: color.muted }}>The rate in effect today applies automatically. A new rate closes the previous one the day before it starts.</p>
                      </div>
                    </>
                  ), 'tax')}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: space.cardGap }}>
                {sectionCard('branding', 'Branding', 'Your logo and brand colour appear across your public pages.', (
                  <>
                    <Field label="Logo">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                        {imageBox(form.logoUrl, 72, 72, 'Logo')}
                        {uploadLabel(form.logoUrl ? 'Replace logo' : 'Upload logo', uploadingLogo, handleLogoUpload)}
                        {form.logoUrl && removeButton(() => update('logoUrl', ''))}
                      </div>
                    </Field>
                    <Field label="Brand colour" htmlFor="f-brand" hint="The accent colour on your public pages.">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <input type="color" aria-label="Pick brand colour" value={form.brandColor} onChange={e => update('brandColor', e.target.value)}
                          style={{ width: 52, height: 44, border: `1px solid ${color.control}`, borderRadius: radius.control, padding: 3, cursor: 'pointer', background: color.surface }} />
                        <Input id="f-brand" value={form.brandColor} onChange={e => update('brandColor', e.target.value)} style={{ maxWidth: 140 }} />
                      </div>
                    </Field>
                  </>
                ), 'branding')}

                {sectionCard('theme', 'Page style', 'One layout, six styles. Your logo and brand colour carry across all of them.', (
                  <ThemePicker value={form.theme as ThemeKey} onChange={k => update('theme', k)} />
                ), 'theme')}

                {sectionCard('content', 'Page content', 'The words and photos on your public home page. Class times, prices and teacher bios come from your schedule and team.', (
                  <div style={{ border: `1px solid ${color.border}`, borderRadius: radius.control, overflow: 'hidden' }}>
                    {contentRows.map((row, i) => {
                      const open = openContentRow === row.id
                      return (
                        <div key={row.id} style={{ borderTop: i ? `1px solid ${color.divider}` : 'none' }}>
                          <button type="button" aria-expanded={open} onClick={() => setOpenContentRow(open ? null : row.id)}
                            className={`${ui.rowLink} ${ui.focusable}`}
                            style={{
                              width: '100%', display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, padding: '0 16px', border: 0, cursor: 'pointer',
                              background: 'transparent', fontFamily: 'inherit', textAlign: 'left', color: color.ink, ['--hover-bg' as string]: '#F7F8F5',
                            }}>
                            {open ? <ChevronDown size={18} aria-hidden /> : <ChevronRight size={18} aria-hidden />}
                            <span style={{ width: 130, flex: 'none', fontSize: 15, fontWeight: 600 }}>{row.label}</span>
                            <span style={{ flex: '1 1 auto', minWidth: 0, fontSize: 14, color: color.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.summary}</span>
                            <span style={{ fontSize: 14, fontWeight: 600, color: color.primary }}>{open ? 'Close' : 'Edit'}</span>
                          </button>
                          {open && (
                            <div style={{ padding: '4px 16px 18px 46px', display: 'flex', flexDirection: 'column', gap: space.formGap }}>{row.fields}</div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ), 'content')}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add tax rate dialog */}
      {showAddRate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(23, 32, 28, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 24 }}>
          <div role="dialog" aria-modal="true" aria-labelledby="rate-heading" style={{
            background: color.surface, borderRadius: radius.card, padding: 28, width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', fontFamily: font.body,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 id="rate-heading" style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>{taxRates.length ? 'Add a future rate' : 'Add a tax rate'}</h2>
              <button type="button" aria-label="Close" onClick={() => setShowAddRate(false)} className={ui.focusable} style={{ ...buttonStyle('secondary', 'sm'), width: 36, padding: 0 }}>
                <X size={16} strokeWidth={2} aria-hidden />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: space.formGap }}>
              <Field label="Rate (%)" htmlFor="r-rate">
                <Input id="r-rate" type="number" min="0" step="0.1" placeholder="10" value={addRateForm.rate} onChange={e => setAddRateForm(p => ({ ...p, rate: e.target.value }))} />
              </Field>
              <Field label="Starts" htmlFor="r-from" hint="Must be after the current rate's start date.">
                <Input id="r-from" type="date" value={addRateForm.effectiveFrom} onChange={e => setAddRateForm(p => ({ ...p, effectiveFrom: e.target.value }))} />
              </Field>
              <Field label="Notes (optional)" htmlFor="r-notes">
                <Input id="r-notes" placeholder="e.g. Rate change from 1 July" value={addRateForm.notes} onChange={e => setAddRateForm(p => ({ ...p, notes: e.target.value }))} />
              </Field>
              {rateError && (
                <div role="alert" style={{ padding: '12px 16px', background: color.dangerBg, borderRadius: radius.control, color: color.dangerInk, fontSize: 15 }}>{rateError}</div>
              )}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <Button onClick={() => setShowAddRate(false)} style={{ flex: 1 }}>Cancel</Button>
                <Button variant="primary" onClick={handleAddRate} disabled={addingRate} style={{ flex: 1 }}>{addingRate ? 'Adding…' : 'Add rate'}</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

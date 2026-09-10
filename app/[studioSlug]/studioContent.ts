// Marketing content for a studio's public site — the copy and photography the design needs that
// the schedule / teacher / pass data doesn't carry: hero, about, gallery, footer contact.
//
// The API carries it as a nested `page_content` object (snake_case) on the org, editable in
// dashboard settings. `getStudioContent` normalises that to the camelCase `StudioContent` the
// components use, falling back per-slug while a studio's `page_content` is still empty.
//
// The bundled photos under /public/studio/<slug>/ are a STOPGAP — production images come from
// Supabase Storage via the API. Remove them (and FALLBACK) once yoga-with-ravi's page_content
// is populated in Settings.

export interface GalleryImage {
  url: string
  alt: string
}

export interface StudioContent {
  /** Uppercase kicker over the hero headline. */
  tagline: string | null
  /** Hero H1. If `heroHeadlineEmphasis` occurs in it, that run renders bolder. */
  heroHeadline: string | null
  heroHeadlineEmphasis: string | null
  heroLead: string | null
  heroImageUrl: string | null
  /** Label for the hero's secondary button (links to the teacher page). */
  heroCtaLabel: string | null

  aboutHeading: string | null
  /** One entry per paragraph. */
  aboutBody: string[]
  aboutImageUrl: string | null
  aboutCtaLabel: string | null

  /** Home "Passes" block — the numbers come from pass-templates; this is just the framing copy. */
  passesHeading: string | null
  passesBlurb: string | null

  gallery: GalleryImage[]

  contactEmail: string | null
}

/** The `page_content` object as the API serves it (GET /api/public/{slug}) and accepts it
 *  (PATCH /api/organisations/{id} → `page_content`). All fields optional / nullable. */
export interface PageContentDto {
  tagline?: string | null
  hero_headline?: string | null
  hero_headline_emphasis?: string | null
  hero_lead?: string | null
  hero_image_url?: string | null
  hero_cta_label?: string | null
  about_heading?: string | null
  about_body?: string[] | null
  about_image_url?: string | null
  about_cta_label?: string | null
  passes_heading?: string | null
  passes_blurb?: string | null
  gallery?: GalleryImage[] | null
  contact_email?: string | null
}

const EMPTY: StudioContent = {
  tagline: null,
  heroHeadline: null,
  heroHeadlineEmphasis: null,
  heroLead: null,
  heroImageUrl: null,
  heroCtaLabel: null,
  aboutHeading: null,
  aboutBody: [],
  aboutImageUrl: null,
  aboutCtaLabel: null,
  passesHeading: null,
  passesBlurb: null,
  gallery: [],
  contactEmail: null,
}

// --- Per-slug fallback (remove once the API serves these fields) --------------------------------

const RAVI_PHOTO = (name: string) => `/studio/yoga-with-ravi/${name}`

const FALLBACK: Record<string, StudioContent> = {
  'yoga-with-ravi': {
    tagline: 'Mysore · Ashtanga · Vinyasa · Workshops',
    heroHeadline: 'Practise with Ravi',
    heroHeadlineEmphasis: 'Ravi',
    heroLead:
      'Ravi grew up in Mysore, where most of his own practice has been Ashtanga. These days he teaches vinyasa and workshop-style classes drawing on both the basic and advanced postures.',
    heroImageUrl: RAVI_PHOTO('ravi-adjust.jpg'),
    heroCtaLabel: 'About Ravi',
    aboutHeading: 'A workshop takes one posture apart',
    aboutBody: [
      'A bind, an inversion, a jump-through — with props, and time to try it. Vinyasa classes stay breath-led and open to anyone who has practised a little.',
      'Never practised? Come to a vinyasa class and say so at the door.',
    ],
    aboutImageUrl: RAVI_PHOTO('ravi-vishwamitrasana.jpg'),
    aboutCtaLabel: 'Read more',
    passesHeading: 'Passes, or pay as you go',
    passesBlurb:
      'Drop in for a single class, or buy a ten-class pass and use it whenever you book.',
    gallery: [
      { url: RAVI_PHOTO('photo-3.jpg'), alt: 'Ravi practising' },
      { url: RAVI_PHOTO('photo-4.jpg'), alt: 'Ravi practising' },
      { url: RAVI_PHOTO('photo-5.jpg'), alt: 'Ravi practising' },
      { url: RAVI_PHOTO('photo-6.webp'), alt: 'Ravi practising' },
      { url: RAVI_PHOTO('ravi-vishwamitrasana.jpg'), alt: 'Ravi in a supported side-angle posture' },
      { url: RAVI_PHOTO('ravi-adjust.jpg'), alt: 'Ravi adjusting a student in class' },
    ],
    contactEmail: 'hello@yogawithravi.com',
  },
}

/**
 * Normalise the API's `page_content` to `StudioContent`, layered over the per-slug fallback. A
 * string field the API returns as `null` *or* `""` counts as "not set" and falls through;
 * `about_body` / `gallery` fall through only when the API omits them (an explicit `[]` means the
 * studio cleared that list).
 */
export function getStudioContent(slug: string, pc?: PageContentDto | null): StudioContent {
  const base = FALLBACK[slug] ?? EMPTY
  if (!pc) return base
  const str = (v: string | null | undefined, fb: string | null) => (v && v.trim() ? v : fb)
  return {
    tagline: str(pc.tagline, base.tagline),
    heroHeadline: str(pc.hero_headline, base.heroHeadline),
    heroHeadlineEmphasis: str(pc.hero_headline_emphasis, base.heroHeadlineEmphasis),
    heroLead: str(pc.hero_lead, base.heroLead),
    heroImageUrl: str(pc.hero_image_url, base.heroImageUrl),
    heroCtaLabel: str(pc.hero_cta_label, base.heroCtaLabel),
    aboutHeading: str(pc.about_heading, base.aboutHeading),
    aboutBody: pc.about_body ?? base.aboutBody,
    aboutImageUrl: str(pc.about_image_url, base.aboutImageUrl),
    aboutCtaLabel: str(pc.about_cta_label, base.aboutCtaLabel),
    passesHeading: str(pc.passes_heading, base.passesHeading),
    passesBlurb: str(pc.passes_blurb, base.passesBlurb),
    gallery: pc.gallery ?? base.gallery,
    contactEmail: str(pc.contact_email, base.contactEmail),
  }
}

/** Split a headline into runs, marking the emphasis substring (first occurrence) bold. */
export function headlineRuns(
  headline: string,
  emphasis: string | null,
): { text: string; bold: boolean }[] {
  if (!emphasis) return [{ text: headline, bold: false }]
  const i = headline.indexOf(emphasis)
  if (i === -1) return [{ text: headline, bold: false }]
  return [
    { text: headline.slice(0, i), bold: false },
    { text: emphasis, bold: true },
    { text: headline.slice(i + emphasis.length), bold: false },
  ].filter((r) => r.text.length > 0)
}

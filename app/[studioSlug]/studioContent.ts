// Marketing content for a studio's public site — the copy and photography the Photo First design
// needs that the schedule/teacher/pass data doesn't carry: hero, about, gallery, footer contact.
//
// TARGET: these become fields on GET /api/public/{slug} (see HANDOFF-backend-contract.md), editable
// in dashboard settings. Until the API serves them, `getStudioContent` falls back to a per-slug
// map so yoga-with-ravi renders the final handoff copy. When the API returns a field, it wins.
//
// The bundled photos under /public/studio/<slug>/ are a STOPGAP for local rendering — production
// images come from Supabase Storage via the API, same as banner_url / photo_url elsewhere.

export interface GalleryImage {
  url: string
  alt: string
}

export interface StudioContent {
  /** Uppercase kicker over the hero headline. */
  tagline: string | null
  /** Hero H1. If `heroHeadlineEmphasis` occurs in it, that run renders at weight 700. */
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

export interface ApiStudioContent extends Partial<Omit<StudioContent, 'aboutBody' | 'gallery'>> {
  about_body?: string[] | null
  gallery?: GalleryImage[] | null
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

/** Merge API-provided content (when present) over the per-slug fallback. */
export function getStudioContent(slug: string, api?: ApiStudioContent | null): StudioContent {
  const base = FALLBACK[slug] ?? EMPTY
  if (!api) return base
  return {
    tagline: api.tagline ?? base.tagline,
    heroHeadline: api.heroHeadline ?? base.heroHeadline,
    heroHeadlineEmphasis: api.heroHeadlineEmphasis ?? base.heroHeadlineEmphasis,
    heroLead: api.heroLead ?? base.heroLead,
    heroImageUrl: api.heroImageUrl ?? base.heroImageUrl,
    heroCtaLabel: api.heroCtaLabel ?? base.heroCtaLabel,
    aboutHeading: api.aboutHeading ?? base.aboutHeading,
    aboutBody: api.about_body ?? base.aboutBody,
    aboutImageUrl: api.aboutImageUrl ?? base.aboutImageUrl,
    aboutCtaLabel: api.aboutCtaLabel ?? base.aboutCtaLabel,
    passesHeading: api.passesHeading ?? base.passesHeading,
    passesBlurb: api.passesBlurb ?? base.passesBlurb,
    gallery: api.gallery ?? base.gallery,
    contactEmail: api.contactEmail ?? base.contactEmail,
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

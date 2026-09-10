// Marketing content for a studio's public site — the copy and photography the design needs that
// the schedule / teacher / pass data doesn't carry: hero, about, gallery, footer contact.
//
// The API carries it as a nested `page_content` object (snake_case) on the org, editable in
// dashboard settings. `getStudioContent` normalises that to the camelCase `StudioContent` the
// components use; a studio with no `page_content` set just renders without those sections.

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

/** Normalise the API's snake_case `page_content` to the camelCase `StudioContent` the components
 *  use. A missing object, or a field that's `null`/`""`, just renders as "not set". */
export function getStudioContent(_slug: string, pc?: PageContentDto | null): StudioContent {
  if (!pc) return EMPTY
  const str = (v: string | null | undefined) => (v && v.trim() ? v : null)
  return {
    tagline: str(pc.tagline),
    heroHeadline: str(pc.hero_headline),
    heroHeadlineEmphasis: str(pc.hero_headline_emphasis),
    heroLead: str(pc.hero_lead),
    heroImageUrl: str(pc.hero_image_url),
    heroCtaLabel: str(pc.hero_cta_label),
    aboutHeading: str(pc.about_heading),
    aboutBody: pc.about_body ?? [],
    aboutImageUrl: str(pc.about_image_url),
    aboutCtaLabel: str(pc.about_cta_label),
    passesHeading: str(pc.passes_heading),
    passesBlurb: str(pc.passes_blurb),
    gallery: pc.gallery ?? [],
    contactEmail: str(pc.contact_email),
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

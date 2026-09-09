# Backend contract — Photo First public site

Frontend work for the Photo First design (design_handoff_studio_pages) is done against the
contract below. Until `CalaStudio.Api` implements it, the frontend falls back to a per-slug
content map (`app/[studioSlug]/studioContent.ts`) so `yoga-with-ravi` renders the final copy.
When the API returns a field, it wins over the fallback.

## 1. `theme` on the org

Add a `theme` column to the organisation record.

- Type: `varchar(20)`, nullable (null ⇒ default, which is currently `photo-first`).
- Values today: `photo-first`. The five-theme picker (`classic | night | clay | grid | poster`)
  is a later phase — reserve the column now.
- Expose on **`GET /api/public/{slug}`** as `theme`.
- Set during onboarding; editable in `app/dashboard/settings`. (Frontend for those screens is
  not built yet — phase 4.)

## 2. Marketing content fields on `GET /api/public/{slug}`

All optional / nullable. Names are camelCase in the JSON to match how the frontend reads them
(`app/[studioSlug]/studioContent.ts` → `ApiStudioContent`). Suggested storage: columns on the
org, or a `studio_page_content` 1:1 table.

| JSON field | Type | Notes / example |
| --- | --- | --- |
| `tagline` | string | Hero kicker. `"Mysore · Ashtanga · Vinyasa · Workshops"` |
| `heroHeadline` | string | Hero H1. `"Practise with Ravi"` |
| `heroHeadlineEmphasis` | string | Substring of `heroHeadline` rendered bold. `"Ravi"` |
| `heroLead` | string | 1 short paragraph under the H1 |
| `heroImageUrl` | string (URL) | Supabase Storage public URL, portrait orientation |
| `heroCtaLabel` | string | Secondary hero button label (links to the teacher page). `"About Ravi"` |
| `aboutHeading` | string | About section H2 |
| `about_body` | string[] | One entry per paragraph |
| `aboutImageUrl` | string (URL) | Square image |
| `aboutCtaLabel` | string | About section button label. `"Read more"` |
| `passesHeading` | string | Home "Passes" block heading. Falls back to `"Passes, or pay as you go"` |
| `passesBlurb` | string | One line under it |
| `gallery` | `{ url: string, alt: string }[]` | Square photos for the Home + Teacher galleries |
| `contactEmail` | string | Footer contact. `"hello@yogawithravi.com"` |

Prices, times, capacity, pass balances stay dynamic — they already come from
`/occurrences`, `/pass-templates`, `/booking-options`.

## 3. Dashboard settings UI (phase 4, not started)

`app/dashboard/settings` needs inputs for the fields above + a theme selector. Image fields
reuse the existing banner/logo upload-to-Supabase flow.

## Stopgap to remove once §2 ships

- `public/studio/yoga-with-ravi/*` — bundled design photos, ~1.9 MB. Delete when
  `heroImageUrl` / `aboutImageUrl` / `gallery` come from the API.
- The `FALLBACK` map in `app/[studioSlug]/studioContent.ts`.

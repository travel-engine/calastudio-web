# Backend contract — Photo First public site

Frontend work for the Photo First design (design_handoff_studio_pages) is done against the
contract below. Until `CalaStudio.Api` implements it, the frontend falls back to a per-slug
content map (`app/[studioSlug]/studioContent.ts`) so `yoga-with-ravi` renders the final copy.
When the API returns a field, it wins over the fallback.

## 1. `theme` on the org  — frontend DONE, needs the column + accept/persist

Add a `theme` column to the organisation record.

- Type: `varchar(20)`, nullable. `null` ⇒ frontend default (`photo-first`).
- Valid values: `classic | night | clay | grid | poster` (the picker) plus `photo-first`
  (Yoga with Ravi's private look — an alias of `night`, never shown in the picker).
- **Accept** it on:
  - `POST /api/organisations` — onboarding wizard sends `theme` in the create body (step 4).
  - `PATCH /api/organisations/{id}` — dashboard settings sends `theme` alongside `brand_color` etc.
- **Expose** it on `GET /api/public/{slug}` as `theme` (already consumed by
  `app/[studioSlug]/layout.tsx` → `resolveTheme`).
- Frontend picker UI: `app/components/ThemePicker.tsx`, wired into `app/onboarding/page.tsx`
  (step 4) and `app/dashboard/settings/page.tsx`. Until the API accepts the field the picker
  still works but the choice isn't saved — new studios all render the `photo-first` fallback.

The theme engine (`lib/studioTheme.ts` + `app/[studioSlug]/photofirst.module.css`) is complete —
adding the column is the only backend work for theming.

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

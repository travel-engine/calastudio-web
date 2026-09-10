# Backend contract — studio public site + theming

The frontend (theme engine, 6-theme picker, split/full-bleed layouts, the settings content
editor) is built against the contract below. Two columns/areas of backend work remain:

1. a `theme` value on the org
2. the public-page **content** fields

Until they land, the frontend falls back to a per-slug map (`app/[studioSlug]/studioContent.ts`)
so `yoga-with-ravi` still renders; every other studio shows an empty-but-valid home page.

---

## 1. `theme` on the org

- Column: `theme varchar(20)` nullable. `null` ⇒ frontend default (`photo-first`).
- Valid values: **`classic | night | clay | grid | poster | photo-first`** — all six are offered
  in the picker now. `photo-first` uses the Night palette with the full-bleed photo-hero layout;
  the other five use the split-hero layout.
- **Accept** on:
  - `POST /api/organisations` — onboarding step 4 sends `theme` in the create body.
  - `PATCH /api/organisations/{id}` — settings sends `theme` alongside `brand_color` etc.
- **Expose** on `GET /api/public/{slug}` as `theme` — consumed by `app/[studioSlug]/layout.tsx`
  and each page (`lib/resolveStudioTheme.ts`) to pick tokens *and* the hero/nav layout.

## 2. Public-page content

The studio edits these in **dashboard settings → "Public page content"**. They must round-trip:
`PATCH /api/organisations/{id}` accepts them, `GET /api/public/{slug}` returns them (same names).
All optional / nullable. Suggested storage: a `studio_page_content` 1:1 table.

| Field (JSON, both directions) | Type | Notes |
| --- | --- | --- |
| `tagline` | string | Kicker above the hero headline |
| `heroHeadline` | string | Hero H1. Falls back to `"Practise with {studio name}"` |
| `heroHeadlineEmphasis` | string | Substring of `heroHeadline` rendered bolder |
| `heroLead` | string | One paragraph under the H1 |
| `heroImageUrl` | string (URL) | Supabase Storage public URL; portrait |
| `heroCtaLabel` | string | Second hero button label (→ teacher page) |
| `aboutHeading` | string | About section heading |
| `about_body` | string[] | One entry per paragraph (settings sends the split array) |
| `aboutImageUrl` | string (URL) | Square image |
| `aboutCtaLabel` | string | About section button label |
| `passesHeading` | string | Home "Passes" block heading; falls back to `"Passes, or pay as you go"` |
| `passesBlurb` | string | One line under it |
| `gallery` | `{ url: string, alt: string }[]` | Square photos (settings sends `alt` = studio name) |
| `contactEmail` | string | Footer contact |

Image uploads already go to Supabase Storage client-side (`org-content/` prefix in the
`teacher-photos` bucket) — the API only needs to store the returned URLs.

Prices, times, capacity, pass balances, teacher bios stay dynamic — from `/occurrences`,
`/pass-templates`, `/booking-options`, `/teachers`.

## Stopgap to remove once §2 ships

- `public/studio/yoga-with-ravi/*` — bundled design photos (~1.9 MB).
- The `FALLBACK` map in `app/[studioSlug]/studioContent.ts`.

# Studio public site — theming & content wiring

Backend implemented `theme` + `page_content`. The frontend has been conformed to the **actual**
API shape (this doc previously guessed flat camelCase; the real shape is below).

## Shape (from the running API's swagger + `GET /api/public/yoga-with-ravi`)

`GET /api/public/{slug}` and `GET /api/organisations/mine` return, on the org:

```jsonc
{
  "theme": "classic",          // or null → frontend defaults to "photo-first"
  "page_content": {            // PageContentDto, or null
    "tagline": null,
    "hero_headline": null,
    "hero_headline_emphasis": null,
    "hero_lead": null,
    "hero_image_url": null,
    "hero_cta_label": null,
    "about_heading": null,
    "about_body": [],           // string[]
    "about_image_url": null,
    "about_cta_label": null,
    "passes_heading": null,
    "passes_blurb": null,
    "gallery": [],              // { url, alt }[]
    "contact_email": null
  }
}
```

- `POST /api/organisations` (`CreateOrganisationRequest`) accepts `theme`. ✓ onboarding sends it.
- `PATCH /api/organisations/{id}` (`UpdateOrganisationRequest`) accepts `theme` + `page_content`
  (nested). ✓ settings sends both.
- `theme` values: `classic | night | clay | grid | poster | photo-first`.

## Frontend status — done

- `lib/studioTheme.ts` / `lib/resolveStudioTheme.ts` — resolve `org.theme` (→ tokens + layout).
- `app/[studioSlug]/studioContent.ts` — `getStudioContent(slug, org.page_content)` normalises the
  snake_case DTO to the components' `StudioContent`; empty/`null` fields fall through to the
  per-slug fallback.
- `app/dashboard/settings` — "Public page content" section reads `org.page_content.*`, writes
  `page_content: { … }` in the PATCH.
- `app/onboarding` step 4 — theme picker, `theme` in the create body.

## To verify (needs a signed-in admin — I can't from here)

1. **`GET /api/organisations/mine` returns `theme` + `page_content`.** Settings pre-fills from it;
   if they're missing, the form loads blank and the next Save `PATCH`es them to `null`, wiping
   content. Quick check: open Settings, set theme + a few content fields, Save, reload — it should
   round-trip, and the public page should reflect it.

## Stopgap — remove after Ravi's content is entered

`yoga-with-ravi` currently has `theme: null`, `page_content: null`, so it still renders from the
fallback. Once its content is set in Settings and round-trips:
- delete the `FALLBACK` map in `app/[studioSlug]/studioContent.ts`
- delete `public/studio/yoga-with-ravi/` (~1.9 MB)

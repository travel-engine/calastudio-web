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

---

# Studio web address (slug)

Status as of 2026-10-17. **Open items are marked ⚠ — confirm on the backend.**

## How it works today

- The slug is **created by the backend** from the studio name when the studio is created
  (`POST /api/organisations`). Onboarding sends only `name`; the frontend never builds or sends a
  slug. Example: "Yoga with Ravi" → `yoga-with-ravi`.
- The frontend only ever **reads** `slug` (from `GET /api/organisations/mine` and
  `GET /api/public/{slug}`) and builds every public URL from it — `lib/seo.ts`
  (`studioOrigin`, `studioPath`, `studioUrl`):
  `https://{slug}.calastudio.app/…` in production, `/{slug}/…` locally.
- **Renaming the studio** (Settings → Studio profile → Studio name) sends only `name` in
  `PATCH /api/organisations/{id}`. There is no slug field anywhere in the dashboard. The new name
  shows everywhere the name is displayed; the address is not editable by the studio.
- Teacher landing pages use their own slug (`teacher_profile.slug`), also backend-generated:
  `{studio}.calastudio.app/teachers/{teacher-slug}`.

## Rules the backend must enforce

1. ⚠ **Stable after creation.** Renaming must NOT regenerate the slug. The address is printed in
   links, QR codes, search results and social bios; it must only change by a deliberate action.
2. **Shape:** lowercase `a–z`, `0–9`, single hyphens, no leading/trailing hyphen. Accents folded
   (é→e). ⚠ A name with no Latin letters (e.g. Japanese, Arabic) must still get a usable slug,
   never an empty one.
3. **Unique** across all studios — suffix `-2`, `-3`… when taken.
4. **Reserved words — must never be a studio slug.** These collide with the main site's own routes
   in `proxy.ts` (`APEX_ROUTES` / `SHARED`) or with hostnames, so a studio given one would be
   unreachable or would hijack an app page:
   `www`, `dashboard`, `onboarding`, `login`, `register`, `set-password`, `forgot-password`,
   `auth`, `help`, `api`.
   Also reserve, for planned or likely pages and hosts: `app`, `admin`, `mail`, `email`, `static`,
   `assets`, `cdn`, `status`, `blog`, `docs`, `support`, `billing`, `account`, `terms`, `privacy`,
   `legal`, `pricing`, `signup`, `about`, `contact`.
   **Frontend rule:** when a new top-level route is added under `app/`, add it to `APEX_ROUTES` in
   `proxy.ts` **and** ask the backend to add it to the reserved list.

## Not built yet — "Change web address"

If studios need to change their address: a separate admin-only endpoint (e.g.
`PATCH /api/organisations/{id}/slug` with `{ "slug": "new-name" }`) applying rules 2–4, which
**keeps the old slug as a permanent redirect** to the new one. The frontend would then add a
"Web address" field to Settings → Studio profile with a warning that old links redirect but
printed QR codes and bookmarks should be updated. Until then, changes go through CalaStudio
support.

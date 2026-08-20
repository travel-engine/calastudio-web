# calastudio-web — CLAUDE.md

## What this is
Frontend for CalaStudio, a multi-tenant SaaS booking platform for yoga/fitness studios. Studio admin/teacher dashboard + public booking pages + teacher landing pages.

## Stack
- **Framework:** Next.js 14, App Router.
- **Styling:** Tailwind CSS. **Components:** shadcn/ui.
- **Data fetching/mutations:** `@tanstack/react-query`.
- **Forms:** `react-hook-form` + `zod` for schema validation.
- **Dates:** `date-fns`. **Client state:** `zustand` (used for the booking flow).
- **Payments:** `@stripe/stripe-js` + `@stripe/react-stripe-js` (Stripe Elements — payment data never touches our backend).
- **Backend:** talks to the CalaStudio .NET API (separate repo, `CalaStudio.Api`), auth via Supabase Auth JWT.
- **Hosting:** Vercel.

## Rendering strategy
- **Server Components** for public, SEO-relevant pages: studio booking page, teacher directory, individual teacher landing pages.
- **Client Components** for anything interactive: booking modal, payment flow, real-time availability/capacity updates.
- Teacher pages use **ISR** (Incremental Static Regeneration) with a 60-second revalidation window — near-instant loads, schedule data still fresh.

## Route structure
```
app/
  [studioSlug]/
    page.tsx               — Studio public booking page
    teachers/
      page.tsx              — Studio teacher directory
      [teacherSlug]/
        page.tsx             — Individual teacher landing page (SSR/ISR)
  (dashboard)/               — Admin/teacher/front-desk authenticated app
    ...
```
Public pages live at `{slug}.calastudio.app/...`. Keep public (SEO, ISR, Server Components) and dashboard (authenticated, client-heavy) concerns cleanly separated — don't leak dashboard-only data fetching patterns into the public route tree.

## Roles this UI needs to respect
Six roles, and the dashboard must scope what it renders (not just what it fetches) accordingly: `admin`, `teacher_super`, `teacher_general`, `teacher_basic`, `front_desk`, `member`.
- `teacher_basic` should never render member contact info, pass balances, or financial data in any view — enforced on the backend too, but don't build UI that assumes data will be there and hide it with CSS; don't fetch it in the first place.
- `teacher_general` only ever sees rosters/members for their own sessions.
- Full matrix: project doc `17-teacher-portal.md` §17.3 — check before building any new role-gated screen.

## Domain concepts relevant to UI work
- **Pass** (credit-based, e.g. "10-class pass") vs **Membership** (period-based, e.g. "Monthly Unlimited"). Different mental models — don't conflate their forms/lists.
- Pass lifecycle states shown to admins/members: `active`, `low` (≤2 credits), `frozen`, `expired`, `exhausted`.
- Money is always displayed with the org's `currency` (char(3)) — never assume USD/$.
- Full schema/business rules: project docs `05-pricing.md`, `12-database-schema.md`.

## Conventions
- Validate all forms with `zod` schemas shared/mirrored against the API's request shape where practical.
- Use `react-query` mutations for writes with optimistic updates only where safe (never for payment or credit-affecting actions — wait for server confirmation there).
- New dashboard screens: check for an existing shadcn pattern in the repo before introducing a new component style. See `frontend-design` conventions for visual consistency (spacing, type scale, avoid default-template look).
- Booking flow state (multi-step) goes in the `zustand` store, not prop-drilled or duplicated in local state per step.

## Testing expectations
- Booking flow should be manually verified on iOS Safari and Android Chrome per project QA checklist.
- Teacher landing pages: verify both published and unpublished states render correctly.

## Before starting work
Check `C:\Dev\CalaStudio` project docs (numbered `NN-*.md` files, especially `04-booking-flow.md`, `09-website-embed.md`, `17-teacher-portal.md`) for the relevant spec before building — they're the source of truth for business rules and copy, not assumptions from existing code alone.

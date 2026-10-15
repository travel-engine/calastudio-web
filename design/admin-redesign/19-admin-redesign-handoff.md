# 19 — Admin Redesign Handoff (for Claude Code)

**Source design:** the "CalaStudio Admin Redesign" canvas on claude.ai (9 screens). The `.dc.html` files in `calastudio-admin-redesign.zip` are the same screens as reference markup. They use a design-tool template syntax (`{{ }}`, `<sc-for>`, `<sc-if>`), so **read them for layout, copy and styling — do not copy them into the app.**

**Goal:** restyle and restructure the existing `/dashboard/*` admin in the Next.js app to match the design. Keep every existing API call, field and behaviour unless this doc says otherwise. No backend changes are required for anything marked *UI only*.

---

## 1. How to work

1. Build the shared foundation first (§3 tokens, §4 components, new `Sidebar`). Ship it on its own.
2. Then migrate one page per PR in the order of §6. Each page keeps its data loading and save logic; only the markup and layout change.
3. The current code uses inline `style={{}}` objects (see `edit-teacher-page.tsx`). Stay consistent with whatever the codebase uses today. Put tokens in **one** module (e.g. `lib/ui/tokens.ts`) and reference them, instead of repeating hex values.
4. Items marked **Needs API** depend on data the frontend may not have yet. Check the existing endpoints first. If missing, build the UI with the field hidden behind a check and list the gap in the PR description. Don't invent endpoints.
5. All numbers in the design (bookings, revenue, attendance, check-in times, most roster names) are **sample data**. Never hard-code them.

---

## 2. Information architecture changes

| Change | Detail |
|---|---|
| **Remove "Bookings" from the sidebar** | Its job moves to Schedule → click a class → Roster page. Redirect `/dashboard/bookings` to `/dashboard/schedule`. |
| **Roster becomes a full page** | Replaces the "Manage" modal. Suggested route: `/dashboard/schedule/[occurrenceId]`. |
| **Session detail** | Same route as today (`/dashboard/sessions/[id]`), new two-column layout. |
| Sidebar groups | Studio: Dashboard, Schedule, Sessions, Members · Revenue: Passes, Reports · Settings: Team, Activity log, Settings · Sign out pinned to the bottom. |
| Icons | Replace emoji nav icons with 20px line icons (stroke 1.8, `currentColor`). Use one icon set throughout, e.g. `lucide-react`. |

---

## 3. Design tokens

**Colour**

| Token | Hex | Use |
|---|---|---|
| `primary` | `#085041` (existing brand green; the canvas used `#14513F`, keep the brand value) | Primary buttons, active states, bars |
| `primaryHover` | `#063D32` | Hover/pressed |
| `primarySoft` | `#E2EEE9` | Active nav item, "Attended"/"Active" chips |
| `primaryInk` | `#0C3A2D` | Text on `primarySoft` |
| `bg` | `#F3F4F1` | Page background |
| `surface` | `#FFFFFF` | Cards, sidebar |
| `border` | `#E1E3DE` | Card borders |
| `divider` | `#EDEEEA` | Row separators |
| `control` | `#CDD1CB` | Input and secondary-button borders |
| `track` | `#E7EAE5` | Empty part of progress bars |
| `ink` | `#17201C` | Primary text |
| `ink2` | `#3C4541` | Secondary text |
| `muted` | `#5A635F` | Hints, labels (4.5:1 on white — don't go lighter) |
| `warnBg` / `warnInk` | `#FBEFD9` / `#7A4508` | "No teacher", "Almost full", "Awaiting payment", waiver outdated |
| `dangerBg` / `dangerInk` | `#FBE4E1` / `#8F1F17` | "Full", waiver not signed, destructive buttons (text) |
| `infoBg` / `infoInk` | `#E4ECF8` / `#1D477F` | "Booked" status |
| `neutralChip` / `neutralInk` | `#EDEEEA` / `#3C4541` | Default chips, "Cancelled", "Late cancel" |
| `fullBar` / `lowBar` | `#B3261E` / `#C77A12` | Capacity bar ≥100% / ≥80% |

**Type**: body and UI in **Figtree** (400/500/600/700, via `next/font/google`). Page titles (H1 only) in **Instrument Serif** 400, 40–44px. Section headings 18px/600. Labels 14px/600. Small caps labels 13px/600, uppercase, 0.04em tracking, `muted`. Use `font-variant-numeric: tabular-nums` on every number, time and price.

**Shape & spacing**: controls radius 10px, cards radius 14px, chips fully rounded. Every clickable target ≥ 44px tall (small buttons 36px only inside dense tables). Page content `max-width: 1180px`, padding 28px 32px. Gaps of 20px between cards, 16px inside forms.

**Formats** (fixes the current "Sun 18-Oct-2026" / "7:00" style):
- Times always with am/pm: `7:00 am`
- Dates: `Sat 17 Oct`, add the year only when it isn't this year
- Relative where it helps: `Tomorrow, 7:00 am`
- Money: `A$6.00`
- Use `date-fns` with the studio's timezone (see Settings: the live studio has **no timezone set**).

---

## 4. Shared components to build

`PageHeader` (small-caps eyebrow + serif H1 + right-aligned actions) · `Card` · `Button` (primary / secondary / destructive-text / small) · `Chip` (tone: neutral, primary, warn, danger, info) · `StatTile` (label, big number, sub-line, optional bar, whole tile is a link) · `CapacityBar` (booked/capacity, colour switches at 80% and 100%) · `Field` (label, hint, control) · `Segmented` (real `<button aria-pressed>`) · `Toggle` (`<button role="switch" aria-checked>`; replace the current div-with-onClick) · `Breadcrumb` · `EmptyState` (icon, one sentence, one action) · `Sidebar` (groups as §2, `aria-current="page"`).

Accessibility rules that apply everywhere: real `<button>`/`<a>`/`<label>`, never clickable divs; `aria-label` on icon-only buttons; status is never colour-only (always a text chip).

---

## 5. Screens

Canvas board name → route.

### Dashboard → `/dashboard`
- Header: date eyebrow, "Good morning, {firstName}"; actions *Add booking*, *New session*.
- Four `StatTile`s, each a link: **Booked this week** (`X / Y spots` + bar; empty state text when 0, not just "0 / 146") → Schedule · **New members this week** → Members · **Next session** (`Tomorrow, 7:00 am` + session name) → its roster · **Birthdays, next 30 days** (empty state: "Birthdays show here once members add a date of birth").
- **Attention card** (amber): upcoming classes with no teacher, each with *Assign teacher*. *UI only* — derive from upcoming occurrences where instructor is null. Hide the card when there are none.
- **Next up** list: day + time, session name, venue · teacher, chip (No teacher / Almost full / Full), `CapacityBar`. Row → roster.
- **Recent activity**: icon (booked vs bought), "**{member}** booked/bought {item}", date. Link to Activity log.

### Schedule → `/dashboard/schedule`
- Week navigation (prev / This week / next) and a **Show cancelled (N)** checkbox (keep the existing filter).
- Left: one row per day. Past days dimmed; today tinted. Each occurrence is a link row: time, name, venue · teacher, chip, `CapacityBar`. Cancelled ones are struck through. Empty day: dashed "No classes · Add one".
- Right: month mini-calendar (keep existing), with a dot on days that have classes and a ring on today.
- This page **replaces Bookings**.

### Roster → `/dashboard/schedule/[occurrenceId]` (new page, replaces the Manage modal)
- Breadcrumb Schedule / {date}. Title = session name. Chips: status, date + time range, venue, teacher, mode.
- Actions: *Cancel class* (destructive, keep the existing confirm), *Export sign-in sheet*, *Add booking* (primary; same flow as today's "+ Add booking").
- Stat strip: Booked X/Y, Checked in, Guests, Waiver to sort.
- Table: member (avatar initials + name + person type, links to member) · pass/payment · guests (cancelled guest struck through) · status chip (Booked / Attended / Late cancel) · waiver chip (Up to date / Outdated · resend / Not signed · send) · **Check in** button that becomes a ✓ + time, and clicking it again undoes.
- **Needs API** if missing: check-in, per-booking waiver status, guests. Empty roster: `EmptyState` "No one's booked yet" + *Add booking*.

### Sessions → `/dashboard/sessions`
- Grouped by venue (card per venue, count in header). Optional venue filter (segmented) and text filter.
- Row (whole row links to detail): thumbnail (session photo or a placeholder icon) · name + "Sat · 7:00 am · 60 min · weekly" · teacher chip ("No teacher" in warn tone) · price · next class date + `CapacityBar`. Edit/Copy move into the detail page (*Duplicate*).

### Session detail → `/dashboard/sessions/[id]`
- Header card: photo, name, chips (visibility, "Every Sat · 7:00 am · 60 min", venue, teacher, drop-in price). Actions *View booking page*, *Duplicate*.
- Left column = **the existing form, split into cards** (same fields, same validation, one Save at the bottom next to *Delete session*):
  - Basics: name, description, type (segmented Class/Workshop), duration, teacher, photo.
  - Where: delivery (segmented), venue, capacity ("blank = unlimited"), address.
  - When: first class, repeats (One-off/Weekly), ends (Never / On a date / After N). One-line summary at the top: "Every Saturday at 7:00 am. Classes are created 60 days ahead automatically."
  - Price & who can book: drop-in price, tax override, visibility, booking access, accepted passes (checkbox list), "Also allow drop-in payment".
  - Booking rules: cancellation window, guests per booking, book-up-to, booking-closes. Placeholders say "Studio default".
- Right column: **Next class** card (date, `CapacityBar`, *Open roster*) · **Upcoming classes** (next 6 occurrences with booked count + Roster link, *Add a date*, "Show all", "Past classes (N)") · **Change history** (count + View). The occurrence list moves here from the bottom of the page.
- Wording changes: "Instructor" → "Teacher", "Minimum advance booking" → "Booking closes", "Booking window" → "Book up to".

### Member detail → `/dashboard/members/[id]`
- Header card: initials avatar (instead of grey circle), name, email, phone, chips (person type, joined, "Hasn't signed in yet" when applicable). Actions *Resend invite* (only when not signed in), *Edit*, *Book a class*.
- Two columns. Left: **Passes** (credits-left bar "7 of 10 credits left", expiry, status, Manage) · **Orders** table (date, item + type, amount, status chip). Rename status "Pending" → "Awaiting payment" (warn tone). Right: **Upcoming** bookings (date badge + name + time · venue, links to roster) · **Details** (DOB, emergency contact, address, joined via) · **Notes** (staff only).

### Passes → `/dashboard/passes`
- Tabs: **Pass types (N)** / **Issued to members (N)** (same data as today's two tabs).
- Pass types as cards: name, chips "10 credits" + "Expires 90 days after purchase", price, **per-class price** (price ÷ credits, *UI only*), Edit, Duplicate.
- Issued table: member, pass, credits-left bar, expires (warn colour when ≤7 days), status chip (Active / Expiring soon / Used up), View member.

### Reports → `/dashboard/reports`
- Date range as a segmented control + *Custom range* button; *Export CSV* in the header.
- Tabs keep the existing five; rename "Insights" → "Overview". Only Overview was redesigned. Apply the same card, tile and table styles to the other four.
- Overview: KPI strip (Revenue + drop-in/pass split · Booked spots + fill % · Attended + no-shows · New members · Active passes + credits not yet used) → **Booked spots by day** (single-series bar chart) + **How full classes are** heatmap (day × start time, one green scale, dashed cell = no class) → Class performance table (classes, avg booked/capacity, fill bar, attended, no-shows) → Pass types (sold all time / active now) + **Members to win back** (no booking in 30 days).
- **Empty state**: when there are no bookings in the range, replace all charts with one `EmptyState` ("No bookings in this range yet…" + *Try last 30 days* + *Copy booking page link*), instead of empty axes. The live account is in this state today.
- Exclude test pass templates such as "[JOB SMOKE TEST] Expiry Pass" from studio-facing reports, or flag them.

### Settings → `/dashboard/settings`
- Tabs renamed **Studio** / **Booking page**.
- Studio tab: section index card on the left (anchor links) + one card per section, **each with its own Save**: Studio profile (incl. business address) · Region & time zone · Booking policy · Liability waiver · Payments · Tax (GST).
  - **Timezone warning banner** at the top when timezone is not set, with "Set to {browser timezone}". The live studio currently has no timezone.
  - Timezone select: put the browser's zone first, make it searchable.
  - Country and currency read-only with a lock icon.
  - Waiver: "Version N live" chip; saving wording is a "Publish version N+1" action with the re-acceptance note; "See past versions".
  - Stripe: connected card showing only the account's last 4 characters, plus *Open Stripe dashboard*.
  - Tax: toggle, tax name, ABN, rate list with "Current" chip, *Add a future rate*.
  - All switches use `Toggle` (`role="switch"`).
- Booking page tab: Branding (logo, brand colour) · Page style (the six themes as clickable preview cards with "In use" chip) · Page content as a list of rows (Hero, Hero photo, About, Passes intro, Photo gallery, Social links), each with *Edit* opening that group's fields. Same fields as today.

Team and Activity log were not redesigned. Apply the shared components and tokens only.

---

## 6. Suggested order

1. Tokens, fonts, shared components, new `Sidebar` (no page changes yet)
2. Dashboard
3. Schedule + new Roster page; remove Bookings
4. Session detail, then Sessions list
5. Member detail
6. Passes
7. Settings (include the timezone banner early; it's a live data issue)
8. Reports, then restyle Team and Activity log

## 7. Done means

- Every screen matches the canvas at 1440px wide and stacks cleanly at 390px (sidebar wraps above content, wide tables scroll inside their card).
- No emoji in the UI. No hard-coded sample numbers.
- Keyboard: every action reachable by Tab, focus visible.
- Existing saves, uploads and API calls still work. Note any **Needs API** gaps in the PR.

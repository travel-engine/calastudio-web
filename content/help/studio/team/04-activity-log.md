---
title: Activity log
description: A full history of who changed what, and why
order: 4
---

# Activity log

Every change made in your studio — creating a session, adjusting a member's pass credits, cancelling an occurrence — is recorded automatically. **Activity log** in the sidebar is where you review that history. It's visible to **Admin** only.

## Reading an entry

Each row shows when something happened, who did it (and their role at the time), what kind of change it was, and what it affected:

| Action | Meaning |
|---|---|
| **Created** | A new record was made — a session, a pass template, a member pass |
| **Updated** | An existing record changed |
| **Deleted** | Something was deactivated (sessions and pass templates are never hard-deleted, just turned off) |
| **Override** | A manual exception, like a credit adjustment, an expiry extension, or manually refunding a forfeited credit on a late-cancelled booking — these always carry a reason |
| **System** | An automated change with no human actor |

Click **Details** on any row that has them to see exactly what changed — a table of each field with its value **Before** and **After** — and, for overrides, the reason given. Times are shown in your studio's time zone.

## Filtering

Use **Everyone** to narrow the log to one person, **All types** to one kind of record (sessions, bookings, member passes, payments, and so on), and the two date pickers to bound it to a range. Filters combine — set them together to find, say, every pass change one person made last week. **Clear filters** resets them all.

The log shows the latest 50 entries first; **Load more** at the bottom fetches older ones.

## Why this exists

Anything that touches money or a member's history — credit adjustments, expiry overrides, cancellations — needs a reason and gets logged, so if a member disputes a charge or a credit balance, you have a record of exactly what happened and who authorized it. The log itself can't be edited or deleted, including by Admin — it's an append-only record.

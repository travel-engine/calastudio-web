---
title: Managing bookings
description: Adding occurrences and running the roster for a session
order: 5
---

# Managing bookings

A session defines what a class *is* — name, price, capacity, whether it repeats. An **occurrence** is one specific bookable date and time of that session. Members book occurrences, not sessions, so a session needs at least one occurrence before anyone can book into it.

## Adding an occurrence

1. Go to **Sessions** and open the session
2. Scroll to **Occurrences**
3. Click **+ Add occurrence**
4. Set the date, start time, and end time
5. Click **Add occurrence**

Capacity and price default to the session's settings — there's no need to re-enter them unless you want to override that occurrence specifically.

For a recurring session, you still add each date as its own occurrence — see **Recurring sessions** for why marking a session recurring doesn't generate these automatically yet.

## The Bookings dashboard

Go to **Bookings** in the sidebar for an org-wide view of every upcoming occurrence across all your sessions, soonest first. Click **Manage** on any row to open its roster.

## Booking a member manually

From an occurrence's roster:

1. Click **+ Add booking**
2. Search for the member by name or email
3. For a hybrid session, choose whether they're attending in-person or online
4. Choose how they're paying:
   - **Use a pass** — pick from the member's usable passes; a credit is debited immediately
   - **Comp (no charge)** — no payment, no credit used
5. Click **Confirm booking**

Card and membership payment aren't available for manual bookings yet — only an existing pass or a comp. If the session is set to **Free**, no payment step is shown at all. **Restricted** sessions (specific passes/memberships only) can't be manually booked yet either.

## Running the roster

Each confirmed booking has three actions:

| Action | What it does |
|---|---|
| **Attended** | Marks the member as having shown up |
| **No-show** | Marks them absent. Unlike a cancellation, no credit is returned |
| **Cancel** | Cancels the booking. Pass credits are returned automatically if the studio's cancellation policy allows it |

## Cancelling a whole occurrence

Click **Cancel occurrence** to cancel the class itself — for example if you need to close the studio for the day. Every confirmed booking on it is cancelled and any pass credits used are returned in full, regardless of your normal cancellation window.

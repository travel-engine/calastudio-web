---
title: Managing bookings
description: Adding occurrences and running the roster for a session
order: 5
---

# Managing bookings

A session defines what a class *is* — name, price, capacity, whether it repeats. An **occurrence** is one specific bookable date and time of that session. Members book occurrences, not sessions, so a session needs at least one occurrence before anyone can book into it. These are generated from the session's schedule the moment you save it, and a nightly job keeps the window extended going forward — see **Recurring sessions** for exactly how — so most of the time you won't need to add one by hand.

## Adding an occurrence manually

Useful for a one-off extra date outside the session's usual pattern, or to re-add a date that was previously cancelled:

1. Go to **Sessions** and open the session
2. Scroll to **Occurrences**
3. Click **+ Add occurrence**
4. Set the date, start time, and end time
5. Click **Add occurrence**

Capacity and price default to the session's settings — there's no need to re-enter them unless you want to override that occurrence specifically.

## Getting to an occurrence

**Dashboard**'s "Next up" list and **Schedule**'s week view both link directly to an occurrence — click any class and you're taken to its own page rather than a list. **Bookings** in the sidebar still shows a flat list of every upcoming occurrence with a **Manage** button per row, if you'd rather search or scroll through everything at once.

Admin, Super teacher, and Front desk see every occurrence in the studio; Teacher and Basic teacher only see occurrences for sessions they're the instructor on.

## The occurrence page

At the top: the session name, date and time, and its status (Scheduled/Cancelled/Completed), followed by who's teaching it. Below that, up to three buttons depending on your role:

| Button | What it does | Who can do it |
|---|---|---|
| **+ Add booking** / **+ Add student** | Puts a member on the roster — see below | Everyone who can see the roster |
| **Edit** | Change the date, start/end time, capacity, or teacher for this occurrence only | Admin, Super teacher only |
| **Cancel occurrence** | Cancels the whole class — see below | Admin, Super teacher only |

**Edit** only affects this one occurrence, not the session template or any other date generated from it. Reassigning the teacher here overrides the session's own instructor for this date only; leave it as **Unassigned** to fall back to whoever the session is normally taught by.

What the roster shows also depends on role — see **Team → Teacher roles** for the full breakdown. Admin, Super teacher, and Teacher see full member detail (name, email, payment method); Basic teacher and Front desk see names only, with no contact or financial information.

## Booking a member manually (Admin, Super teacher)

1. Click **+ Add booking**
2. Search for the member by name or email
3. For a hybrid session, choose whether they're attending in-person or online
4. Choose how they're paying:
   - **Use a pass** — pick from the member's usable passes; a credit is debited immediately
   - **Comp (no charge)** — no payment, no credit used
5. Click **Confirm booking**

Card and membership payment aren't available for manual bookings yet — only an existing pass or a comp. If the session is set to **Free**, no payment step is shown at all. **Restricted** sessions (specific passes/memberships only) can't be manually booked yet either.

## Adding a student without payment (Teacher, Basic teacher)

Teacher and Basic teacher can't process a paid booking, but can still put a student on their own roster at no charge:

1. Open one of your own occurrences and click **+ Add student**
2. Search for the member by name — Basic teacher's search doesn't show email, matching what the roster itself shows
3. For a hybrid session, choose in-person or online
4. Click **Add student**

This always creates a free spot — no pass credit is used and no payment is recorded, regardless of the session's price. It's meant for filling a class, not for anything that should show up in revenue reporting.

## The roster's three tabs

**Booked**, **On waitlist**, and **Cancelled** — each labelled with a count, and **Booked** also shows occupancy against capacity (e.g. `5/12`).

### Booked

Each row supports up to three actions, depending on your role:

| Action | What it does | Who can do it |
|---|---|---|
| **Attended** checkbox | Marks the member as having shown up. Tick it again to undo an accidental tap | Everyone who can see the roster |
| **No-show** | Marks them absent. Unlike a cancellation, no credit is returned | Everyone except Front desk |
| **Cancel** | Cancels the booking. Pass credits are returned automatically if the studio's cancellation policy allows it | Admin, Super teacher only |

If someone brought guests, they're listed underneath the member's own row — see **Members → Guest bookings** for how those work and how to cancel just one guest's spot.

### On waitlist

Shown once a class is full and members start joining the queue from the booking page. Each row shows the member's name (plus email for Admin, Super teacher, and Teacher — matching the same contact-info visibility as the Booked tab), which mode they're waiting for, their position in line, and how many spots they need if they're waiting as a group.

There's no manual action here — joining and leaving the waitlist is self-service from the member's own account, and promotion runs automatically when a spot frees up: one member at a time with a time-limited hold if it's well before the class, or a simultaneous first-come blast to everyone waiting if it's close to start time. A promoted member's row shows **Spot held** with the time their hold expires; if they don't claim it in time, the next person in line is offered it automatically. Right at the start of class there's a short window where a freed spot isn't offered to anyone — it's released as a walk-in instead.

### Cancelled

Every cancelled or late-cancelled booking shows a short history: when it was cancelled and by whom, and — only if one happened — when a credit was refunded and by whom. A late-cancelled pass booking that forfeited its credit gets a **Refund credit** button (Admin, Super teacher only) to manually return it anyway; see **Payments → Refunds**.

## Cancelling a whole occurrence (Admin, Super teacher)

Click **Cancel occurrence** to cancel the class itself — for example if you need to close the studio for the day. Every confirmed booking on it is cancelled and any pass credits used are returned in full, regardless of your normal cancellation window.

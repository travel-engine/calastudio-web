---
title: Managing bookings
description: Adding class dates and running the roster for a class
order: 5
---

# Managing bookings

A session defines what a class *is* — name, price, capacity, whether it repeats. An **occurrence** (a "class" on screen) is one specific bookable date and time of that session. Members book classes, not sessions, so a session needs at least one upcoming class before anyone can book into it. These are generated from the session's schedule the moment you save it, and a nightly job keeps the window extended going forward — see **Recurring sessions** for exactly how — so most of the time you won't need to add one by hand.

## Adding a date manually

Useful for a one-off extra date outside the session's usual pattern, or to re-add a date that was previously cancelled:

1. Go to **Sessions** and open the session
2. Under **Upcoming classes**, click **+ Add a date**
3. Set the date, start time, and end time
4. Click **Add occurrence**

Capacity and price default to the session's settings — there's no need to re-enter them unless you want to override that date specifically.

## Getting to a class's roster

Every class has its own roster page. You can reach it from:

- **Schedule** — click any class in the week view
- **Dashboard** — the **Next up** list
- **Sessions** — open a session, then **Open roster** on its next class or any row under **Upcoming classes**

Admin, Super teacher, and Front desk see every class in the studio; Teacher and Basic teacher only see classes for sessions they're the instructor on.

## The roster page

At the top: the session name, then chips for the status (Scheduled/Cancelled/Completed), date and time, venue, teacher (or **No teacher assigned**), and in person/online. Next to that, depending on your role:

| Button | What it does | Who can do it |
|---|---|---|
| **+ Add booking** | Puts a member on the roster — see below | Everyone who can add to the roster |
| **Export sign-in sheet** | Downloads the roster as a CSV to print or keep (shown once someone is booked) | Everyone who can see the roster |
| **Edit class** | Change the date, start/end time, capacity, or teacher for this class only | Admin, Super teacher, and Teacher (their own classes) |
| **Cancel class** | Cancels the whole class — see below | Admin, Super teacher, and Teacher (their own classes) |

**Edit class** only affects this one date, not the session or any other date generated from it. The **Teacher** list has three kinds of choice:

- **Same as session (…)**: whoever teaches the session, now or later. If the session's teacher changes, this date follows. This is the default.
- **A named teacher**: that teacher for this date only, for example a substitute. Changing the session's teacher later doesn't touch it.
- **No teacher**: nobody is shown as teaching this date, even though the session has a teacher. The session's own teacher can still open this date and its roster, so they can help arrange cover. They see it labelled **No teacher assigned**, with a note that they're not down to teach it. To take a teacher off the session completely, change the teacher on the session instead.

Under the header, a summary strip shows **Booked** (against capacity, e.g. `5 / 12`), **Checked in**, **Guests**, **On waitlist**, and — when your studio requires a waiver — **Waiver to sort**, the number of booked members who haven't signed the current waiver.

What the roster shows also depends on role — see **Team → Teacher roles** for the full breakdown. Admin, Super teacher, and Teacher see full member detail (name, email, payment); Basic teacher and Front desk see names only, with no contact or financial information.

## Booking a member manually (Admin, Super teacher)

1. Click **+ Add booking**
2. Search for the member by name or email. Not a member yet? Click **+ Add a new member** to create them on the spot
3. Under **Payment**, choose:
   - **A pass** — pick from the member's passes that are valid for this class; a credit is debited immediately
   - **Comp (no charge)** — no payment, no credit used. Add a short reason (e.g. "makeup class") — it's recorded with the booking
4. Click **Confirm booking**

If the class is **Free**, no payment step is shown at all. If the session is **Restricted** to certain passes, you'll see a note — bookings you add here skip that list, so you can still put anyone on the roster. Card payment isn't offered for bookings you add yourself; members pay by card when they book from your booking page.

## Adding a student without payment (Teacher, Basic teacher)

Teacher and Basic teacher can't take payment, but can still put a student on their own roster at no charge:

1. Open one of your own classes and click **+ Add booking**
2. Search for the member by name — Basic teacher's search doesn't show email, matching what the roster itself shows
3. Click **Add student**

This always creates a free spot — no pass credit is used and no payment is recorded, regardless of the session's price. It's meant for filling a class, not for anything that should show up in revenue reporting.

## The roster's three tabs

**Booked**, **Waitlist**, and **Cancelled** — each labelled with a count; **Booked** also shows occupancy against capacity (e.g. `5/12`).

### Booked

Each row shows the member, how they paid (pass, card, comp, or free), any guests, their status, and — when your studio requires one — their waiver status (**Up to date**, **Outdated** if they signed an older version, or **Not signed**).

| Action | What it does | Who can do it |
|---|---|---|
| **Check in** | Marks the member as having shown up. The button turns into the time they were checked in — click that to undo an accidental tap | Everyone who can see the roster |
| **Cancel** | Cancels the booking. Pass credits are returned automatically if the studio's cancellation policy allows it | Admin, Super teacher only |
| **Refund** | For card bookings: refund some or all of what they paid | Admin, Super teacher only |

If someone brought guests, they're listed in the **Guests** column of the member's row, each with its own **Cancel** — see **Members → Guest bookings** for how those work.

### Waitlist

Shown once a class is full and members start joining the queue from the booking page. Each row shows the member's name (plus email for Admin, Super teacher, and Teacher), whether they want to attend in person or online, how many guests they'd bring, their place in line, and their status.

There's no manual action here — joining and leaving the waitlist is self-service from the member's own account, and promotion runs automatically when a spot frees up: one member at a time with a time-limited hold if it's well before the class, or a simultaneous first-come blast to everyone waiting if it's close to start time. A promoted member shows **Spot held** with the time their hold expires; if they don't claim it in time, the next person in line is offered it automatically. Right at the start of class there's a short window where a freed spot isn't offered to anyone — it's released as a walk-in instead.

### Cancelled

Every cancelled or late-cancelled booking shows what happened: when it was cancelled and by whom, and — only if one happened — when a credit was refunded and by whom. A late-cancelled pass booking that forfeited its credit gets a **Refund credit** button (Admin, Super teacher only) to return it anyway, and a cancelled card booking gets **Refund**; see **Payments → Refunds**.

## Cancelling a whole class

Click **Cancel class** to cancel the class itself — for example if you need to close the studio for the day. You can add an optional reason (e.g. "teacher unwell"), and choose whether to keep the class on your public schedule marked as cancelled, or remove it entirely. Every confirmed booking on it is cancelled and any pass credits used are returned in full, regardless of your normal cancellation window.

## Activity

At the bottom of the roster page, **Activity** lists the changes made to this class — edits, cancellation, and who made them. The full studio-wide history is in **Activity log** (Admin only).

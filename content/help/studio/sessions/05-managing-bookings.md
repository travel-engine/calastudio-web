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

Go to **Bookings** in the sidebar for a view of upcoming occurrences, soonest first. Admin, Super teacher, and Front desk see every occurrence in the studio; Teacher and Basic teacher only see occurrences for sessions they're the instructor on. Click **Manage** on any row to open its roster.

What the roster itself shows also depends on role — see **Team → Teacher roles** for the full breakdown. Admin, Super teacher, and Teacher see full member detail (name, email, payment method); Basic teacher and Front desk see names only, with no contact or financial information.

## Booking a member manually (Admin, Super teacher)

From an occurrence's roster:

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

1. Open the roster for one of your own occurrences and click **+ Add student**
2. Search for the member by name — Basic teacher's search doesn't show email, matching what the roster itself shows
3. For a hybrid session, choose in-person or online
4. Click **Add student**

This always creates a free spot — no pass credit is used and no payment is recorded, regardless of the session's price. It's meant for filling a class, not for anything that should show up in revenue reporting.

## Running the roster

Each confirmed booking supports up to three actions, depending on your role:

| Action | What it does | Who can do it |
|---|---|---|
| **Attended** | Marks the member as having shown up | Everyone who can see the roster |
| **No-show** | Marks them absent. Unlike a cancellation, no credit is returned | Everyone except Front desk |
| **Cancel** | Cancels the booking. Pass credits are returned automatically if the studio's cancellation policy allows it | Admin, Super teacher only |

## Cancelling a whole occurrence (Admin, Super teacher)

Click **Cancel occurrence** to cancel the class itself — for example if you need to close the studio for the day. Every confirmed booking on it is cancelled and any pass credits used are returned in full, regardless of your normal cancellation window.

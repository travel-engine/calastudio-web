---
title: Recurring sessions
description: How to set up a session that repeats weekly
order: 3
---

# Recurring sessions

Instead of creating the same class over and over, mark it **Weekly** and it repeats on the same weekday as its first occurrence. Occurrences — the actual bookable dates — are generated from that pattern automatically.

## Setting up recurrence

1. On the session form, set **First occurrence** — the date and time of the very first class. This is the anchor every future date is generated from, so get it right.
2. Under **Schedule**, choose **Weekly**
3. Optionally set when it **Ends** — never (the default), on a specific date, or after a set number of classes
4. Save the session

The session repeats every week on the same weekday as **First occurrence** — pick that date on the weekday you want. Recurrence is weekly only; there's no support yet for multiple days a week, skipping weeks, or running every other week.

## How occurrences actually get created

When you save the session, its occurrences are generated straight away — every date up to 60 days ahead, starting from **First occurrence** and stopping at whichever comes first: your **Ends** setting or the 60-day horizon. A nightly job at 2am, your studio's local time, then keeps that window rolling forward for every active session. Generation only ever adds — it never removes or edits a date you've already touched.

Two practical consequences:

- A session is bookable as soon as it's saved — no waiting for an overnight run. You'll see the created dates listed on the session's **Occurrences** section immediately.
- Because generation only looks 60 days out, a recurring session with no end date always has a rolling window of dates rather than every date that will ever exist — there's no need to set an end date just to "give it enough room."

## One-off sessions

For a single event — a workshop, a special class, a one-time event — leave recurrence set to **One-off**. **First occurrence** is the only date it needs, and that single occurrence is created for you as soon as you save.

## Editing a recurring session

Changes you make to the session itself — price, capacity, description, and so on — are defaults for every occurrence generated afterward. Occurrences already created keep their own settings; edit or cancel those individually from **Bookings** or the session's **Occurrences** section.

## Copying instead of recurring

If you want a similar session on a different, irregular schedule (not weekly), it's usually easier to create it as one-off and use **Copy** from the sessions list to quickly duplicate the details for the next date, rather than forcing it into a weekly recurrence.

---
title: Recurring sessions
description: How to set up a session that repeats weekly
order: 3
---

# Recurring sessions

Instead of creating the same class over and over, mark it as repeating on a weekly schedule. Occurrences — the actual bookable dates — are generated from that pattern automatically.

## Setting up recurrence

1. On the session form, set **First occurrence** — the date and time of the very first class. This is the anchor every future date is generated from, so get it right.
2. Under **Schedule**, choose **Recurring**
3. Select which day(s) of the week it runs — for example, Monday, Wednesday, and Friday for a class that meets three times a week
4. Optionally set when it **Ends** — never (the default), on a specific date, or after a set number of classes
5. Save the session

Currently, recurrence is weekly only — every selected day, every week. There's no support yet for skipping weeks or running every other week.

## How occurrences actually get created

A nightly job runs at 2am and generates every occurrence up to 90 days ahead for every active recurring session, starting from **First occurrence** and stopping at whichever comes first: your **Ends** setting or the 90-day horizon. It only ever adds — it never removes or edits a date you've already touched.

Two practical consequences:

- A session created today won't have any occurrences until tonight's run. If you need it bookable right away, add the first occurrence manually from the session's **Occurrences** section.
- Because it only looks 90 days out, a recurring session with no end date always has a rolling window of dates rather than every date that will ever exist — there's no need to set an end date just to "give it enough room."

## One-off sessions

For a single event — a workshop, a special class, a one-time event — leave recurrence set to **One-off**. **First occurrence** is the only date it needs; the same nightly job creates that single occurrence for you.

## Editing a recurring session

Changes you make to the session itself — price, capacity, description, and so on — are defaults for every occurrence generated afterward. Occurrences already created keep their own settings; edit or cancel those individually from **Bookings** or the session's **Occurrences** section.

## Copying instead of recurring

If you want a similar session on a different, irregular schedule (not weekly), it's usually easier to create it as one-off and use **Copy** from the sessions list to quickly duplicate the details for the next date, rather than forcing it into a weekly recurrence.

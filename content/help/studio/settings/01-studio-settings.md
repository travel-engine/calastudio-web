---
title: Studio settings
description: Your studio's profile, time zone, booking rules, waiver, payments and tax
order: 1
---

# Studio settings

**Settings** in the sidebar has three tabs: **Studio**, covered here, **Booking page** — see **Booking page settings** — and **Plan & billing**, see **Plan & billing**. Only **Admin** can open Settings.

The Studio tab is a set of cards with a list of them on the left — click a name to jump to it. **Each card saves on its own**: its **Save** button lights up once you change something in that card, and **Discard** puts it back. Saving one card never saves half-finished edits in another.

## Studio profile

Your studio name, a description (shown on your booking page), contact email and phone, and your **business address**, which appears on receipts.

## Region & time zone

**Time zone** is the most important setting in your studio. Class times, pass expiry and the times in every email all use it. Start typing a city (e.g. "Brisbane") and pick from the list — your computer's own zone is suggested first.

If your studio has no time zone, a yellow banner appears at the top of Settings with a one-click **Set to …** button for your computer's zone.

**Locale** controls how dates and numbers are formatted on receipts and emails (e.g. `en-AU`).

**Country** and **Currency** are shown with a lock — they're set when you sign up, because tax rules, prices and your Stripe payout account all depend on them. Contact CalaStudio support if one is wrong.

## Booking policy

Studio-wide defaults that every session uses unless it sets its own:

- **Cancellation window (hours)** — members can cancel free of charge up to this many hours before a class
- **Booking closes (hours before)** — members can't book a class starting sooner than this
- **Book up to (days ahead)** — how far ahead members can book
- **Late cancellations forfeit the pass credit** — whether a member who cancels after the window has closed loses the credit

See **Sessions → Cancellation policy** for how these combine with a session's own settings.

## Emails to you

CalaStudio emails your studio's **contact email** (set under **Studio profile**) when a member does something. Each email has its own switch, and all of them start switched on:

- **A new member signs up:** someone creates an account on your booking page
- **A pass or membership is bought:** a member buys one online
- **A member books a class:** with a pass, by card or for free
- **A booking or membership is cancelled:** a member cancels a booking or their membership

These are only sent for things members do themselves. When you add a member, make a booking or cancel a class, you won't get an email. You'll always get an email when a membership ends because its payments failed, even with the switch off. If you have no contact email, none of these are sent.

Getting too many? Turn off new sign-ups and purchases first. Both also appear in the activity feed on your dashboard. Cancellations are also safe to turn off: when a spot opens up, the next person on the waitlist is offered it automatically.

Click **Save** on the card after changing a switch.

## Liability waiver

Your studio's own waiver, separate from CalaStudio's platform terms.

- **Members must accept the waiver before their first booking** — turn this off if you don't use a waiver. Saved with the card's **Save** button.
- **Waiver wording** — the text members agree to. The tag above it shows which version is live (e.g. **Version 2 live**).

Changing the wording is a deliberate step: edit the text, then click **Publish version N**. Publishing creates a new version, and **every member is asked to accept it again before their next booking**. Until they do, their row on a class roster shows the waiver as **Outdated**. **Discard wording changes** puts the text back without publishing.

## Payments

Shows whether Stripe is connected, with the last four characters of your account ID. If it isn't connected yet, click **Connect with Stripe** — see **Payments → Connecting Stripe**.

## Tax (GST)

Turn tax on, name it, add your ABN or tax number, and manage your rates. See **Payments → Tax on receipts** for the full walkthrough.

---
title: Guest bookings
description: Letting members bring guests, and how guests are charged
order: 3
---

# Guest bookings

A member can bring one or more guests along when they book a session, if the session allows it. Guests don't need their own CalaStudio account — there's no name or email collected for them at all. Each guest is automatically labelled using the booking member's own name, like **"Jordan Lee - Guest 1"**, so they're identifiable on your roster without any extra data entry.

## Turning it on for a session

1. Open the session and find **Max guests per booking** under **Settings**
2. Choose **No guests**, or a number from 1–3

Leave it at **No guests** (the default) for classes that shouldn't allow them at all. There's no studio-wide default for this in Settings yet — it's set per session (or per occurrence, via that occurrence's **Edit** button, if you need to override just one date).

## The pass side of the equation

If a member is paying with a pass, that pass template's own guest settings also have to allow it — both the session **and** the pass need to say yes, and the *more* restrictive of the two wins. Open a pass template and look for:

- **Guest bookings** — Yes/No, or "Studio default" to inherit the org-wide setting (there's no dashboard screen for the org-wide default itself yet, so in practice this behaves like "No" unless set explicitly)
- **Max guests per booking** — capped further by whatever the session itself allows
- **Credits per guest** — defaults to 1, independent of what the member's own credit cost is

A pass with guest bookings turned off means that member can't bring guests on it, even into a session that otherwise allows them.

## How a member books with guests

If the session and their pass both allow it, the booking flow shows a **Bringing guests?** selector before confirming. The member picks how many they're bringing (capped at whatever spots are actually left, not just the configured max), and each guest counts as an extra spot against capacity — a session with room for 12 and a member bringing 2 guests uses 3 of those spots.

Guests can only be brought along on a pass-paid booking — there's no separate guest payment step for a card or free booking.

## Checking in guests

Each guest is checked in separately from the member. On the class roster, every guest listed under the member's row has their own **Check in** button. Tap it when they arrive; it turns into the time they were checked in, which you can tap to undo. The member's own **Check in** covers only the member, so a member who comes without their guest is recorded correctly, and so is a guest who comes without the member.

Anyone not checked in once the class is over counts as a **no-show**, member or guest. If someone did come and nobody tapped, you can still check them in afterwards. Guests on classes before 23 October 2026 weren't checked in separately, so they're left out of attendance and no-show figures.

## Cancelling a guest

A member can't cancel just one guest themselves — cancelling their own booking cancels any guests on it too. From the occurrence's roster, though, Admin and Super teacher can cancel an individual guest without touching the member's own confirmed spot: find the guest listed under the member's row and click **Cancel** next to their name. Any credit used for that guest is returned in full — unlike cancelling the member's own spot, this doesn't check the cancellation window.

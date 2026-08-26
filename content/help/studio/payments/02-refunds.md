---
title: Refunds
description: How card payments and pass credits get refunded
order: 2
---

# Refunds

Refunds work differently depending on how the booking was paid for — a card charge goes back through Stripe, a pass booking gets its credit returned instead. Both can happen automatically or be triggered manually.

## Card payments

**Automatic** — if a member cancels a card-paid booking themselves inside the session's cancellation window, the full amount is refunded straight away with no action needed from you. Cancelling a booking or a whole occurrence from the dashboard doesn't trigger this — only a member's own in-window self-service cancellation does.

**Manual** — from a booking's roster row, click **Refund** (Admin, Super teacher only) to open the refund form:

1. Enter the amount — partial refunds are allowed, capped at whatever hasn't already been refunded
2. Enter a reason (required)
3. Click **Issue refund**

Payments older than 90 days can't be refunded from here — the button will tell you to use the Stripe dashboard directly instead.

## Pass credits

**Automatic** — cancelling inside the cancellation window returns the credit immediately, whether the member cancelled it themselves or you cancelled it for them. Cancelling outside the window (a "late cancel") forfeits it instead, per your studio's cancellation policy — see **Sessions → Cancellation policy**.

**Manual override** — if a late cancel forfeited a credit and you want to return it anyway (a goodwill gesture, or the cancellation window was misjudged), open the occurrence and go to its **Cancelled** tab. A late-cancelled pass booking that hasn't been refunded shows a **Refund credit** button (Admin, Super teacher only) — click it to return the credit to the member's pass. The Cancelled tab then shows when it was refunded and by whom, alongside the original cancellation record.

Cancelling a whole occurrence always returns every credit in full, regardless of the window — see **Managing bookings → Cancelling a whole occurrence**.

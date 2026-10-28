---
title: Connecting Stripe
description: Accepting card payments for drop-ins and passes
order: 1
---

# Connecting Stripe

Card payments — a member paying for a drop-in class or buying a pass online — go through Stripe. Money is deposited straight into your own bank account. What CalaStudio charges depends on your plan; see **Settings → Plan & billing**.

## Connecting your account

1. Go to **Settings** and find the **Payments** card
2. Click **Connect with Stripe**
3. Complete Stripe's onboarding flow (business details, bank account)
4. You'll land back on Settings, which shows **Stripe connected.** and a **Connected** tag on the Stripe card once it's done

If you don't already have a Stripe account, this same flow creates one for you.

## Without Stripe connected

You can still run your studio without it — issue and comp passes manually, take payment outside the platform, or run **Free** sessions. What you can't do is let a member pay by card themselves, either for a drop-in or to buy a pass online.

## Checking your connection

The **Payments** card checks your connection with Stripe each time you open Settings. It shows **Connected** and the last four characters of your Stripe account ID ("Account ending …"). If a payment starts failing, check here first. An interrupted Stripe onboarding (a closed tab, a declined verification) can leave the account only partly set up.

## Needs reconnecting

If the card shows **Needs reconnecting**, CalaStudio can no longer reach your Stripe account. This can happen if CalaStudio was removed in your Stripe dashboard. Members can't pay by card until you fix it: click **Reconnect Stripe** and sign in to Stripe again.

## Disconnecting or switching accounts

To stop taking card payments, or to move to a different Stripe account (for example a new business entity or bank):

1. In **Settings → Payments**, click **Disconnect**
2. Confirm with **Disconnect Stripe**
3. To switch accounts, click **Connect with Stripe** and connect the new one

Once disconnected, members can't pay by card until you connect again. Card payments that hadn't finished are cancelled. If a member is paying at that moment, you'll be asked to try again in a few minutes.

**Refunds for card payments taken on a previous Stripe account must be made from that account's Stripe dashboard**, not from CalaStudio. Passes and bookings themselves aren't affected.

Only an **Admin** can connect or disconnect Stripe, and each change is recorded in the **Activity log**.

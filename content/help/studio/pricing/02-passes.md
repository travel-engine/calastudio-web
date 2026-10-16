---
title: Creating & managing passes
description: How to set up pass templates and issue passes to members
order: 2
---

# Passes

Passes let members buy credits upfront and spend them on sessions — cheaper for them, steadier revenue for you. A **pass type** (also called a pass template) defines a kind of pass (e.g. "10-Class Pack"); each time a member buys or is issued one, that becomes an **issued pass** with its own credit balance and expiry date.

## Create a pass type

1. Go to **Passes** in the sidebar
2. Click **+ New pass type**
3. Fill in the basics:
   - **Pass type** — Credit-based (a fixed number of classes) or Unlimited
   - **Credits** — how many classes a credit-based pass includes
   - **Expiry rule** — a fixed calendar date, or rolling days/months from purchase
   - **Price** — shown to members in your studio's currency
4. Click **Create pass template**

It's active immediately and appears as a card on the **Pass types** tab, showing its credits, expiry, price and — for credit passes — the price per class.

## Optional settings

| Setting | What it does |
|---|---|
| **Session/delivery restrictions** | Limit the pass to specific session types (class/workshop) or delivery modes (in-person/online). Leave blank to allow everything. |
| **Allow freeze** | Lets a member pause the pass's expiry clock, up to a max number of days. |
| **Credit return on cancel** | Reserved for a future per-pass override. Today, whether a cancellation returns its credit is decided studio-wide by your cancellation policy, not per pass template — see **Sessions → Cancellation policy**. |
| **Multi-pass priority** | When a member holds more than one usable pass, which one gets debited first — soonest to expire, oldest purchased, or let the member choose. |
| **Guest bookings** | Whether this pass can bring guests, how many, and the credit cost per guest. Leave as "studio default" to inherit your org-wide setting. |
| **Auto-renew** | Offer auto-renewal, and which template a member is moved into when it renews (defaults to the same template). |
| **Sale window** | Restrict when the pass can be purchased — useful for limited-time offers. |

## Issue a pass to a member

Use this to comp a pass, backfill a purchase made outside the platform, or set someone up manually.

1. Go to **Passes** → **Issued to members**
2. Click **+ Issue a pass**
3. Search for the member by name or email
4. Choose the pass type, an optional **Effective from** date (leave blank to start today), and whether to enable auto-renew
5. Click **Issue pass**

Only **Admin** and **Super teacher** roles can issue passes.

## Manage an issued pass

Click **Manage** on any row in **Issued to members** to:

- **Freeze / unfreeze** — pause the expiry clock (only if the template allows freezing)
- **Adjust credits** — add or remove credits by hand; you must give a reason, which is recorded permanently
- **Extend expiry** — override the expiry date; also requires a reason
- **View credit history** — every purchase, booking debit, cancellation credit, and manual adjustment on that pass, oldest to newest

Every credit movement is logged and can't be edited or deleted, so the history always reconciles.

## Deactivating a pass type

Click **Edit** on the pass type's card, then **Deactivate**. It stops appearing as purchasable or issuable, but passes already issued from it keep working until they expire — deactivating never cuts off a member mid-pass.

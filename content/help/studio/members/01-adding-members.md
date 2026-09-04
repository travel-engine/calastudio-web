---
title: Adding members
description: How members join your studio, and how to bulk-import an existing list
order: 1
---

# Adding members

**Members** in the sidebar shows everyone registered at your studio — name and email, searchable. It's visible to Admin and Super teacher only.

## How members join

Most members join themselves: they sign up when booking a session from your studio's public booking page. There's nothing for you to do — they show up in this list automatically once they register.

You can also add people yourself — **+ Add member** for one, or **Import CSV** for a whole list (below). Anyone you add or import gets an email inviting them to set a password so they can sign in to book and manage their passes. Until they set it, they're in your list but haven't accessed their account yet. The single **+ Add member** form lets you skip that email for walk-ins who won't use online booking.

## Importing an existing list

If you're moving from another system, use **Import CSV** (Admin only) to bring your existing member list in rather than re-entering it by hand.

1. Click **Import CSV**.
2. Choose a `.csv` file, or paste rows directly into the text box.
3. Click **Preview import** — nothing is saved yet. Each row is checked and marked:
   - **Valid** — ready to import
   - **Already a member** — this email is already an active member of your studio, so it's skipped
   - **Invalid** — missing a required field, a bad email, a bad date, or a duplicate row within the file itself; the reason is shown next to the row
4. Review the results, then click **Import N members** to actually create the valid rows. Invalid and already-member rows are never written.

### Recognized columns

Only `full_name` and `email` are required. Include a header row and any subset of these columns, in any order:

`full_name, email, join_date, phone, date_of_birth, gender, person_type, emergency_contact_name, emergency_contact_phone, address`

Dates (`join_date`, `date_of_birth`) must be in `YYYY-MM-DD` format. If you include `gender` it must be one of `male`, `female`, `other`, `prefer_not_to_say`; if you include `person_type` it must be one of `adult`, `child`, `senior`, `student`. Rows with any other value are marked invalid in the preview with the reason shown — casing doesn't matter, `Female` and `female` both work.

If a person already exists at another studio under the same email, their name and identity are reused rather than duplicated — only the fields still blank on their existing profile get filled in from the import.

Pass balances and credits are never part of an import — imported members start with none. Issue passes separately from **Passes**.

## Resending the welcome email

If someone you added or imported didn't receive their invitation, or the link has expired, open their profile from the **Members** list and click **Resend welcome email**. That sends a fresh set-password link.

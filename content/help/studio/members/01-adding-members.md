---
title: Adding members
description: How members join your studio, and how to bulk-import an existing list
order: 1
---

# Adding members

**Members** in the sidebar shows everyone registered at your studio — name and email, searchable. It's visible to Admin and Super teacher only.

## How members join

Most members join themselves: they sign up when booking a session from your studio's public booking page. There's nothing for you to do — they show up in this list automatically once they register.

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

If a person already exists at another studio under the same email, their name and identity are reused rather than duplicated — only the fields still blank on their existing profile get filled in from the import.

Pass balances and credits are never part of an import — imported members start with none. Issue passes separately from **Passes**.

---
title: Adding members
description: How members join your studio, and how to bulk-import an existing list
order: 1
---

# Adding members

**Members** in the sidebar shows everyone registered at your studio: name and email, searchable and sortable. It's visible to Admin and Super teacher only. To edit someone's details or add notes, see **Member details and notes**.

## How members join

Most members join themselves: they sign up when booking a session from your studio's public booking page. There's nothing for you to do — they show up in this list automatically once they register.

You can also add people yourself — **+ Add member** for one, or **Import CSV** for a whole list (below). Anyone you add or import gets an email inviting them to set a password so they can sign in to book and manage their passes. The single **+ Add member** form lets you skip that email for walk-ins who won't use online booking.

The **Last active** column on the Members list tells you where each person is up to: *Invite pending* (email not sent yet), *Welcome not sent* (imported, welcome email held until you send it), *Not signed in yet* (invited, hasn't set a password), or when they were last active in the portal. It's also on each member's profile.

## Importing an existing list

Moving from another booking system? **Import CSV** (Admin only) brings your member list across in one go, including the classes each person has left on their passes.

1. Click **Import CSV**, then **Download template**. It already has a column for each of your passes
2. Fill in one row per member in Excel or Google Sheets (see below), and save it as CSV
3. Click **Choose CSV file**, or open **Or paste the rows instead** and paste them, then click **Check file**. Nothing is saved yet. Each row is marked:
   - **New member:** ready to import
   - **Already a member:** this email is already at your studio. Their details are left alone, but any pass balances in the row are still added, so you can re-upload a corrected file
   - **Needs fixing:** a missing or invalid value, with the reason next to it
4. Click **Import …** to create the members and their passes
5. Then send the welcome emails, now or later (below)

### What goes in the file

- **first_name** and **email** are required. Everything else is optional: **last_name**, **join_date**, **phone**, **date_of_birth**, **gender**, **person_type**, **emergency_contact_name**, **emergency_contact_phone**, **address**
- **sessions_attended:** how many classes they'd been to before CalaStudio. It's shown on their profile as "Classes before CalaStudio"
- **Pass columns** (one per pass, named exactly like the pass): the classes they have left, or **yes** for an unlimited pass. Leave blank if they don't have it. The pass is added with no payment recorded (they paid your old system)
- **"… expiry" columns:** when that pass runs out. Leave blank to use the pass's usual expiry, counted from today
- **All dates as yyyy-mm-dd**, for example 2026-11-19. Excel sometimes changes dates to 19/11/2026 when it saves, so check before uploading
- **gender** must be male, female, other or prefer_not_to_say; **person_type** must be adult, child, senior or student. Capitals don't matter

Spreadsheets saved from Excel, with accented names like Lomé, are read correctly.

If a person already exists at another studio under the same email, their existing account is reused, and only details that are still blank get filled in from your file.

## Welcome emails

Nothing is emailed during the import. When you're ready, click **Send welcome emails**, either straight after importing or later from the banner on the **Members** page.

Imported members get a "{your studio} has moved to a new booking system" email with:

- **Your message:** a few lines in your own words. Blank lines start a new paragraph. Leave it empty to use a standard line
- How to sign in: a button to set their password, or use **Forgot password** or **Continue with Google** on your booking page. The link doesn't expire, so it's fine if they open it days later
- **Their class credits:** a table of the passes and memberships carried over, or a note that there was nothing to carry over
- **Sign-off:** shown after "See you on the mat,". Leave it empty to use your studio name

Tick **Email me a copy of each welcome** to get a copy of each one at your studio email, without the member's personal sign-in button. Your message, sign-off and this choice are remembered for next time.

A note is added to each member's notes when their welcome goes out, listing any credits carried over.

## Resending the welcome email

If someone didn't receive their invitation, open their profile from the **Members** list and click **Resend invite** (or **Send welcome email** if it hasn't gone out yet). It sends the same never-expiring link again.

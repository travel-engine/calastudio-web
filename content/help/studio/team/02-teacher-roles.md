---
title: Teacher roles
description: What each teacher role can see and do
order: 2
---

# Teacher roles

Every person you invite gets a role that controls what they can see and do in your studio's dashboard. Roles restrict what's fetched, not just what's shown — a role without access to member data never receives it, so there's nothing to accidentally leak.

## Sessions and the schedule

| Role | Can see | Can create/edit a session | Can add/edit/cancel an occurrence |
|---|---|---|---|
| **Admin** | Every session | Yes | Yes |
| **Super teacher** | Every session | No | Yes |
| **Teacher** | Only sessions they're the instructor on | No | Edit and cancel their own classes (can't add dates) |
| **Basic teacher** | Only sessions they're the instructor on | No | No |
| **Front desk** | Every session | No | No |

Session *templates* — name, price, capacity, delivery mode — are admin-only to create or edit, even for Super teacher. Adding the actual bookable dates (occurrences) is where Super teacher's access kicks in. A Teacher can edit or cancel a class they teach, but can't add new dates.

A session's **instructor** is set by an admin from the session form — this is what determines which sessions a Teacher or Basic teacher can see at all, so assign it or they'll see nothing. Admin and Super teacher can also override the instructor for a single class from that class's **Edit class** button, without changing who teaches the session everywhere else.

## The roster

| Role | Can view roster | What they see | Add student (free) | Paid booking | Check in |
|---|---|---|---|---|---|
| **Admin** | Yes | Full member detail | Yes | Yes | Yes |
| **Super teacher** | Yes | Full member detail | Yes | Yes | Yes |
| **Teacher** | Own sessions only | Full member detail | Yes | No | Yes |
| **Basic teacher** | Own sessions only | Name only | Yes | No | Yes |
| **Front desk** | Every roster | Name only | No | No | Yes |

"Full member detail" means name, email, and payment method. "Name only" means exactly that — no email, phone, pass balance, or health notes, even though Basic teacher and Front desk can both see who's on the roster and check them in.

**Add student** issues a free spot with no payment or credit involved — it's how Teacher and Basic teacher put someone on their own roster, since they can't process a paid booking. **Paid booking** (charging a pass credit or comping with a note) is Super teacher and Admin only.

## Members, passes, and team

| Role | Search members by name | View/issue passes | Manage team | View activity log |
|---|---|---|---|---|
| **Admin** | Yes (full detail) | Yes | Yes | Yes |
| **Super teacher** | Yes (full detail) | Yes | No | No |
| **Teacher** | Yes (name only) | No | No | No |
| **Basic teacher** | Yes (name only) | No | No | No |
| **Front desk** | No | No | No | No |

## Choosing a role when inviting

Pick the narrowest role that lets someone do their job. A casual instructor covering the occasional class only needs **Basic teacher**; someone running their own program day-to-day needs **Teacher**; someone you'd trust to run the schedule and take payments in your absence needs **Super teacher**. Reach for **Admin** rarely — it's the only role that can change session templates, studio settings, or see the activity log.

## Changing a role later

You can see each person's roles on **Team** and on their page, but changing an existing team member's role from the dashboard isn't available yet. Contact CalaStudio support if someone's role needs to change.

## Multiple roles at once

A person can hold more than one role — for example, a member who also teaches one class a week can be both a **Member** and a **Basic teacher** at the same time. See **Multiple roles** in *Inviting teachers* for how that works.

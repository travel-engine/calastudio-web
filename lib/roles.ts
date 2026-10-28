// Mirrors the .RequireRoles(...) gates in CalaStudio.Api's EndPoints/*.cs. If the backend's gates
// change, these must be updated to match — this is not an independent policy, just the client-side
// reflection of the same rules, so the UI doesn't attempt actions the API will reject.

export const ADMIN = 'admin'
export const TEACHER_SUPER = 'teacher_super'
export const TEACHER_GENERAL = 'teacher_general'
export const TEACHER_BASIC = 'teacher_basic'
export const FRONT_DESK = 'front_desk'
export const MEMBER = 'member'

const has = (roles: string[], allowed: string[]) => roles.some(r => allowed.includes(r))

// Any studio staff role. A member-only account has no business in the dashboard; it belongs on
// the studio's member site (/account).
export const isStaff = (roles: string[]) => has(roles, [ADMIN, TEACHER_SUPER, TEACHER_GENERAL, TEACHER_BASIC, FRONT_DESK])

// Sessions (SessionEndpoints.cs). teacher_general/teacher_basic can view too, but scoped to
// sessions where they're the instructor — enforced server-side (list is pre-filtered by the API;
// single-session GET is gated by RequireSessionOwnershipFilter), not something this client needs
// to replicate — it only needs to know whether to show the page/nav item at all.
export const canViewSessions = (roles: string[]) => has(roles, [ADMIN, TEACHER_SUPER, FRONT_DESK, TEACHER_GENERAL, TEACHER_BASIC])
export const canManageSessions = (roles: string[]) => has(roles, [ADMIN])
// The API scopes sessions/occurrences/rosters to the ones they instruct for these two roles, unless
// they also hold a studio-wide role. Wording only ("assigned to you" vs "in your studio").
export const seesOnlyOwnSessions = (roles: string[]) =>
  has(roles, [TEACHER_GENERAL, TEACHER_BASIC]) && !has(roles, [ADMIN, TEACHER_SUPER, FRONT_DESK])

// Session occurrences (SessionOccurrenceEndpoints.cs) — same ownership-scoping note as sessions above
export const canViewOccurrences = (roles: string[]) => has(roles, [ADMIN, TEACHER_SUPER, FRONT_DESK, TEACHER_GENERAL, TEACHER_BASIC])
// POST /occurrences (create a one-off occurrence) — admin/teacher_super only.
export const canCreateOccurrence = (roles: string[]) => has(roles, [ADMIN, TEACHER_SUPER])
// PATCH /occurrences/{id} + POST /occurrences/{id}/cancel — also teacher_general, but ownership-
// scoped server-side (RequireSessionOwnership) to occurrences on sessions they instruct. The client
// only decides whether to show the Edit / Cancel buttons; a teacher_general only ever reaches an
// occurrence detail page for their own occurrences anyway (the GET is ownership-scoped too).
export const canManageOccurrences = (roles: string[]) => has(roles, [ADMIN, TEACHER_SUPER, TEACHER_GENERAL])

// Team (TeacherEndpoints.cs)
export const canViewTeam = (roles: string[]) => has(roles, [ADMIN])
export const canManageTeam = (roles: string[]) => has(roles, [ADMIN])
// POST /organisations/{orgId}/teachers/{userId}/resend-invite (TeacherEndpoints.cs) — admin only.
export const canResendTeacherInvite = (roles: string[]) => has(roles, [ADMIN])

// Pass templates (PassTemplateEndpoints.cs)
export const canViewPassTemplates = (roles: string[]) => has(roles, [ADMIN, TEACHER_SUPER])
export const canManagePassTemplates = (roles: string[]) => has(roles, [ADMIN])

// Member passes + ledger (MemberPassEndpoints.cs) — view and manage are the same gate today
export const canManageMemberPasses = (roles: string[]) => has(roles, [ADMIN, TEACHER_SUPER])

// Bookings (BookingEndpoints.cs). Roster GET now also includes teacher_general/teacher_basic,
// ownership-scoped to occurrences they instruct (RequireSessionOwnershipFilter) — same "server
// already scopes it" note as sessions above.
export const canViewBookings = (roles: string[]) => has(roles, [ADMIN, TEACHER_SUPER, FRONT_DESK, TEACHER_GENERAL, TEACHER_BASIC])
export const canManageBookings = (roles: string[]) => has(roles, [ADMIN, TEACHER_SUPER]) // POST /bookings (paid), cancel booking, cancel occurrence
export const canMarkAttended = (roles: string[]) => has(roles, [ADMIN, TEACHER_SUPER, TEACHER_GENERAL, TEACHER_BASIC, FRONT_DESK])
export const canMarkNoShow = (roles: string[]) => has(roles, [ADMIN, TEACHER_SUPER, TEACHER_GENERAL, TEACHER_BASIC])
// POST .../add-student — the no-payment path (front_desk excluded, unlike canMarkAttended above)
export const canAddStudent = (roles: string[]) => has(roles, [ADMIN, TEACHER_SUPER, TEACHER_GENERAL, TEACHER_BASIC])

// Audit log (AuditEndpoints.cs) — admin only. Org-wide activity history, including override
// reasons, is more sensitive than most screens here, so it doesn't reuse the admin/teacher_super
// pattern used elsewhere.
export const canViewAuditLog = (roles: string[]) => has(roles, [ADMIN])
// Entity feed (GET /organisations/{orgId}/activity, AuditEndpoints.cs): everything linked to one
// member, pass, payment, … — admin and teacher_super (who see all members, passes and payments,
// 17.3; spec 08 §8.10b).
export const canViewEntityActivity = (roles: string[]) => has(roles, [ADMIN, TEACHER_SUPER])

// Studio settings — PATCH /organisations/{id} (OrganisationEndpoints.cs). Admin only.
export const canManageSettings = (roles: string[]) => has(roles, [ADMIN])

// Reports (ReportEndpoints.cs). Every report is admin-only except Attendance (§8.12), which also
// serves teacher_super scoped to their own sessions — so the page shows for either role and only
// the tabs a role can actually load are rendered.
export const canViewReports = (roles: string[]) => has(roles, [ADMIN, TEACHER_SUPER])
export const canViewAllReports = (roles: string[]) => has(roles, [ADMIN])

// Members directory (GET /organisations/{orgId}/members, OrganisationEndpoints.cs). The endpoint
// itself also serves teacher_general/teacher_basic a name-only projection for the add-student
// picker, but that's not a member directory — per 17-teacher-portal.md 17.3 ("View full member
// profiles"), only admin/teacher_super get a real member list page.
export const canViewMembers = (roles: string[]) => has(roles, [ADMIN, TEACHER_SUPER])
// POST /organisations/{orgId}/members/{memberId}/resend-welcome (MemberEndpoints.cs) — admin/teacher_super.
export const canResendMemberWelcome = (roles: string[]) => has(roles, [ADMIN, TEACHER_SUPER])
// CSV import (POST /organisations/{orgId}/members/import, MemberEndpoints.cs) — admin only.
export const canImportMembers = (roles: string[]) => has(roles, [ADMIN])
// "Add new member" quick-add (POST /organisations/{orgId}/members, MemberEndpoints.cs) —
// admin/teacher_super/teacher_general; the add-student search modal it also lives in is reachable
// by teacher_general, who needs a way to add someone not yet in the system rather than dead-ending.
export const canAddMember = (roles: string[]) => has(roles, [ADMIN, TEACHER_SUPER, TEACHER_GENERAL])

// The most senior staff role someone holds, for a chip next to their name ("Admin", "Teacher").
// Null for a member-only account. Same wording as the activity feeds.
const STAFF_RANK: [string, string][] = [
  [ADMIN, 'Admin'], [TEACHER_SUPER, 'Senior teacher'], [TEACHER_GENERAL, 'Teacher'], [TEACHER_BASIC, 'Teacher'], [FRONT_DESK, 'Front desk'],
]
export const staffRoleLabel = (roles: string[] | null | undefined) =>
  STAFF_RANK.find(([r]) => roles?.includes(r))?.[1] ?? null

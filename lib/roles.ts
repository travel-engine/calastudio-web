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

// Sessions (SessionEndpoints.cs). teacher_general/teacher_basic can view too, but scoped to
// sessions where they're the instructor — enforced server-side (list is pre-filtered by the API;
// single-session GET is gated by RequireSessionOwnershipFilter), not something this client needs
// to replicate — it only needs to know whether to show the page/nav item at all.
export const canViewSessions = (roles: string[]) => has(roles, [ADMIN, TEACHER_SUPER, FRONT_DESK, TEACHER_GENERAL, TEACHER_BASIC])
export const canManageSessions = (roles: string[]) => has(roles, [ADMIN])

// Session occurrences (SessionOccurrenceEndpoints.cs) — same ownership-scoping note as sessions above
export const canViewOccurrences = (roles: string[]) => has(roles, [ADMIN, TEACHER_SUPER, FRONT_DESK, TEACHER_GENERAL, TEACHER_BASIC])
export const canManageOccurrences = (roles: string[]) => has(roles, [ADMIN, TEACHER_SUPER])

// Team (TeacherEndpoints.cs)
export const canViewTeam = (roles: string[]) => has(roles, [ADMIN])
export const canManageTeam = (roles: string[]) => has(roles, [ADMIN])

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

// Studio settings — PATCH /organisations/{id} (OrganisationEndpoints.cs). Admin only.
export const canManageSettings = (roles: string[]) => has(roles, [ADMIN])

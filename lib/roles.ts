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

// Sessions (SessionEndpoints.cs)
export const canViewSessions = (roles: string[]) => has(roles, [ADMIN, TEACHER_SUPER, FRONT_DESK])
export const canManageSessions = (roles: string[]) => has(roles, [ADMIN])

// Session occurrences (SessionOccurrenceEndpoints.cs)
export const canViewOccurrences = (roles: string[]) => has(roles, [ADMIN, TEACHER_SUPER, FRONT_DESK])
export const canManageOccurrences = (roles: string[]) => has(roles, [ADMIN, TEACHER_SUPER])

// Team (TeacherEndpoints.cs)
export const canViewTeam = (roles: string[]) => has(roles, [ADMIN])
export const canManageTeam = (roles: string[]) => has(roles, [ADMIN])

// Pass templates (PassTemplateEndpoints.cs)
export const canViewPassTemplates = (roles: string[]) => has(roles, [ADMIN, TEACHER_SUPER])
export const canManagePassTemplates = (roles: string[]) => has(roles, [ADMIN])

// Member passes + ledger (MemberPassEndpoints.cs) — view and manage are the same gate today
export const canManageMemberPasses = (roles: string[]) => has(roles, [ADMIN, TEACHER_SUPER])

// Bookings (BookingEndpoints.cs)
export const canViewBookings = (roles: string[]) => has(roles, [ADMIN, TEACHER_SUPER, FRONT_DESK])
export const canManageBookings = (roles: string[]) => has(roles, [ADMIN, TEACHER_SUPER]) // create/cancel booking, cancel occurrence
export const canMarkAttended = (roles: string[]) => has(roles, [ADMIN, TEACHER_SUPER, TEACHER_GENERAL, TEACHER_BASIC, FRONT_DESK])
export const canMarkNoShow = (roles: string[]) => has(roles, [ADMIN, TEACHER_SUPER, TEACHER_GENERAL, TEACHER_BASIC])

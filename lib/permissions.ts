// Named permissions, decided by the API (GET /api/organisations/{orgId}/me/permissions, loaded with
// the org context). The API checks every one of these again before the action runs; the web only
// uses them to decide what to show. The role → permission map lives in the API
// (Models/Permissions.cs) and will later be editable per studio (Settings → Permissions).
//
// Screens move from lib/roles checks to these as the API names them.

export type Permission =
  | 'pass.issue'
  | 'pass.override_price'
  | 'pass.mark_paid'
  | 'pass.send_payment_reminder'
  | 'member.view'
  | 'member.edit_details'
  | 'booking.override_price'

export function can(permissions: readonly string[] | null | undefined, permission: Permission): boolean {
  return !!permissions?.includes(permission)
}

// Presentation mapping for a member's account/activity state, from the two nullable timestamps the
// members endpoints return (auth_provisioned_at, last_seen_at). Shared by the members list and the
// member detail screen so the labels don't drift.
//
//   auth_provisioned_at | last_seen_at | state
//   --------------------|--------------|------------------------------
//   null                | null         | invite pending (no auth account yet)
//   set                 | null         | provisioned, never signed in  (also: walk-in added with
//                       |              |   "send welcome email" unchecked)
//   set                 | set          | active — last_seen_at is last activity (~10 min throttle)

export type MemberActivity =
  | { kind: 'seen'; at: string }
  | { kind: 'never' }
  | { kind: 'pending' }
  | { kind: 'held' } // imported, welcome email held until the studio sends it (welcome_pending)

export function memberActivity(
  authProvisionedAt: string | null,
  lastSeenAt: string | null,
  welcomePending = false,
): MemberActivity {
  if (lastSeenAt) return { kind: 'seen', at: lastSeenAt }
  if (welcomePending) return { kind: 'held' }
  if (authProvisionedAt) return { kind: 'never' }
  return { kind: 'pending' }
}

/** Short label for the non-"seen" states; caller formats the timestamp for 'seen' itself. */
export function memberActivityLabel(a: MemberActivity): string {
  switch (a.kind) {
    case 'pending': return 'Invite pending'
    case 'held': return 'Welcome not sent'
    case 'never': return 'Not signed in yet'
    case 'seen': return 'Active'
  }
}

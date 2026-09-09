import SessionPolicyGuard from '@/app/components/SessionPolicyGuard'

// Wraps every authenticated dashboard route so the "remember me" session cap (lib/authRemember)
// is enforced no matter which page the user lands on first.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SessionPolicyGuard />
      {children}
    </>
  )
}

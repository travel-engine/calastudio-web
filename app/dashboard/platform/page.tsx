import { redirect } from 'next/navigation'

// The platform-admin billing screen moved into the CalaStudio admin area.
export default function PlatformAdminMoved() {
  redirect('/admin')
}

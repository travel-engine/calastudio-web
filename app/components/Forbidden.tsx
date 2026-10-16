import { Lock } from 'lucide-react'
import { Button, Card, EmptyState } from '@/app/components/admin'

export default function Forbidden() {
  return (
    <div style={{ maxWidth: 640, margin: '40px auto 0' }}>
      <Card>
        <EmptyState
          icon={<Lock size={22} strokeWidth={1.8} />}
          message={<>
            <strong style={{ display: 'block', fontSize: 17, marginBottom: 6 }}>You don&apos;t have access to this</strong>
            Your role doesn&apos;t include this section. If you think that&apos;s wrong, check with your studio admin.
          </>}
          action={<Button href="/dashboard" variant="primary">Back to dashboard</Button>}
        />
      </Card>
    </div>
  )
}

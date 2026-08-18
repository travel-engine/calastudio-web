export default function Forbidden() {
  return (
    <div style={{
      backgroundColor: 'white', borderRadius: '12px', padding: '64px', textAlign: 'center',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
    }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
      <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>You don't have access to this</h3>
      <p style={{ color: '#666', fontSize: '14px', marginBottom: '24px' }}>
        Your role doesn't include this section. If you think that's wrong, check with your studio admin.
      </p>
      <a href="/dashboard" style={{
        display: 'inline-block', padding: '10px 24px', backgroundColor: '#085041', color: 'white',
        borderRadius: '8px', fontSize: '14px', fontWeight: 600, textDecoration: 'none'
      }}>
        Back to dashboard
      </a>
    </div>
  )
}

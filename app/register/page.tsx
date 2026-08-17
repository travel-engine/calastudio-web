'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRegister = async () => {
    setLoading(true)
    const supabase = createClient()

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Check your email for a verification link!')
    }
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: 400, margin: '100px auto', padding: 24 }}>
      <h1 style={{ marginBottom: 24 }}>Create your CalaStudio account</h1>

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        style={{ display: 'block', width: '100%', marginBottom: 12, padding: 8 }}
      />

      <input
        type="password"
        placeholder="Password (min 8 characters)"
        value={password}
        onChange={e => setPassword(e.target.value)}
        style={{ display: 'block', width: '100%', marginBottom: 12, padding: 8 }}
      />

      <button
        onClick={handleRegister}
        disabled={loading}
        style={{ padding: '8px 24px', background: '#085041', color: 'white', border: 'none', cursor: 'pointer' }}
      >
        {loading ? 'Creating account...' : 'Create account'}
      </button>

      {message && (
        <p style={{ marginTop: 16, color: message.includes('Check') ? 'green' : 'red' }}>
          {message}
        </p>
      )}
    </div>
  )
}
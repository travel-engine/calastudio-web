'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [token, setToken] = useState('')

  const handleLogin = async () => {
    setLoading(true)
    const supabase = createClient()

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Login successful!')
      setToken(data.session?.access_token ?? '')
    }
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: 400, margin: '100px auto', padding: 24 }}>
      <h1 style={{ marginBottom: 24 }}>Sign in to CalaStudio</h1>

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        style={{ display: 'block', width: '100%', marginBottom: 12, padding: 8 }}
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        style={{ display: 'block', width: '100%', marginBottom: 12, padding: 8 }}
      />

      <button
        onClick={handleLogin}
        disabled={loading}
        style={{ padding: '8px 24px', background: '#085041', color: 'white', border: 'none', cursor: 'pointer' }}
      >
        {loading ? 'Signing in...' : 'Sign in'}
      </button>

      {message && (
        <p style={{ marginTop: 16, color: message.includes('successful') ? 'green' : 'red' }}>
          {message}
        </p>
      )}

      {token && (
        <div style={{ marginTop: 24 }}>
          <p style={{ fontWeight: 'bold' }}>Your JWT token (copy this):</p>
          <textarea
            readOnly
            value={token}
            style={{ width: '100%', height: 100, fontSize: 10, marginTop: 8 }}
          />
        </div>
      )}
    </div>
  )
}
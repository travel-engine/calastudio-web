'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { MIN_PASSWORD_LENGTH, PASSWORD_HINT, authErrorMessage, passwordProblem } from '@/lib/passwordPolicy'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRegister = async () => {
    const problem = passwordProblem(password)
    if (problem) { setMessage(problem); return }
    setLoading(true)
    const supabase = createClient()

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Land a freshly-verified studio signup on the onboarding wizard, not the empty dashboard.
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
      },
    })

    if (error) {
      setMessage(authErrorMessage(error))
    } else {
      setMessage('Check your email for a verification link!')
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f4f4f4'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '48px',
        width: '100%',
        maxWidth: '420px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)'
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            display: 'inline-block',
            backgroundColor: '#085041',
            color: 'white',
            fontWeight: 700,
            fontSize: '20px',
            padding: '8px 20px',
            borderRadius: '8px',
            marginBottom: '16px'
          }}>
            CalaStudio
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 600, color: '#1a1a1a' }}>
            Create your account
          </h1>
          <p style={{ color: '#666', marginTop: '8px', fontSize: '14px' }}>
            Get your studio live in under 30 minutes
          </p>
        </div>

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px', color: '#1a1a1a' }}>
              Email address
            </label>
            <input
              type="email"
              placeholder="you@yourstudio.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                border: '1px solid #e2e2e2',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px', color: '#1a1a1a' }}>
              Password
            </label>
            <input
              type="password"
              placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="new-password"
              aria-describedby="password-hint"
              style={{
                width: '100%',
                padding: '10px 14px',
                border: '1px solid #e2e2e2',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none'
              }}
            />
            <p id="password-hint" style={{ margin: '6px 0 0', fontSize: '13px', color: '#666' }}>{PASSWORD_HINT}</p>
          </div>

          <button
            onClick={handleRegister}
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: loading ? '#9fd6b8' : '#085041',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: '8px'
            }}
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>

          {message && (
            <div style={{
              padding: '12px',
              borderRadius: '8px',
              backgroundColor: message.includes('Check') ? '#e8f5ee' : '#fdecea',
              color: message.includes('Check') ? '#085041' : '#8b1a1a',
              fontSize: '14px',
              textAlign: 'center'
            }}>
              {message}
            </div>
          )}

          <p style={{ textAlign: 'center', fontSize: '14px', color: '#666', marginTop: '8px' }}>
            Already have an account?{' '}
            <Link href="/login" style={{ color: '#085041', fontWeight: 500 }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
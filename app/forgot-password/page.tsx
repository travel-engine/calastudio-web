'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setMessage('')
    const supabase = createClient()

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/set-password`,
    })

    if (error) {
      setMessage(error.message)
    } else {
      setSent(true)
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
            Reset your password
          </h1>
          <p style={{ color: '#666', marginTop: '8px', fontSize: '14px' }}>
            We&apos;ll email you a link to set a new one
          </p>
        </div>

        {sent ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{
              padding: '12px',
              borderRadius: '8px',
              backgroundColor: '#e8f5ee',
              color: '#085041',
              fontSize: '14px',
              textAlign: 'center'
            }}>
              If an account exists for {email}, a reset link is on its way. Check your inbox.
            </div>
            <p style={{ textAlign: 'center', fontSize: '14px', color: '#666' }}>
              <Link href="/login" style={{ color: '#085041', fontWeight: 500 }}>
                Back to sign in
              </Link>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px', color: '#1a1a1a' }}>
                Email address
              </label>
              <input
                type="email"
                placeholder="you@yourstudio.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
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

            <button
              type="submit"
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
              {loading ? 'Sending...' : 'Send reset link'}
            </button>

            {message && (
              <div style={{
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: '#fdecea',
                color: '#8b1a1a',
                fontSize: '14px',
                textAlign: 'center'
              }}>
                {message}
              </div>
            )}

            <p style={{ textAlign: 'center', fontSize: '14px', color: '#666', marginTop: '8px' }}>
              Remembered it?{' '}
              <Link href="/login" style={{ color: '#085041', fontWeight: 500 }}>
                Sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}

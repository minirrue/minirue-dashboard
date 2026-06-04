'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { setTokens } from '@/lib/auth/tokens'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const idempotencyKey = `login-${crypto.randomUUID()}`
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({ email, password }),
      })

      if (res.status === 401) {
        setError('Email or password is incorrect')
        return
      }
      if (res.status === 429) {
        setError('Too many attempts. Please wait a moment and try again.')
        return
      }
      if (!res.ok) {
        setError('Something went wrong')
        return
      }

      const data = await res.json()
      const { accessToken, refreshToken } = data
      // Proxy-level auth: cookie checked by proxy.ts middleware
      const maxAge = 60 * 60 * 24 * 7
      document.cookie = `mr-auth=${encodeURIComponent(JSON.stringify({ accessToken, refreshToken }))}; max-age=${maxAge}; path=/; SameSite=Lax`
      // Backend-level auth: tokens in localStorage for Authorization: Bearer header
      setTokens(accessToken, refreshToken)
      router.push('/dashboard')
    } catch {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F6F2E9',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Inter Tight', sans-serif",
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 16,
        padding: '40px',
        width: '100%',
        maxWidth: 400,
        boxShadow: '0 6px 14px rgba(11,11,11,0.10), 0 12px 28px rgba(11,11,11,0.08)',
      }}>
        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontWeight: 500,
            fontSize: 28,
            color: '#95783C',
            letterSpacing: '-0.01em',
            lineHeight: 1,
          }}>
            MiniRue
          </div>
          <div style={{
            fontFamily: "'Jost', sans-serif",
            fontSize: 10,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#8A8376',
            marginTop: 6,
          }}>
            Admin
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: '#FADDDE',
            color: '#8E1418',
            borderRadius: 8,
            padding: '10px 14px',
            fontFamily: "'Inter Tight', sans-serif",
            fontSize: 13,
            marginBottom: 20,
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Email field */}
          <div style={{ marginBottom: 24 }}>
            <label style={{
              display: 'block',
              fontFamily: "'Jost', sans-serif",
              fontSize: 10,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: '#5C564C',
              marginBottom: 8,
            }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              style={{
                display: 'block',
                width: '100%',
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                borderBottom: '1px solid #CFC3A4',
                padding: '10px 0',
                fontFamily: "'Inter Tight', sans-serif",
                fontSize: 14,
                color: '#0B0B0B',
                background: 'transparent',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={e => (e.currentTarget.style.borderBottomColor = '#95783C')}
              onBlur={e => (e.currentTarget.style.borderBottomColor = '#CFC3A4')}
            />
          </div>

          {/* Password field */}
          <div style={{ marginBottom: 32 }}>
            <label style={{
              display: 'block',
              fontFamily: "'Jost', sans-serif",
              fontSize: 10,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: '#5C564C',
              marginBottom: 8,
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              style={{
                display: 'block',
                width: '100%',
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                borderBottom: '1px solid #CFC3A4',
                padding: '10px 0',
                fontFamily: "'Inter Tight', sans-serif",
                fontSize: 14,
                color: '#0B0B0B',
                background: 'transparent',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={e => (e.currentTarget.style.borderBottomColor = '#95783C')}
              onBlur={e => (e.currentTarget.style.borderBottomColor = '#CFC3A4')}
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              display: 'block',
              width: '100%',
              height: 48,
              background: loading ? '#2E2A24' : '#0B0B0B',
              color: '#F6F2E9',
              border: 'none',
              borderRadius: 6,
              fontFamily: "'Jost', sans-serif",
              fontSize: 14,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 200ms',
            }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}

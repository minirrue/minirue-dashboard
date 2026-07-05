'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { apiLogin } from '@/lib/api/auth';
import type { ApiError } from '@/lib/api/client';
import ErrorBanner from '@/components/dashboard/ErrorBanner';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await apiLogin(email, password);
      router.push('/overview');
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      if (!navigator.onLine || apiErr.status === 0) {
        setError('Unable to connect. Check your connection.');
      } else if (apiErr.status === 401) {
        setError('Email or password is incorrect.');
      } else if (apiErr.status === 403) {
        setError('This account does not have admin access.');
      } else if (apiErr.status === 429) {
        setError('Too many attempts. Please wait a moment and try again.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--mr-cream-200)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Inter Tight', sans-serif",
      }}
    >
      <div
        style={{
          background: 'var(--mr-dash-surface)',
          borderRadius: 'var(--mr-radius-lg)',
          padding: '40px',
          width: '100%',
          maxWidth: 400,
          boxShadow: 'var(--mr-shadow-md)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontWeight: 500,
              fontSize: 28,
              color: 'var(--mr-gold-500)',
              letterSpacing: '-0.01em',
              lineHeight: 1,
            }}
          >
            MiniRue
          </div>
          <div
            style={{
              fontFamily: "'Jost', sans-serif",
              fontSize: 10,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--mr-ink-400)',
              marginTop: 6,
            }}
          >
            Admin
          </div>
        </div>

        {error && (
          <div style={{ marginBottom: 20 }}>
            <ErrorBanner animated={false} message={error} />
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div style={{ marginBottom: 24 }}>
            <label
              htmlFor="email"
              style={{
                display: 'block',
                fontFamily: "'Jost', sans-serif",
                fontSize: 10,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--mr-ink-500)',
                marginBottom: 8,
              }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              style={{
                display: 'block',
                width: '100%',
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                borderBottom: '1px solid var(--mr-border)',
                padding: '10px 0',
                fontFamily: "'Inter Tight', sans-serif",
                fontSize: 14,
                color: 'var(--mr-ink-900)',
                background: 'transparent',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: 32 }}>
            <label
              htmlFor="password"
              style={{
                display: 'block',
                fontFamily: "'Jost', sans-serif",
                fontSize: 10,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--mr-ink-500)',
                marginBottom: 8,
              }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              style={{
                display: 'block',
                width: '100%',
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                borderBottom: '1px solid var(--mr-border)',
                padding: '10px 0',
                fontFamily: "'Inter Tight', sans-serif",
                fontSize: 14,
                color: 'var(--mr-ink-900)',
                background: 'transparent',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              display: 'block',
              width: '100%',
              height: 48,
              background: loading ? 'var(--mr-ink-700)' : 'var(--mr-ink-900)',
              color: 'var(--mr-cream-200)',
              border: 'none',
              borderRadius: 'var(--mr-radius-sm)',
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
  );
}

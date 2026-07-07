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
      setLoading(false);
    }
    // No `finally` here: on the success path router.push() has already been
    // called and this component is about to unmount via navigation, so we
    // deliberately leave `loading` at true — that keeps the full-viewport
    // overlay below visible continuously until the dashboard's own skeleton
    // takes over, closing the visual gap where the button used to flash back
    // to "Sign in" for a render tick.
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
      <style>{`
        @keyframes mr-login-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      {loading && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--mr-cream-200)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            zIndex: 50,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              display: 'inline-block',
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: '3px solid var(--mr-ink-200, rgba(0,0,0,0.12))',
              borderTopColor: 'currentColor',
              color: 'var(--mr-ink-900)',
              animation: 'mr-login-spin 700ms linear infinite',
            }}
          />
          <div
            style={{
              fontFamily: "'Jost', sans-serif",
              fontSize: 12,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--mr-ink-500)',
            }}
          >
            Signing you in…
          </div>
        </div>
      )}
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
        <div data-trace-id="PG-DASHBOARD-IAM-001::EL-REGION-brand-header" style={{ textAlign: 'center', marginBottom: 36 }}>
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
            <ErrorBanner
              animated={false}
              message={error}
              traceId="PG-DASHBOARD-IAM-001::EL-REGION-login-error-banner"
            />
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          noValidate
          data-trace-id="PG-DASHBOARD-IAM-001::EL-FORM-login-form"
        >
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
              data-trace-id="PG-DASHBOARD-IAM-001::EL-INPUT-email"
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
              data-trace-id="PG-DASHBOARD-IAM-001::EL-INPUT-password"
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
            data-trace-id="PG-DASHBOARD-IAM-001::EL-BTN-sign-in"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
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
            {loading && (
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-block',
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,0.35)',
                  borderTopColor: 'currentColor',
                  animation: 'mr-login-spin 700ms linear infinite',
                }}
              />
            )}
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

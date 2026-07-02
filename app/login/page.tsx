'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { apiLogin } from '@/lib/api/auth';
import type { ApiError } from '@/lib/api/client';

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
      router.push('/dashboard');
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
        background: '#F6F2E9',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Inter Tight', sans-serif",
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          padding: '40px',
          width: '100%',
          maxWidth: 400,
          boxShadow: '0 6px 14px rgba(11,11,11,0.10), 0 12px 28px rgba(11,11,11,0.08)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontWeight: 500,
              fontSize: 28,
              color: '#95783C',
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
              color: '#8A8376',
              marginTop: 6,
            }}
          >
            Admin
          </div>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              background: '#FADDDE',
              color: '#8E1418',
              borderRadius: 8,
              padding: '10px 14px',
              fontFamily: "'Inter Tight', sans-serif",
              fontSize: 13,
              marginBottom: 20,
            }}
          >
            {error}
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
                color: '#5C564C',
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
                borderBottom: '1px solid #CFC3A4',
                padding: '10px 0',
                fontFamily: "'Inter Tight', sans-serif",
                fontSize: 14,
                color: '#0B0B0B',
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
                color: '#5C564C',
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
                borderBottom: '1px solid #CFC3A4',
                padding: '10px 0',
                fontFamily: "'Inter Tight', sans-serif",
                fontSize: 14,
                color: '#0B0B0B',
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
  );
}

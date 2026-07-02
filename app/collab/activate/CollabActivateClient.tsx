'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiActivateCollaborator } from '@/lib/api/collab-portal';
import type { ApiError } from '@/lib/api/client';

export default function CollabActivateClient() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (!token) {
      setError('Missing activation token — use the link from your invitation email.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await apiActivateCollaborator(token, password);
      router.push('/login?activated=1');
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'Activation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="collab-activate-shell">
      <div className="collab-activate-card dash-card">
        <h1 className="dash-page-title" style={{ fontSize: '1.35rem' }}>
          Activate partner account
        </h1>
        <p className="dash-page-subtitle" style={{ marginTop: 8 }}>
          Set a password to access your MiniRue brand workspace.
        </p>

        <form onSubmit={onSubmit} className="collab-activate-form">
          <div className="dash-field">
            <label className="dash-label" htmlFor="activate-password">
              Password
            </label>
            <input
              id="activate-password"
              type="password"
              className="dash-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              disabled={loading}
            />
          </div>
          <div className="dash-field">
            <label className="dash-label" htmlFor="activate-confirm">
              Confirm password
            </label>
            <input
              id="activate-confirm"
              type="password"
              className="dash-input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              disabled={loading}
            />
          </div>
          {error ? (
          <p className="dash-inline-error" role="alert" id="activate-error">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          className="dash-btn-primary"
          disabled={loading}
          aria-describedby={error ? 'activate-error' : undefined}
        >
            {loading ? 'Activating…' : 'Activate account'}
          </button>
        </form>

        <p className="collab-activate-footer">
          Already activated?{' '}
          <Link href="/login" className="dash-link">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}

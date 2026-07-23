'use client';

import React, { useEffect, useState } from 'react';
import {
  listSuperAdmins,
  createSuperAdmin,
  type SuperAdminSummary,
} from '@/lib/api/platform';
import type { ApiError } from '@/lib/api/client';

const TRACE = 'PG-DASHBOARD-SET-003';

/**
 * Creates the super admin account from Settings.
 * specs/2026-07-22-platform-reset
 *
 * Exists because there was previously no way to make one without a database
 * terminal — registration always produces a customer, and the row cannot be
 * written by hand since the password is hashed and the email is encrypted.
 *
 * You retype your own password to confirm. Being signed in is not enough to
 * create an account that can erase the shop.
 */
export default function SuperAdminPanel() {
  const [existing, setExisting] = useState<SuperAdminSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listSuperAdmins()
      .then((rows) => {
        if (!cancelled) setExisting(rows);
      })
      .catch(() => {
        // 403 is the normal answer for anyone below owner — hide rather than
        // show a locked box.
        if (!cancelled) setUnavailable(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setDone(null);
    try {
      const created = await createSuperAdmin({
        email: email.trim(),
        password,
        name: name.trim() || undefined,
        confirmPassword,
      });
      setExisting((prev) => [...prev, created]);
      setDone(
        `${created.name || 'Super admin'} is ready. Sign in with that email.`,
      );
      setEmail('');
      setName('');
      setPassword('');
      setConfirmPassword('');
    } catch (e) {
      setError((e as ApiError).message ?? 'Could not create the account.');
    } finally {
      setSaving(false);
    }
  }

  if (loading || unavailable) return null;

  return (
    <section
      className="dash-card"
      style={{ marginTop: 32 }}
      data-trace-id={`${TRACE}::EL-REGION-super-admin`}
    >
      <h2 style={{ marginTop: 0 }}>Super admin</h2>

      <p className="dash-muted">
        A super admin can do everything you can, plus erase shop data from this
        page. Sign-in accounts are never removed by that, so everyone can still
        log in afterwards.
      </p>

      {existing.length > 0 ? (
        <p>
          Current:{' '}
          {existing.map((s) => s.name || s.id.slice(0, 8)).join(', ')}
        </p>
      ) : (
        <p className="dash-muted">There is no super admin yet.</p>
      )}

      <form onSubmit={handleSubmit} style={{ marginTop: 16, maxWidth: 420 }}>
        <div className="dash-field">
          <label className="dash-label" htmlFor="sa-email">
            Email <span className="dash-required">*</span>
          </label>
          <input
            id="sa-email"
            className="dash-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={saving}
            autoComplete="off"
            required
            data-trace-id={`${TRACE}::EL-INPUT-email`}
          />
          <p className="dash-help-text">
            If this email already has an account, it is promoted instead of a
            second one being made.
          </p>
        </div>

        <div className="dash-field">
          <label className="dash-label" htmlFor="sa-name">
            Name
          </label>
          <input
            id="sa-name"
            className="dash-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Super Admin"
            disabled={saving}
            data-trace-id={`${TRACE}::EL-INPUT-name`}
          />
        </div>

        <div className="dash-field">
          <label className="dash-label" htmlFor="sa-password">
            Password for the new account{' '}
            <span className="dash-required">*</span>
          </label>
          <input
            id="sa-password"
            className="dash-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={saving}
            autoComplete="new-password"
            minLength={10}
            required
            data-trace-id={`${TRACE}::EL-INPUT-password`}
          />
          <p className="dash-help-text">At least 10 characters.</p>
        </div>

        <div className="dash-field">
          <label className="dash-label" htmlFor="sa-confirm">
            Your own password <span className="dash-required">*</span>
          </label>
          <input
            id="sa-confirm"
            className="dash-input"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={saving}
            autoComplete="current-password"
            required
            data-trace-id={`${TRACE}::EL-INPUT-confirm`}
          />
          <p className="dash-help-text">
            Confirms it is really you — this account can erase shop data.
          </p>
        </div>

        {error && <p className="dash-inline-error">{error}</p>}
        {done && <p data-trace-id={`${TRACE}::EL-TEXT-created`}>{done}</p>}

        <button
          type="submit"
          className="dash-btn-primary"
          disabled={saving || !email.trim() || !password || !confirmPassword}
          data-trace-id={`${TRACE}::EL-BTN-create`}
        >
          {saving ? 'Creating…' : 'Create super admin'}
        </button>
      </form>
    </section>
  );
}

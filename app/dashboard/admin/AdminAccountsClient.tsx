'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  listAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  signInAsAccount,
  type AccountSummary,
} from '@/lib/api/platform';
import type { ApiError } from '@/lib/api/client';
import { Role, ASSIGNABLE_ROLES, roleLabel, roleDescription } from '@/lib/auth/role';
import { beginActingAs } from '@/lib/auth/acting-session';

const TRACE = 'PG-DASHBOARD-ADM-001';

type Dialog =
  | { kind: 'none' }
  | { kind: 'edit'; account: AccountSummary }
  | { kind: 'password'; account: AccountSummary }
  | { kind: 'delete'; account: AccountSummary }
  | { kind: 'signInAs'; account: AccountSummary };

/**
 * Accounts — create, edit, delete and sign in as any account.
 * specs/2026-07-23-account-administration
 *
 * Super admin only. The server refuses every call here for anyone else; the
 * tab being hidden in the sidebar is presentation, never the permission.
 */
export default function AdminAccountsClient() {
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | ''>('');
  const [statusFilter, setStatusFilter] = useState<'' | 'ACTIVE' | 'SUSPENDED'>('');

  const [dialog, setDialog] = useState<Dialog>({ kind: 'none' });
  const [notice, setNotice] = useState<string | null>(null);

  const LIMIT = 25;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await listAccounts({
        search: search.trim() || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
        page,
        limit: LIMIT,
      });
      setAccounts(res.data);
      setTotal(res.total);
    } catch (e) {
      setLoadError((e as ApiError).message ?? 'Could not load accounts.');
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, statusFilter, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const pageCount = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div data-trace-id={`${TRACE}::EL-REGION-accounts`}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ marginBottom: 8 }}>Accounts</h1>
        <p className="dash-muted" style={{ maxWidth: 640 }}>
          Everyone who can sign in, at any level. Create accounts, change what
          they are allowed to do, remove them, or open the dashboard as them to
          see exactly what they see.
        </p>
      </header>

      {notice && (
        <p className="dash-inline-ok" data-trace-id={`${TRACE}::EL-TEXT-notice`}>
          {notice}
        </p>
      )}

      <CreateAccountForm
        onCreated={(account) => {
          setNotice(`${account.name} can now sign in as ${roleLabel(account.role)}.`);
          void load();
        }}
      />

      <section className="dash-card" style={{ marginTop: 32 }}>
        <h2 style={{ marginTop: 0 }}>All accounts</h2>

        <div
          style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            marginBottom: 16,
          }}
        >
          <div className="dash-field" style={{ marginBottom: 0, minWidth: 220, maxWidth: '100%' }}>
            <label className="dash-label" htmlFor="acc-search">
              Search by name
            </label>
            <input
              id="acc-search"
              className="dash-input"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              placeholder="e.g. Sara"
              data-trace-id={`${TRACE}::EL-INPUT-search`}
            />
            <p className="dash-help-text">
              Email addresses are stored encrypted, so only a whole address can
              be looked up — not part of one.
            </p>
          </div>

          <div className="dash-field" style={{ marginBottom: 0 }}>
            <label className="dash-label" htmlFor="acc-role">
              Role
            </label>
            <select
              id="acc-role"
              className="dash-select"
              value={roleFilter}
              onChange={(e) => {
                setPage(1);
                setRoleFilter(e.target.value as Role | '');
              }}
              data-trace-id={`${TRACE}::EL-SELECT-role-filter`}
            >
              <option value="">Any role</option>
              <option value={Role.SUPERADMIN}>{roleLabel(Role.SUPERADMIN)}</option>
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>
          </div>

          <div className="dash-field" style={{ marginBottom: 0 }}>
            <label className="dash-label" htmlFor="acc-status">
              Status
            </label>
            <select
              id="acc-status"
              className="dash-select"
              value={statusFilter}
              onChange={(e) => {
                setPage(1);
                setStatusFilter(e.target.value as '' | 'ACTIVE' | 'SUSPENDED');
              }}
              data-trace-id={`${TRACE}::EL-SELECT-status-filter`}
            >
              <option value="">Any status</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>
        </div>

        {loadError && <p className="dash-inline-error">{loadError}</p>}

        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col">Role</th>
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="dash-table-empty">
                    Loading…
                  </td>
                </tr>
              )}

              {!loading && accounts.length === 0 && (
                <tr>
                  <td colSpan={5} className="dash-table-empty">
                    No accounts match those filters.
                  </td>
                </tr>
              )}

              {!loading &&
                accounts.map((account) => (
                  <tr key={account.id} className="dash-table-row-hover">
                    <td>
                      {account.name || '—'}
                      {account.isSelf && (
                        <span className="dash-muted"> (you)</span>
                      )}
                    </td>
                    <td>{account.email}</td>
                    <td>{roleLabel(account.role)}</td>
                    <td>
                      {account.status === 'ACTIVE' ? 'Active' : 'Suspended'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="dash-btn-ghost"
                          onClick={() => setDialog({ kind: 'edit', account })}
                          data-trace-id={`${TRACE}::EL-BTN-edit`}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="dash-btn-ghost"
                          onClick={() => setDialog({ kind: 'password', account })}
                          data-trace-id={`${TRACE}::EL-BTN-password`}
                        >
                          Set password
                        </button>
                        {!account.isSelf && (
                          <button
                            type="button"
                            className="dash-btn-secondary"
                            onClick={() =>
                              setDialog({ kind: 'signInAs', account })
                            }
                            data-trace-id={`${TRACE}::EL-BTN-sign-in-as`}
                          >
                            Sign in as
                          </button>
                        )}
                        {!account.isSelf && (
                          <button
                            type="button"
                            className="dash-btn-danger"
                            onClick={() => setDialog({ kind: 'delete', account })}
                            data-trace-id={`${TRACE}::EL-BTN-delete`}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {pageCount > 1 && (
          <div
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              marginTop: 16,
            }}
          >
            <button
              type="button"
              className="dash-btn-ghost"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span className="dash-muted">
              Page {page} of {pageCount} — {total} account
              {total === 1 ? '' : 's'}
            </span>
            <button
              type="button"
              className="dash-btn-ghost"
              disabled={page >= pageCount}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            >
              Next
            </button>
          </div>
        )}
      </section>

      {dialog.kind === 'edit' && (
        <EditAccountDialog
          account={dialog.account}
          onClose={() => setDialog({ kind: 'none' })}
          onSaved={(msg) => {
            setNotice(msg);
            setDialog({ kind: 'none' });
            void load();
          }}
        />
      )}

      {dialog.kind === 'password' && (
        <SetPasswordDialog
          account={dialog.account}
          onClose={() => setDialog({ kind: 'none' })}
          onSaved={(msg) => {
            setNotice(msg);
            setDialog({ kind: 'none' });
            void load();
          }}
        />
      )}

      {dialog.kind === 'delete' && (
        <DeleteAccountDialog
          account={dialog.account}
          onClose={() => setDialog({ kind: 'none' })}
          onDeleted={(msg) => {
            setNotice(msg);
            setDialog({ kind: 'none' });
            void load();
          }}
        />
      )}

      {dialog.kind === 'signInAs' && (
        <SignInAsDialog
          account={dialog.account}
          onClose={() => setDialog({ kind: 'none' })}
          onStarted={() => {
            // A full reload is deliberate: every cached query, the sidebar and
            // the role brief were all built for the previous account.
            window.location.href = '/overview';
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

function CreateAccountForm({
  onCreated,
}: {
  onCreated: (account: AccountSummary) => void;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>(Role.STAFF);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsConfirm = role === Role.SUPERADMIN;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await createAccount({
        email: email.trim(),
        password,
        name: name.trim(),
        role,
        confirmPassword: needsConfirm ? confirmPassword : undefined,
      });
      setEmail('');
      setName('');
      setPassword('');
      setConfirmPassword('');
      setRole(Role.STAFF);
      setOpen(false);
      onCreated(created);
    } catch (e) {
      setError((e as ApiError).message ?? 'Could not create the account.');
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className="dash-btn-primary"
        onClick={() => setOpen(true)}
        data-trace-id={`${TRACE}::EL-BTN-open-create`}
      >
        Add an account
      </button>
    );
  }

  return (
    <section className="dash-card">
      <h2 style={{ marginTop: 0 }}>Add an account</h2>
      <form onSubmit={handleSubmit} style={{ maxWidth: 460 }}>
        <div className="dash-field">
          <label className="dash-label" htmlFor="new-email">
            Email <span className="dash-required">*</span>
          </label>
          <input
            id="new-email"
            className="dash-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={saving}
            autoComplete="off"
            required
            data-trace-id={`${TRACE}::EL-INPUT-new-email`}
          />
        </div>

        <div className="dash-field">
          <label className="dash-label" htmlFor="new-name">
            Name <span className="dash-required">*</span>
          </label>
          <input
            id="new-name"
            className="dash-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={saving}
            required
            data-trace-id={`${TRACE}::EL-INPUT-new-name`}
          />
        </div>

        <div className="dash-field">
          <label className="dash-label" htmlFor="new-role">
            What they can do <span className="dash-required">*</span>
          </label>
          <select
            id="new-role"
            className="dash-select"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            disabled={saving}
            data-trace-id={`${TRACE}::EL-SELECT-new-role`}
          >
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {roleLabel(r)}
              </option>
            ))}
            <option value={Role.SUPERADMIN}>{roleLabel(Role.SUPERADMIN)}</option>
          </select>
          <p className="dash-help-text">{roleDescription(role)}</p>
        </div>

        <div className="dash-field">
          <label className="dash-label" htmlFor="new-password">
            Password for the new account <span className="dash-required">*</span>
          </label>
          <input
            id="new-password"
            className="dash-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={saving}
            autoComplete="new-password"
            minLength={10}
            required
            data-trace-id={`${TRACE}::EL-INPUT-new-password`}
          />
          <p className="dash-help-text">At least 10 characters.</p>
        </div>

        {needsConfirm && (
          <div className="dash-field">
            <label className="dash-label" htmlFor="new-confirm">
              Your own password <span className="dash-required">*</span>
            </label>
            <input
              id="new-confirm"
              className="dash-input"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={saving}
              autoComplete="current-password"
              required
              data-trace-id={`${TRACE}::EL-INPUT-new-confirm`}
            />
            <p className="dash-help-text">
              Confirms it is really you — a super admin can erase shop data.
            </p>
          </div>
        )}

        {error && <p className="dash-inline-error">{error}</p>}

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            type="submit"
            className="dash-btn-primary"
            disabled={saving || !email.trim() || !name.trim() || !password}
            data-trace-id={`${TRACE}::EL-BTN-create`}
          >
            {saving ? 'Creating…' : 'Create account'}
          </button>
          <button
            type="button"
            className="dash-btn-ghost"
            onClick={() => setOpen(false)}
            disabled={saving}
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Dialogs
// ---------------------------------------------------------------------------

function DialogShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="dash-card" style={{ marginTop: 24 }}>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      {children}
    </section>
  );
}

function EditAccountDialog({
  account,
  onClose,
  onSaved,
}: {
  account: AccountSummary;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [name, setName] = useState(account.name);
  const [email, setEmail] = useState(account.email);
  const [role, setRole] = useState<Role>(account.role);
  const [status, setStatus] = useState(account.status);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roleChanged = role !== account.role;
  const needsConfirm = roleChanged && role === Role.SUPERADMIN;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await updateAccount(account.id, {
        name: name.trim() !== account.name ? name.trim() : undefined,
        email: email.trim() !== account.email ? email.trim() : undefined,
        role: roleChanged ? role : undefined,
        status: status !== account.status ? status : undefined,
        confirmPassword: needsConfirm ? confirmPassword : undefined,
      });
      onSaved(`${name.trim() || 'That account'} was updated.`);
    } catch (e) {
      setError((e as ApiError).message ?? 'Could not save the changes.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogShell title={`Edit ${account.name || account.email}`}>
      <form onSubmit={handleSubmit} style={{ maxWidth: 460 }}>
        <div className="dash-field">
          <label className="dash-label" htmlFor="edit-name">
            Name
          </label>
          <input
            id="edit-name"
            className="dash-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={saving}
            data-trace-id={`${TRACE}::EL-INPUT-edit-name`}
          />
        </div>

        <div className="dash-field">
          <label className="dash-label" htmlFor="edit-email">
            Email
          </label>
          <input
            id="edit-email"
            className="dash-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={saving}
            data-trace-id={`${TRACE}::EL-INPUT-edit-email`}
          />
          <p className="dash-help-text">
            This is the address they sign in with. Changing it signs them out.
          </p>
        </div>

        <div className="dash-field">
          <label className="dash-label" htmlFor="edit-role">
            What they can do
          </label>
          <select
            id="edit-role"
            className="dash-select"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            disabled={saving || account.isSelf}
            data-trace-id={`${TRACE}::EL-SELECT-edit-role`}
          >
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {roleLabel(r)}
              </option>
            ))}
            <option value={Role.SUPERADMIN}>{roleLabel(Role.SUPERADMIN)}</option>
          </select>
          <p className="dash-help-text">
            {account.isSelf
              ? 'You cannot change your own role — ask another super admin to do it.'
              : roleDescription(role)}
          </p>
        </div>

        <div className="dash-field">
          <label className="dash-label" htmlFor="edit-status">
            Status
          </label>
          <select
            id="edit-status"
            className="dash-select"
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as 'ACTIVE' | 'SUSPENDED')
            }
            disabled={saving || account.isSelf}
            data-trace-id={`${TRACE}::EL-SELECT-edit-status`}
          >
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
          <p className="dash-help-text">
            A suspended account keeps everything it has but cannot sign in.
          </p>
        </div>

        {needsConfirm && (
          <div className="dash-field">
            <label className="dash-label" htmlFor="edit-confirm">
              Your own password <span className="dash-required">*</span>
            </label>
            <input
              id="edit-confirm"
              className="dash-input"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={saving}
              autoComplete="current-password"
              required
              data-trace-id={`${TRACE}::EL-INPUT-edit-confirm`}
            />
            <p className="dash-help-text">
              Confirms it is really you — a super admin can erase shop data.
            </p>
          </div>
        )}

        {error && <p className="dash-inline-error">{error}</p>}

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            type="submit"
            className="dash-btn-primary"
            disabled={saving}
            data-trace-id={`${TRACE}::EL-BTN-save-edit`}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button
            type="button"
            className="dash-btn-ghost"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
        </div>
      </form>
    </DialogShell>
  );
}

function SetPasswordDialog({
  account,
  onClose,
  onSaved,
}: {
  account: AccountSummary;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await updateAccount(account.id, { password, confirmPassword });
      onSaved(
        `Password set for ${account.name || account.email}. They were signed out everywhere.`,
      );
    } catch (e) {
      setError((e as ApiError).message ?? 'Could not set the password.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogShell title={`Set a password for ${account.name || account.email}`}>
      <p className="dash-muted" style={{ maxWidth: 460 }}>
        This replaces whatever they had. Everywhere they are currently signed in
        gets signed out, so tell them the new password yourself.
      </p>
      <form onSubmit={handleSubmit} style={{ maxWidth: 460 }}>
        <div className="dash-field">
          <label className="dash-label" htmlFor="pw-new">
            New password <span className="dash-required">*</span>
          </label>
          <input
            id="pw-new"
            className="dash-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={saving}
            autoComplete="new-password"
            minLength={10}
            required
            data-trace-id={`${TRACE}::EL-INPUT-pw-new`}
          />
          <p className="dash-help-text">At least 10 characters.</p>
        </div>

        <div className="dash-field">
          <label className="dash-label" htmlFor="pw-confirm">
            Your own password <span className="dash-required">*</span>
          </label>
          <input
            id="pw-confirm"
            className="dash-input"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={saving}
            autoComplete="current-password"
            required
            data-trace-id={`${TRACE}::EL-INPUT-pw-confirm`}
          />
        </div>

        {error && <p className="dash-inline-error">{error}</p>}

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            type="submit"
            className="dash-btn-primary"
            disabled={saving || !password || !confirmPassword}
            data-trace-id={`${TRACE}::EL-BTN-save-password`}
          >
            {saving ? 'Saving…' : 'Set password'}
          </button>
          <button
            type="button"
            className="dash-btn-ghost"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
        </div>
      </form>
    </DialogShell>
  );
}

function DeleteAccountDialog({
  account,
  onClose,
  onDeleted,
}: {
  account: AccountSummary;
  onClose: () => void;
  onDeleted: (message: string) => void;
}) {
  const [confirmPassword, setConfirmPassword] = useState('');
  const [typedEmail, setTypedEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailMatches = typedEmail.trim().toLowerCase() === account.email.toLowerCase();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await deleteAccount(account.id, confirmPassword);
      onDeleted(`${account.name || account.email} was deleted.`);
    } catch (e) {
      setError((e as ApiError).message ?? 'Could not delete the account.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogShell title={`Delete ${account.name || account.email}`}>
      <p style={{ maxWidth: 520 }}>
        This removes the account for good — there is no undo and no restore.
        Their orders stay in the shop&apos;s records under their name, so your
        sales history does not change.
      </p>
      <form onSubmit={handleSubmit} style={{ maxWidth: 460 }}>
        <div className="dash-field">
          <label className="dash-label" htmlFor="del-email">
            Type their email to confirm <span className="dash-required">*</span>
          </label>
          <input
            id="del-email"
            className="dash-input"
            value={typedEmail}
            onChange={(e) => setTypedEmail(e.target.value)}
            disabled={saving}
            autoComplete="off"
            placeholder={account.email}
            data-trace-id={`${TRACE}::EL-INPUT-del-email`}
          />
        </div>

        <div className="dash-field">
          <label className="dash-label" htmlFor="del-confirm">
            Your own password <span className="dash-required">*</span>
          </label>
          <input
            id="del-confirm"
            className="dash-input"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={saving}
            autoComplete="current-password"
            required
            data-trace-id={`${TRACE}::EL-INPUT-del-confirm`}
          />
        </div>

        {error && <p className="dash-inline-error">{error}</p>}

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            type="submit"
            className="dash-btn-danger"
            disabled={saving || !emailMatches || !confirmPassword}
            data-trace-id={`${TRACE}::EL-BTN-confirm-delete`}
          >
            {saving ? 'Deleting…' : 'Delete for good'}
          </button>
          <button
            type="button"
            className="dash-btn-ghost"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
        </div>
      </form>
    </DialogShell>
  );
}

function SignInAsDialog({
  account,
  onClose,
  onStarted,
}: {
  account: AccountSummary;
  onClose: () => void;
  onStarted: () => void;
}) {
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const result = await signInAsAccount(account.id, confirmPassword);
      beginActingAs(result.accessToken, result.expiresIn, result.actingAs);
      onStarted();
    } catch (e) {
      setError((e as ApiError).message ?? 'Could not start that session.');
      setSaving(false);
    }
  }

  return (
    <DialogShell title={`Sign in as ${account.name || account.email}`}>
      <p style={{ maxWidth: 520 }}>
        The dashboard will look exactly as it does for them, with only what they
        are allowed to see. Your own session is kept safe and a bar at the top
        lets you switch back at any time. It also ends by itself after a while.
      </p>
      <p className="dash-muted" style={{ maxWidth: 520 }}>
        Anything you do while signed in as them is recorded against your account
        as well as theirs.
      </p>
      <form onSubmit={handleSubmit} style={{ maxWidth: 460 }}>
        <div className="dash-field">
          <label className="dash-label" htmlFor="sia-confirm">
            Your own password <span className="dash-required">*</span>
          </label>
          <input
            id="sia-confirm"
            className="dash-input"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={saving}
            autoComplete="current-password"
            required
            data-trace-id={`${TRACE}::EL-INPUT-sia-confirm`}
          />
        </div>

        {error && <p className="dash-inline-error">{error}</p>}

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            type="submit"
            className="dash-btn-primary"
            disabled={saving || !confirmPassword}
            data-trace-id={`${TRACE}::EL-BTN-confirm-sign-in-as`}
          >
            {saving ? 'Switching…' : 'Sign in as them'}
          </button>
          <button
            type="button"
            className="dash-btn-ghost"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
        </div>
      </form>
    </DialogShell>
  );
}

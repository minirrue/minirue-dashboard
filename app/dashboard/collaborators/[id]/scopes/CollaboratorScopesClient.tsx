'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  CollabEmptyState,
  CollabErrorPanel,
  CollabLoadingBlock,
  CollabPageHeader,
  CollabTableCard,
} from '@/components/collab/collab-ui';
import {
  apiAssignCollaboratorScope,
  apiListCollaboratorScopes,
  type CollaboratorScope,
} from '@/lib/api/collaborators';
import type { ApiError } from '@/lib/api/client';

export default function CollaboratorScopesClient() {
  const params = useParams();
  const id = params.id as string;
  const [scopes, setScopes] = useState<CollaboratorScope[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAssign, setShowAssign] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [blockKey, setBlockKey] = useState('');
  const [canEdit, setCanEdit] = useState(false);
  const [requiresApproval, setRequiresApproval] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiListCollaboratorScopes(id);
      setScopes(res.items);
    } catch (e) {
      const err = e as ApiError;
      setError(err.message || 'Failed to load scopes');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    setAssigning(true);
    setAssignError(null);
    try {
      await apiAssignCollaboratorScope(id, {
        blockKey: blockKey.trim(),
        canEdit,
        requiresApproval,
      });
      setShowAssign(false);
      setBlockKey('');
      setCanEdit(false);
      setRequiresApproval(true);
      await load();
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 409) {
        setAssignError('Scope with this block key already exists');
      } else {
        setAssignError(err.message || 'Failed to assign scope');
      }
    } finally {
      setAssigning(false);
    }
  }

  function resetAssignForm() {
    setShowAssign(false);
    setAssignError(null);
    setBlockKey('');
    setCanEdit(false);
    setRequiresApproval(true);
  }

  return (
    <>
      <CollabPageHeader
        title="Scopes"
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="dash-btn-primary"
              onClick={() => setShowAssign(true)}
            >
              + Assign
            </button>
            <Link href={`/dashboard/collaborators/${id}`} className="dash-btn-ghost">
              Back to collaborator
            </Link>
          </div>
        }
      />

      {loading ? (
        <CollabLoadingBlock lines={3} />
      ) : error ? (
        <CollabErrorPanel
          message={error}
          action={
            <button type="button" className="dash-btn-primary" onClick={() => void load()}>
              Retry
            </button>
          }
        />
      ) : scopes.length === 0 ? (
        <CollabEmptyState
          title="No scopes assigned yet"
          copy="Add the first scope to get started."
          action={
            <button type="button" className="dash-btn-primary" onClick={() => setShowAssign(true)}>
              + Assign
            </button>
          }
        />
      ) : (
        <CollabTableCard>
          <table className="dash-table">
            <thead>
              <tr>
                <th>Block Key</th>
                <th>Can Edit</th>
                <th>Requires Approval</th>
              </tr>
            </thead>
            <tbody>
              {scopes.map((scope) => (
                <tr key={scope.blockKey}>
                  <td><code>{scope.blockKey}</code></td>
                  <td>{scope.canEdit ? 'Yes' : 'No'}</td>
                  <td>{scope.requiresApproval ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CollabTableCard>
      )}

      {showAssign ? (
        <form className="dash-form-card" onSubmit={handleAssign} style={{ marginTop: 16 }}>
          <h2 className="dash-card-title">Assign scope</h2>
          <div className="dash-field">
            <label className="dash-label" htmlFor="blockKey">Block key</label>
            <input
              id="blockKey"
              className="dash-input"
              value={blockKey}
              onChange={(e) => setBlockKey(e.target.value)}
              required
              minLength={2}
              maxLength={120}
              disabled={assigning}
            />
          </div>
          <label className="dash-checkbox-label">
            <input
              type="checkbox"
              className="dash-checkbox"
              checked={canEdit}
              onChange={(e) => setCanEdit(e.target.checked)}
              disabled={assigning}
            />
            Can edit
          </label>
          <label className="dash-checkbox-label">
            <input
              type="checkbox"
              className="dash-checkbox"
              checked={requiresApproval}
              onChange={(e) => setRequiresApproval(e.target.checked)}
              disabled={assigning}
            />
            Requires approval
          </label>
          {assignError ? <p className="dash-inline-error">{assignError}</p> : null}
          <div className="dash-form-actions">
            <button type="submit" className="dash-btn-primary" disabled={assigning}>
              {assigning ? 'Assigning…' : 'Assign'}
            </button>
            <button type="button" className="dash-btn-ghost" onClick={resetAssignForm}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </>
  );
}

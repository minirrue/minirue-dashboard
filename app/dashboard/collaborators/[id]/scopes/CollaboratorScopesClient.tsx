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
              data-trace-id="PG-DASHBOARD-COLLAB-009::EL-BTN-scopes-assign-open"
            >
              + Assign
            </button>
            <Link
              href={`/dashboard/collaborators/${id}`}
              className="dash-btn-ghost"
              data-trace-id="PG-DASHBOARD-COLLAB-009::EL-LINK-scopes-back"
            >
              Back to collaborator
            </Link>
          </div>
        }
      />

      {loading ? (
        <CollabLoadingBlock lines={3} traceId="PG-DASHBOARD-COLLAB-009::EL-REGION-scopes-loading" />
      ) : error ? (
        <CollabErrorPanel
          message={error}
          traceId="PG-DASHBOARD-COLLAB-009::EL-REGION-scopes-error"
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
          traceId="PG-DASHBOARD-COLLAB-009::EL-REGION-scopes-empty"
          action={
            <button type="button" className="dash-btn-primary" onClick={() => setShowAssign(true)}>
              + Assign
            </button>
          }
        />
      ) : (
        <CollabTableCard traceId="PG-DASHBOARD-COLLAB-009::EL-TABLE-scopes-table">
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
                <tr
                  key={scope.blockKey}
                  data-trace-id={`PG-DASHBOARD-COLLAB-009::EL-ROW-scope-row@${scope.blockKey}`}
                >
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
        <form
          className="dash-form-card"
          onSubmit={handleAssign}
          style={{ marginTop: 16 }}
          data-trace-id="PG-DASHBOARD-COLLAB-009::EL-FORM-scopes-assign-form"
        >
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
              data-trace-id="PG-DASHBOARD-COLLAB-009::EL-INPUT-scopes-block-key"
            />
          </div>
          <label className="dash-checkbox-label">
            <input
              type="checkbox"
              className="dash-checkbox"
              checked={canEdit}
              onChange={(e) => setCanEdit(e.target.checked)}
              disabled={assigning}
              data-trace-id="PG-DASHBOARD-COLLAB-009::EL-CHECK-scopes-can-edit"
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
              data-trace-id="PG-DASHBOARD-COLLAB-009::EL-CHECK-scopes-requires-approval"
            />
            Requires approval
          </label>
          {assignError ? <p className="dash-inline-error">{assignError}</p> : null}
          <div className="dash-form-actions">
            <button
              type="submit"
              className="dash-btn-primary"
              disabled={assigning}
              data-trace-id="PG-DASHBOARD-COLLAB-009::EL-BTN-scopes-assign-submit"
            >
              {assigning ? 'Assigning…' : 'Assign'}
            </button>
            <button
              type="button"
              className="dash-btn-ghost"
              onClick={resetAssignForm}
              data-trace-id="PG-DASHBOARD-COLLAB-009::EL-BTN-scopes-assign-cancel"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </>
  );
}

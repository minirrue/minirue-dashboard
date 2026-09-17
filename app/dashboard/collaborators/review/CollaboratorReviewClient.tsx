'use client';



import {FormEvent, useCallback, useState } from 'react';

import Link from 'next/link';

import {

  CollabEmptyState,

  CollabLoadingBlock,

  CollabTableCard,

  formatEgp,

} from '@/components/collab/collab-ui';

import {

  apiApproveCollaboratorProduct,

  apiListPendingReviewProducts,

  apiRejectCollaboratorProduct,

  type PendingReviewProduct,

} from '@/lib/api/collaborators';

import type { ApiError } from '@/lib/api/client';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';
import { ReasonPicker } from '@/components/dashboard/ReasonPicker';
import {
  COLLABORATOR_REJECTION_REASONS,
  legacyReasonText,
  type CollaboratorRejectionReason,
} from '@/lib/reasons/operational';



export default function CollaboratorReviewClient() {

  const [items, setItems] = useState<PendingReviewProduct[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [rejectId, setRejectId] = useState<string | null>(null);

  const [rejectReason, setRejectReason] = useState<CollaboratorRejectionReason>('IMAGE_QUALITY');

  const [rejectReasonNote, setRejectReasonNote] = useState('');

  const [rejectReasonError, setRejectReasonError] = useState<string | undefined>();

  const [acting, setActing] = useState<string | null>(null);



  const load = useCallback(async () => {

    setLoading(true);

    setError(null);

    try {

      const res = await apiListPendingReviewProducts();

      // Guarded: a response missing this key set state to undefined and the
      // next .map()/.reduce() blanked the whole tab. Same bug as Settings
      // and Loyalty had.
      setItems(Array.isArray(res?.items) ? res.items : []);

    } catch (e) {

      const err = e as ApiError;

      setError(err.message || 'Failed to load review queue');

    } finally {

      setLoading(false);

    }

  }, []);



  useMountedEffect(() => {

    void load();

  }, [load]);



  async function onApprove(productId: string) {

    setActing(productId);

    setError(null);

    try {

      await apiApproveCollaboratorProduct(productId);

      await load();

    } catch (e) {

      const err = e as ApiError;

      setError(err.message || 'Approve failed');

    } finally {

      setActing(null);

    }

  }



  async function onReject(e: FormEvent) {

    e.preventDefault();

    if (!rejectId) return;

    if (rejectReason === 'OTHER' && !rejectReasonNote.trim()) {

      setRejectReasonError('Explain the rejection when the reason is Other.');

      return;

    }

    setActing(rejectId);

    setError(null);

    try {

      await apiRejectCollaboratorProduct(

        rejectId,

        legacyReasonText(COLLABORATOR_REJECTION_REASONS, rejectReason, rejectReasonNote),

      );

      setRejectId(null);

      setRejectReason('IMAGE_QUALITY');

      setRejectReasonNote('');

      setRejectReasonError(undefined);

      await load();

    } catch (err) {

      const apiErr = err as ApiError;

      setError(apiErr.message || 'Reject failed');

    } finally {

      setActing(null);

    }

  }



  return (

    <>

      <div className="dash-page-header">

        <div>

          <h1 className="dash-page-title">Product review</h1>

          <p className="dash-page-subtitle">Approve or reject partner listings awaiting trust clearance.</p>

        </div>

        <Link href="/collaborators" className="dash-btn-ghost">

          Back to collaborators

        </Link>

      </div>



      {error ? <p className="dash-inline-error">{error}</p> : null}



      {loading ? (

        <CollabLoadingBlock />

      ) : items.length === 0 ? (

        <CollabEmptyState

          title="No products pending review"

          copy="New submissions from untrusted partners will appear here."

        />

      ) : (

        <CollabTableCard>

          <div className="dash-table-wrap">

          <table className="dash-table">

            <thead>

              <tr>

                <th>Product</th>

                <th>Brand</th>

                <th>Price</th>

                <th>Submitted</th>

                <th />

              </tr>

            </thead>

            <tbody>

              {items.map((row) => (

                <tr key={row.id}>

                  <td>{row.name}</td>

                  <td>

                    <span>{row.brandName}</span>

                    <span className="dash-muted"> · </span>

                    <code className="collab-slug-code">{row.brandSlug}</code>

                  </td>

                  <td>{formatEgp(row.priceAmount)}</td>

                  <td>{new Date(row.submittedAt).toLocaleDateString('en-GB')}</td>

                  <td className="dash-row-actions" style={{ justifyContent: 'flex-end' }}>

                    <button

                      type="button"

                      className="dash-btn-ok"

                      disabled={acting === row.id}

                      onClick={() => void onApprove(row.id)}

                    >

                      Approve

                    </button>

                    <button

                      type="button"

                      className="dash-btn-ghost dash-btn-muted"

                      disabled={acting === row.id}

                      onClick={() => {

                        setRejectId(row.id);

                        setRejectReason('IMAGE_QUALITY');

                        setRejectReasonNote('');

                        setRejectReasonError(undefined);

                      }}

                    >

                      Reject

                    </button>

                  </td>

                </tr>

              ))}

            </tbody>

          </table>

          </div>

        </CollabTableCard>

      )}



      {rejectId ? (

        <form className="dash-form-card collab-reject-form" onSubmit={onReject}>

          <h2 className="dash-card-title">Reject product</h2>

          <ReasonPicker

            label="Reason shown to partner"

            options={COLLABORATOR_REJECTION_REASONS}

            value={rejectReason}

            onChange={(next) => { setRejectReason(next); setRejectReasonError(undefined); }}

            note={rejectReasonNote}

            onNoteChange={(next) => { setRejectReasonNote(next); setRejectReasonError(undefined); }}

            otherValue="OTHER"

            noteLabel="Explain the rejection"

            notePlaceholder="Tell the partner what must change"

            error={rejectReasonError}

          />

          <div className="dash-form-actions">

            <button type="submit" className="dash-btn-danger" disabled={acting === rejectId}>

              Confirm reject

            </button>

            <button type="button" className="dash-btn-ghost" onClick={() => setRejectId(null)}>

              Cancel

            </button>

          </div>

        </form>

      ) : null}

    </>

  );

}


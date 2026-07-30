'use client';

import { FormEvent, useCallback, useState } from 'react';
import {
  CollabEmptyState,
  CollabLoadingBlock,
  CollabTableCard,
} from '@/components/collab/collab-ui';
import StarRating from '@/components/dashboard/StarRating';
import {
  apiApproveReview,
  apiListReviews,
  apiRejectReview,
  type AdminReview,
  type ReviewStatus,
} from '@/lib/api/reviews';
import type { ApiError } from '@/lib/api/client';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';
import { useClearNavBadge } from '@/lib/hooks/use-clear-nav-badge';
import { HREF_CATEGORIES } from '@/lib/notifications/nav-counts';

type Filter = ReviewStatus | 'ALL';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'PENDING', label: 'Waiting for you' },
  { value: 'APPROVED', label: 'On the shop' },
  { value: 'REJECTED', label: 'Turned down' },
  { value: 'ALL', label: 'Everything' },
];

const EMPTY_COPY: Record<Filter, { title: string; copy: string }> = {
  PENDING: {
    title: 'Nothing waiting',
    copy: 'New reviews land here the moment a customer writes one. Nothing reaches a product page until you approve it.',
  },
  APPROVED: {
    title: 'Nothing published yet',
    copy: 'Reviews you approve show up here, and on the product page.',
  },
  REJECTED: {
    title: 'Nothing turned down',
    copy: 'Reviews you reject stay here with the reason you gave.',
  },
  ALL: {
    title: 'No reviews yet',
    copy: 'Only customers who have received a product can review it, so the first reviews arrive after the first deliveries.',
  },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function ReviewsClient() {
  // Reviews has no notification category of its own yet — '/reviews' is not
  // in HREF_CATEGORIES and there is no REVIEW entry in the backend's
  // NotificationCategory enum, so reviews never produce admin notifications
  // today. This is a no-op until that exists; see the task report for why it
  // is still wired here rather than left out.
  useClearNavBadge(HREF_CATEGORIES['/reviews'] ?? []);
  const [filter, setFilter] = useState<Filter>('PENDING');
  const [items, setItems] = useState<AdminReview[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [acting, setActing] = useState<string | null>(null);
  // A failed video load and a healthy-but-unstarted one look identical — both
  // are just the poster-less black rectangle until the play button is hit.
  // Tracking failures per media id turns "presigned URL broken" into
  // something visible on this page instead of only discoverable by clicking
  // play and getting nothing.
  const [failedMedia, setFailedMedia] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiListReviews(
        filter === 'ALL' ? {} : { status: filter },
      );
      // Guarded: a response missing this key set state to undefined and the
      // next .map() blanked the whole tab — the same bug Settings and Loyalty
      // both had.
      setItems(Array.isArray(res?.items) ? res.items : []);
      setTotal(typeof res?.total === 'number' ? res.total : 0);
    } catch (e) {
      const err = e as ApiError;
      setError(err.message || 'Could not load reviews');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useMountedEffect(() => {
    void load();
  }, [load]);

  async function onApprove(id: string) {
    setActing(id);
    setError(null);
    try {
      await apiApproveReview(id);
      await load();
    } catch (e) {
      setError((e as ApiError).message || 'Could not approve that review');
    } finally {
      setActing(null);
    }
  }

  async function onReject(e: FormEvent) {
    e.preventDefault();
    if (!rejectId || !rejectReason.trim()) return;
    setActing(rejectId);
    setError(null);
    try {
      await apiRejectReview(rejectId, rejectReason.trim());
      setRejectId(null);
      setRejectReason('');
      await load();
    } catch (err) {
      setError((err as ApiError).message || 'Could not turn down that review');
    } finally {
      setActing(null);
    }
  }

  const empty = EMPTY_COPY[filter];

  return (
    <>
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Reviews</h1>
          <p className="dash-page-subtitle">
            Nothing a customer writes appears on a product page until you approve
            it here. Only people who have received the product can write one.
          </p>
        </div>
      </div>

      <div className="dash-filters">
        <label className="dash-label" htmlFor="review-status">
          Show
        </label>
        <select
          id="review-status"
          className="dash-input"
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
        >
          {FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        {!loading && items.length > 0 ? (
          <span className="dash-muted">
            {total} {total === 1 ? 'review' : 'reviews'}
          </span>
        ) : null}
      </div>

      {error ? <p className="dash-inline-error">{error}</p> : null}

      {loading ? (
        <CollabLoadingBlock />
      ) : items.length === 0 ? (
        <CollabEmptyState title={empty.title} copy={empty.copy} />
      ) : (
        <CollabTableCard>
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Rating</th>
                  <th>What they wrote</th>
                  <th>Written</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <StarRating value={row.rating} />
                      {row.verifiedPurchase ? (
                        <div
                          className="dash-muted"
                          style={{ fontSize: 'var(--mr-text-xs)', marginTop: 4 }}
                        >
                          Verified purchase
                        </div>
                      ) : null}
                    </td>
                    <td>
                      {row.title ? (
                        <div style={{ fontWeight: 500 }}>{row.title}</div>
                      ) : null}
                      {row.body ? (
                        <div className="dash-muted" style={{ maxWidth: '48ch' }}>
                          {row.body}
                        </div>
                      ) : !row.title && !row.media?.length ? (
                        <span className="dash-muted">Stars only, no words.</span>
                      ) : null}
                      {row.media?.length ? (
                        <div
                          style={{
                            display: 'flex',
                            gap: 8,
                            flexWrap: 'wrap',
                            marginTop: 10,
                          }}
                        >
                          {row.media.map((m) =>
                            m.url ? (
                              m.kind === 'IMAGE' ? (
                                // Opens full size, because deciding from a
                                // 72px square is deciding from nothing.
                                <a
                                  key={m.id}
                                  href={m.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  title="Open full size"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={m.url}
                                    alt="Attached by the customer"
                                    width={72}
                                    height={72}
                                    style={{
                                      objectFit: 'cover',
                                      borderRadius: 'var(--mr-radius-sm)',
                                      border: '1px solid var(--mr-dash-hair)',
                                      display: 'block',
                                    }}
                                  />
                                </a>
                              ) : failedMedia[m.id] ? (
                                <span
                                  key={m.id}
                                  className="dash-muted"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    width: 128,
                                    height: 72,
                                    borderRadius: 'var(--mr-radius-sm)',
                                    border: '1px solid var(--mr-dash-hair)',
                                    padding: '0 8px',
                                    fontSize: 'var(--mr-text-xs)',
                                  }}
                                >
                                  This video could not be loaded.
                                </span>
                              ) : (
                                <video
                                  key={m.id}
                                  src={m.url}
                                  controls
                                  playsInline
                                  preload="metadata"
                                  width={128}
                                  onError={() =>
                                    setFailedMedia((f) => ({ ...f, [m.id]: true }))
                                  }
                                  style={{
                                    height: 72,
                                    borderRadius: 'var(--mr-radius-sm)',
                                    border: '1px solid var(--mr-dash-hair)',
                                    background: 'var(--mr-ink-900)',
                                  }}
                                />
                              )
                            ) : (
                              <span
                                key={m.id}
                                className="dash-muted"
                                style={{ fontSize: 'var(--mr-text-xs)' }}
                              >
                                An attachment could not be loaded.
                              </span>
                            ),
                          )}
                        </div>
                      ) : null}
                      {row.status === 'REJECTED' && row.rejectionReason ? (
                        <div
                          className="dash-muted"
                          style={{ marginTop: 6, fontSize: 'var(--mr-text-xs)' }}
                        >
                          Turned down: {row.rejectionReason}
                        </div>
                      ) : null}
                    </td>
                    <td>{formatDate(row.createdAt)}</td>
                    <td
                      className="dash-row-actions"
                      style={{ justifyContent: 'flex-end' }}
                    >
                      {/* An approved review can still be pulled, and a rejected
                          one can still be let through — moderation is a
                          decision, not a one-way door. */}
                      {row.status !== 'APPROVED' ? (
                        <button
                          type="button"
                          className="dash-btn-ok"
                          disabled={acting === row.id}
                          onClick={() => void onApprove(row.id)}
                        >
                          {row.status === 'REJECTED' ? 'Let it through' : 'Approve'}
                        </button>
                      ) : null}
                      {row.status !== 'REJECTED' ? (
                        <button
                          type="button"
                          className="dash-btn-ghost dash-btn-muted"
                          disabled={acting === row.id}
                          onClick={() => {
                            setRejectId(row.id);
                            setRejectReason('');
                          }}
                        >
                          {row.status === 'APPROVED' ? 'Take it down' : 'Reject'}
                        </button>
                      ) : null}
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
          <h2 className="dash-card-title">Turn down this review</h2>
          <div className="dash-field">
            <label className="dash-label" htmlFor="reject-reason">
              Why (kept for your records, not shown to the customer)
            </label>
            <textarea
              id="reject-reason"
              className="dash-input"
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              required
            />
          </div>
          <div className="dash-form-actions">
            <button
              type="submit"
              className="dash-btn-danger"
              disabled={acting === rejectId}
            >
              Confirm
            </button>
            <button
              type="button"
              className="dash-btn-ghost"
              onClick={() => setRejectId(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </>
  );
}

'use client';

import React from 'react';
import Link from 'next/link';
import CatalogSubnav from '@/components/dashboard/CatalogSubnav';
import RetryingImage from '@/components/dashboard/RetryingImage';
import { errorMessageToText } from '@/lib/api/client';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';
import {
  deleteBundle,
  listBundles,
  updateBundle,
  type Bundle,
} from '@/lib/api/bundles';
import { MAX_MEMBERS, formatMinor, formatPercent } from './bundle-economics';

/**
 * Sets of products sold together at one price — the management view.
 *
 * This route used to be a create form with a table bolted underneath, and the
 * table could do exactly two things to a set: hide it and delete it. Creating
 * now has its own route (`/catalogue/bundles/new`) and so does changing one
 * (`/catalogue/bundles/:id/edit`) — both URLs `next.config.ts` was already
 * rewriting to app-router paths that did not exist, so both answered 404.
 *
 * What is left here is the thing a list is for: seeing, at a glance, which sets
 * a shopper can currently buy and whether each one is actually cheaper than its
 * parts. The saving and the discount percentage are on the row because a set
 * that has quietly stopped being a saving — a component's price went up after
 * the set was priced — is invisible otherwise, and the shop keeps selling it.
 */
export default function BundlesClient() {
  const [rows, setRows] = React.useState<Bundle[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listBundles());
    } catch (e) {
      setError(errorMessageToText(e, 'Could not load bundles'));
    } finally {
      setLoading(false);
    }
  }, []);

  useMountedEffect(load, [load]);

  async function toggleLive(bundle: Bundle) {
    setError(null);
    setBusyId(bundle.id);
    try {
      await updateBundle(bundle.id, { isActive: !bundle.isActive });
      await load();
    } catch (e) {
      setError(errorMessageToText(e, 'Could not change the set'));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(bundle: Bundle) {
    if (!window.confirm(`Delete "${bundle.name}"? Past orders are unaffected.`))
      return;
    setError(null);
    setBusyId(bundle.id);
    try {
      await deleteBundle(bundle.id);
      await load();
    } catch (e) {
      setError(errorMessageToText(e, 'Could not delete the set'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Bundles</h1>
          <p className="dash-help-text">
            Products you already sell, boxed together at one price. A set holds 1
            to {MAX_MEMBERS} lines.
          </p>
        </div>
        <Link className="dash-btn-primary" href="/catalogue/bundles/new">
          New bundle
        </Link>
      </div>
      <CatalogSubnav />

      {error && <p className="dash-error">{error}</p>}

      <section className="dash-card">
        {loading ? (
          <p className="dash-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="dash-panel-empty">
            No bundles yet.{' '}
            <Link className="dash-link" href="/catalogue/bundles/new">
              Build the first one
            </Link>
            .
          </p>
        ) : (
          <div className="dash-table-wrap">
            <table className="dash-table mr-bundle-table">
              <thead>
                <tr>
                  <th>Set</th>
                  <th>Inside</th>
                  <th>Set price</th>
                  <th>Separately</th>
                  <th>Saving</th>
                  <th>In shop</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => {
                  const pct =
                    b.listTotalMinor > 0
                      ? ((b.listTotalMinor - b.priceMinor) / b.listTotalMinor) *
                        100
                      : null;
                  return (
                    <tr key={b.id}>
                      <td>
                        <span className="mr-bundle-row-set">
                          <span className="mr-bundle-thumb">
                            {b.imageUrl ? (
                              <RetryingImage src={b.imageUrl} alt="" />
                            ) : (
                              <span
                                className="mr-bundle-thumb-empty"
                                aria-hidden="true"
                              />
                            )}
                          </span>
                          <span>
                            <Link
                              className="dash-link"
                              href={`/catalogue/bundles/${b.id}/edit`}
                            >
                              {b.name}
                            </Link>
                            <br />
                            <code className="dash-slug">/bundles/{b.slug}</code>
                          </span>
                        </span>
                      </td>
                      <td>
                        <span className="mr-bundle-chips">
                          {b.members.map((m, i) => (
                            <span
                              key={`${m.productId}-${m.variantId ?? '*'}-${i}`}
                              className="mr-bundle-chip"
                            >
                              {m.quantity > 1 && (
                                <strong>{m.quantity}× </strong>
                              )}
                              {m.productName}
                            </span>
                          ))}
                        </span>
                      </td>
                      <td className="mr-num">
                        {b.currency} {formatMinor(b.priceMinor)}
                      </td>
                      <td className="mr-num dash-muted">
                        {formatMinor(b.listTotalMinor)}
                      </td>
                      <td className="mr-num">
                        {/* A set that is no longer a saving is the failure this
                            column exists for: nothing else on the screen says
                            so, and the shop keeps selling it regardless. */}
                        {b.savingMinor > 0 ? (
                          <span className="mr-bundle-saving" data-tone="ok">
                            {formatMinor(b.savingMinor)}
                            {pct != null && ` · ${formatPercent(pct)}`}
                          </span>
                        ) : (
                          <span className="mr-bundle-saving" data-tone="warn">
                            None
                          </span>
                        )}
                      </td>
                      {/* "Live" has to mean "a shopper can see it".

                          The storefront list ends in a stock filter — a set
                          whose member sold out is hidden rather than shown as
                          unavailable, because a shopper cannot buy it either
                          way. So `isActive` is necessary and not sufficient,
                          and a row reading plain "Live" over a bundle nobody
                          can see sent the admin looking for a bug in the
                          toggle. */}
                      <td>
                        {!b.isActive ? (
                          'Hidden'
                        ) : expired(b) ? (
                          <span title="Its end date has passed, so the shop no longer lists it.">
                            Expired
                          </span>
                        ) : b.inStock ? (
                          'Live'
                        ) : (
                          <span title="Set to show, but the storefront hides a set that cannot be bought.">
                            Live — not showing
                          </span>
                        )}
                        {b.expiresAt && !expired(b) && (
                          <>
                            <br />
                            <span className="dash-muted">
                              until {new Date(b.expiresAt).toLocaleDateString()}
                            </span>
                          </>
                        )}
                      </td>
                      <td className="dash-row-actions">
                        <Link
                          className="dash-btn-secondary"
                          href={`/catalogue/bundles/${b.id}/edit`}
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          className="dash-btn-secondary"
                          disabled={busyId === b.id}
                          onClick={() => void toggleLive(b)}
                        >
                          {b.isActive ? 'Hide' : 'Show'}
                        </button>
                        <button
                          type="button"
                          className="dash-btn-danger"
                          disabled={busyId === b.id}
                          onClick={() => void remove(b)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function expired(b: Bundle): boolean {
  return !!b.expiresAt && new Date(b.expiresAt).getTime() <= Date.now();
}

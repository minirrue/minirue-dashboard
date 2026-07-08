'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  CollaboratorModuleChips,
  CollaboratorStatusBadge,
  CollabLoadingBlock,
} from '@/components/collab/collab-ui';
import {
  apiArchiveCollaborator,
  apiGetCollaborator,
  apiGetCollaboratorDeleteImpact,
  apiHardDeleteCollaborator,
  apiReactivateCollaborator,
  apiSoftDeleteCollaborator,
  apiSuspendCollaborator,
  apiUpdateCollaborator,
  apiUpdateCollaboratorSettings,
  type CollaboratorDeleteImpact,
  type CollaboratorDetail,
  type CollaboratorModule,
  type FulfillmentMode,
} from '@/lib/api/collaborators';
import { useRouter } from 'next/navigation';
import type { ApiError } from '@/lib/api/client';

const MODULE_OPTIONS: Array<{ value: CollaboratorModule; label: string }> = [
  { value: 'ORDERS', label: 'Orders' },
  { value: 'PRODUCTS', label: 'Products' },
  { value: 'ANALYTICS', label: 'Analytics' },
];

export default function CollaboratorDetailClient() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [collab, setCollab] = useState<CollaboratorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [brandSlug, setBrandSlug] = useState('');
  const [modules, setModules] = useState<CollaboratorModule[]>([]);
  const [saving, setSaving] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [settingsSavedAt, setSettingsSavedAt] = useState<Date | null>(null);
  const [autoPublish, setAutoPublish] = useState(false);
  const [homeFeature, setHomeFeature] = useState(false);
  const [navLink, setNavLink] = useState(false);
  const [commissionPct, setCommissionPct] = useState('20');
  const [fulfillmentMode, setFulfillmentMode] = useState<FulfillmentMode>('MINIRUE_SHIPS');

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteImpact, setDeleteImpact] = useState<CollaboratorDeleteImpact | null>(null);
  const [deleteImpactError, setDeleteImpactError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiGetCollaborator(id);
        if (!cancelled) {
          setCollab(data);
          setBrandSlug(data.brandSlug);
          setModules(data.modules);
          setAutoPublish(data.autoPublishProducts ?? false);
          setHomeFeature(data.storefrontHomeFeature ?? false);
          setNavLink(data.storefrontNavLink ?? false);
          if (data.commissionRate != null) {
            const pct = Number.parseFloat(data.commissionRate) * 100;
            if (!Number.isNaN(pct)) setCommissionPct(String(Math.round(pct * 100) / 100));
          }
          setFulfillmentMode(data.fulfillmentMode ?? 'MINIRUE_SHIPS');
        }
      } catch (e) {
        if (!cancelled) {
          const err = e as ApiError;
          setError(err.message || 'Collaborator not found');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  function toggleModule(mod: CollaboratorModule) {
    setModules((prev) => {
      const has = prev.includes(mod);
      const next = has ? prev.filter((m) => m !== mod) : [...prev, mod];
      return next.length ? next : prev;
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!collab) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await apiUpdateCollaborator(id, {
        brandSlug: brandSlug !== collab.brandSlug ? brandSlug : undefined,
        modules:
          JSON.stringify(modules) !== JSON.stringify(collab.modules) ? modules : undefined,
      });
      setCollab(updated);
      setBrandSlug(updated.brandSlug);
      setModules(updated.modules);
      setSavedAt(new Date());
    } catch (e) {
      const err = e as ApiError;
      setSaveError(err.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  }

  async function handleSettingsSave(e: React.FormEvent) {
    e.preventDefault();
    const pct = Number.parseFloat(commissionPct);
    if (Number.isNaN(pct) || pct < 0 || pct > 100) {
      setSettingsError('Commission must be between 0 and 100%.');
      return;
    }
    setSettingsSaving(true);
    setSettingsError(null);
    try {
      const updated = await apiUpdateCollaboratorSettings(id, {
        autoPublishProducts: autoPublish,
        storefrontHomeFeature: homeFeature,
        storefrontNavLink: navLink,
        commissionRate: (pct / 100).toFixed(4),
        fulfillmentMode,
      });
      setCollab(updated);
      setSettingsSavedAt(new Date());
    } catch (e) {
      const err = e as ApiError;
      setSettingsError(err.message || 'Failed to save settings');
    } finally {
      setSettingsSaving(false);
    }
  }

  async function handleSuspend() {
    setActionLoading(true);
    setActionError(null);
    try {
      await apiSuspendCollaborator(id);
      const data = await apiGetCollaborator(id);
      setCollab(data);
    } catch (e) {
      const err = e as ApiError;
      setActionError(
        err.status === 409 ? 'This collaborator is already suspended.' : err.message || 'Failed to suspend',
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReactivate() {
    setActionLoading(true);
    setActionError(null);
    try {
      await apiReactivateCollaborator(id);
      const data = await apiGetCollaborator(id);
      setCollab(data);
    } catch (e) {
      const err = e as ApiError;
      setActionError(err.message || 'Failed to reactivate');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleArchive() {
    setActionLoading(true);
    setActionError(null);
    try {
      await apiArchiveCollaborator(id);
      const data = await apiGetCollaborator(id);
      setCollab(data);
    } catch (e) {
      const err = e as ApiError;
      setActionError(
        err.status === 409 ? 'This collaborator is already archived.' : err.message || 'Failed to archive',
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function openDeleteDialog() {
    setDeleteDialogOpen(true);
    setDeleteError(null);
    setDeleteImpact(null);
    setDeleteImpactError(null);
    try {
      const impact = await apiGetCollaboratorDeleteImpact(id);
      setDeleteImpact(impact);
    } catch (e) {
      const err = e as ApiError;
      setDeleteImpactError(err.message || 'Failed to load delete impact');
    }
  }

  async function handleSoftDelete() {
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await apiSoftDeleteCollaborator(id);
      router.push('/collaborators');
    } catch (e) {
      const err = e as ApiError;
      setDeleteError(err.message || 'Failed to soft-delete');
      setDeleteBusy(false);
    }
  }

  async function handleHardDelete() {
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await apiHardDeleteCollaborator(id);
      router.push('/collaborators');
    } catch (e) {
      const err = e as ApiError;
      setDeleteError(
        err.status === 409
          ? err.message ?? 'This collaborator has real order history — use soft delete instead.'
          : err.message || 'Failed to delete',
      );
      setDeleteBusy(false);
    }
  }

  if (loading) {
    return <CollabLoadingBlock traceId="PG-DASHBOARD-COLLAB-008::EL-REGION-detail-loading" />;
  }

  if (error || !collab) {
    return (
      <>
        <div className="dash-page-header">
          <h1 className="dash-page-title">Collaborator</h1>
        </div>
        <p
          className="dash-inline-error"
          data-trace-id="PG-DASHBOARD-COLLAB-008::EL-REGION-detail-error"
        >
          {error ?? 'Not found'}
        </p>
        <Link href="/collaborators" className="dash-btn-ghost">
          Back to list
        </Link>
      </>
    );
  }

  return (
    <>
      <div className="dash-page-header" data-trace-id="PG-DASHBOARD-COLLAB-008::EL-REGION-detail-header">
        <div>
          <h1 className="dash-page-title">{collab.brandName}</h1>
          <p className="dash-page-subtitle">{collab.email}</p>
          <div className="collab-header-meta">
            <CollaboratorStatusBadge status={collab.status} />
            <CollaboratorModuleChips modules={collab.modules} />
          </div>
        </div>
        <div className="collab-action-row" style={{ marginTop: 0 }}>
          <Link
            href={`/dashboard/collaborators/${id}/scopes`}
            className="dash-btn-secondary"
            data-trace-id="PG-DASHBOARD-COLLAB-008::EL-LINK-detail-scopes"
          >
            Scopes
          </Link>
          {!autoPublish ? (
            <Link
              href="/collaborators/review"
              className="dash-btn-secondary"
              data-trace-id="PG-DASHBOARD-COLLAB-008::EL-LINK-detail-review-queue"
            >
              Review queue
            </Link>
          ) : null}
          {collab.status === 'ACTIVE' ? (
            <button
              type="button"
              className="dash-btn-ghost dash-btn-muted"
              disabled={actionLoading || saving}
              onClick={() => void handleSuspend()}
              data-trace-id="PG-DASHBOARD-COLLAB-008::EL-BTN-detail-suspend"
            >
              Suspend
            </button>
          ) : collab.status === 'SUSPENDED' || collab.status === 'ARCHIVED' ? (
            <button
              type="button"
              className="dash-btn-ok"
              disabled={actionLoading || saving}
              onClick={() => void handleReactivate()}
              data-trace-id="PG-DASHBOARD-COLLAB-008::EL-BTN-detail-reactivate"
            >
              Reactivate
            </button>
          ) : null}
          {collab.status !== 'ARCHIVED' ? (
            <button
              type="button"
              className="dash-btn-ghost dash-btn-muted"
              disabled={actionLoading || saving}
              onClick={() => void handleArchive()}
              data-trace-id="PG-DASHBOARD-COLLAB-008::EL-BTN-detail-archive"
            >
              Archive
            </button>
          ) : null}
          <button
            type="button"
            className="dash-btn-ghost dash-btn-danger"
            disabled={actionLoading || saving}
            onClick={() => void openDeleteDialog()}
            data-trace-id="PG-DASHBOARD-COLLAB-008::EL-BTN-detail-delete"
          >
            Delete
          </button>
          <Link
            href="/collaborators"
            className="dash-btn-ghost"
            data-trace-id="PG-DASHBOARD-COLLAB-008::EL-LINK-detail-back"
          >
            Back
          </Link>
        </div>
      </div>

      {actionError ? (
        <div
          className="dash-card dash-inline-error"
          role="alert"
          style={{ padding: 16, marginBottom: 16 }}
          data-trace-id="PG-DASHBOARD-COLLAB-008::EL-REGION-detail-action-error"
        >
          {actionError}
        </div>
      ) : null}

      <div className="collab-admin-grid">
      <form
        className="dash-form-card"
        onSubmit={handleSave}
        data-trace-id="PG-DASHBOARD-COLLAB-008::EL-FORM-detail-identity-form"
      >
        <h2 className="dash-card-title">Identity</h2>
        <div className="dash-field">
          <label className="dash-label">Status</label>
          <CollaboratorStatusBadge status={collab.status} />
        </div>
        <div className="dash-field">
          <label className="dash-label" htmlFor="brandSlug">
            Brand slug
          </label>
          <input
            id="brandSlug"
            className="dash-input"
            value={brandSlug}
            onChange={(e) => setBrandSlug(e.target.value)}
            pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
            disabled={saving}
            data-trace-id="PG-DASHBOARD-COLLAB-008::EL-INPUT-detail-brand-slug"
          />
        </div>
        <div className="dash-field">
          <p className="dash-label">Access</p>
          <div className="dash-checkbox-grid">
            {MODULE_OPTIONS.map((opt) => (
              <label key={opt.value} className="dash-checkbox-label">
                <input
                  type="checkbox"
                  className="dash-checkbox"
                  checked={modules.includes(opt.value)}
                  onChange={() => toggleModule(opt.value)}
                  disabled={saving}
                  data-trace-id={`PG-DASHBOARD-COLLAB-008::EL-CHECK-detail-module-toggle@${opt.value}`}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
        {collab.logoUrl ? (
          <div className="dash-field">
            <p className="dash-label">Brand logo</p>
            <img src={collab.logoUrl} alt="" className="collab-brand-logo" />
          </div>
        ) : null}
        {saveError ? <p className="dash-inline-error">{saveError}</p> : null}
        <div className="dash-form-actions">
          <button
            type="submit"
            className="dash-btn-primary"
            disabled={saving}
            data-trace-id="PG-DASHBOARD-COLLAB-008::EL-BTN-detail-save-identity"
          >
            {saving ? 'Saving…' : 'Save identity'}
          </button>
          {savedAt ? <span className="dash-help-text">Saved at {savedAt.toLocaleTimeString()}</span> : null}
        </div>
      </form>

      <form
        className="dash-form-card collab-admin-settings"
        onSubmit={handleSettingsSave}
        data-trace-id="PG-DASHBOARD-COLLAB-008::EL-FORM-detail-settings-form"
      >
        <h2 className="dash-card-title">Trust & publishing</h2>
        <label className="dash-checkbox-label">
          <input
            type="checkbox"
            className="dash-checkbox"
            checked={autoPublish}
            onChange={(e) => setAutoPublish(e.target.checked)}
            disabled={settingsSaving}
            data-trace-id="PG-DASHBOARD-COLLAB-008::EL-CHECK-detail-auto-publish"
          />
          Auto-publish products (skip review queue)
        </label>

        <h2 className="dash-card-title" style={{ marginTop: 24 }}>
          Storefront placement
        </h2>
        <p className="dash-help-text">
          Brand page (always on):{' '}
          <code className="collab-slug-code">/brands/{collab.brandSlug}</code>
        </p>
        <label className="dash-checkbox-label">
          <input
            type="checkbox"
            className="dash-checkbox"
            checked={homeFeature}
            onChange={(e) => setHomeFeature(e.target.checked)}
            disabled={settingsSaving}
            data-trace-id="PG-DASHBOARD-COLLAB-008::EL-CHECK-detail-home-feature"
          />
          Feature brand on storefront home page
        </label>
        <label className="dash-checkbox-label">
          <input
            type="checkbox"
            className="dash-checkbox"
            checked={navLink}
            onChange={(e) => setNavLink(e.target.checked)}
            disabled={settingsSaving}
            data-trace-id="PG-DASHBOARD-COLLAB-008::EL-CHECK-detail-nav-link"
          />
          Add link to brand page in storefront navbar
        </label>

        <h2 className="dash-card-title" style={{ marginTop: 24 }}>
          Revenue & operations
        </h2>
        <div className="dash-field-row">
          <div className="dash-field">
            <label className="dash-label" htmlFor="commission">
              Commission rate (MiniRue %)
            </label>
            <input
              id="commission"
              className="dash-input"
              inputMode="decimal"
              value={commissionPct}
              onChange={(e) => setCommissionPct(e.target.value)}
              disabled={settingsSaving}
              data-trace-id="PG-DASHBOARD-COLLAB-008::EL-INPUT-detail-commission-rate"
            />
          </div>
        </div>
        <fieldset className="collab-provision-mode">
          <legend className="dash-label">Fulfillment</legend>
          <label className="collab-radio-label">
            <input
              type="radio"
              name="fulfillment"
              checked={fulfillmentMode === 'MINIRUE_SHIPS'}
              onChange={() => setFulfillmentMode('MINIRUE_SHIPS')}
              disabled={settingsSaving}
              data-trace-id="PG-DASHBOARD-COLLAB-008::EL-RADIO-detail-fulfillment-mode@MINIRUE_SHIPS"
            />
            MiniRue ships
          </label>
          <label className="collab-radio-label">
            <input
              type="radio"
              name="fulfillment"
              checked={fulfillmentMode === 'COLLAB_DROPSHIP'}
              onChange={() => setFulfillmentMode('COLLAB_DROPSHIP')}
              disabled={settingsSaving}
              data-trace-id="PG-DASHBOARD-COLLAB-008::EL-RADIO-detail-fulfillment-mode@COLLAB_DROPSHIP"
            />
            Collaborator dropship
          </label>
        </fieldset>

        {settingsError ? <p className="dash-inline-error">{settingsError}</p> : null}
        <div className="dash-form-actions">
          <button
            type="submit"
            className="dash-btn-primary"
            disabled={settingsSaving}
            data-trace-id="PG-DASHBOARD-COLLAB-008::EL-BTN-detail-save-settings"
          >
            {settingsSaving ? 'Saving…' : 'Save settings'}
          </button>
          {settingsSavedAt ? (
            <span className="dash-help-text">Saved at {settingsSavedAt.toLocaleTimeString()}</span>
          ) : null}
        </div>
      </form>
      </div>

      {deleteDialogOpen && (
        <div
          className="dash-gallery-preview-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Delete collaborator"
          data-trace-id="PG-DASHBOARD-COLLAB-008::EL-MODAL-delete-collaborator"
        >
          <div
            className="dash-card"
            style={{ maxWidth: 480, width: '90%', textAlign: 'left' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="dash-section-title" style={{ marginBottom: 12 }}>
              Delete {collab.brandName}?
            </h2>

            {deleteImpactError ? (
              <p className="dash-inline-error">{deleteImpactError}</p>
            ) : !deleteImpact ? (
              <p className="dash-help-text">Checking what this would affect…</p>
            ) : (
              <>
                <p className="dash-help-text" style={{ marginBottom: 8 }}>
                  Choosing <strong>Delete everything</strong> will permanently erase:
                </p>
                <ul style={{ margin: '0 0 12px', paddingLeft: 20, fontSize: 13, color: 'var(--mr-fg-2)' }}>
                  <li>{deleteImpact.productCount} product(s)</li>
                  <li>{deleteImpact.mediaCount} product photo(s)</li>
                  <li>{deleteImpact.galleryFolderCount} gallery folder(s)</li>
                  <li>{deleteImpact.galleryItemCount} gallery photo/video(s)</li>
                </ul>
                {deleteImpact.orderReferenceCount > 0 ? (
                  <p className="dash-inline-error" style={{ marginBottom: 12 }}>
                    {deleteImpact.orderReferenceCount} order(s) reference this collaborator's
                    products — permanent delete is blocked. Use soft delete instead, which hides
                    everything without erasing your order history.
                  </p>
                ) : (
                  <p className="dash-inline-error" style={{ marginBottom: 12 }}>
                    This cannot be undone — there is no trace-back once erased.
                  </p>
                )}
                <p className="dash-help-text" style={{ marginBottom: 12 }}>
                  Or choose <strong>Soft delete</strong> instead — the collaborator disappears
                  from your lists but every product, photo, and order stays intact, and this can
                  be reversed later.
                </p>
              </>
            )}

            {deleteError ? <p className="dash-inline-error">{deleteError}</p> : null}

            <div className="dash-form-actions" style={{ marginTop: 8 }}>
              <button
                type="button"
                className="dash-btn-secondary"
                disabled={deleteBusy}
                onClick={() => void handleSoftDelete()}
                data-trace-id="PG-DASHBOARD-COLLAB-008::EL-BTN-confirm-soft-delete"
              >
                {deleteBusy ? 'Working…' : 'Soft delete'}
              </button>
              <button
                type="button"
                className="dash-btn-danger"
                disabled={deleteBusy || !deleteImpact || deleteImpact.orderReferenceCount > 0}
                onClick={() => void handleHardDelete()}
                data-trace-id="PG-DASHBOARD-COLLAB-008::EL-BTN-confirm-hard-delete"
              >
                {deleteBusy ? 'Working…' : 'Delete everything'}
              </button>
              <button
                type="button"
                className="dash-btn-ghost"
                disabled={deleteBusy}
                onClick={() => setDeleteDialogOpen(false)}
                data-trace-id="PG-DASHBOARD-COLLAB-008::EL-BTN-cancel-delete"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

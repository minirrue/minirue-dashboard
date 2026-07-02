'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  CollaboratorModuleChips,
  CollaboratorStatusBadge,
  CollabApiNotice,
  CollabLoadingBlock,
} from '@/components/collab/collab-ui';
import {
  apiGetCollaborator,
  apiReactivateCollaborator,
  apiSuspendCollaborator,
  apiUpdateCollaborator,
  apiUpdateCollaboratorSettings,
  type CollaboratorDetail,
  type CollaboratorModule,
  type FulfillmentMode,
} from '@/lib/api/collaborators';
import type { ApiError } from '@/lib/api/client';

const MODULE_OPTIONS: Array<{ value: CollaboratorModule; label: string }> = [
  { value: 'ORDERS', label: 'Orders' },
  { value: 'PRODUCTS', label: 'Products' },
  { value: 'ANALYTICS', label: 'Analytics' },
];

export default function CollaboratorDetailClient() {
  const params = useParams();
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
  const [settingsNotice, setSettingsNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [settingsSavedAt, setSettingsSavedAt] = useState<Date | null>(null);
  const [autoPublish, setAutoPublish] = useState(false);
  const [homeFeature, setHomeFeature] = useState(false);
  const [navLink, setNavLink] = useState(false);
  const [commissionPct, setCommissionPct] = useState('20');
  const [fulfillmentMode, setFulfillmentMode] = useState<FulfillmentMode>('MINIRUE_SHIPS');

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
    setSettingsNotice(null);
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
      if (err.status === 404) {
        setSettingsNotice(
          'Settings API not available yet — form is wired; save will work when backend ships PATCH /settings.',
        );
      } else {
        setSettingsError(err.message || 'Failed to save settings');
      }
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

  if (loading) {
    return <CollabLoadingBlock />;
  }

  if (error || !collab) {
    return (
      <>
        <div className="dash-page-header">
          <h1 className="dash-page-title">Collaborator</h1>
        </div>
        <p className="dash-inline-error">{error ?? 'Not found'}</p>
        <Link href="/dashboard/collaborators" className="dash-btn-ghost">
          Back to list
        </Link>
      </>
    );
  }

  return (
    <>
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">{collab.brandName}</h1>
          <p className="dash-page-subtitle">{collab.email}</p>
          <div className="collab-header-meta">
            <CollaboratorStatusBadge status={collab.status} />
            <CollaboratorModuleChips modules={collab.modules} />
          </div>
        </div>
        <div className="collab-action-row" style={{ marginTop: 0 }}>
          {!autoPublish ? (
            <Link href="/dashboard/collaborators/review" className="dash-btn-secondary">
              Review queue
            </Link>
          ) : null}
          {collab.status === 'ACTIVE' ? (
            <button
              type="button"
              className="dash-btn-ghost dash-btn-muted"
              disabled={actionLoading || saving}
              onClick={() => void handleSuspend()}
            >
              Suspend
            </button>
          ) : collab.status === 'SUSPENDED' ? (
            <button
              type="button"
              className="dash-btn-ok"
              disabled={actionLoading || saving}
              onClick={() => void handleReactivate()}
            >
              Reactivate
            </button>
          ) : null}
          <Link href="/dashboard/collaborators" className="dash-btn-ghost">
            Back
          </Link>
        </div>
      </div>

      {actionError ? (
        <div className="dash-card dash-inline-error" role="alert" style={{ padding: 16, marginBottom: 16 }}>
          {actionError}
        </div>
      ) : null}

      <div className="collab-admin-grid">
      <form className="dash-form-card" onSubmit={handleSave}>
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
          />
        </div>
        <div className="dash-field">
          <p className="dash-label">Modules</p>
          <div className="dash-checkbox-grid">
            {MODULE_OPTIONS.map((opt) => (
              <label key={opt.value} className="dash-checkbox-label">
                <input
                  type="checkbox"
                  className="dash-checkbox"
                  checked={modules.includes(opt.value)}
                  onChange={() => toggleModule(opt.value)}
                  disabled={saving}
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
          <button type="submit" className="dash-btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save identity'}
          </button>
          {savedAt ? <span className="dash-help-text">Saved at {savedAt.toLocaleTimeString()}</span> : null}
        </div>
      </form>

      <form className="dash-form-card collab-admin-settings" onSubmit={handleSettingsSave}>
        <h2 className="dash-card-title">Trust & publishing</h2>
        <label className="dash-checkbox-label">
          <input
            type="checkbox"
            className="dash-checkbox"
            checked={autoPublish}
            onChange={(e) => setAutoPublish(e.target.checked)}
            disabled={settingsSaving}
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
            />
            Collaborator dropship
          </label>
        </fieldset>

        {settingsError ? <p className="dash-inline-error">{settingsError}</p> : null}
        {settingsNotice ? <CollabApiNotice>{settingsNotice}</CollabApiNotice> : null}
        <div className="dash-form-actions">
          <button type="submit" className="dash-btn-primary" disabled={settingsSaving}>
            {settingsSaving ? 'Saving…' : 'Save settings'}
          </button>
          {settingsSavedAt ? (
            <span className="dash-help-text">Saved at {settingsSavedAt.toLocaleTimeString()}</span>
          ) : null}
        </div>
      </form>
      </div>
    </>
  );
}

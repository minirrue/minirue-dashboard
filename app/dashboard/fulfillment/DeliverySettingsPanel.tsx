'use client';

import React, { useEffect, useState } from 'react';
import { apiGetSettings, apiUpdateSettings, type DeliveryConfig } from '@/lib/api/settings';
import type { ApiError } from '@/lib/api/client';
import { validateDeliverySettings, type DeliveryValidationError } from '@/lib/settings/delivery-validate';
import { GOVERNORATE_KEYS, GOVERNORATE_LABELS, type GovernorateKey } from '@/lib/geo/governorates';

const DEFAULT_DELIVERY: DeliveryConfig = {
  standard: { enabled: true, etaLabel: '2–5 working days' },
  sameDay: {
    enabled: true,
    governorates: ['CAIRO', 'GIZA'],
    windowStart: '19:00',
    windowEnd: '24:00',
    cutoff: '17:00',
    feeRangeMinor: { min: 9000, max: 16000 },
    disclaimer:
      'Same-day delivery fees usually range from EGP 90 to 160. We confirm the exact fee after your order is confirmed, and you pay it in cash on delivery.',
  },
};

function toEgp(minor: number): string {
  return (minor / 100).toFixed(2);
}

function fromEgp(egp: string): number {
  const n = Number(egp);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/**
 * Fulfillment → Settings sub-tab: Standard + Same-day delivery methods
 * (dashboard#84 / backend#186's pinned contract). ADMIN-only — gated by the
 * parent `FulfillmentClient`, which only shows this tab once it has
 * confirmed the signed-in role.
 *
 * Sends the WHOLE `fulfillment.delivery` block on save (never a partial
 * patch) — the backend's `DeliveryConfigSchema` replaces it wholesale, the
 * same convention `pricing`/`reviews` already use.
 */
export default function DeliverySettingsPanel() {
  const [delivery, setDelivery] = useState<DeliveryConfig>(DEFAULT_DELIVERY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<DeliveryValidationError[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const settings = await apiGetSettings();
        if (!cancelled && settings.fulfillment?.delivery) {
          setDelivery(settings.fulfillment.delivery);
        }
      } catch (e) {
        if (!cancelled) setServerError((e as ApiError).message ?? 'Could not load settings');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const errorFor = (field: DeliveryValidationError['field']) =>
    errors.find((e) => e.field === field)?.message;

  const toggleGovernorate = (key: GovernorateKey) => {
    setDelivery((d) => {
      const has = d.sameDay.governorates.includes(key);
      return {
        ...d,
        sameDay: {
          ...d.sameDay,
          governorates: has
            ? d.sameDay.governorates.filter((g) => g !== key)
            : [...d.sameDay.governorates, key],
        },
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(false);
    setServerError(null);
    const validationErrors = validateDeliverySettings(delivery);
    setErrors(validationErrors);
    if (validationErrors.length > 0) return;

    setSaving(true);
    try {
      await apiUpdateSettings({ fulfillment: { delivery } });
      setSaved(true);
    } catch (err) {
      setServerError((err as ApiError).message ?? 'Could not save delivery settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="dash-help-text">Loading delivery settings…</p>;
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="dash-card">
        <h2 className="dash-section-title" style={{ marginTop: 0 }}>Standard delivery</h2>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={delivery.standard.enabled}
            onChange={(e) =>
              setDelivery((d) => ({ ...d, standard: { ...d.standard, enabled: e.target.checked } }))
            }
          />
          Standard delivery enabled
        </label>
        <div>
          <label className="dash-label" htmlFor="std-eta">ETA label</label>
          <input
            id="std-eta"
            className="dash-input"
            type="text"
            value={delivery.standard.etaLabel}
            onChange={(e) =>
              setDelivery((d) => ({ ...d, standard: { ...d.standard, etaLabel: e.target.value } }))
            }
          />
          {errorFor('etaLabel') && <p className="dash-inline-error">{errorFor('etaLabel')}</p>}
        </div>
      </div>

      <div className="dash-card">
        <h2 className="dash-section-title" style={{ marginTop: 0 }}>Same-day delivery</h2>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={delivery.sameDay.enabled}
            onChange={(e) =>
              setDelivery((d) => ({ ...d, sameDay: { ...d.sameDay, enabled: e.target.checked } }))
            }
          />
          Same-day delivery enabled
        </label>

        <p className="dash-label" style={{ marginBottom: 6 }}>Eligible governorates</p>
        <div
          role="group"
          aria-label="Eligible governorates"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: 8,
            marginBottom: 8,
          }}
        >
          {GOVERNORATE_KEYS.map((key) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={delivery.sameDay.governorates.includes(key)}
                onChange={() => toggleGovernorate(key)}
              />
              {GOVERNORATE_LABELS[key]}
            </label>
          ))}
        </div>
        {errorFor('governorates') && <p className="dash-inline-error">{errorFor('governorates')}</p>}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(0, 1fr))',
            gap: 16,
            marginTop: 16,
          }}
        >
          <div>
            <label className="dash-label" htmlFor="sd-window-start">Window start</label>
            <input
              id="sd-window-start"
              className="dash-input"
              type="time"
              value={delivery.sameDay.windowStart}
              onChange={(e) =>
                setDelivery((d) => ({ ...d, sameDay: { ...d.sameDay, windowStart: e.target.value } }))
              }
            />
            {errorFor('windowStart') && <p className="dash-inline-error">{errorFor('windowStart')}</p>}
          </div>
          <div>
            <label className="dash-label" htmlFor="sd-window-end">Window end</label>
            <input
              id="sd-window-end"
              className="dash-input"
              type="time"
              value={delivery.sameDay.windowEnd === '24:00' ? '00:00' : delivery.sameDay.windowEnd}
              onChange={(e) => {
                const v = e.target.value === '00:00' ? '24:00' : e.target.value;
                setDelivery((d) => ({ ...d, sameDay: { ...d.sameDay, windowEnd: v } }));
              }}
            />
            {errorFor('windowEnd') && <p className="dash-inline-error">{errorFor('windowEnd')}</p>}
          </div>
          <div>
            <label className="dash-label" htmlFor="sd-cutoff">Cut-off</label>
            <input
              id="sd-cutoff"
              className="dash-input"
              type="time"
              value={delivery.sameDay.cutoff}
              onChange={(e) =>
                setDelivery((d) => ({ ...d, sameDay: { ...d.sameDay, cutoff: e.target.value } }))
              }
            />
            {errorFor('cutoff') && <p className="dash-inline-error">{errorFor('cutoff')}</p>}
            <p className="dash-help-text" style={{ marginTop: 4 }}>
              After the cut-off, same-day stays selectable and moves to tomorrow&rsquo;s window.
            </p>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(0, 1fr))',
            gap: 16,
            marginTop: 16,
          }}
        >
          <div>
            <label className="dash-label" htmlFor="sd-fee-min">Fee range min (EGP)</label>
            <input
              id="sd-fee-min"
              className="dash-input"
              type="number"
              min={0}
              step="0.01"
              value={toEgp(delivery.sameDay.feeRangeMinor.min)}
              onChange={(e) =>
                setDelivery((d) => ({
                  ...d,
                  sameDay: {
                    ...d.sameDay,
                    feeRangeMinor: { ...d.sameDay.feeRangeMinor, min: fromEgp(e.target.value) },
                  },
                }))
              }
            />
            {errorFor('feeMin') && <p className="dash-inline-error">{errorFor('feeMin')}</p>}
          </div>
          <div>
            <label className="dash-label" htmlFor="sd-fee-max">Fee range max (EGP)</label>
            <input
              id="sd-fee-max"
              className="dash-input"
              type="number"
              min={0}
              step="0.01"
              value={toEgp(delivery.sameDay.feeRangeMinor.max)}
              onChange={(e) =>
                setDelivery((d) => ({
                  ...d,
                  sameDay: {
                    ...d.sameDay,
                    feeRangeMinor: { ...d.sameDay.feeRangeMinor, max: fromEgp(e.target.value) },
                  },
                }))
              }
            />
            {errorFor('feeMax') && <p className="dash-inline-error">{errorFor('feeMax')}</p>}
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <label className="dash-label" htmlFor="sd-disclaimer">Disclaimer</label>
          <textarea
            id="sd-disclaimer"
            className="dash-input"
            rows={3}
            value={delivery.sameDay.disclaimer}
            onChange={(e) =>
              setDelivery((d) => ({ ...d, sameDay: { ...d.sameDay, disclaimer: e.target.value } }))
            }
          />
          {errorFor('disclaimer') && <p className="dash-inline-error">{errorFor('disclaimer')}</p>}
        </div>
      </div>

      {serverError && <p className="dash-inline-error">{serverError}</p>}
      {saved && !serverError && (
        <p className="dash-help-text" style={{ color: 'var(--mr-st-ok-fg)' }}>
          Delivery settings saved.
        </p>
      )}

      <div className="dash-row-actions">
        <button type="submit" className="dash-btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save delivery settings'}
        </button>
      </div>
    </form>
  );
}

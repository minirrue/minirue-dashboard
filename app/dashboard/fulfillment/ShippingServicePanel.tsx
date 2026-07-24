'use client';

import React from 'react';

/**
 * Deliberately inert. MiniRue has no shipping-service integration yet, so this
 * is the shape of the screen only — every control is disabled, there is no
 * <form>, and nothing here calls the API. When a carrier is signed, this file
 * is where the wiring goes.
 */
export default function ShippingServicePanel() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        className="dash-card"
        role="note"
        style={{ borderLeft: '3px solid var(--mr-st-warning-fg, #b45309)' }}
      >
        <p style={{ margin: 0, fontWeight: 600, color: 'var(--mr-fg)' }}>
          No shipping service is connected — this screen is not connected to a carrier yet
        </p>
        <p style={{ margin: '6px 0 0', color: 'var(--mr-fg-3)', fontSize: 14 }}>
          This is a preview of the screen. Nothing below saves, sends, or books
          anything. Fulfil orders manually from the Manual tab until a carrier
          account is added.
        </p>
      </div>

      <div className="dash-card">
        <h2 className="dash-section-title" style={{ marginTop: 0 }}>Carrier account</h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(0, 1fr))',
            gap: 16,
          }}
        >
          <div>
            <label className="dash-label" htmlFor="ship-carrier">Carrier</label>
            <select id="ship-carrier" className="dash-select" disabled defaultValue="">
              <option value="">Select a carrier…</option>
              <option value="ARAMEX">Aramex</option>
              <option value="BOSTA">Bosta</option>
              <option value="MYLERZ">Mylerz</option>
            </select>
          </div>
          <div>
            <label className="dash-label" htmlFor="ship-account">Account number</label>
            <input id="ship-account" className="dash-input" type="text" disabled placeholder="—" />
          </div>
          <div>
            <label className="dash-label" htmlFor="ship-key">API key</label>
            <input id="ship-key" className="dash-input" type="text" disabled placeholder="—" />
          </div>
        </div>
        <div className="dash-row-actions" style={{ marginTop: 16 }}>
          <button type="button" className="dash-btn-primary" disabled>
            Connect carrier
          </button>
          <button type="button" className="dash-btn-secondary" disabled>
            Test connection
          </button>
        </div>
      </div>

      <div className="dash-card">
        <h2 className="dash-section-title" style={{ marginTop: 0 }}>Default shipping options</h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(0, 1fr))',
            gap: 16,
          }}
        >
          <div>
            <label className="dash-label" htmlFor="ship-service">Service level</label>
            <select id="ship-service" className="dash-select" disabled defaultValue="">
              <option value="">—</option>
              <option value="STANDARD">Standard</option>
              <option value="EXPRESS">Express</option>
            </select>
          </div>
          <div>
            <label className="dash-label" htmlFor="ship-pickup">Pickup address</label>
            <input id="ship-pickup" className="dash-input" type="text" disabled placeholder="—" />
          </div>
          <div>
            <label className="dash-label" htmlFor="ship-note">Note printed on the label</label>
            <input id="ship-note" className="dash-input" type="text" disabled placeholder="—" />
          </div>
        </div>
        <div className="dash-row-actions" style={{ marginTop: 16 }}>
          <button type="button" className="dash-btn-primary" disabled>
            Save defaults
          </button>
        </div>
      </div>

      <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px' }}>
          <h2 className="dash-section-title" style={{ margin: 0 }}>Booked shipments</h2>
        </div>
        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Carrier</th>
                <th>Service</th>
                <th>Tracking</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={6} className="dash-table-empty">
                  Shipments booked through a carrier will appear here once one is connected.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

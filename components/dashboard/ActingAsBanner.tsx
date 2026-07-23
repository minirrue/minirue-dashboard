'use client';

import React, { useEffect, useState } from 'react';
import { getActingAs, stopActingAs, type ActingAs } from '@/lib/auth/acting-session';
import { roleLabel } from '@/lib/auth/role';

const TRACE = 'PG-DASHBOARD-ADM-002';

/**
 * The bar that says whose dashboard you are looking at.
 * specs/2026-07-23-account-administration
 *
 * Always on screen while a borrowed session is active. Without it, a super
 * admin who forgot they switched would read someone else's limited dashboard
 * as their own being broken.
 */
export default function ActingAsBanner() {
  const [acting, setActing] = useState<ActingAs | null>(null);
  const [remaining, setRemaining] = useState('');

  // sessionStorage is not readable during the server render, so this resolves
  // on mount — the banner is absent for one frame by design, not by accident.
  useEffect(() => {
    setActing(getActingAs());
  }, []);

  useEffect(() => {
    if (!acting) return;

    function tick() {
      const left = (acting as ActingAs).expiresAt - Date.now();
      if (left <= 0) {
        // The token is dead either way; put the real session back rather than
        // leaving a bar that offers to switch back from nowhere.
        stopActingAs();
        window.location.href = '/admin';
        return;
      }
      const minutes = Math.floor(left / 60000);
      const seconds = Math.floor((left % 60000) / 1000);
      setRemaining(minutes > 0 ? `${minutes}m` : `${seconds}s`);
    }

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [acting]);

  if (!acting) return null;

  function handleSwitchBack() {
    const restored = stopActingAs();
    window.location.href = restored ? '/admin' : '/login';
  }

  return (
    <div
      role="status"
      className="dash-acting-banner"
      data-trace-id={`${TRACE}::EL-REGION-acting-banner`}
    >
      <span>
        You are signed in as <strong>{acting.name || acting.email}</strong> (
        {roleLabel(acting.role)}). This ends in {remaining}.
      </span>
      <button
        type="button"
        className="dash-btn-secondary"
        onClick={handleSwitchBack}
        data-trace-id={`${TRACE}::EL-BTN-switch-back`}
      >
        Switch back to my account
      </button>
    </div>
  );
}

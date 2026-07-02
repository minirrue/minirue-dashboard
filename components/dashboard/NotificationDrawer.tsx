'use client';

import React from 'react';

export interface NotificationDrawerProps {
  open: boolean;
  onClose: () => void;
}

export default function NotificationDrawer({ open, onClose }: NotificationDrawerProps) {
  return (
    <>
      <div
        className="dash-notif-backdrop"
        onClick={onClose}
        style={{ opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none' }}
      />
      <aside className="dash-notif-drawer" data-open={open ? 'true' : 'false'} aria-hidden={!open}>
        <div className="dash-notif-header">
          <div className="dash-notif-title">Notifications</div>
          <button className="dash-notif-close" onClick={onClose} aria-label="Close notifications">
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M5 5l14 14M19 5L5 19" />
            </svg>
          </button>
        </div>
        <div className="dash-notif-empty">All caught up!</div>
      </aside>
    </>
  );
}

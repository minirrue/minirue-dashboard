import React from 'react';

export interface ErrorBannerProps {
  message: string;
  animated?: boolean;
  onDismiss?: () => void;
  /** RULEBOOK §27 — full data-trace-id for this banner's REGION, e.g.
   * "PG-DASHBOARD-IAM-001::EL-REGION-login-error-banner". Caller-supplied because this
   * component is reused across multiple pages, each with its own PG-* id. */
  traceId?: string;
}

export default function ErrorBanner({ message, animated = true, onDismiss, traceId }: ErrorBannerProps) {
  return (
    <div className="dash-error-banner" data-animated={animated} data-trace-id={traceId} role="alert">
      <span className="dash-error-banner-message">{message}</span>
      {onDismiss && (
        <button
          type="button"
          className="dash-error-banner-dismiss"
          onClick={onDismiss}
          aria-label="Dismiss error"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}

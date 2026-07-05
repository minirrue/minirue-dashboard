import React from 'react';

export interface ErrorBannerProps {
  message: string;
  animated?: boolean;
  onDismiss?: () => void;
}

export default function ErrorBanner({ message, animated = true, onDismiss }: ErrorBannerProps) {
  return (
    <div className="dash-error-banner" data-animated={animated} role="alert">
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

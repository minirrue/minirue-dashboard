'use client';

export default function DashboardSectionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="dash-card" style={{ padding: 32, textAlign: 'center' }}>
      <p className="dash-inline-error" style={{ display: 'inline-block' }}>
        This page couldn't load.
      </p>
      <p className="dash-help-text" style={{ marginTop: 8 }}>
        {error.message || 'Something went wrong.'}
      </p>
      <button className="dash-btn-secondary" style={{ marginTop: 16 }} onClick={reset}>
        Try again
      </button>
    </div>
  );
}

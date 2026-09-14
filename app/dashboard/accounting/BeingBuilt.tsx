import type { ReactNode } from 'react';

/** Placeholder body for an Accounting tab whose screen lands in a later issue. */
export default function BeingBuilt({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="dash-card acct-building" aria-label={title}>
      <div className="acct-building-head">
        <h2 className="dash-section-title">{title}</h2>
        <span className="acct-building-status">Being built</span>
      </div>
      <p className="acct-building-body">{children}</p>
    </section>
  );
}

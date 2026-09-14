/**
 * Placeholder for the Reach to Profit slider, the USD rate and the result line
 * with Undo (DA-3). The track is drawn, not an input, so nothing here looks
 * operable before it is.
 */
export default function StrategyBar() {
  return (
    <section className="dash-card acct-strategy" aria-label="Pricing strategy">
      <div className="acct-strategy-scale" aria-hidden="true">
        <span className="acct-strategy-end">Reach</span>
        <span className="acct-strategy-track">
          <span className="acct-strategy-thumb" />
        </span>
        <span className="acct-strategy-end">Profit</span>
      </div>
      <p className="acct-strategy-note">
        <span className="acct-building-status">Being built</span>
        The strategy slider and the dollar rate will reprice every System price live, with Undo.
      </p>
    </section>
  );
}

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * VAT needs a switch, because `0` could not say "we do not charge it".
 *
 * #5: VAT was a bare percentage field. `0` was the only way to express "no VAT"
 * and it was ambiguous — disabled, or zero-rated? Nothing on screen said which,
 * and an admin clearing the field could not know what would happen to an
 * invoice.
 *
 * Two things this has to get right beyond adding a checkbox:
 *
 *   - switching VAT off must not DISCARD the configured rate, or turning it back
 *     on means remembering what 14 was
 *   - the rate must visibly not apply while the switch is off, rather than
 *     sitting there looking active
 */

/** The VAT block, in the shape SettingsClient renders it. */
function VatFields({
  initialEnabled,
  initialPct,
  onChange,
}: {
  initialEnabled: boolean;
  initialPct: string;
  onChange?: (state: { enabled: boolean; pct: string }) => void;
}) {
  const [enabled, setEnabled] = React.useState(initialEnabled);
  const [pct, setPct] = React.useState(initialPct);

  React.useEffect(() => {
    onChange?.({ enabled, pct });
  }, [enabled, pct, onChange]);

  return (
    <>
      <label>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        <span>Charge VAT on orders</span>
      </label>
      <label>
        VAT % (Egypt)
        <input
          type="number"
          aria-label="VAT % (Egypt)"
          value={pct}
          onChange={(e) => setPct(e.target.value)}
          disabled={!enabled}
        />
      </label>
      <p>
        {enabled
          ? 'Applied to orders placed from Egypt.'
          : 'VAT is off — this rate is kept but not charged. Turn the switch on to apply it.'}
      </p>
    </>
  );
}

describe('VAT on/off switch', () => {
  it('offers an explicit switch, not just a number', () => {
    render(<VatFields initialEnabled initialPct="14" />);

    expect(screen.getByText('Charge VAT on orders')).toBeInTheDocument();
  });

  it('disables the rate field when VAT is switched off', async () => {
    const user = userEvent.setup();
    render(<VatFields initialEnabled initialPct="14" />);

    await user.click(screen.getByRole('checkbox'));

    expect(screen.getByLabelText('VAT % (Egypt)')).toBeDisabled();
  });

  it('keeps the configured rate when VAT is switched off', async () => {
    // The one that matters: an admin turning VAT off must not lose the 14 they
    // set, or turning it back on becomes a memory test.
    const user = userEvent.setup();
    render(<VatFields initialEnabled initialPct="14" />);

    await user.click(screen.getByRole('checkbox'));

    expect(screen.getByLabelText('VAT % (Egypt)')).toHaveValue(14);
  });

  it('restores the rate when VAT is switched back on', async () => {
    const user = userEvent.setup();
    render(<VatFields initialEnabled initialPct="14" />);

    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('checkbox'));

    expect(screen.getByLabelText('VAT % (Egypt)')).toBeEnabled();
    expect(screen.getByLabelText('VAT % (Egypt)')).toHaveValue(14);
  });

  it('says the rate is not being charged while the switch is off', async () => {
    // Removes the ambiguity the issue is about: the number is visible, so the
    // screen has to say it is not applying.
    const user = userEvent.setup();
    render(<VatFields initialEnabled initialPct="14" />);

    await user.click(screen.getByRole('checkbox'));

    expect(screen.getByText(/kept but not charged/)).toBeInTheDocument();
  });

  it('opens switched off for a shop that had VAT disabled', () => {
    render(<VatFields initialEnabled={false} initialPct="14" />);

    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(screen.getByLabelText('VAT % (Egypt)')).toBeDisabled();
  });
});

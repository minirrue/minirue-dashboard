import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import RibbonEditor from '@/app/dashboard/storefront-appearance/editors/RibbonEditor';
import type { RibbonSection } from '@/lib/api/storefront';

/**
 * Owner, 2026-08-24: "this typing area is bugged cant type or cant enter new
 * line and space make new line".
 *
 * The cause was normalizing INSIDE onChange of a controlled textarea. The value
 * was `items.join('\n')` while onChange did `.split('\n').map(trim).filter(Boolean)`,
 * so the round trip was lossy: pressing Enter produced an empty line that was
 * filtered out before React re-rendered, the newline disappeared, and the caret
 * jumped to the end of the box. A trailing space was eaten by .trim() the same
 * way. The newline only showed up once a real character was typed, which reads
 * as "space makes a new line".
 *
 * The rule these tests hold: what the admin types is exactly what stays on
 * screen. Blank lines are stripped at SAVE time (see storefront-normalize),
 * never while they are still typing.
 */

function harnessSection(items: string[]): RibbonSection {
  return {
    id: 'ribbon-1',
    type: 'ribbon',
    enabled: true,
    order: 0,
    items,
    speedSeconds: 38,
    surface: 'ink',
  };
}

function Harness({ initial }: { initial: string[] }) {
  const [section, setSection] = useState<RibbonSection>(harnessSection(initial));
  return <RibbonEditor section={section} onChange={setSection} />;
}

function textarea(): HTMLTextAreaElement {
  return screen.getByLabelText(/phrases/i) as HTMLTextAreaElement;
}

describe('RibbonEditor — the phrases textarea', () => {
  it('keeps a newline the admin just pressed Enter for', () => {
    render(<Harness initial={['shipping all over egypt']} />);
    fireEvent.change(textarea(), {
      target: { value: 'shipping all over egypt\n' },
    });
    expect(textarea().value).toBe('shipping all over egypt\n');
  });

  it('keeps a space typed at the end of a line', () => {
    render(<Harness initial={['Luxury packaging']} />);
    fireEvent.change(textarea(), { target: { value: 'Luxury packaging ' } });
    expect(textarea().value).toBe('Luxury packaging ');
  });

  it('keeps a blank line in the middle while typing', () => {
    render(<Harness initial={['one', 'two']} />);
    fireEvent.change(textarea(), { target: { value: 'one\n\ntwo' } });
    expect(textarea().value).toBe('one\n\ntwo');
  });

  it('still tells the admin the ribbon is empty when only blank lines remain', () => {
    render(<Harness initial={[]} />);
    fireEvent.change(textarea(), { target: { value: '\n  \n' } });
    expect(screen.getByText(/No phrases yet/i)).toBeInTheDocument();
  });
});

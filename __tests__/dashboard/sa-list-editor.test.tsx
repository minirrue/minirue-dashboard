/**
 * Tests for the Storefront Appearance primitives.
 *
 * The three defects these primitives exist to close (see the header comment
 * in ListEditor.tsx) are each asserted here, because each was previously a
 * per-editor convention that drifted: a cap that is enforced, ONE reorder
 * vocabulary that stops at both ends, a remove prompt sized to the damage,
 * `order` that cannot disagree with array position, and a real empty state.
 */

import * as React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  ListEditor,
  moveItem,
  type ListEditorItem,
} from '@/components/storefront-appearance/ListEditor';
import { SectionShell } from '@/components/storefront-appearance/SectionShell';
import {
  Advisory,
  EmptyState,
  HelpText,
  InlineError,
} from '@/components/storefront-appearance/Messages';

interface Row extends ListEditorItem {
  id: string;
  label: string;
  order?: number;
}

const rows = (...labels: string[]): Row[] =>
  labels.map((label, i) => ({ id: `r${i}`, label }));

/**
 * Renders ListEditor as a controlled component backed by real state, so a
 * test can perform several gestures in sequence and assert on the result —
 * a bare `onChange` spy cannot express "move it up twice".
 */
function Harness({
  initial,
  onChangeSpy,
  ...props
}: {
  initial: Row[];
  onChangeSpy?: (next: Row[]) => void;
} & Partial<React.ComponentProps<typeof ListEditor<Row>>>) {
  const [items, setItems] = React.useState<Row[]>(initial);
  let nextId = items.length;
  return (
    <ListEditor<Row>
      label="Link columns"
      itemNoun="column"
      items={items}
      onChange={(next) => {
        setItems(next);
        onChangeSpy?.(next);
      }}
      createItem={() => ({ id: `new${nextId++}`, label: '' })}
      rowTitle={(item) => item.label || 'Untitled'}
      renderItem={({ item, update }) => (
        <input
          aria-label={`Label for ${item.label || 'Untitled'}`}
          value={item.label}
          onChange={(e) => update({ ...item, label: e.target.value })}
        />
      )}
      {...props}
    />
  );
}

const rowTitles = () =>
  screen
    .getAllByRole('listitem')
    .map((li) => within(li).getAllByRole('heading')[0].textContent);

describe('moveItem', () => {
  it('swaps neighbours', () => {
    expect(moveItem([1, 2, 3], 0, 1)).toEqual([2, 1, 3]);
    expect(moveItem([1, 2, 3], 2, -1)).toEqual([1, 3, 2]);
  });

  it('returns the SAME reference at either end, so a no-op cannot dirty the form', () => {
    const list = [1, 2, 3];
    expect(moveItem(list, 0, -1)).toBe(list);
    expect(moveItem(list, 2, 1)).toBe(list);
  });

  it('returns the same reference for an out-of-range index', () => {
    const list = [1, 2, 3];
    expect(moveItem(list, -1, 1)).toBe(list);
    expect(moveItem(list, 9, -1)).toBe(list);
  });
});

describe('ListEditor — cap enforcement (defect 3)', () => {
  it('disables Add at the cap and says why, rather than hiding it', async () => {
    render(<Harness initial={rows('a', 'b')} max={2} />);

    const add = screen.getByRole('button', { name: /add column/i });
    // Visible-but-disabled: the merchant can still see the feature exists.
    expect(add).toBeInTheDocument();
    expect(add).toBeDisabled();
    expect(screen.getByText(/that is the maximum \(2\)/i)).toBeInTheDocument();
  });

  it('ties the reason to the button with aria-describedby', () => {
    render(<Harness initial={rows('a', 'b')} max={2} />);
    const add = screen.getByRole('button', { name: /add column/i });
    const describedBy = add.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent(/that is the maximum/i);
  });

  it('does not show the cap message below the cap, and Add works', async () => {
    const user = userEvent.setup();
    render(<Harness initial={rows('a')} max={2} />);

    expect(screen.queryByText(/that is the maximum/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /add column/i }));

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /add column/i })).toBeDisabled();
  });

  it('never exceeds the cap even across repeated adds', async () => {
    const user = userEvent.setup();
    const spy = jest.fn();
    render(<Harness initial={[]} max={3} onChangeSpy={spy} />);

    const add = () => screen.getByRole('button', { name: /add column/i });
    await user.click(add());
    await user.click(add());
    await user.click(add());
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(add()).toBeDisabled();

    // Every emitted list is within the cap.
    for (const call of spy.mock.calls) expect(call[0].length).toBeLessThanOrEqual(3);
  });

  it('has no cap message and an enabled Add when max is omitted', () => {
    render(<Harness initial={rows('a', 'b', 'c')} />);
    expect(screen.getByRole('button', { name: /add column/i })).toBeEnabled();
    expect(screen.queryByText(/that is the maximum/i)).not.toBeInTheDocument();
  });
});

describe('ListEditor — reorder (defect 1)', () => {
  it('uses one vocabulary: Move up / Move down, never left/right', () => {
    render(<Harness initial={rows('a', 'b', 'c')} />);

    expect(screen.getAllByRole('button', { name: 'Move up' })).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: 'Move down' })).toHaveLength(3);
    expect(screen.queryByRole('button', { name: /move left|move right/i })).toBeNull();
    // and not the bare adverb form either
    expect(screen.queryByRole('button', { name: /^(up|down)$/i })).toBeNull();
  });

  it('disables Move up on the first row and Move down on the last', () => {
    render(<Harness initial={rows('a', 'b', 'c')} />);
    const items = screen.getAllByRole('listitem');

    expect(within(items[0]).getByRole('button', { name: 'Move up' })).toBeDisabled();
    expect(within(items[0]).getByRole('button', { name: 'Move down' })).toBeEnabled();

    expect(within(items[2]).getByRole('button', { name: 'Move up' })).toBeEnabled();
    expect(within(items[2]).getByRole('button', { name: 'Move down' })).toBeDisabled();

    expect(within(items[1]).getByRole('button', { name: 'Move up' })).toBeEnabled();
    expect(within(items[1]).getByRole('button', { name: 'Move down' })).toBeEnabled();
  });

  it('a single row has both ends disabled', () => {
    render(<Harness initial={rows('only')} />);
    expect(screen.getByRole('button', { name: 'Move up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move down' })).toBeDisabled();
  });

  it('actually reorders in both directions', async () => {
    const user = userEvent.setup();
    render(<Harness initial={rows('a', 'b', 'c')} />);

    expect(rowTitles()).toEqual(['1.a', '2.b', '3.c']);

    await user.click(
      within(screen.getAllByRole('listitem')[2]).getByRole('button', { name: 'Move up' }),
    );
    expect(rowTitles()).toEqual(['1.a', '2.c', '3.b']);

    await user.click(
      within(screen.getAllByRole('listitem')[0]).getByRole('button', { name: 'Move down' }),
    );
    expect(rowTitles()).toEqual(['1.c', '2.a', '3.b']);
  });

  it('hides the reorder buttons when reorderable is false', () => {
    render(<Harness initial={rows('a', 'b')} reorderable={false} />);
    expect(screen.queryByRole('button', { name: 'Move up' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Move down' })).toBeNull();
  });
});

describe('ListEditor — remove with a confirm sized to the damage (defect 2)', () => {
  let confirmSpy: jest.SpyInstance<boolean, [message?: string]>;

  beforeEach(() => {
    confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
  });
  afterEach(() => {
    confirmSpy.mockRestore();
  });

  it('removes with no prompt when confirmRemove is not supplied', async () => {
    const user = userEvent.setup();
    render(<Harness initial={rows('a', 'b')} />);

    await user.click(
      within(screen.getAllByRole('listitem')[0]).getByRole('button', { name: 'Remove' }),
    );

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(rowTitles()).toEqual(['1.b']);
  });

  it('stays silent for a cheap row and warns for an expensive one', async () => {
    const user = userEvent.setup();
    // An empty column costs nothing; a column with links takes them with it.
    const linkCounts: Record<string, number> = { empty: 0, heavy: 5 };
    const confirmRemove = (item: Row) =>
      linkCounts[item.label] > 0
        ? `Remove "${item.label}"? This also deletes the ${linkCounts[item.label]} links inside it.`
        : null;

    render(<Harness initial={rows('empty', 'heavy')} confirmRemove={confirmRemove} />);

    // Cheap row: no prompt at all.
    await user.click(
      within(screen.getAllByRole('listitem')[0]).getByRole('button', { name: 'Remove' }),
    );
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(rowTitles()).toEqual(['1.heavy']);

    // Expensive row: prompt naming exactly what is destroyed.
    await user.click(
      within(screen.getAllByRole('listitem')[0]).getByRole('button', { name: 'Remove' }),
    );
    expect(confirmSpy).toHaveBeenCalledWith(
      'Remove "heavy"? This also deletes the 5 links inside it.',
    );
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('keeps the row when the merchant cancels', async () => {
    const user = userEvent.setup();
    confirmSpy.mockReturnValue(false);
    const spy = jest.fn();

    render(
      <Harness
        initial={rows('a', 'b')}
        onChangeSpy={spy}
        confirmRemove={(item) => `Remove ${item.label}?`}
      />,
    );

    await user.click(
      within(screen.getAllByRole('listitem')[0]).getByRole('button', { name: 'Remove' }),
    );

    expect(confirmSpy).toHaveBeenCalled();
    expect(rowTitles()).toEqual(['1.a', '2.b']);
    expect(spy).not.toHaveBeenCalled();
  });

  it('hides the Remove button when removable is false', () => {
    render(<Harness initial={rows('a')} removable={false} />);
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
  });
});

describe('ListEditor — order renumbering', () => {
  it('renumbers order to array position after a move', async () => {
    const user = userEvent.setup();
    const spy = jest.fn();
    render(<Harness initial={rows('a', 'b', 'c')} renumberOrder onChangeSpy={spy} />);

    await user.click(
      within(screen.getAllByRole('listitem')[2]).getByRole('button', { name: 'Move up' }),
    );

    expect(spy).toHaveBeenCalledWith([
      { id: 'r0', label: 'a', order: 0 },
      { id: 'r2', label: 'c', order: 1 },
      { id: 'r1', label: 'b', order: 2 },
    ]);
  });

  it('renumbers after a remove, leaving no gap', async () => {
    const user = userEvent.setup();
    const spy = jest.fn();
    render(<Harness initial={rows('a', 'b', 'c')} renumberOrder onChangeSpy={spy} />);

    await user.click(
      within(screen.getAllByRole('listitem')[0]).getByRole('button', { name: 'Remove' }),
    );

    expect(spy).toHaveBeenCalledWith([
      { id: 'r1', label: 'b', order: 0 },
      { id: 'r2', label: 'c', order: 1 },
    ]);
  });

  it('renumbers after an add', async () => {
    const user = userEvent.setup();
    const spy = jest.fn();
    render(<Harness initial={rows('a')} renumberOrder onChangeSpy={spy} />);

    await user.click(screen.getByRole('button', { name: /add column/i }));

    expect(spy.mock.calls[0][0].map((r: Row) => r.order)).toEqual([0, 1]);
  });

  it('does NOT renumber on a plain field edit', async () => {
    const user = userEvent.setup();
    const spy = jest.fn();
    render(<Harness initial={rows('a', 'b')} renumberOrder onChangeSpy={spy} />);

    await user.type(screen.getByLabelText('Label for a'), 'x');

    // The edit is emitted untouched — order is not rewritten on every keystroke.
    expect(spy).toHaveBeenCalledWith([
      { id: 'r0', label: 'ax' },
      { id: 'r1', label: 'b' },
    ]);
  });

  it('leaves order alone when renumberOrder is off', async () => {
    const user = userEvent.setup();
    const spy = jest.fn();
    render(<Harness initial={rows('a', 'b')} onChangeSpy={spy} />);

    await user.click(
      within(screen.getAllByRole('listitem')[0]).getByRole('button', { name: 'Move down' }),
    );

    expect(spy).toHaveBeenCalledWith([
      { id: 'r1', label: 'b' },
      { id: 'r0', label: 'a' },
    ]);
  });
});

describe('ListEditor — empty state', () => {
  it('shows an empty state instead of a bare list', () => {
    render(
      <Harness
        initial={[]}
        emptyDescription="The footer will show no links at all."
      />,
    );

    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    expect(screen.getByText('No columns yet')).toBeInTheDocument();
    expect(screen.getByText('The footer will show no links at all.')).toBeInTheDocument();
  });

  it('replaces the empty state with rows once one is added', async () => {
    const user = userEvent.setup();
    render(<Harness initial={[]} />);

    expect(screen.getByText('No columns yet')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /add column/i }));

    expect(screen.queryByText('No columns yet')).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('honours a custom empty title', () => {
    render(<Harness initial={[]} emptyTitle="Nothing in the footer" />);
    expect(screen.getByText('Nothing in the footer')).toBeInTheDocument();
  });
});

describe('ListEditor — keys and disabled', () => {
  it('keys rows by id, so an input keeps its row across a reorder', async () => {
    const user = userEvent.setup();
    render(<Harness initial={rows('a', 'b')} />);

    await user.click(
      within(screen.getAllByRole('listitem')[1]).getByRole('button', { name: 'Move up' }),
    );

    // The input still belongs to "b", which is now first.
    const first = screen.getAllByRole('listitem')[0];
    expect(within(first).getByRole('textbox')).toHaveValue('b');
  });

  it('disables every control when disabled', () => {
    render(<Harness initial={rows('a', 'b')} disabled />);

    expect(screen.getByRole('button', { name: /add column/i })).toBeDisabled();
    for (const name of ['Move up', 'Move down', 'Remove']) {
      for (const b of screen.getAllByRole('button', { name })) expect(b).toBeDisabled();
    }
  });
});

describe('SectionShell', () => {
  it('renders a heading, description and action slot', () => {
    render(
      <SectionShell title="Link columns" description="Shown at the foot of every page." action={<button type="button">Add</button>}>
        <p>body</p>
      </SectionShell>,
    );

    expect(screen.getByRole('heading', { name: 'Link columns' })).toBeInTheDocument();
    expect(screen.getByText('Shown at the foot of every page.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });

  it('gives each nested level a different surface and heading rank', () => {
    const { container } = render(
      <SectionShell title="Footer">
        <SectionShell title="Column">
          <SectionShell title="Link">
            <span>deep</span>
          </SectionShell>
        </SectionShell>
      </SectionShell>,
    );

    const shells = Array.from(container.querySelectorAll('[data-slot="section-shell"]'));
    expect(shells.map((s) => s.getAttribute('data-level'))).toEqual(['1', '2', '3']);

    // Different surfaces, not three copies of .dash-form-card.
    const classes = shells.map((s) => s.className);
    expect(classes[0]).toContain('bg-card');
    expect(classes[1]).toContain('bg-muted/50');
    expect(classes[2]).toContain('border-l-2');
    expect(new Set(classes).size).toBe(3);

    // Document outline follows the visual hierarchy.
    expect(screen.getByRole('heading', { name: 'Footer', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Column', level: 3 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Link', level: 4 })).toBeInTheDocument();
  });

  it('caps the level at 3 however deep the nesting goes', () => {
    const { container } = render(
      <SectionShell title="1">
        <SectionShell title="2">
          <SectionShell title="3">
            <SectionShell title="4">
              <SectionShell title="5">deep</SectionShell>
            </SectionShell>
          </SectionShell>
        </SectionShell>
      </SectionShell>,
    );

    const levels = Array.from(container.querySelectorAll('[data-slot="section-shell"]')).map((s) =>
      s.getAttribute('data-level'),
    );
    expect(levels).toEqual(['1', '2', '3', '3', '3']);
  });

  it('shrinks padding as depth grows rather than keeping 24px at every level', () => {
    const { container } = render(
      <SectionShell title="a">
        <SectionShell title="b">
          <SectionShell title="c">x</SectionShell>
        </SectionShell>
      </SectionShell>,
    );
    const classes = Array.from(container.querySelectorAll('[data-slot="section-shell"]')).map(
      (s) => s.className,
    );
    expect(classes[0]).toContain('p-5');
    expect(classes[1]).toContain('p-3.5');
    expect(classes[2]).toContain('pl-3');
  });

  it('is not collapsible by default: no toggle, body always present', () => {
    render(
      <SectionShell title="Slides">
        <p>body</p>
      </SectionShell>,
    );
    expect(screen.queryByRole('button', { expanded: true })).toBeNull();
    expect(screen.queryByRole('button', { expanded: false })).toBeNull();
    expect(screen.getByText('body')).toBeInTheDocument();
  });

  it('collapses and expands when collapsible', async () => {
    const user = userEvent.setup();
    render(
      <SectionShell title="Slides" collapsible defaultOpen={false}>
        <p>body</p>
      </SectionShell>,
    );
    expect(screen.queryByText('body')).not.toBeInTheDocument();

    const toggle = screen.getByRole('button', { name: /slides/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(screen.getByText('body')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /slides/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('dims and blocks interaction when disabled', () => {
    const { container } = render(
      <SectionShell title="Hidden section" disabled>
        <p>body</p>
      </SectionShell>,
    );
    const shell = container.querySelector('[data-slot="section-shell"]')!;
    expect(shell).toHaveAttribute('data-disabled', 'true');
    expect(shell.className).toContain('pointer-events-none');
    expect(shell.className).toContain('opacity-55');
  });
});

describe('Messages', () => {
  it('HelpText is muted annotation, not body content', () => {
    render(<HelpText>Up to 6 columns.</HelpText>);
    const el = screen.getByText('Up to 6 columns.');
    // The defect being fixed: .dash-hint had no rule at all, so guidance
    // rendered at full body size. This one carries real, smaller styling.
    expect(el.className).toContain('text-muted-foreground');
    expect(el.className).toContain('text-[13px]');
  });

  it('Advisory is a polite status, NOT an alert', () => {
    render(<Advisory title="This section will render empty.">Add a product to fix it.</Advisory>);
    const el = screen.getByRole('status');
    expect(el).toHaveTextContent('This section will render empty.');
    expect(el).toHaveTextContent('Add a product to fix it.');
    // The misuse being fixed: a consequence must not be painted as an error.
    expect(screen.queryByRole('alert')).toBeNull();
    expect(el.className).not.toContain('text-destructive');
  });

  it('InlineError is an assertive alert', () => {
    render(<InlineError>Could not load products.</InlineError>);
    const el = screen.getByRole('alert');
    expect(el).toHaveTextContent('Could not load products.');
    expect(el.className).toContain('text-destructive');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('EmptyState carries a title, a consequence and an action', () => {
    render(
      <EmptyState title="No columns yet" action={<button type="button">Add column</button>}>
        The footer will show no links.
      </EmptyState>,
    );
    expect(screen.getByText('No columns yet')).toBeInTheDocument();
    expect(screen.getByText('The footer will show no links.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add column' })).toBeInTheDocument();
  });
});

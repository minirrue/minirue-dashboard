import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  ColorField,
  NumberField,
  SelectField,
  TextAreaField,
  TextField,
  ToggleRow,
  classifyFreeColor,
  clampNumber,
} from '@/components/storefront-appearance/fields';
import { HERO_COLOR_PATTERN, HERO_COLOR_THEME_DEFAULTS } from '@/lib/hero-slide-colors';

/**
 * The field primitives for the Storefront Appearance rebuild (#102).
 *
 * These tests are written against the four defects the primitives exist to
 * close, not against their rendering. Each block names the defect and the
 * call sites it was found at, so a future change that reintroduces one fails
 * here with an explanation rather than a diff.
 */

/**
 * Radix builds Select on pointer capture and scroll-into-view, neither of
 * which jsdom implements — without these the trigger throws
 * `target.hasPointerCapture is not a function` on the first click and the
 * component looks broken when it is the environment that is missing.
 */
beforeAll(() => {
  const proto = window.Element.prototype as unknown as Record<string, unknown>;
  if (typeof proto.hasPointerCapture !== 'function') proto.hasPointerCapture = () => false;
  if (typeof proto.setPointerCapture !== 'function') proto.setPointerCapture = () => undefined;
  if (typeof proto.releasePointerCapture !== 'function') {
    proto.releasePointerCapture = () => undefined;
  }
  if (typeof proto.scrollIntoView !== 'function') proto.scrollIntoView = () => undefined;
  if (typeof window.ResizeObserver !== 'function') {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

/**
 * These are controlled components, so a test that types more than one
 * character has to hold the value for them — with a fixed `value` prop every
 * keystroke is applied to the same starting string and nothing accumulates.
 * `onChange` is still a spy, so assertions about what was emitted are unchanged.
 */
function Controlled<P extends { value: unknown; onChange: (next: never) => void }>({
  as: Component,
  initial,
  spy,
  ...rest
}: {
  as: React.ComponentType<P>;
  initial: P['value'];
  spy: jest.Mock;
} & Omit<P, 'value' | 'onChange'>) {
  const [value, setValue] = React.useState(initial);
  const props = {
    ...rest,
    value,
    onChange: (next: unknown) => {
      spy(next);
      setValue(next as P['value']);
    },
  } as unknown as P;
  return <Component {...props} />;
}

// ---------------------------------------------------------------------------
// Defect 1 — maxLength is set on exactly two inputs in the whole tab
// (ProductSectionEditor:272 and the hex box at HeroSlideColors:143). Over 40
// fields have a backend maximum and no client guard, and a value past it 400s
// the WHOLE layout save, not just the field.
// ---------------------------------------------------------------------------

describe('TextField guards the backend limit', () => {
  it('puts the limit on the DOM node, so the browser refuses the extra keystroke', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    // `ctaLabel` is 60 on the backend and unguarded today at HeroEditor:420.
    render(<Controlled as={TextField} initial="" spy={onChange} label="Button label" maxLength={60} />);

    const input = screen.getByLabelText('Button label');
    expect(input).toHaveAttribute('maxlength', '60');

    await user.type(input, 'x'.repeat(70));

    // The browser stops accepting keystrokes at the limit, so the field can
    // never be the thing that sends a 61st character to the backend.
    expect(input).toHaveValue('x'.repeat(60));
    const last = onChange.mock.calls.at(-1)?.[0] as string;
    expect(last).toHaveLength(60);
  });

  it('caps a value that arrives past the limit without going through the keyboard', () => {
    const onChange = jest.fn();
    render(<TextField label="Headline" value="" maxLength={200} onChange={onChange} />);

    // A paste, or anything else that bypasses the DOM guard. The field must
    // still be incapable of emitting an over-length value.
    fireEvent.change(screen.getByLabelText('Headline'), { target: { value: 'a'.repeat(250) } });

    expect(onChange).toHaveBeenCalledWith('a'.repeat(200));
  });

  it('counts down as the limit approaches, and says nothing before that', () => {
    const { rerender } = render(
      <TextField label="Headline" value={'a'.repeat(100)} maxLength={200} onChange={jest.fn()} />,
    );
    // 100 characters into a 200 limit is not news.
    expect(screen.queryByText(/characters left/)).not.toBeInTheDocument();

    rerender(
      <TextField label="Headline" value={'a'.repeat(195)} maxLength={200} onChange={jest.fn()} />,
    );
    expect(screen.getByText('5 characters left')).toBeInTheDocument();

    rerender(
      <TextField label="Headline" value={'a'.repeat(200)} maxLength={200} onChange={jest.fn()} />,
    );
    expect(screen.getByText('No characters left')).toBeInTheDocument();
  });

  it('shows — and does not silently truncate — a stored value already over the limit', () => {
    // These limits are not enforced client-side today, so over-length values
    // can already be in the layout. Cutting the admin's copy on sight would be
    // worse than telling them.
    render(<TextField label="Tagline" value={'a'.repeat(210)} maxLength={200} onChange={jest.fn()} />);

    expect(screen.getByLabelText('Tagline')).toHaveValue('a'.repeat(210));
    // The counter is terse because it updates per keystroke; the error line
    // says what to do about it. Two different sentences, not one printed twice.
    expect(screen.getByText('10 over')).toBeInTheDocument();
    expect(
      screen.getByText('Too long to save — remove 10 characters. The limit is 200.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Tagline')).toHaveAttribute('aria-invalid', 'true');
  });

  it('leaves an unlimited field uncounted rather than inventing a limit', () => {
    render(<TextField label="Free" value="anything" onChange={jest.fn()} />);
    expect(screen.getByLabelText('Free')).not.toHaveAttribute('maxlength');
    expect(screen.queryByText(/characters left/)).not.toBeInTheDocument();
  });
});

describe('TextAreaField guards the long limits', () => {
  it('carries the limit and the counter the same way', () => {
    // `newsletterBlurb` is 400 and unguarded today.
    render(
      <TextAreaField
        label="Newsletter blurb"
        value={'a'.repeat(399)}
        maxLength={400}
        onChange={jest.fn()}
      />,
    );

    expect(screen.getByLabelText('Newsletter blurb')).toHaveAttribute('maxlength', '400');
    expect(screen.getByText('1 characters left')).toBeInTheDocument();
  });

  it('caps an over-length change', () => {
    const onChange = jest.fn();
    render(<TextAreaField label="Body" value="" maxLength={50} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'b'.repeat(80) } });
    expect(onChange).toHaveBeenCalledWith('b'.repeat(50));
  });
});

// ---------------------------------------------------------------------------
// Defect 2 — the clamp is written out five times and one of them is wrong.
// TrustEditor:54 does `Math.max(0, Math.trunc(Number(raw)))` and ignores its
// own `max={3650}` attribute, so a typed 99999 reaches the backend.
// ---------------------------------------------------------------------------

describe('NumberField actually enforces its maximum', () => {
  it('clamps a typed value above the max — the TrustEditor:54 bug', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <NumberField
        label="Returns window"
        value={null}
        min={0}
        max={3650}
        allowEmpty
        onChange={onChange}
      />,
    );

    await user.type(screen.getByLabelText('Returns window'), '99999');

    // The attribute alone never stopped this: `max` constrains the spinner,
    // not the keyboard.
    expect(screen.getByLabelText('Returns window')).toHaveAttribute('max', '3650');
    expect(onChange.mock.calls.at(-1)?.[0]).toBe(3650);
    for (const [n] of onChange.mock.calls) {
      if (n !== null) expect(n).toBeLessThanOrEqual(3650);
    }
  });

  it('clamps below the minimum too', () => {
    const onChange = jest.fn();
    render(<NumberField label="Seconds per slide" value={6} min={2} max={30} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Seconds per slide'), { target: { value: '0' } });
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('stays typeable across a minimum, which the four hand-written clamps are not', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    // RibbonEditor:60 is 10–180. Clearing and typing "45" there clamps the "4"
    // to 10, re-renders the box as "10", and the "5" lands making 105.
    render(<NumberField label="Speed" value={60} min={10} max={180} onChange={onChange} />);

    const input = screen.getByLabelText('Speed');
    await user.clear(input);
    await user.type(input, '45');

    // The box shows what was typed…
    expect(input).toHaveValue(45);
    // …and the parent ends up with it, not with 105.
    expect(onChange.mock.calls.at(-1)?.[0]).toBe(45);
  });

  it('truncates to whole numbers when the step is a whole number', () => {
    const onChange = jest.fn();
    render(<NumberField label="Columns" value={3} min={1} max={24} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Columns'), { target: { value: '7.9' } });
    expect(onChange).toHaveBeenCalledWith(7);
  });

  it('keeps fractions when the step is fractional', () => {
    const onChange = jest.fn();
    render(<NumberField label="Ratio" value={1} min={0} max={10} step={0.1} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Ratio'), { target: { value: '2.5' } });
    expect(onChange).toHaveBeenCalledWith(2.5);
  });

  describe('the nullable-empty policy', () => {
    it('writes a real null when blank is a value', () => {
      const onChange = jest.fn();
      render(
        <NumberField label="Returns window" value={14} min={0} max={3650} allowEmpty onChange={onChange} />,
      );

      fireEvent.change(screen.getByLabelText('Returns window'), { target: { value: '' } });
      expect(onChange).toHaveBeenCalledWith(null);
    });

    it('writes nothing at all when blank is just a box mid-edit', () => {
      const onChange = jest.fn();
      // HeroEditor:326. `Number('')` is 0, and a 0ms autoplay interval is a
      // hero that never advances.
      render(<NumberField label="Seconds per slide" value={6} min={2} max={30} onChange={onChange} />);

      fireEvent.change(screen.getByLabelText('Seconds per slide'), { target: { value: '' } });
      expect(onChange).not.toHaveBeenCalled();
    });

    it('holds its peace on a half-typed number rather than emitting NaN', () => {
      const onChange = jest.fn();
      render(<NumberField label="Speed" value={60} min={10} max={180} onChange={onChange} />);

      fireEvent.change(screen.getByLabelText('Speed'), { target: { value: '-' } });
      expect(onChange).not.toHaveBeenCalled();
    });

    it('settles a non-nullable field on its minimum when it is left blank', () => {
      const onChange = jest.fn();
      render(<NumberField label="Seconds per slide" value={null} min={2} max={30} onChange={onChange} />);

      fireEvent.blur(screen.getByLabelText('Seconds per slide'));
      expect(onChange).toHaveBeenCalledWith(2);
    });
  });

  it('exposes the one clamp every bounded number goes through', () => {
    expect(clampNumber(99999, { min: 0, max: 3650, integer: true })).toBe(3650);
    expect(clampNumber(-5, { min: 0, max: 3650, integer: true })).toBe(0);
    expect(clampNumber(7.9, { min: 1, max: 24, integer: true })).toBe(7);
    expect(clampNumber(7.9, { min: 1, max: 24, integer: false })).toBe(7.9);
    expect(clampNumber(500, { integer: true })).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// Defect 3 — `e.target.value || null` at 11 sites, and trim-on-blur on 5
// fields in the whole tab. Hero text runs, nav labels, shortcut labels,
// legalLine, secondaryLine, newsletterBlurb and page titles are never trimmed.
// ---------------------------------------------------------------------------

describe('the empty and trim policy is a prop, not a call-site decision', () => {
  it('trims on blur by default — which almost nothing in the tab does today', () => {
    const onChange = jest.fn();
    render(<TextField label="Headline" value="  Oud Royale  " onChange={onChange} />);

    fireEvent.blur(screen.getByLabelText('Headline'));
    expect(onChange).toHaveBeenCalledWith('Oud Royale');
  });

  it('leaves whitespace alone while it is being typed', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<Controlled as={TextField} initial="" spy={onChange} label="Headline" />);

    // Trimming per keystroke makes a space impossible to type: the character
    // is deleted before the next one arrives.
    await user.type(screen.getByLabelText('Headline'), 'a b');
    expect(onChange).toHaveBeenLastCalledWith('a b');
  });

  it('can be told not to trim', () => {
    const onChange = jest.fn();
    render(<TextField label="Headline" value="  spaced  " trim={false} onChange={onChange} />);

    fireEvent.blur(screen.getByLabelText('Headline'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('stores an emptied nullable field as a real null', () => {
    const onChange = jest.fn();
    render(<TextField label="Favicon URL" value="https://x/f.ico" emptyAs="null" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Favicon URL'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('turns whitespace-only into null on blur, not into spaces', () => {
    const onChange = jest.fn();
    render(<TextField label="Scroll hint" value="   " emptyAs="null" onChange={onChange} />);

    fireEvent.blur(screen.getByLabelText('Scroll hint'));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("stores an emptied non-nullable field as '' and never as null", () => {
    const onChange = jest.fn();
    render(<TextField label="Headline" value="Oud" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Headline'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith('');
    expect(onChange).not.toHaveBeenCalledWith(null);
  });

  it('applies the same policy to a textarea', () => {
    const onChange = jest.fn();
    render(<TextAreaField label="Blurb" value="  hello  " emptyAs="null" onChange={onChange} />);

    fireEvent.blur(screen.getByLabelText('Blurb'));
    expect(onChange).toHaveBeenCalledWith('hello');
  });

  it('trims before deciding a field is empty, not after', () => {
    const onChange = jest.fn();
    render(<TextAreaField label="Blurb" value=" " emptyAs="null" onChange={onChange} />);

    fireEvent.blur(screen.getByLabelText('Blurb'));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});

describe('SelectField carries the same policy', () => {
  const BOTTLES = [
    { value: 'amber', label: 'Amber' },
    { value: 'clear', label: 'Clear' },
  ];

  it('selects an option', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <SelectField label="Bottle artwork" value={null} options={BOTTLES} emptyAs="null" emptyLabel="None" onChange={onChange} />,
    );

    await user.click(screen.getByRole('combobox', { name: 'Bottle artwork' }));
    await user.click(await screen.findByRole('option', { name: 'Amber' }));

    expect(onChange).toHaveBeenCalledWith('amber');
  });

  it('turns the empty choice into a real null — the `|| null` at HeroEditor:558', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <SelectField label="Bottle artwork" value="amber" options={BOTTLES} emptyAs="null" emptyLabel="None" onChange={onChange} />,
    );

    await user.click(screen.getByRole('combobox', { name: 'Bottle artwork' }));
    await user.click(await screen.findByRole('option', { name: 'None' }));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("turns the empty choice into '' for a non-nullable column", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <SelectField label="Bottle artwork" value="amber" options={BOTTLES} emptyLabel="None" onChange={onChange} />,
    );

    await user.click(screen.getByRole('combobox', { name: 'Bottle artwork' }));
    await user.click(await screen.findByRole('option', { name: 'None' }));

    expect(onChange).toHaveBeenCalledWith('');
  });

  it('offers no empty choice when the field cannot be emptied', async () => {
    const user = userEvent.setup();
    render(<SelectField label="Mode" value="image" options={BOTTLES} onChange={jest.fn()} />);

    await user.click(screen.getByRole('combobox', { name: 'Mode' }));
    expect(await screen.findByRole('option', { name: 'Amber' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'None' })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Defect 4 — six toggle rows, three different inline style objects
// (SectionCard:42, StorefrontAppearanceClient:454, FooterEditor:68 and :250,
// PagesEditor:196, ProductSectionEditor:302).
// ---------------------------------------------------------------------------

describe('ToggleRow', () => {
  it('announces as a switch with a state, not as an unlabelled checkbox', () => {
    render(<ToggleRow label="Show" checked onChange={jest.fn()} />);

    const control = screen.getByRole('switch', { name: 'Show' });
    expect(control).toBeChecked();
  });

  it('toggles both ways', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const { rerender } = render(<ToggleRow label="Show" checked={false} onChange={onChange} />);

    await user.click(screen.getByRole('switch', { name: 'Show' }));
    expect(onChange).toHaveBeenLastCalledWith(true);

    rerender(<ToggleRow label="Show" checked onChange={onChange} />);
    await user.click(screen.getByRole('switch', { name: 'Show' }));
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it('describes the switch with its help text without making the help clickable', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <ToggleRow
        label="Show"
        checked
        help="Hidden keeps its settings, just off the live page"
        onChange={onChange}
      />,
    );

    const help = screen.getByText('Hidden keeps its settings, just off the live page');
    expect(screen.getByRole('switch', { name: 'Show' })).toHaveAttribute(
      'aria-describedby',
      help.id,
    );

    // Today the help hangs inside the <label>, so reading it toggles the section.
    await user.click(help);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not fire while disabled', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<ToggleRow label="Show" checked disabled onChange={onChange} />);

    await user.click(screen.getByRole('switch', { name: 'Show' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Defect 5 — ColorField. The hex half preserves HeroSlideColors exactly; the
// free half is what HeroEditor:550 "Background (colour or gradient)" never had.
// ---------------------------------------------------------------------------

describe('ColorField, hex mode: null is a real state', () => {
  const hex = (over: Partial<React.ComponentProps<typeof ColorField>> = {}) => {
    const onChange = jest.fn();
    render(
      <ColorField
        label="Tagline"
        value={null}
        themeDefault={HERO_COLOR_THEME_DEFAULTS.taglineColor}
        onChange={onChange}
        {...(over as object)}
      />,
    );
    return { onChange };
  };

  it('renders no colour input at all while the field is unset', () => {
    const { container } = render(
      <ColorField
        label="Tagline"
        value={null}
        themeDefault={HERO_COLOR_THEME_DEFAULTS.taglineColor}
        onChange={jest.fn()}
      />,
    );

    // There is nothing on screen that can commit #000000, by construction.
    expect(container.querySelectorAll('input[type="color"]')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Pick a colour' })).toBeInTheDocument();
  });

  it('patches nothing on mount', () => {
    const { onChange } = hex();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('seeds the theme colour when asked for a picker, never #000000', async () => {
    const user = userEvent.setup();
    const { onChange } = hex();

    await user.click(screen.getByRole('button', { name: 'Pick a colour' }));

    expect(onChange).toHaveBeenCalledWith(HERO_COLOR_THEME_DEFAULTS.taglineColor);
    expect(onChange).not.toHaveBeenCalledWith('#000000');
  });

  it('shows a picker and a hex box once set', () => {
    const { container } = render(
      <ColorField label="Tagline" value="#ff0000" themeDefault="#f6f2e9" onChange={jest.fn()} />,
    );

    expect(container.querySelectorAll('input[type="color"]')).toHaveLength(1);
    expect(screen.getByLabelText('Tagline hex code')).toHaveValue('#ff0000');
  });

  it('commits only values matching the pinned backend regex while the admin types', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<ColorField label="Tagline" value="#ff0000" themeDefault="#f6f2e9" onChange={onChange} />);

    const box = screen.getByLabelText('Tagline hex code');
    await user.clear(box);
    await user.type(box, '#1a2b3c');

    // "#", "#1", "#1a" … each fails the regex, and zod rejects the WHOLE
    // layout on one bad value rather than just the field.
    for (const [next] of onChange.mock.calls) {
      expect(next).toMatch(HERO_COLOR_PATTERN);
    }
    expect(onChange).toHaveBeenCalledWith('#1a2b3c');
  });

  it('flags an uncommittable draft without discarding it or the saved value', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<ColorField label="Tagline" value="#ff0000" themeDefault="#f6f2e9" onChange={onChange} />);

    const box = screen.getByLabelText('Tagline hex code');
    await user.clear(box);
    await user.type(box, 'zz');

    expect(screen.getByText(/Not a hex colour yet/)).toBeInTheDocument();
    expect(box).toHaveValue('zz'); // the draft survives being wrong
    expect(onChange).not.toHaveBeenCalled();
  });

  it('snaps back to the stored value when a bad draft is abandoned', async () => {
    const user = userEvent.setup();
    render(<ColorField label="Tagline" value="#ff0000" themeDefault="#f6f2e9" onChange={jest.fn()} />);

    const box = screen.getByLabelText('Tagline hex code');
    await user.clear(box);
    await user.type(box, 'zz');
    fireEvent.blur(box);

    // The box must never lie about what is actually saved.
    expect(box).toHaveValue('#ff0000');
    expect(screen.queryByText(/Not a hex colour yet/)).not.toBeInTheDocument();
  });

  it('accepts the two things people actually do: no hash, and capitals', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<ColorField label="Tagline" value="#ff0000" themeDefault="#f6f2e9" onChange={onChange} />);

    const box = screen.getByLabelText('Tagline hex code');
    await user.clear(box);
    await user.type(box, 'AABBCC');

    expect(onChange).toHaveBeenCalledWith('#aabbcc');
  });

  it('resets to a real null, never to an empty string and never to black', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<ColorField label="Tagline" value="#ff0000" themeDefault="#f6f2e9" onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Theme default' }));

    expect(onChange).toHaveBeenCalledWith(null);
    // '' passes every `!value` check, looks cleared, and fails the backend regex.
    expect(onChange.mock.calls[0][0]).not.toBe('');
    expect(onChange.mock.calls[0][0]).not.toBe('#000000');
  });

  it('commits a contract-safe value straight from the native picker', () => {
    const onChange = jest.fn();
    const { container } = render(
      <ColorField label="Tagline" value="#ff0000" themeDefault="#f6f2e9" onChange={onChange} />,
    );

    const picker = container.querySelector('input[type="color"]') as HTMLInputElement;
    fireEvent.change(picker, { target: { value: '#00ff00' } });

    expect(onChange).toHaveBeenCalledWith('#00ff00');
    expect(onChange.mock.calls[0][0]).toMatch(HERO_COLOR_PATTERN);
  });
});

describe('ColorField contrast guidance warns, never blocks', () => {
  it('reports a real computed ratio against a measurable background', () => {
    render(
      <ColorField
        label="Tagline"
        value="#f0ecdf"
        themeDefault="#f6f2e9"
        measuredAgainst="#f6f2e9"
        contrastThreshold={4.5}
        onChange={jest.fn()}
      />,
    );

    const advice = screen.getByText(/Tagline contrast is/);
    expect(advice).toHaveAttribute('role', 'status'); // advice, not an alert
    // Nothing is disabled and nothing was rejected — the admin can still ship it.
    expect(screen.getByLabelText('Tagline hex code')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Theme default' })).toBeEnabled();
  });

  it('offers no number where there is no single answer', () => {
    render(
      <ColorField
        label="Tagline"
        value="#f0ecdf"
        themeDefault="#f6f2e9"
        measuredAgainst={null}
        contrastThreshold={4.5}
        onChange={jest.fn()}
      />,
    );

    expect(screen.queryByText(/Tagline contrast is/)).not.toBeInTheDocument();
  });

  it('says nothing about a pair that reads fine', () => {
    render(
      <ColorField
        label="Tagline"
        value="#0b0b0b"
        themeDefault="#f6f2e9"
        measuredAgainst="#ffffff"
        contrastThreshold={4.5}
        onChange={jest.fn()}
      />,
    );

    expect(screen.queryByText(/contrast is/)).not.toBeInTheDocument();
  });
});

describe('ColorField, free mode: the gradient box HeroEditor:550 never had', () => {
  it('accepts a gradient and commits it', () => {
    const onChange = jest.fn();
    render(
      <ColorField mode="free" label="Background" value="#0B0B0B" maxLength={500} onChange={onChange} />,
    );

    const box = screen.getByLabelText('Background');
    fireEvent.change(box, { target: { value: 'linear-gradient(180deg, #0B0B0B, #1A1A1A)' } });

    expect(onChange).toHaveBeenCalledWith('linear-gradient(180deg, #0B0B0B, #1A1A1A)');
    expect(screen.queryByText(/does not look like a CSS colour/)).not.toBeInTheDocument();
  });

  it('paints a live swatch with the actual string', () => {
    const { container } = render(
      <ColorField mode="free" label="Background" value="#0b0b0b" onChange={jest.fn()} />,
    );

    const swatch = container.querySelector('[data-slot="color-swatch"]') as HTMLElement;
    expect(swatch).toHaveStyle({ background: '#0b0b0b' });
  });

  it('offers a picker when, and only when, the value is a plain hex', () => {
    const { container, rerender } = render(
      <ColorField mode="free" label="Background" value="#0b0b0b" onChange={jest.fn()} />,
    );
    expect(container.querySelectorAll('input[type="color"]')).toHaveLength(1);

    rerender(
      <ColorField mode="free" label="Background" value="linear-gradient(180deg, #000, #111)" onChange={jest.fn()} />,
    );
    // A picker cannot express a gradient, so offering one would be a lie.
    expect(container.querySelectorAll('input[type="color"]')).toHaveLength(0);
  });

  it('advises on a string that is not CSS, and still commits it', () => {
    const onChange = jest.fn();
    render(<ColorField mode="free" label="Background" value="#ab" onChange={onChange} />);

    const advice = screen.getByText(/does not look like a CSS colour or gradient/);
    expect(advice).toHaveAttribute('role', 'status');

    // Advisory, never a block: color-mix(), var(), and whatever CSS ships next
    // year must all stay typeable.
    fireEvent.change(screen.getByLabelText('Background'), { target: { value: 'not a colour!' } });
    expect(onChange).toHaveBeenCalledWith('not a colour!');
  });

  it('guards the column length like every other text field', () => {
    const onChange = jest.fn();
    render(<ColorField mode="free" label="Background" value="" maxLength={500} onChange={onChange} />);

    expect(screen.getByLabelText('Background')).toHaveAttribute('maxlength', '500');
    fireEvent.change(screen.getByLabelText('Background'), { target: { value: 'g'.repeat(600) } });
    expect(onChange).toHaveBeenCalledWith('g'.repeat(500));
  });

  it('trims on blur, and never produces null for a non-nullable column', () => {
    const onChange = jest.fn();
    render(<ColorField mode="free" label="Background" value="  #0b0b0b  " onChange={onChange} />);

    fireEvent.blur(screen.getByLabelText('Background'));
    expect(onChange).toHaveBeenCalledWith('#0b0b0b');
    expect(onChange).not.toHaveBeenCalledWith(null);
  });

  it('classifies what admins type', () => {
    expect(classifyFreeColor('')).toBe('empty');
    expect(classifyFreeColor('#0B0B0B')).toBe('hex');
    expect(classifyFreeColor('#abc')).toBe('hex');
    expect(classifyFreeColor('#0b0b0b80')).toBe('hex'); // valid CSS, not pickable
    expect(classifyFreeColor('#ab')).toBe('unknown');
    expect(classifyFreeColor('linear-gradient(180deg, #000, #111)')).toBe('function');
    expect(classifyFreeColor('color-mix(in srgb, red, blue)')).toBe('function');
    expect(classifyFreeColor('var(--mr-ink-900)')).toBe('function');
    expect(classifyFreeColor('transparent')).toBe('keyword');
    expect(classifyFreeColor('deep navy please')).toBe('unknown');
  });
});

// ---------------------------------------------------------------------------
// The wiring every field shares.
// ---------------------------------------------------------------------------

describe('FieldRow wires help and error to the control', () => {
  it('points aria-describedby at both, in reading order', () => {
    render(
      <TextField
        label="Slug"
        value="about"
        maxLength={60}
        help="Used in the page URL."
        error="Already taken."
        onChange={jest.fn()}
      />,
    );

    const input = screen.getByLabelText('Slug');
    const described = (input.getAttribute('aria-describedby') ?? '').split(' ');

    expect(described).toContain(screen.getByText('Used in the page URL.').id);
    expect(described).toContain(screen.getByText('Already taken.').id);
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('keeps the help visible when there is an error, because the instruction still applies', () => {
    render(
      <TextField label="Slug" value="" help="Lowercase letters and dashes." error="Required." onChange={jest.fn()} />,
    );

    expect(screen.getByText('Lowercase letters and dashes.')).toBeInTheDocument();
    expect(screen.getByText('Required.')).toBeInTheDocument();
  });

  it('marks a required field for sighted and assistive users alike', () => {
    render(<TextField label="Title" value="" required onChange={jest.fn()} />);

    expect(screen.getByLabelText(/Title/)).toBeRequired();
    expect(screen.getByText('(required)')).toBeInTheDocument();
  });

  it('leaves aria-describedby off entirely when there is nothing to describe', () => {
    render(<TextField label="Title" value="" onChange={jest.fn()} />);
    // An empty aria-describedby is a dangling reference, not "no description".
    expect(screen.getByLabelText('Title')).not.toHaveAttribute('aria-describedby');
  });
});

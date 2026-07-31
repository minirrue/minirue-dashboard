import { afterEach, describe, expect, it } from '@jest/globals';
import React, { useReducer, type ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, within } from '@testing-library/react';
import OverviewGrid, {
  ANALYTICS_OVERVIEW_WIDGETS,
  buildDefaultOverviewLayout,
  nextSize,
} from '@/app/dashboard/analytics/OverviewGrid';
import { layoutReducer } from '@/lib/analytics/layout-store';
import type { LayoutAction, LayoutItem } from '@/lib/analytics/layout-store';
import type { AnalyticsQueryParams } from '@/lib/api/analytics-insights';
import { useAudienceSummary, usePurchaseReconciliation } from '@/lib/hooks/use-analytics';
import { apiFetch } from '@/lib/api/client';

/**
 * `OverviewGrid` composes the already-committed widget registry
 * (`lib/analytics/widgets.tsx`) and the already-committed layout reducer
 * (`lib/analytics/layout-store.ts`) — neither is re-tested here beyond what
 * this lane's composition needs. Every query hook is mocked to a static,
 * always-resolved result so no test hits the network; that also means
 * `AnalyticsWidgetCard` never reaches a widget's own `Render` (its
 * `data === undefined` branch renders first) except in the three tests below
 * that deliberately supply real data — reconciliation, DAU/MAU/stickiness,
 * and the country-split wiring check.
 *
 * `country-split` has no registered hook (see `OverviewGrid.tsx`'s header
 * comment) — it calls `apiFetch` directly via a real `useQuery`, so every
 * render in this file goes through `renderWithClient`, not bare `render`,
 * and `@/lib/api/client` is mocked alongside `@/lib/hooks/use-analytics`.
 */

// Jest hoists `jest.mock()` calls above every import in this file, but the
// factory below is NOT allowed to close over an arbitrary outer variable —
// only names starting with `mock` are exempted from that hoisting
// restriction. The previous version of this file used `emptyResult`, which
// doesn't qualify: instead of the documented hard "out-of-scope variable"
// error, this project's SWC-based jest transform silently failed to hoist
// the mock at all, so the real `@/lib/hooks/use-analytics` module (and its
// real `useQuery`) loaded before `jest.mock` ever registered — which is
// exactly why every widget blew up with "No QueryClient set" instead of
// rendering the mocked, network-free result. Renaming to `mockEmptyResult`
// fixes the hoisting, not just the symptom.
function mockEmptyResult() {
  return { data: undefined, isLoading: false, isError: false };
}

jest.mock('@/lib/hooks/use-analytics', () => ({
  useAudienceSummary: jest.fn(mockEmptyResult),
  useAudienceTimeseries: jest.fn(mockEmptyResult),
  useRealtime: jest.fn(mockEmptyResult),
  useTopPages: jest.fn(mockEmptyResult),
  useProductsTop: jest.fn(mockEmptyResult),
  useSources: jest.fn(mockEmptyResult),
  useCheckoutFunnel: jest.fn(mockEmptyResult),
  useSearchTerms: jest.fn(mockEmptyResult),
  useTech: jest.fn(mockEmptyResult),
  usePurchaseReconciliation: jest.fn(mockEmptyResult),
  useDataQuality: jest.fn(mockEmptyResult),
}));

// `country-split` (OverviewGrid.tsx) has no registered hook yet — it calls
// the shared low-level `apiFetch` directly (see that file's header comment),
// so it needs a real `QueryClient` (via `renderWithClient` below) rather
// than a mocked hook. Mocking `apiFetch` here, rather than letting it hit
// the network, keeps this test suite exactly as network-free as the rest —
// resolves to an empty-but-collecting envelope so the widget renders its
// ordinary "no data in range" copy instead of crashing.
jest.mock('@/lib/api/client', () => ({
  apiFetch: jest.fn(() =>
    Promise.resolve({
      range: { from: '2026-07-01', to: '2026-07-31', timezone: 'UTC' },
      freshness: { rollupLastOkAt: null, staleBuckets: 0 },
      data: [],
    }),
  ),
}));

const PARAMS: AnalyticsQueryParams = { from: '2026-07-01', to: '2026-07-31' };

/** Escapes regex metacharacters in a widget title before dropping it into
 * `new RegExp(...)` — several real titles contain literal parens/slashes
 * (e.g. "Stickiness (DAU/MAU)"), which otherwise get parsed as regex syntax
 * (a capture group, in that example) instead of matched as literal text. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Every OTHER widget's query hook is mocked above (no real `useQuery` runs
// for them), but `country-split`'s `useCountrySplit` calls the real
// `useQuery` against the mocked `apiFetch` — that needs an actual
// `QueryClient` in the tree, or React Query throws "No QueryClient set,
// use QueryClientProvider to set one". `retry: false` keeps a failed fetch
// (there shouldn't be one, `apiFetch` is mocked to resolve) from retrying
// and leaving a dangling timer after the test finishes.
function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

// Flushes the microtask queue between tests so `useCountrySplit`'s pending
// promise (from the render above) resolves and its `setState` lands before
// the next test's `render()`, rather than warning about an update outside
// `act()` mid-way through an unrelated test.
afterEach(async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
});

function Harness({
  initial,
  editMode = false,
}: {
  initial: LayoutItem[];
  editMode?: boolean;
}) {
  const [layout, dispatch] = useReducer(layoutReducer, initial);
  return (
    <OverviewGrid
      widgets={ANALYTICS_OVERVIEW_WIDGETS}
      layout={layout}
      params={PARAMS}
      editMode={editMode}
      dispatch={dispatch as (action: LayoutAction) => void}
    />
  );
}

describe('OverviewGrid', () => {
  it('renders only visible widgets, in order', () => {
    const layout = buildDefaultOverviewLayout();
    const hidden = layoutReducer(layout, { type: 'remove', id: layout[1].id });

    renderWithClient(<Harness initial={hidden} />);

    const expectedIds = hidden
      .filter((item) => item.visible)
      .sort((a, b) => a.order - b.order)
      .map((item) => item.id);

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(expectedIds.length);
    expectedIds.forEach((id, i) => {
      const widget = ANALYTICS_OVERVIEW_WIDGETS.find((w) => w.id === id)!;
      expect(within(items[i]).getByText(widget.title)).toBeInTheDocument();
    });
  });

  it('a widget card exposes a link to its registry href', () => {
    const layout = buildDefaultOverviewLayout();
    renderWithClient(<Harness initial={layout} />);

    const first = ANALYTICS_OVERVIEW_WIDGETS.find((w) => w.id === layout[0].id)!;
    // Anchored at the start: the card's title is always the first text node
    // inside the link, but some widgets' *descriptions* also contain other
    // widgets' titles as substrings (e.g. realtime's description starts with
    // "Visitors active…"), so an unanchored match can hit more than one link.
    const link = screen.getByRole('link', { name: new RegExp(`^${escapeRegExp(first.title)}`) });
    expect(link).toHaveAttribute('href', first.href);
  });

  it('the size-cycle button maps to the right grid-span class', () => {
    const layout = buildDefaultOverviewLayout();
    renderWithClient(<Harness initial={layout} editMode />);

    const widget = ANALYTICS_OVERVIEW_WIDGETS.find((w) => w.id === layout[0].id)!;
    const slot = screen.getAllByRole('listitem')[0];
    expect(slot.className).toContain(`dash-widget-${widget.defaultSize}`);

    const sizeBtn = within(slot).getByRole('button', { name: /change size/i });
    fireEvent.click(sizeBtn);

    const next = nextSize(widget.defaultSize);
    expect(slot.className).toContain(`dash-widget-${next}`);
    expect(slot.className).not.toContain(`dash-widget-${widget.defaultSize}`);
  });

  it('remove then add restores the widget at its registry default size', () => {
    const layout = buildDefaultOverviewLayout();
    const target = layout[2];
    const widget = ANALYTICS_OVERVIEW_WIDGETS.find((w) => w.id === target.id)!;

    function AddHarness() {
      const [state, dispatch] = useReducer(layoutReducer, layout);
      return (
        <>
          <OverviewGrid
            widgets={ANALYTICS_OVERVIEW_WIDGETS}
            layout={state}
            params={PARAMS}
            editMode
            dispatch={dispatch}
          />
          <button
            type="button"
            onClick={() => dispatch({ type: 'add', id: widget.id, size: widget.defaultSize })}
          >
            re-add
          </button>
        </>
      );
    }

    renderWithClient(<AddHarness />);

    const slotBefore = screen.getAllByRole('listitem').find((el) => el.textContent?.includes(widget.title));
    expect(slotBefore).toBeTruthy();
    fireEvent.click(within(slotBefore!).getByRole('button', { name: /remove/i }));
    expect(screen.queryByText(widget.title)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 're-add' }));
    const restored = screen.getAllByRole('listitem').find((el) => el.textContent?.includes(widget.title));
    expect(restored).toBeTruthy();
    expect(restored!.className).toContain(`dash-widget-${widget.defaultSize}`);
  });

  it('reset returns the default layout', () => {
    const defaults = buildDefaultOverviewLayout();
    const mutated = layoutReducer(defaults, { type: 'resize', id: defaults[0].id, size: 'full' });
    const removed = layoutReducer(mutated, { type: 'remove', id: defaults[1].id });
    const reset = layoutReducer(removed, { type: 'reset', defaults });
    expect(reset).toEqual(defaults);
  });

  it('keyboard reorder moves a widget earlier', () => {
    const layout = buildDefaultOverviewLayout();
    renderWithClient(<Harness initial={layout} editMode />);

    const secondWidget = ANALYTICS_OVERVIEW_WIDGETS.find((w) => w.id === layout[1].id)!;
    const handle = screen.getByRole('button', { name: new RegExp(`Reorder ${escapeRegExp(secondWidget.title)}`) });
    fireEvent.keyDown(handle, { key: 'ArrowLeft' });

    const items = screen.getAllByRole('listitem');
    // In edit mode the title appears twice inside the moved slot (the edit
    // bar's own label, plus the widget card's title) — `getAllByText` avoids
    // the "multiple elements" ambiguity a plain `getByText` would hit here.
    expect(within(items[0]).getAllByText(secondWidget.title).length).toBeGreaterThan(0);
  });

  it('the reconciliation widget surfaces a divergence at a glance, not just as a number', () => {
    (usePurchaseReconciliation as jest.Mock).mockReturnValueOnce({
      data: {
        range: { ...PARAMS, timezone: 'UTC' },
        freshness: { rollupLastOkAt: '2026-07-31T00:00:00Z', staleBuckets: 0 },
        // Shaped like the real `ReconcileReport` (`dto/reconcile.dto.ts`) —
        // a three-way count plus `healthy`, not the `{matched, unmatched}`
        // pair this lane originally guessed before the client types were
        // reconciled against the real backend DTOs.
        data: {
          orders: { count: 10, revenueMinor: 500000 },
          purchaseEvents: { count: 12, revenueMinor: 600000 },
          attribution: { count: 9, revenueMinor: 450000 },
          healthy: false,
          mismatches: {
            ordersMissingAttribution: ['order-1'],
            attributionMissingOrder: [],
            purchaseEventsMissingOrder: ['evt-1', 'evt-2'],
            ordersMissingPurchaseEvent: [],
          },
        },
      },
      isLoading: false,
      isError: false,
    });

    const layout = buildDefaultOverviewLayout();
    renderWithClient(<Harness initial={layout} />);

    expect(screen.getByText(/3 mismatches/i)).toBeInTheDocument();
    expect(screen.getByText(/may be unreliable/i)).toBeInTheDocument();
  });

  it('the DAU/MAU/stickiness widget renders the headline metric from the audience-summary hook', () => {
    (useAudienceSummary as jest.Mock).mockReturnValueOnce({
      data: {
        range: { ...PARAMS, timezone: 'UTC' },
        freshness: { rollupLastOkAt: '2026-07-31T00:00:00Z', staleBuckets: 0 },
        // Shaped like the real `/analytics/audience/summary` response
        // (`audience.dto.ts`), not like the (currently narrower) front-end
        // `AudienceSummary` TS type — this is exactly the gap
        // `dau-mau-stickiness`'s defensive `readNumber()` reads across.
        data: { visitors: 500, newVisitorRate: 0.4, dau: 120, mau: 400, stickiness: 0.3 },
      },
      isLoading: false,
      isError: false,
    });

    const layout = buildDefaultOverviewLayout();
    renderWithClient(<Harness initial={layout} />);

    expect(screen.getByText('30%')).toBeInTheDocument();
    expect(screen.getByText(/120 DAU \/ 400 MAU/)).toBeInTheDocument();
  });

  it('the country-split widget calls the real /analytics/geo endpoint (no registered hook yet)', async () => {
    const layout = buildDefaultOverviewLayout();
    renderWithClient(<Harness initial={layout} />);

    // `apiFetch` is mocked (see the top of this file) rather than a hook —
    // `country-split` has none yet — so this is the only way to confirm the
    // widget is actually wired to the real endpoint and not silently inert.
    await screen.findByText('Countries');
    const mockApiFetch = apiFetch as jest.Mock;
    expect(mockApiFetch).toHaveBeenCalledWith(
      expect.stringContaining('/analytics/geo?'),
      expect.objectContaining({ auth: true }),
    );
    expect(mockApiFetch).toHaveBeenCalledWith(
      expect.stringContaining('dimension=country'),
      expect.anything(),
    );
  });
});

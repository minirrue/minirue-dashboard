import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  LineChart,
  AreaChart,
  BarChart,
  StackedBar,
  HorizontalBar,
  Funnel,
  Donut,
  Heatmap,
  Sparkline,
} from '@/components/dashboard/charts';

/**
 * Smoke coverage per chart: empty data never crashes and shows the honest
 * empty state (DESIGN.md bans fabricated placeholder data — ChartEmpty is
 * the alternative), one point never crashes (the awkward "domain has zero
 * span" case for scales/ticks), and a realistic multi-point series renders.
 *
 * jsdom has no ResizeObserver, so `useMeasuredSize` falls back to a fixed
 * default — these tests don't assert pixel geometry, only that nothing
 * throws and the expected DOM lands.
 */

type Point = { label: string; a: number; b: number };

function points(n: number): Point[] {
  return Array.from({ length: n }, (_, i) => ({ label: `D${i}`, a: (i + 1) * 10, b: (i + 1) * 7 }));
}

const EMPTY_TEXT = 'No data for this period.';

describe('LineChart', () => {
  const series = [
    { id: 'a', label: 'Series A', y: (d: Point) => d.a },
    { id: 'b', label: 'Series B', y: (d: Point) => d.b },
  ];

  it('shows the empty state for []', () => {
    render(<LineChart data={[]} xLabel={(d: Point) => d.label} series={series} title="Revenue" />);
    expect(screen.getByText(EMPTY_TEXT)).toBeInTheDocument();
  });

  it('renders a single point without crashing', () => {
    render(<LineChart data={points(1)} xLabel={(d) => d.label} series={series} title="Revenue" />);
    expect(screen.getByText('Revenue')).toBeInTheDocument();
  });

  it('renders many points without crashing', () => {
    render(<LineChart data={points(30)} xLabel={(d) => d.label} series={series} title="Revenue" />);
    expect(screen.getByText('Revenue')).toBeInTheDocument();
  });
});

describe('AreaChart', () => {
  const singleSeries = [{ id: 'a', label: 'Series A', y: (d: Point) => d.a }];
  const stackedSeries = [
    { id: 'a', label: 'Series A', y: (d: Point) => d.a },
    { id: 'b', label: 'Series B', y: (d: Point) => d.b },
  ];

  it('shows the empty state for []', () => {
    render(<AreaChart data={[]} xLabel={(d: Point) => d.label} series={singleSeries} title="Sessions" />);
    expect(screen.getByText(EMPTY_TEXT)).toBeInTheDocument();
  });

  it('renders a single point (single series) without crashing', () => {
    render(<AreaChart data={points(1)} xLabel={(d) => d.label} series={singleSeries} title="Sessions" />);
    expect(screen.getByText('Sessions')).toBeInTheDocument();
  });

  it('renders many points (stacked) without crashing', () => {
    render(<AreaChart data={points(30)} xLabel={(d) => d.label} series={stackedSeries} title="Sessions" />);
    expect(screen.getByText('Sessions')).toBeInTheDocument();
  });
});

describe('BarChart', () => {
  const series = [{ id: 'a', label: 'Series A', y: (d: Point) => d.a }];
  const grouped = [
    { id: 'a', label: 'Series A', y: (d: Point) => d.a },
    { id: 'b', label: 'Series B', y: (d: Point) => d.b },
  ];

  it('shows the empty state for []', () => {
    render(<BarChart data={[]} category={(d: Point) => d.label} series={series} title="Orders" />);
    expect(screen.getByText(EMPTY_TEXT)).toBeInTheDocument();
  });

  it('renders a single category without crashing', () => {
    render(<BarChart data={points(1)} category={(d) => d.label} series={series} title="Orders" />);
    expect(screen.getByText('Orders')).toBeInTheDocument();
  });

  it('renders many grouped categories without crashing', () => {
    render(<BarChart data={points(30)} category={(d) => d.label} series={grouped} title="Orders" />);
    expect(screen.getByText('Orders')).toBeInTheDocument();
  });
});

describe('StackedBar', () => {
  const series = [
    { id: 'a', label: 'Series A', y: (d: Point) => d.a },
    { id: 'b', label: 'Series B', y: (d: Point) => d.b },
  ];

  it('shows the empty state for []', () => {
    render(<StackedBar data={[]} category={(d: Point) => d.label} series={series} title="Fulfilment mix" />);
    expect(screen.getByText(EMPTY_TEXT)).toBeInTheDocument();
  });

  it('renders a single category without crashing', () => {
    render(<StackedBar data={points(1)} category={(d) => d.label} series={series} title="Fulfilment mix" />);
    expect(screen.getByText('Fulfilment mix')).toBeInTheDocument();
  });

  it('renders many categories without crashing', () => {
    render(<StackedBar data={points(30)} category={(d) => d.label} series={series} title="Fulfilment mix" />);
    expect(screen.getByText('Fulfilment mix')).toBeInTheDocument();
  });
});

describe('HorizontalBar', () => {
  it('shows the empty state for []', () => {
    render(<HorizontalBar data={[]} label={(d: Point) => d.label} value={(d: Point) => d.a} title="Top pages" />);
    expect(screen.getByText(EMPTY_TEXT)).toBeInTheDocument();
  });

  it('renders a single row without crashing', () => {
    render(<HorizontalBar data={points(1)} label={(d) => d.label} value={(d) => d.a} title="Top pages" />);
    expect(screen.getByText('Top pages')).toBeInTheDocument();
  });

  it('renders many rows without crashing', () => {
    render(<HorizontalBar data={points(30)} label={(d) => d.label} value={(d) => d.a} title="Top pages" />);
    expect(screen.getByText('Top pages')).toBeInTheDocument();
  });
});

describe('Funnel', () => {
  it('shows the empty state for no stages', () => {
    render(<Funnel stages={[]} title="Checkout funnel" />);
    expect(screen.getByText(EMPTY_TEXT)).toBeInTheDocument();
  });

  it('renders a single stage without crashing', () => {
    render(<Funnel stages={[{ label: 'Carts', value: 100 }]} title="Checkout funnel" />);
    expect(screen.getByText('Checkout funnel')).toBeInTheDocument();
  });

  it('renders many stages without crashing', () => {
    const stages = Array.from({ length: 8 }, (_, i) => ({ label: `Stage ${i}`, value: 1000 - i * 100 }));
    render(<Funnel stages={stages} title="Checkout funnel" />);
    expect(screen.getByText('Checkout funnel')).toBeInTheDocument();
  });
});

describe('Donut', () => {
  it('shows the empty state for []', () => {
    render(<Donut data={[]} title="Traffic sources" />);
    expect(screen.getByText(EMPTY_TEXT)).toBeInTheDocument();
  });

  it('renders a single slice without crashing', () => {
    render(<Donut data={[{ label: 'Direct', value: 10 }]} title="Traffic sources" />);
    expect(screen.getByText('Traffic sources')).toBeInTheDocument();
  });

  it('folds more than 5 slices into "Other" without crashing', () => {
    const data = Array.from({ length: 9 }, (_, i) => ({ label: `Source ${i}`, value: 100 - i * 5 }));
    render(<Donut data={data} title="Traffic sources" />);
    expect(screen.getByText('Traffic sources')).toBeInTheDocument();
    expect(screen.getByText('Other')).toBeInTheDocument();
  });
});

describe('Heatmap', () => {
  it('shows the empty state for []', () => {
    render(<Heatmap data={[]} title="Activity by hour" />);
    expect(screen.getByText(EMPTY_TEXT)).toBeInTheDocument();
  });

  it('renders a single cell without crashing', () => {
    render(<Heatmap data={[{ weekday: 0, hour: 9, value: 5 }]} title="Activity by hour" />);
    expect(screen.getByText('Activity by hour')).toBeInTheDocument();
  });

  it('renders a full week of cells without crashing', () => {
    const data = Array.from({ length: 7 }, (_, weekday) =>
      Array.from({ length: 24 }, (_, hour) => ({ weekday, hour, value: Math.round(Math.random() * 100) })),
    ).flat();
    render(<Heatmap data={data} title="Activity by hour" />);
    expect(screen.getByText('Activity by hour')).toBeInTheDocument();
  });
});

describe('Sparkline', () => {
  // Sparkline is deliberately chrome-free (no title, no axes, no empty-state
  // card — it's an inline trend glyph embedded in something like
  // DashboardCard), so "empty" here means "renders an inert container
  // without crashing", not a ChartEmpty message.
  it('renders without crashing for an empty series', () => {
    const { container } = render(<Sparkline values={[]} />);
    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });

  it('renders without crashing for a single point', () => {
    const { container } = render(<Sparkline values={[42]} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders without crashing for many points', () => {
    const { container } = render(<Sparkline values={Array.from({ length: 30 }, (_, i) => i * 3)} />);
    expect(container.querySelector('path')).toBeInTheDocument();
  });
});

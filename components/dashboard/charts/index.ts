/**
 * Public API of the dashboard chart kit. Consumers import from
 * `@/components/dashboard/charts` — do not import individual chart files
 * directly, so this barrel stays the single surface that can change shape
 * without breaking callers.
 */

export { default as ChartFrame } from './ChartFrame';
export type { ChartFrameProps } from './ChartFrame';

export { default as LineChart } from './LineChart';
export type { LineChartProps, LineChartSeries } from './LineChart';

export { default as AreaChart } from './AreaChart';
export type { AreaChartProps, AreaChartSeries } from './AreaChart';

export { default as BarChart } from './BarChart';
export type { BarChartProps, BarChartSeries } from './BarChart';

export { default as StackedBar } from './StackedBar';
export type { StackedBarProps, StackedBarSeries } from './StackedBar';

export { default as HorizontalBar } from './HorizontalBar';
export type { HorizontalBarProps } from './HorizontalBar';

export { default as Funnel } from './Funnel';
export type { FunnelProps, FunnelStage } from './Funnel';

export { default as Donut } from './Donut';
export type { DonutProps, DonutSlice } from './Donut';

export { default as Heatmap } from './Heatmap';
export type { HeatmapProps, HeatmapCell } from './Heatmap';

export { default as Sparkline } from './Sparkline';
export type { SparklineProps } from './Sparkline';

export { default as ChartTooltip } from './ChartTooltip';
export type { ChartTooltipProps, ChartTooltipItem } from './ChartTooltip';

export { default as ChartLegend } from './ChartLegend';
export type { ChartLegendProps, ChartLegendItem } from './ChartLegend';

export { default as ChartTableView } from './ChartTableView';
export type { ChartTableViewProps } from './ChartTableView';

export { default as ChartEmpty } from './ChartEmpty';
export type { ChartEmptyProps } from './ChartEmpty';

export { default as ChartSkeleton } from './ChartSkeleton';
export type { ChartSkeletonProps } from './ChartSkeleton';

export {
  useMeasuredSize,
  seriesColor,
  seriesColorOrOther,
  rampColor,
  RAMP_STEPS,
  formatEgpMinor,
  formatCompact,
  niceTicks,
  pathFor,
  roundedBarPath,
} from './chart-utils';
export type { MeasuredSize } from './chart-utils';

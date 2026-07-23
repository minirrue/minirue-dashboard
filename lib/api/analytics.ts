import { apiFetch } from './client';

export interface OverviewRevenue {
  today_cents: number;
  week_cents: number;
  month_cents: number;
  net_month_cents: number;
}

export interface OverviewRefunds {
  today_cents: number;
  week_cents: number;
  month_cents: number;
  count: number;
}

export interface OverviewOrders {
  pending_count: number;
  confirmed_count: number;
  processing_count: number;
  shipped_count: number;
  delivered_count: number;
  cancelled_count: number;
}

export interface OverviewCustomers {
  new_today: number;
  new_week: number;
  new_month: number;
  total_active: number;
}

export interface AnalyticsOverview {
  revenue: OverviewRevenue;
  refunds: OverviewRefunds;
  orders: OverviewOrders;
  customers: OverviewCustomers;
}

export interface RevenuePoint {
  date: string;
  total_cents: number;
}

export interface TopProduct {
  product_id: string;
  product_name: string;
  quantity_sold: number;
  revenue_cents: number;
}

export interface TopCustomer {
  customer_id: string;
  customer_name: string;
  total_orders: number;
  total_spend_cents: number;
}

export interface OrdersFunnel {
  carts_created: number;
  orders_placed: number;
  orders_paid: number;
  orders_fulfilled: number;
  conversion_to_paid: number;
  conversion_to_fulfilled: number;
}

export async function apiGetAnalyticsOverview(): Promise<AnalyticsOverview> {
  return apiFetch('/analytics/overview', { auth: true });
}

export async function apiGetRevenueSeries(period: '7d' | '30d' | '90d' = '30d'): Promise<RevenuePoint[]> {
  return apiFetch(`/analytics/revenue?period=${period}`, { auth: true });
}

export async function apiGetTopProducts(limit = 10): Promise<TopProduct[]> {
  return apiFetch(`/analytics/top-products?limit=${limit}`, { auth: true });
}

export async function apiGetTopCustomers(limit = 10): Promise<TopCustomer[]> {
  return apiFetch(`/analytics/top-customers?limit=${limit}`, { auth: true });
}

export async function apiGetOrdersFunnel(): Promise<OrdersFunnel> {
  return apiFetch('/analytics/orders-funnel', { auth: true });
}

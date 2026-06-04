import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';

export interface OrderItem {
  id: string;
  orderId: string;
  variantId: string;
  productId: string;
  quantity: number;
  price_amount: string;
  price_currency: string;
}

export interface Order {
  id: string;
  userId: string;
  order_number: string;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  total_amount: string;
  total_currency: string;
  items: OrderItem[];
  shipping_address: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateOrderRequest {
  cartId?: string;
  shippingAddressId?: string;
}

export interface OrderFilters {
  status?: string;
  cursor?: string;
  limit?: number;
}

const ORDERS_QUERY_KEY = ['orders'];
const ORDER_DETAIL_QUERY_KEY = ['order'];

export function useOrders(filters?: OrderFilters) {
  const queryKey = [...ORDERS_QUERY_KEY, filters || {}];

  return useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.cursor) params.append('cursor', filters.cursor);
      if (filters?.limit) params.append('limit', String(filters.limit));

      const query = params.toString();
      return apiFetch<{
        data: Order[];
        meta: { cursor?: string; total: number; hasMore: boolean };
      }>(`/orders${query ? `?${query}` : ''}`, { auth: true });
    },
    enabled: typeof window !== 'undefined',
  });
}

export function useOrderDetail(orderId?: string) {
  return useQuery({
    queryKey: [...ORDER_DETAIL_QUERY_KEY, orderId],
    queryFn: async () => {
      return apiFetch<Order>(`/orders/${orderId}`, { auth: true });
    },
    enabled: !!orderId,
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateOrderRequest) => {
      return apiFetch<Order>('/orders', {
        method: 'POST',
        auth: true,
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEY });
    },
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      return apiFetch<Order>(`/orders/${orderId}/cancel`, {
        method: 'POST',
        auth: true,
      });
    },
    onSuccess: (_, orderId) => {
      queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: [...ORDER_DETAIL_QUERY_KEY, orderId] });
    },
  });
}

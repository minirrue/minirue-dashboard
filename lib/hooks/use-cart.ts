import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';

export interface CartItemDto {
  id: string;
  variantId: string;
  qty: number;
  unitPriceAmount: string;
  unitPriceCurrency: string;
  lineTotalAmount: string;
}

export interface CartTotals {
  subtotalAmount: string;
  currency: string;
  itemCount: number;
  uniqueItemCount: number;
}

export interface Cart {
  id: string;
  status: string;
  currency: string;
  items: CartItemDto[];
  totals: CartTotals;
  expiresAt: string | null;
}

export interface AddCartItemRequest {
  variantId: string;
  qty: number;
}

export interface UpdateCartItemRequest {
  qty: number;
}

const CART_QUERY_KEY = ['cart'];

export function useCart() {
  return useQuery({
    queryKey: CART_QUERY_KEY,
    queryFn: async () => apiFetch<Cart>('/cart', { auth: true }),
    enabled: typeof window !== 'undefined',
  });
}

export function useAddCartItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: AddCartItemRequest) =>
      apiFetch<Cart>('/cart/items', { method: 'POST', auth: true, body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY }); },
  });
}

export function useUpdateCartItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, ...data }: { itemId: string } & UpdateCartItemRequest) =>
      apiFetch<Cart>(`/cart/items/${itemId}`, { method: 'PATCH', auth: true, body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY }); },
  });
}

export function useRemoveCartItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) =>
      apiFetch<Cart>(`/cart/items/${itemId}`, { method: 'DELETE', auth: true }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY }); },
  });
}

export function useClearCart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => apiFetch<void>('/cart', { method: 'DELETE', auth: true }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY }); },
  });
}

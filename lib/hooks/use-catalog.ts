import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';

export interface ProductVariant {
  id: string;
  size_ml: number;
  price_amount: string;
  price_currency: string;
}

export interface ProductMedia {
  cloudinary_public_id: string;
  width: number;
  height: number;
  alt_text: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string;
  fragrance_family?: string;
  gender: 'men' | 'women' | 'unisex';
  variants: ProductVariant[];
  media: ProductMedia[];
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  children: Category[];
}

export interface ProductsListResponse {
  data: Product[];
  meta: {
    cursor?: string;
    total: number;
    hasMore: boolean;
  };
}

export interface ProductFilters {
  gender?: 'men' | 'women' | 'unisex';
  categoryId?: string;
  brand?: string;
  priceMin?: number;
  priceMax?: number;
  sortBy?: 'price_asc' | 'price_desc' | 'newest' | 'relevance';
  cursor?: string;
  limit?: number;
}

const PRODUCTS_QUERY_KEY = ['catalog', 'products'];
const PRODUCT_DETAIL_QUERY_KEY = ['catalog', 'product'];
const CATEGORIES_QUERY_KEY = ['catalog', 'categories'];
const SEARCH_QUERY_KEY = ['catalog', 'search'];

export function useProducts(filters?: ProductFilters) {
  const queryKey = [
    ...PRODUCTS_QUERY_KEY,
    filters || {},
  ];

  return useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.gender) params.append('gender', filters.gender);
      if (filters?.categoryId) params.append('categoryId', filters.categoryId);
      if (filters?.brand) params.append('brand', filters.brand);
      if (filters?.priceMin !== undefined) params.append('priceMin', String(filters.priceMin));
      if (filters?.priceMax !== undefined) params.append('priceMax', String(filters.priceMax));
      if (filters?.sortBy) params.append('sortBy', filters.sortBy);
      if (filters?.cursor) params.append('cursor', filters.cursor);
      if (filters?.limit) params.append('limit', String(filters.limit));

      const query = params.toString();
      return apiFetch<ProductsListResponse>(`/catalog/products${query ? `?${query}` : ''}`);
    },
  });
}

export function useProductDetail(id?: string) {
  return useQuery({
    queryKey: [...PRODUCT_DETAIL_QUERY_KEY, id],
    queryFn: async () => {
      return apiFetch<Product>(`/catalog/products/${id}`);
    },
    enabled: !!id,
  });
}

export function useProductBySlug(slug?: string) {
  return useQuery({
    queryKey: [...PRODUCT_DETAIL_QUERY_KEY, 'slug', slug],
    queryFn: async () => {
      return apiFetch<Product>(`/catalog/products/slug/${slug}`);
    },
    enabled: !!slug,
  });
}

export function useSearchProducts(query?: string) {
  return useQuery({
    queryKey: [...SEARCH_QUERY_KEY, query],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (query) params.append('q', query);
      return apiFetch<ProductsListResponse>(`/catalog/search?${params.toString()}`);
    },
    enabled: !!query,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: CATEGORIES_QUERY_KEY,
    queryFn: async () => {
      const response = await apiFetch<{ data: Category[] }>('/catalog/categories');
      return response.data;
    },
    staleTime: 1000 * 60 * 30, // 30m (categories change infrequently)
  });
}

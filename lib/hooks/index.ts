// Auth hooks
export { useLogin, useRegister, useLogout, useUser } from './use-auth';

// Catalog hooks
export {
  useProducts,
  useProductDetail,
  useProductBySlug,
  useSearchProducts,
  useCategories,
  type Product,
  type ProductVariant,
  type ProductMedia,
  type Category,
  type ProductFilters,
  type ProductsListResponse,
} from './use-catalog';

// Cart hooks
export {
  useCart,
  useAddCartItem,
  useUpdateCartItem,
  useRemoveCartItem,
  useClearCart,
  type Cart,
  type CartItemDto,
  type AddCartItemRequest,
  type UpdateCartItemRequest,
} from './use-cart';

// Orders hooks
export {
  useOrders,
  useOrderDetail,
  useCreateOrder,
  useCancelOrder,
  type Order,
  type OrderItem,
  type CreateOrderRequest,
  type OrderFilters,
} from './use-orders';

// Query client
export { createQueryClient, getQueryClient } from './query-client';
export { RootQueryProvider } from './query-provider';

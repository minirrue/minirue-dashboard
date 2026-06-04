# React-Query Hooks — MiniRue Storefront

Typed react-query hooks layer for storefront client-side data fetching. All hooks built on top of the typed API client (`lib/api/client.ts`).

## Setup

The `QueryClientProvider` is already configured in `app/layout.tsx` and wraps the entire storefront.

```tsx
// app/layout.tsx
import { RootQueryProvider } from "@/lib/hooks";

export default function RootLayout({ children }) {
  return (
    <RootQueryProvider>
      {children}
    </RootQueryProvider>
  );
}
```

## Auth Hooks

### `useLogin()`

Authenticate user with email/password.

```tsx
import { useLogin } from "@/lib/hooks";

export function LoginForm() {
  const { mutate: login, isPending, error } = useLogin();

  async function handleSubmit(email: string, password: string) {
    login(
      { email, password },
      {
        onSuccess: (data) => {
          console.log("Logged in:", data.user.email);
          // Tokens auto-stored via apiLogin()
          // Redirect handled in auth module
        },
        onError: (err) => {
          console.error("Login failed:", err.message);
        },
      }
    );
  }

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      handleSubmit(/* ... */);
    }}>
      {error && <p>{error.message}</p>}
      <button disabled={isPending}>{isPending ? "Logging in..." : "Login"}</button>
    </form>
  );
}
```

### `useRegister()`

Register new customer account.

```tsx
const { mutate: register, isPending, error } = useRegister();

register(
  { firstName: "John", email: "john@example.com", password: "..." },
  {
    onSuccess: (data) => console.log("Registered:", data.user.email),
  }
);
```

### `useLogout()`

Revoke refresh token and clear auth queries.

```tsx
const { mutate: logout, isPending } = useLogout();

logout(undefined, {
  onSuccess: () => {
    // Queries cleared, redirect to login
    window.location.href = "/login";
  },
});
```

### `useUser()`

Fetch current authenticated user. **Only runs in browser.**

```tsx
export function ProfilePage() {
  const { data: user, isLoading, error } = useUser();

  if (isLoading) return <p>Loading...</p>;
  if (error) return <p>Failed to fetch user</p>;

  return <p>Logged in as {user?.email}</p>;
}
```

## Catalog Hooks

### `useProducts(filters?)`

List published products with cursor pagination.

```tsx
import { useProducts, type ProductFilters } from "@/lib/hooks";

export function ProductGrid() {
  const filters: ProductFilters = {
    gender: "men",
    brand: "Creed",
    priceMin: 1000,
    priceMax: 5000,
    sortBy: "price_asc",
    limit: 20,
  };

  const { data, isLoading, error, isFetching } = useProducts(filters);

  if (isLoading) return <p>Loading products...</p>;
  if (error) return <p>Failed to load products</p>;

  return (
    <div>
      {data?.data.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
      {isFetching && <p>Updating...</p>}
    </div>
  );
}
```

**Query Key Pattern**: `['catalog', 'products', { gender, brand, ... }]`

### `useProductDetail(id?)`

Fetch single product by ID with all variants and media.

```tsx
export function ProductDetail({ id }: { id: string }) {
  const { data: product, isLoading, error } = useProductDetail(id);

  if (isLoading) return <Skeleton />;
  if (error) return <p>Product not found</p>;

  return (
    <div>
      <h1>{product?.name}</h1>
      <p>{product?.brand}</p>
      <ul>
        {product?.variants.map((v) => (
          <li key={v.id}>{v.size_ml}ml — {v.price_amount} {v.price_currency}</li>
        ))}
      </ul>
    </div>
  );
}
```

**Tip**: Disable queries with `enabled: false` to fetch on demand:

```tsx
const [enabled, setEnabled] = useState(false);
const { data } = useProductDetail(id, { enabled });
```

### `useProductBySlug(slug?)`

Fetch product by URL slug (useful for dynamic routes).

```tsx
// app/products/[slug]/page.tsx
export default function ProductPage({ params }: { params: { slug: string } }) {
  const { data: product } = useProductBySlug(params.slug);
  return <ProductDetail product={product} />;
}
```

### `useSearchProducts(query?)`

Full-text search across product name, description, brand.

```tsx
export function SearchBox() {
  const [query, setQuery] = useState("");
  const { data, isLoading } = useSearchProducts(query);

  return (
    <div>
      <input 
        onChange={(e) => setQuery(e.target.value)} 
        placeholder="Search..." 
      />
      {isLoading && <p>Searching...</p>}
      {data?.data.map((p) => <ProductCard key={p.id} product={p} />)}
    </div>
  );
}
```

**Note**: Only queries when `query` is non-empty (conditional `enabled`).

### `useCategories()`

Fetch hierarchical category tree (30m stale time — categories change infrequently).

```tsx
export function CategoryNav() {
  const { data: categories } = useCategories();

  return (
    <nav>
      {categories?.map((cat) => (
        <div key={cat.id}>
          <a href={`/products?category=${cat.slug}`}>{cat.name}</a>
          {cat.children.length > 0 && (
            <ul>
              {cat.children.map((child) => (
                <li key={child.id}>
                  <a href={`/products?category=${child.slug}`}>{child.name}</a>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </nav>
  );
}
```

## Cart Hooks

### `useCart()`

Fetch authenticated user's cart.

```tsx
import { useCart } from "@/lib/hooks";

export function CartSummary() {
  const { data: cart, isLoading } = useCart();

  if (!cart) return <p>Cart empty</p>;

  return (
    <div>
      <p>{cart.item_count} items</p>
      <p>Total: {cart.total_amount} {cart.total_currency}</p>
    </div>
  );
}
```

### `useAddCartItem()`

Add product variant to cart.

```tsx
export function AddToCartButton({ variantId }: { variantId: string }) {
  const { mutate: addItem, isPending } = useAddCartItem();

  return (
    <button 
      onClick={() => addItem({ variantId, quantity: 1 })}
      disabled={isPending}
    >
      {isPending ? "Adding..." : "Add to Cart"}
    </button>
  );
}
```

### `useUpdateCartItem()`

Update quantity of existing cart item.

```tsx
export function QuantityControl({ itemId, quantity }: { itemId: string; quantity: number }) {
  const { mutate: updateItem } = useUpdateCartItem();

  return (
    <div>
      <button onClick={() => updateItem({ itemId, quantity: quantity - 1 })}>−</button>
      <span>{quantity}</span>
      <button onClick={() => updateItem({ itemId, quantity: quantity + 1 })}>+</button>
    </div>
  );
}
```

### `useRemoveCartItem()`

Remove single item from cart.

```tsx
const { mutate: removeItem } = useRemoveCartItem();
<button onClick={() => removeItem(itemId)}>Remove</button>
```

### `useClearCart()`

Clear all items from cart (e.g., after successful order).

```tsx
const { mutate: clearCart } = useClearCart();
```

## Orders Hooks

### `useOrders(filters?)`

List customer's orders with optional status filter.

```tsx
export function OrderHistory() {
  const { data: response, isLoading } = useOrders({ limit: 10 });

  return (
    <ul>
      {response?.data.map((order) => (
        <li key={order.id}>
          Order #{order.order_number} — {order.status}
        </li>
      ))}
    </ul>
  );
}
```

### `useOrderDetail(orderId?)`

Fetch full order with line items.

```tsx
export function OrderPage({ orderId }: { orderId: string }) {
  const { data: order, isLoading } = useOrderDetail(orderId);

  return (
    <div>
      <h2>Order #{order?.order_number}</h2>
      <p>Status: {order?.status}</p>
      <table>
        <tbody>
          {order?.items.map((item) => (
            <tr key={item.id}>
              <td>{item.quantity}x</td>
              <td>{item.price_amount} {item.price_currency}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### `useCreateOrder()`

Convert cart to order.

```tsx
export function CheckoutButton() {
  const { mutate: createOrder, isPending } = useCreateOrder();

  return (
    <button 
      onClick={() => createOrder({ cartId: undefined })}
      disabled={isPending}
    >
      {isPending ? "Processing..." : "Place Order"}
    </button>
  );
}
```

### `useCancelOrder()`

Cancel order (if eligible).

```tsx
const { mutate: cancelOrder } = useCancelOrder();
<button onClick={() => cancelOrder(orderId)}>Cancel Order</button>
```

## Query Timing & Invalidation

All hooks follow these defaults:

| Setting | Value | Notes |
|---|---|---|
| `staleTime` | 5m | Data is fresh for 5 minutes |
| `gcTime` | 10m | Cached data kept for 10 minutes |
| `retry` | 1 | Retry failed requests once |
| `retryDelay` | Exponential | 1s, 2s, 4s, ... (max 30s) |

**Categories** have extended staleTime (30m) — they change infrequently.

To invalidate a query manually:

```tsx
import { useQueryClient } from "@tanstack/react-query";

const queryClient = useQueryClient();
queryClient.invalidateQueries({ queryKey: ["catalog", "products"] });
```

## Error Handling

All hooks throw `ApiError`:

```tsx
interface ApiError {
  status: number;
  message: string;
  error?: string;
}
```

Example with error boundary:

```tsx
import { ApiError } from "@/lib/api/client";

export function SafeProductGrid() {
  const { data, error, isLoading } = useProducts();

  if (error instanceof Error) {
    const apiError = error as ApiError;
    return <ErrorBanner code={apiError.status} message={apiError.message} />;
  }

  // ...
}
```

## Integration with Auth

All authenticated hooks (`useCart`, `useOrders`, `useUser`) include `auth: true` in fetch config. This:

1. Passes `Authorization: Bearer <token>` header
2. Triggers automatic token refresh on 401
3. Redirects to `/login` if refresh fails

No explicit auth handling needed in components.

## Best Practices

1. **Keep staleTime aggressive** — 5m default is good for storefront (product list doesn't change per-user)
2. **Invalidate on mutation success** — all mutations do this automatically
3. **Use query keys with filters** — React-Query caches by key structure
4. **Enable conditionally** — disable queries for optional data (e.g., `enabled: !!userId`)
5. **Handle loading + error states** — always check `isLoading` and `error` before rendering
6. **Avoid over-fetching** — lazy-load product details with `useProductDetail(id)` not pre-fetch all

## Testing

```tsx
import { renderHook, waitFor } from "@testing-library/react";
import { useProducts } from "@/lib/hooks";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

function wrapper({ children }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

test("useProducts fetches and returns data", async () => {
  const { result } = renderHook(() => useProducts(), { wrapper });

  await waitFor(() => {
    expect(result.current.isLoading).toBe(false);
  });

  expect(result.current.data?.data.length).toBeGreaterThan(0);
});
```

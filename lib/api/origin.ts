/** Browser calls stay on the dashboard origin; server calls use its configured backend. */
export function getApiOrigin(): string {
  if (typeof window !== 'undefined') return window.location.origin;
  return (
    process.env.NODE_ENV === 'development'
      ? 'http://127.0.0.1:8002'
      : process.env.API_PROXY_ORIGIN ?? (process.env.VERCEL_ENV === 'preview'
      ? 'https://pre-backend.minirueshop.com'
      : process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8002')
  ).replace(/\/+$/, '');
}

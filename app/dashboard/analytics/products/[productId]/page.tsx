import ProductFunnelDetailClient from './ProductFunnelDetailClient';

export const metadata = {
  title: 'Product Funnel — Analytics — MiniRue Admin',
};

export default async function AnalyticsProductFunnelDetailPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  return <ProductFunnelDetailClient productId={productId} />;
}

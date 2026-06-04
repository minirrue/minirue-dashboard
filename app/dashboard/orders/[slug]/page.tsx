import OrderDetailClient from './OrderDetailClient';

export const metadata = {
  title: 'Order Detail — MiniRue Admin',
};

export default async function OrderDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <OrderDetailClient id={slug} />;
}

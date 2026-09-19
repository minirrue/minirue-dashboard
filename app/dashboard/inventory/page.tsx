import StockOverviewClient from './StockOverviewClient';

export const metadata = {
  title: 'Inventory — MiniRue Admin',
};

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { q } = await searchParams;
  return <StockOverviewClient initialSearch={typeof q === 'string' ? q : ''} />;
}

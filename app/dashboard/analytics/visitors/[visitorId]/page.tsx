import VisitorDetailClient from './VisitorDetailClient';

export const metadata = {
  title: 'Visitor Detail — Analytics — MiniRue Admin',
};

export default async function AnalyticsVisitorDetailPage({
  params,
}: {
  params: Promise<{ visitorId: string }>;
}) {
  const { visitorId } = await params;
  return <VisitorDetailClient visitorId={visitorId} />;
}

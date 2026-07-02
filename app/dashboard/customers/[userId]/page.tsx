import CustomerDetailClient from './CustomerDetailClient';

export const metadata = {
  title: 'Customer Detail — MiniRue Admin',
};

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  return <CustomerDetailClient userId={userId} />;
}

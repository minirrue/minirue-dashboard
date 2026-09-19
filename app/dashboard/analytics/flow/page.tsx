import { Suspense } from 'react';
import FlowClient from './FlowClient';

export const metadata = {
  title: 'Story Flow — Analytics — MiniRue Admin',
};

export default function AnalyticsFlowPage() {
  return (
    <Suspense fallback={null}>
      <FlowClient />
    </Suspense>
  );
}

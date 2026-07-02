import { Suspense } from 'react';
import CollabActivateClient from './CollabActivateClient';

export default function CollabActivatePage() {
  return (
    <Suspense fallback={<main style={{ padding: 48 }}>Loading…</main>}>
      <CollabActivateClient />
    </Suspense>
  );
}

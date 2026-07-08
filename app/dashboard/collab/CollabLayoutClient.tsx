import type { ReactNode } from 'react';

export default function CollabLayoutClient({ children }: { children: ReactNode }) {
  return <div className="collab-portal-shell">{children}</div>;
}


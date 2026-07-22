'use client';

import {useState, type ReactNode } from 'react';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';

type ClientOnlyProps = {
  children: ReactNode;
  /** Shown during SSR and until the client has mounted. */
  fallback?: ReactNode;
};

/** Renders children only after mount to avoid auth/UI hydration mismatches. */
export default function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
  const [mounted, setMounted] = useState(false);

  useMountedEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <>{fallback}</>;
  return <>{children}</>;
}

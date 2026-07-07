'use client';

import React from 'react';

export interface Breakpoint {
  mobile: boolean;
  tablet: boolean;
  w: number;
}

export function useBreakpoint(): Breakpoint {
  const [w, setW] = React.useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

  React.useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  return { mobile: w < 640, tablet: w < 1024, w };
}

'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/** Persistent page actions. Mount once per page; space follows its real height. */
export default function DashboardActionBar({ title, description, children }: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = ref.current;
    const main = element?.closest<HTMLElement>('.dash-main');
    if (!element || !main) return;
    const previous = main.style.getPropertyValue('--dash-action-height');
    const measure = () => main.style.setProperty('--dash-action-height', `${element.getBoundingClientRect().height}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      observer.disconnect();
      if (previous) main.style.setProperty('--dash-action-height', previous);
      else main.style.removeProperty('--dash-action-height');
    };
  }, []);
  return <footer ref={ref} className="dash-action-bar" aria-label="Page actions">
    <div className="dash-action-bar-context"><strong>{title}</strong>{description && <span>{description}</span>}</div>
    <div className="dash-action-bar-controls">{children}</div>
  </footer>;
}

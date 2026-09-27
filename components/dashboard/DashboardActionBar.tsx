'use client';

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const subscribe = (onChange: () => void) => { queueMicrotask(onChange); return () => {}; };
const clientSnapshot = () => document.querySelector<HTMLElement>('.dash-shell');
const serverSnapshot = () => null;

/** Persistent page actions. Mount once per page; space follows its real height. */
export default function DashboardActionBar({ title, description, children }: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const anchor = useRef<HTMLSpanElement>(null);
  const shell = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  useEffect(() => {
    const element = ref.current;
    const main = anchor.current?.closest<HTMLElement>('.dash-main');
    if (!element || !main) return;
    const previous = main.style.getPropertyValue('--dash-action-height');
    const previousAttribute = main.getAttribute('data-has-action-bar');
    main.setAttribute('data-has-action-bar', 'true');
    const measure = () => main.style.setProperty('--dash-action-height', `${element.getBoundingClientRect().height}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      observer.disconnect();
      if (previous) main.style.setProperty('--dash-action-height', previous);
      else main.style.removeProperty('--dash-action-height');
      if (previousAttribute === null) main.removeAttribute('data-has-action-bar');
      else main.setAttribute('data-has-action-bar', previousAttribute);
    };
  }, [shell]);
  return <><span ref={anchor} hidden />{shell && createPortal(<footer ref={ref} className="dash-action-bar" aria-label="Page actions">
    <div className="dash-action-bar-context"><strong>{title}</strong>{description && <span>{description}</span>}</div>
    <div className="dash-action-bar-controls">{children}</div>
  </footer>, shell)}</>;
}

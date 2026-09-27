'use client';

import { useEffect, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

/** Page-scrolling header; the original horizontal scroller remains authoritative. */
export default function DownScrollHeader({ tableRef, children }: {
  tableRef: RefObject<HTMLTableElement | null>; children: ReactNode;
}) {
  const [layout, setLayout] = useState<{ top: number; left: number; width: number; scroll: number; columns: number[] } | null>(null);
  useEffect(() => {
    const table = tableRef.current;
    const scroller = table?.parentElement;
    if (!table || !scroller) return;
    let lastY = window.scrollY;
    let down = false;
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      if (Math.abs(y - lastY) > 1) down = y > lastY;
      lastY = y;
      const rect = table.getBoundingClientRect();
      const topbar = document.querySelector<HTMLElement>('.dash-topbar--minimal');
      const top = topbar && window.getComputedStyle(topbar).display !== 'none' ? Math.max(0, topbar.getBoundingClientRect().bottom) : 0;
      const header = table.tHead;
      const height = header?.getBoundingClientRect().height ?? 0;
      if (!down || window.innerWidth <= 640 || rect.top >= top || rect.bottom <= top + height + 80) { setLayout(null); return; }
      const box = scroller.getBoundingClientRect();
      setLayout({ top, left: box.left, width: box.width, scroll: scroller.scrollLeft,
        columns: Array.from(header?.rows[0]?.cells ?? []).map(cell => cell.getBoundingClientRect().width),
      });
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    scroller.addEventListener('scroll', schedule, { passive: true });
    const observer = new ResizeObserver(schedule);
    observer.observe(table);
    return () => {
      cancelAnimationFrame(frame); observer.disconnect();
      window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule);
      scroller.removeEventListener('scroll', schedule);
    };
  }, [tableRef]);
  if (!layout) return null;
  return createPortal(<div className="acct-floating-header" style={{ top: layout.top, left: layout.left, width: layout.width }}>
    <table className="dash-table acct-prices-table" aria-label="Pinned price sorting" style={{ tableLayout: 'fixed', width: layout.columns.reduce((a, b) => a + b, 0), transform: `translateX(-${layout.scroll}px)` }}>
      <colgroup>{layout.columns.map((width, index) => <col key={index} style={{ width }} />)}</colgroup>
      <thead>{children}</thead>
    </table>
  </div>, document.body);
}

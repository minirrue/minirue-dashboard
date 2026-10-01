'use client';

import { useMemo, useState } from 'react';
import type { Order } from '@/lib/api/orders';
import type { Column } from '@/components/dashboard/DashboardTable';

interface Props {
  orders: Order[];
  columns: Column<Order>[];
  emptyMessage: string;
}

/** Keeps the original column renderers (including transition actions) on narrow surfaces. */
export default function OrdersResponsiveList({ orders, columns, emptyMessage }: Props) {
  const [sort, setSort] = useState<{ key: 'orderSeq' | 'totalAmount' | 'createdAt'; desc: boolean } | null>(null);
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const sorted = useMemo(() => {
    if (!sort) return orders;
    return [...orders].sort((a, b) => {
      const left = a[sort.key];
      const right = b[sort.key];
      const comparison = typeof left === 'number' && typeof right === 'number'
        ? left - right : String(left).toLowerCase().localeCompare(String(right).toLowerCase());
      return sort.desc ? -comparison : comparison;
    });
  }, [orders, sort]);
  const lastPage = Math.max(0, Math.ceil(orders.length / 20) - 1);
  const currentPage = Math.min(page, lastPage);
  const cell = (order: Order, key: string) => {
    const column = columns.find((item) => item.key === key);
    return column?.render ? column.render(order) : null;
  };
  const toggleSort = (key: 'orderSeq' | 'totalAmount' | 'createdAt') => {
    setSort(previous => ({ key, desc: previous?.key === key && !previous.desc }));
    setPage(0);
  };
  return <section className="orders-list" aria-label="Orders list">
    <div className="orders-list-sort" aria-label="Sort orders">
      <span>Sort by</span>
      {([['orderSeq', 'Order'], ['totalAmount', 'Total'], ['createdAt', 'Date']] as const).map(([key, label]) =>
        <button key={key} type="button" aria-pressed={sort?.key === key} onClick={() => toggleSort(key)}>{label}{sort?.key === key ? (sort.desc ? ' ↓' : ' ↑') : ''}</button>)}
    </div>
    {!orders.length ? <p className="dash-table-empty">{emptyMessage}</p> : sorted.slice(currentPage * 20, (currentPage + 1) * 20).map(order => {
      const open = expanded.has(order.id);
      return <article key={order.id} className="orders-record" aria-label={`Order ${order.orderNumber}`}>
        <div className="orders-record-head"><div className="orders-reference">{cell(order, 'orderSeq')}</div>{cell(order, 'status')}</div>
        <div className="orders-record-main"><span>{cell(order, 'customer')}</span><span className="orders-record-amount">{cell(order, 'totalAmount')}</span><span className="orders-record-date">{cell(order, 'createdAt')}</span></div>
        {open && <div className="orders-record-detail" id={`order-detail-${order.id}`}><span>Channel: {cell(order, 'channel')}</span><span>Fulfillment: {cell(order, 'fulfillment')}</span></div>}
        <div className="orders-record-footer"><button type="button" className="orders-detail-button" aria-expanded={open} aria-controls={`order-detail-${order.id}`} onClick={() => setExpanded(previous => {
          const next = new Set(previous);
          if (next.has(order.id)) next.delete(order.id); else next.add(order.id);
          return next;
        })}>{open ? 'Hide details' : 'Details'}</button><div className="orders-record-actions">{cell(order, '_actions')}</div></div>
      </article>;
    })}
    {lastPage > 0 && <nav className="dash-pagination" aria-label="Orders pages"><span className="dash-pagination-info">{currentPage * 20 + 1}–{Math.min((currentPage + 1) * 20, orders.length)} of {orders.length}</span><div className="dash-pagination-controls"><button className="dash-pagination-btn" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Prev</button>{Array.from({ length: lastPage + 1 }, (_, index) => <button key={index} className="dash-pagination-btn" aria-current={index === currentPage ? 'page' : undefined} onClick={() => setPage(index)}>{index + 1}</button>)}<button className="dash-pagination-btn" disabled={currentPage === lastPage} onClick={() => setPage(currentPage + 1)}>Next</button></div></nav>}
  </section>;
}

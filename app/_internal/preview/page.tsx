'use client';

import React from 'react';
import {
  DashboardCard,
  DashboardShell,
  DashboardTable,
  StatusBadge,
} from '@/components/dashboard';
import type { Column } from '@/components/dashboard/DashboardTable';

type SampleRow = { id: string; name: string; status: 'draft' | 'published' | 'archived'; price: string };

const sampleColumns: Column<SampleRow>[] = [
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'Product' },
  { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
  { key: 'price', label: 'Price' },
];

const sampleRows: SampleRow[] = [
  { id: '#001', name: 'Oud Noir EDP', status: 'published', price: 'EGP 2,850' },
  { id: '#002', name: 'Rose Absolute', status: 'draft', price: 'EGP 1,450' },
  { id: '#003', name: 'Amber Elixir', status: 'archived', price: 'EGP 3,200' },
];

export default function DashboardPreviewPage() {
  return (
    <DashboardShell activePath="/preview" userName="Yusuf">
      <div className="p-8 space-y-10">
        <header>
          <h1 className="text-2xl font-semibold text-[--mr-ink-900]">Dashboard Design System</h1>
          <p className="text-sm text-[--mr-ink-500] mt-1">
            Kitchen-sink route — all dashboard primitives. Reference for builders.
          </p>
        </header>

        {/* Status Badges */}
        <section id="badges">
          <h2 className="text-sm font-medium text-[--mr-ink-500] uppercase tracking-widest mb-4">Status Badges</h2>
          <div className="flex flex-wrap gap-3">
            <StatusBadge status="published" />
            <StatusBadge status="draft" />
            <StatusBadge status="archived" />
            <StatusBadge status="published" label="Active" />
            <StatusBadge status="draft" label="Pending" />
          </div>
        </section>

        {/* Dashboard Cards */}
        <section id="cards">
          <h2 className="text-sm font-medium text-[--mr-ink-500] uppercase tracking-widest mb-4">Stat Cards</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <DashboardCard title="Total Revenue" value="EGP 128,450" change="12.5" trend="up" />
            <DashboardCard title="Orders Today" value="34" change="5.0" trend="up" />
            <DashboardCard title="Avg. Order Value" value="EGP 3,778" change="2.1" trend="down" />
          </div>
        </section>

        {/* Table */}
        <section id="table">
          <h2 className="text-sm font-medium text-[--mr-ink-500] uppercase tracking-widest mb-4">Table</h2>
          <DashboardTable columns={sampleColumns} data={sampleRows} />
        </section>

        {/* Shipped pages (append here as pages ship) */}
        <section id="shipped-pages">
          <h2 className="text-sm font-medium text-[--mr-ink-500] uppercase tracking-widest mb-4">Shipped Pages</h2>
          <p className="text-sm text-[--mr-ink-400] italic">
            No pages shipped yet. Dashboard-Builder appends here when each page/module ships.
          </p>
        </section>
      </div>
    </DashboardShell>
  );
}

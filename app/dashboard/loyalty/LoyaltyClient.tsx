'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import CopyButton from '@/components/dashboard/CopyButton';
import { ReasonPicker } from '@/components/dashboard/ReasonPicker';
import RetryingImage from '@/components/dashboard/RetryingImage';
import {
  apiAdminGetLoyaltyCustomer,
  apiAdminGetLoyaltyRules,
  apiAdminListLoyaltyAccounts,
  apiAdminManualAdjust,
  type LoyaltyAccountDto,
  type LoyaltyAdjustmentReason,
  type LoyaltyCustomerDetailDto,
  type LoyaltyTier,
} from '@/lib/api/loyalty';
import { apiUpdateSettings } from '@/lib/api/settings';
import type { ApiError } from '@/lib/api/client';
import { useUser } from '@/lib/hooks/use-auth';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';
import './loyalty.css';

type View = 'customers' | 'rules' | 'milestones';
type Sort = 'name' | 'balance' | 'earned30d' | 'adjusted30d' | 'lastActivity';
type Direction = 'asc' | 'desc';

const REASONS: Array<{ value: LoyaltyAdjustmentReason; label: string; sign: 'add' | 'remove' | 'either' }> = [
  { value: 'COMPENSATION_LATE_DELIVERY', label: 'Compensation · late delivery', sign: 'add' },
  { value: 'COMPENSATION_DAMAGED_ITEM', label: 'Compensation · damaged item', sign: 'add' },
  { value: 'GOODWILL', label: 'Goodwill', sign: 'add' },
  { value: 'PENALTY_ABUSE', label: 'Penalty · abuse', sign: 'remove' },
  { value: 'CORRECTION', label: 'Correction', sign: 'either' },
  { value: 'OTHER', label: 'Other', sign: 'either' },
];

const dateTime = new Intl.DateTimeFormat('en-EG', { dateStyle: 'medium', timeStyle: 'short', hour12: true });
const titleCase = (value: string) => value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

function Avatar({ account, large = false }: { account: LoyaltyAccountDto; large?: boolean }) {
  const fallback = <span aria-hidden>{account.name?.trim().charAt(0).toUpperCase() || '?'}</span>;
  if (!account.avatarUrl) return <span className={`loyalty-avatar${large ? ' loyalty-avatar-lg' : ''}`}>{fallback}</span>;
  return <RetryingImage src={account.avatarUrl} alt={`${account.name} profile`} className={`loyalty-avatar${large ? ' loyalty-avatar-lg' : ''}`} fallback={fallback} />;
}

function CustomerDrawer({ account, onClose, onChanged }: { account: LoyaltyAccountDto; onClose: () => void; onChanged: () => Promise<void> }) {
  const [detail, setDetail] = useState<LoyaltyCustomerDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'add' | 'remove'>('add');
  const [amount, setAmount] = useState('50');
  const [reason, setReason] = useState<LoyaltyAdjustmentReason>('COMPENSATION_LATE_DELIVERY');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setDetail(await apiAdminGetLoyaltyCustomer(account.customerId, { page: 1, limit: 50 })); }
    catch (err) { setError((err as ApiError).message ?? 'Could not load the points ledger.'); }
    finally { setLoading(false); }
  }, [account.customerId]);

  useEffect(() => {
    let active = true;
    apiAdminGetLoyaltyCustomer(account.customerId, { page: 1, limit: 50 })
      .then((value) => { if (active) setDetail(value); })
      .catch((err: ApiError) => { if (active) setError(err.message ?? 'Could not load the points ledger.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [account.customerId]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);

  function selectReason(next: LoyaltyAdjustmentReason) {
    setReason(next);
    const rule = REASONS.find((item) => item.value === next);
    if (rule?.sign === 'add') setMode('add');
    if (rule?.sign === 'remove') setMode('remove');
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = Number(amount);
    if (!Number.isInteger(parsed) || parsed <= 0) { setError('Enter a whole number greater than zero.'); return; }
    if (reason === 'OTHER' && !note.trim()) { setError('Add a note when the reason is Other.'); return; }
    const rule = REASONS.find((item) => item.value === reason);
    if ((rule?.sign === 'add' && mode !== 'add') || (rule?.sign === 'remove' && mode !== 'remove')) {
      setError(`${rule.label} must ${rule.sign === 'add' ? 'add' : 'remove'} points.`); return;
    }
    setSaving(true); setError(null); setSuccess(null);
    const delta = mode === 'add' ? parsed : -parsed;
    try {
      await apiAdminManualAdjust({ customerId: account.customerId, delta, reason, note: note.trim() || undefined });
      await Promise.all([loadDetail(), onChanged()]);
      setSuccess(`${delta > 0 ? '+' : ''}${delta.toLocaleString()} points applied.`);
      setNote('');
    } catch (err) { setError((err as ApiError).message ?? 'Could not adjust points.'); }
    finally { setSaving(false); }
  }

  const shown = detail ?? account;
  return <>
    <button className="loyalty-drawer-backdrop" type="button" aria-label="Close customer details" onClick={onClose} />
    <aside className="loyalty-drawer" role="dialog" aria-modal="true" aria-labelledby="loyalty-customer-title">
      <header className="loyalty-drawer-head">
        <div className="loyalty-person"><Avatar account={shown} large /><div><h2 id="loyalty-customer-title">{shown.name || 'Unnamed customer'}</h2><div className="loyalty-id"><code>{shown.customerId}</code><CopyButton value={shown.customerId} label="Copy ID" /></div></div></div>
        <button type="button" className="loyalty-close" onClick={onClose} aria-label="Close">×</button>
      </header>
      <div className="loyalty-drawer-body">
        <section className="loyalty-balance-band"><div><span>Available balance</span><strong>{shown.balance.toLocaleString()} pts</strong></div><span className="loyalty-tier" data-tier={shown.tier}>{titleCase(shown.tier)}</span></section>
        <section className="loyalty-section">
          <div className="loyalty-section-head"><div><h3>Adjust points</h3><p>Changes are recorded with your identity and reason.</p></div></div>
          <form className="loyalty-adjust" onSubmit={submit}>
            <div className="loyalty-segmented" aria-label="Adjustment direction"><button type="button" aria-pressed={mode === 'add'} onClick={() => setMode('add')}>Add</button><button type="button" aria-pressed={mode === 'remove'} onClick={() => setMode('remove')}>Remove</button></div>
            <label>Points<input className="dash-input" type="number" min="1" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
            <div className="loyalty-full">
              <ReasonPicker
                label="Reason"
                options={REASONS}
                value={reason}
                onChange={selectReason}
                note={note}
                onNoteChange={setNote}
                otherValue="OTHER"
                noteLabel="Required note"
                notePlaceholder="Explain why this adjustment is needed"
                showOptionalNote
              />
            </div>
            {error && <p className="dash-inline-error loyalty-full" role="alert">{error}</p>}
            {success && <p className="loyalty-success loyalty-full" role="status">{success}</p>}
            <button className="dash-btn-primary loyalty-adjust-submit" disabled={saving}>{saving ? 'Applying…' : `${mode === 'add' ? 'Add' : 'Remove'} ${Number(amount || 0).toLocaleString()} points`}</button>
          </form>
        </section>
        <section className="loyalty-section">
          <div className="loyalty-section-head"><div><h3>Points ledger</h3><p>Every earn, reversal and staff adjustment.</p></div>{detail && <span>{detail.total.toLocaleString()} events</span>}</div>
          {loading ? <span className="dash-skeleton loyalty-ledger-skeleton" /> : error && !detail ? <button className="dash-btn-secondary" onClick={() => void loadDetail()}>Retry ledger</button> : !detail?.history?.length ? <p className="loyalty-empty">No points activity yet.</p> : <ol className="loyalty-ledger">{detail.history.map((tx) => <li key={tx.id}><span className="loyalty-ledger-mark" data-positive={tx.delta > 0} /><div><strong>{titleCase(tx.type)}</strong><span>{tx.reason ? titleCase(tx.reason) : tx.note || 'Automatic loyalty event'}</span><time>{dateTime.format(new Date(tx.createdAt))}</time>{tx.orderId && <Link href={`/orders/${tx.orderId}`} className="dash-link">View order</Link>}</div><div className="loyalty-ledger-value" data-positive={tx.delta > 0}><strong>{tx.delta > 0 ? '+' : ''}{tx.delta.toLocaleString()}</strong><span>{tx.balanceAfter.toLocaleString()} after</span></div></li>)}</ol>}
        </section>
      </div>
    </aside>
  </>;
}

function RulesPanel() {
  const { data: user } = useUser();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';
  const [rate, setRate] = useState('2');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => { apiAdminGetLoyaltyRules().then((rules) => setRate(String(rules.pointsPerEgp))).catch(() => setMessage('Could not load the current earning rate.')).finally(() => setLoading(false)); }, []);
  async function save(event: React.FormEvent) {
    event.preventDefault(); const value = Number(rate);
    if (!Number.isInteger(value) || value < 1 || value > 1000) { setMessage('Enter a whole number from 1 to 1,000.'); return; }
    setSaving(true); setMessage(null);
    try { await apiUpdateSettings({ loyalty: { pointsPerEgp: value } }); setMessage('Earning rate saved.'); }
    catch (err) { setMessage((err as ApiError).message ?? 'Could not save the earning rate.'); }
    finally { setSaving(false); }
  }
  return <div className="dash-card loyalty-rules"><span className="loyalty-eyebrow">Earning rule</span><h2>Reward every pound spent</h2><p>Points are added only after an order is delivered. Refunds and cancellations reverse the matching points automatically.</p><form onSubmit={save}><span>1 EGP</span><span aria-hidden>→</span><label><span className="loyalty-sr">Points per EGP</span><input className="dash-input" type="number" min="1" max="1000" step="1" value={rate} onChange={(e) => setRate(e.target.value)} disabled={!canEdit || loading} /></label><span>points</span>{canEdit && <button className="dash-btn-primary" disabled={saving || loading}>{saving ? 'Saving…' : 'Save rate'}</button>}</form>{!canEdit && <p className="loyalty-note">You can view this rule. An administrator can change it.</p>}{message && <p className="loyalty-note" role="status">{message}</p>}</div>;
}

export default function LoyaltyClient() {
  const router = useRouter(); const pathname = usePathname(); const searchParams = useSearchParams();
  const initialView = (searchParams.get('view') as View) || 'customers';
  const [view, setView] = useState<View>(['customers', 'rules', 'milestones'].includes(initialView) ? initialView : 'customers');
  const [search, setSearch] = useState(searchParams.get('q') ?? ''); const debouncedSearch = useDebounce(search, 350);
  const [tier, setTier] = useState<LoyaltyTier | ''>((searchParams.get('tier') as LoyaltyTier) ?? '');
  const [hasBalance, setHasBalance] = useState(searchParams.get('hasBalance') === 'true');
  const [recentlyAdjusted, setRecentlyAdjusted] = useState(searchParams.get('recentlyAdjusted') === 'true');
  const [sort, setSort] = useState<Sort>((searchParams.get('sort') as Sort) || 'lastActivity');
  const [direction, setDirection] = useState<Direction>((searchParams.get('direction') as Direction) || 'desc');
  const [page, setPage] = useState(Math.max(1, Number(searchParams.get('page')) || 1));
  const [limit, setLimit] = useState<20 | 50 | 100>([20, 50, 100].includes(Number(searchParams.get('limit'))) ? Number(searchParams.get('limit')) as 20 | 50 | 100 : 20);
  const [accounts, setAccounts] = useState<LoyaltyAccountDto[]>([]); const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null); const [selected, setSelected] = useState<LoyaltyAccountDto | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const res = await apiAdminListLoyaltyAccounts({ page, limit, q: debouncedSearch || undefined, tier: tier || undefined, hasBalance: hasBalance || undefined, recentlyAdjusted: recentlyAdjusted || undefined, sort, direction }); setAccounts(Array.isArray(res?.data) ? res.data : []); setTotal(Number(res?.total) || 0); }
    catch (err) { setError((err as ApiError).message ?? 'Failed to load loyalty customers.'); }
    finally { setLoading(false); }
  }, [page, limit, debouncedSearch, tier, hasBalance, recentlyAdjusted, sort, direction]);
  useMountedEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const next = new URLSearchParams(); if (view !== 'customers') next.set('view', view); if (debouncedSearch) next.set('q', debouncedSearch); if (tier) next.set('tier', tier); if (hasBalance) next.set('hasBalance', 'true'); if (recentlyAdjusted) next.set('recentlyAdjusted', 'true'); if (sort !== 'lastActivity') next.set('sort', sort); if (direction !== 'desc') next.set('direction', direction); if (page !== 1) next.set('page', String(page)); if (limit !== 20) next.set('limit', String(limit));
    router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false });
  }, [view, debouncedSearch, tier, hasBalance, recentlyAdjusted, sort, direction, page, limit, pathname, router]);
  const pageCount = Math.max(1, Math.ceil(total / limit));
  const range = total ? `${(page - 1) * limit + 1}–${Math.min(page * limit, total)} of ${total}` : '0 customers';
  const currentTotal = useMemo(() => accounts.reduce((sum, item) => sum + item.balance, 0), [accounts]);
  function chooseView(next: View) { setView(next); }

  return <>
    <header className="dash-page-header loyalty-page-head"><div><h1 className="dash-page-title">Loyalty</h1><p>Find a customer, understand every point, and resolve exceptions safely.</p></div>{view === 'customers' && <div className="loyalty-page-stat"><span>Balance on this page</span><strong>{currentTotal.toLocaleString()} pts</strong></div>}</header>
    <div className="loyalty-layout">
      <nav className="loyalty-nav" aria-label="Loyalty sections"><button aria-current={view === 'customers' ? 'page' : undefined} onClick={() => chooseView('customers')}><span>Customers & points</span><small>Balances and activity</small></button><button aria-current={view === 'rules' ? 'page' : undefined} onClick={() => chooseView('rules')}><span>Rules</span><small>Earning rate</small></button><button aria-current={view === 'milestones' ? 'page' : undefined} onClick={() => chooseView('milestones')}><span>Milestones & rewards</span><small>Coming soon</small></button></nav>
      <main className="loyalty-content">
        {view === 'rules' ? <RulesPanel /> : view === 'milestones' ? <div className="dash-card loyalty-coming"><span className="loyalty-coming-mark">Soon</span><h2>Milestones & rewards</h2><p>Celebrate repeat customers with milestone gifts and point redemption. These controls will appear here once the reward engine is ready.</p><div><span>Birthday rewards</span><span>VIP milestones</span><span>Points spending</span></div></div> : <div className="dash-card loyalty-customers">
          <div className="loyalty-tools"><label className="loyalty-search"><span className="loyalty-sr">Search customers</span><input className="dash-input" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search name, ID, phone or email" /></label><label><span>Tier</span><select className="dash-input" value={tier} onChange={(e) => { setTier(e.target.value as LoyaltyTier | ''); setPage(1); }}><option value="">All tiers</option>{['BRONZE','SILVER','GOLD','PLATINUM'].map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></label><label><span>Sort</span><select className="dash-input" value={`${sort}:${direction}`} onChange={(e) => { const [nextSort, nextDirection] = e.target.value.split(':') as [Sort, Direction]; setSort(nextSort); setDirection(nextDirection); setPage(1); }}><option value="lastActivity:desc">Recently active</option><option value="name:asc">Name A–Z</option><option value="balance:desc">Highest balance</option><option value="earned30d:desc">Most earned · 30d</option><option value="adjusted30d:desc">Most adjusted · 30d</option></select></label><div className="loyalty-checks"><label><input type="checkbox" checked={hasBalance} onChange={(e) => { setHasBalance(e.target.checked); setPage(1); }} /> Has balance</label><label><input type="checkbox" checked={recentlyAdjusted} onChange={(e) => { setRecentlyAdjusted(e.target.checked); setPage(1); }} /> Recently adjusted</label></div></div>
          {loading ? <div className="loyalty-loading">{Array.from({length: 5}).map((_, index) => <span className="dash-skeleton" key={index} />)}</div> : error ? <div className="loyalty-state"><p className="dash-inline-error">{error}</p><button className="dash-btn-secondary" onClick={() => void load()}>Retry</button></div> : accounts.length === 0 ? <div className="loyalty-state"><strong>No matching customers</strong><p>Try clearing a filter or searching another email, phone, name or ID.</p></div> : <div className="dash-table-wrap"><table className="dash-table loyalty-table"><thead><tr><th>Customer</th><th>Customer ID</th><th>Tier</th><th className="loyalty-num">Balance</th><th className="loyalty-num">Last 30 days</th><th>Last activity</th><th /></tr></thead><tbody>{accounts.map((account) => <tr key={account.id}><td data-label="Customer"><button className="loyalty-customer-button" onClick={() => setSelected(account)}><Avatar account={account} /><span><strong>{account.name || 'Unnamed customer'}</strong><small>{account.email || 'No email'}</small></span></button></td><td data-label="Customer ID"><span className="loyalty-table-id"><code>{account.customerId.slice(0, 10)}…</code><CopyButton value={account.customerId} /></span></td><td data-label="Tier"><span className="loyalty-tier" data-tier={account.tier}>{titleCase(account.tier)}</span></td><td data-label="Balance" className="loyalty-num"><strong>{account.balance.toLocaleString()}</strong><small>points</small></td><td data-label="Last 30 days" className="loyalty-num"><span className="loyalty-positive">+{account.earnedLast30Days.toLocaleString()} earned</span><small>{account.adjustedLast30Days > 0 ? '+' : ''}{account.adjustedLast30Days.toLocaleString()} adjusted</small></td><td data-label="Last activity">{account.lastActivity ? dateTime.format(new Date(account.lastActivity)) : 'Never'}</td><td><button className="dash-btn-ghost" onClick={() => setSelected(account)}>View ledger</button></td></tr>)}</tbody></table></div>}
          <footer className="loyalty-pagination"><label>Rows <select className="dash-input" value={limit} onChange={(e) => { setLimit(Number(e.target.value) as 20 | 50 | 100); setPage(1); }}><option>20</option><option>50</option><option>100</option></select></label><span>{range}</span><div><button className="dash-btn-secondary" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {page} of {pageCount}</span><button className="dash-btn-secondary" disabled={page >= pageCount || loading} onClick={() => setPage((value) => value + 1)}>Next</button></div></footer>
        </div>}
      </main>
    </div>
    {selected && <CustomerDrawer account={selected} onClose={() => setSelected(null)} onChanged={load} />}
  </>;
}

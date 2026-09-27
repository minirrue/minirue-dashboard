'use client';

import { useMemo, useState } from 'react';
import { MenuSelect, SideSheet } from '@/components/dashboard/AnimatedControls';
import { formatEgpMinor } from '@/components/dashboard/charts';
import { groundItemKey, previewGroundPrices, saveGroundPrices, type GroundPriceItem, type GroundPrices, type GroundPricePatch, type GroundRule } from '@/lib/api/ground-pricing';

function message(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
  return error instanceof Error ? error.message : 'Prices could not be updated. Close this editor, reload prices and try again.';
}

export default function GroundPriceEditor({ overview, item, selected, onClose, onSaved }: {
  overview: GroundPrices; item?: GroundPriceItem; selected: string[];
  onClose: () => void; onSaved: (result: GroundPrices & {runId: string}) => void;
}) {
  const initialRule = item?.rule ?? overview.rule;
  const [scope, setScope] = useState<'SELECTED' | 'SYSTEM' | 'ALL'>(selected.length ? 'SELECTED' : 'SYSTEM');
  const [mode, setMode] = useState<'SYSTEM' | 'MANUAL'>(item?.mode ?? 'SYSTEM');
  const [useDefault, setUseDefault] = useState(!item?.rule);
  const [type, setType] = useState<GroundRule['type']>(initialRule.type);
  const [value, setValue] = useState(String(initialRule.value / 100));
  const [manual, setManual] = useState(item ? String(item.groundPriceMinor / 100) : '');
  const [preview, setPreview] = useState<GroundPrices | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const targets = useMemo(() => item ? [item] : overview.items.filter(row => scope === 'ALL' || (scope === 'SYSTEM' ? row.mode === 'SYSTEM' : selected.includes(groundItemKey(row)))), [item, overview, scope, selected]);
  const invalidate = () => { setPreview(null); setError(''); };
  const patch = (): GroundPricePatch => {
    if (!targets.length) throw new Error('Select at least one product to update.');
    const rule = { type, value: Math.round(Number(value) * 100) };
    if (!(item && mode === 'MANUAL') && !(item && useDefault) && (!Number.isFinite(rule.value) || rule.value <= 0)) throw new Error('Enter a percentage or EGP amount greater than zero.');
    if (item && mode === 'MANUAL') {
      const price = Math.round(Number(manual) * 100);
      if (!Number.isFinite(price) || price <= item.onlinePriceMinor) throw new Error('The Ground price must be greater than the online price.');
      return { revision: overview.revision, items: [{id:item.id,kind:item.kind,mode:'MANUAL',manualPriceMinor:price}] };
    }
    const updateDefault = !item && scope !== 'SELECTED';
    return { revision: overview.revision, ...(updateDefault ? {defaultRule:rule} : {}), items: targets.map(row => ({id:row.id,kind:row.kind,mode:'SYSTEM', ...((item && useDefault) || updateDefault ? {} : {rule})})) };
  };
  const runPreview = async () => {
    setBusy(true); setError('');
    try { setPreview(await previewGroundPrices(patch())); }
    catch (error) { setError(message(error)); }
    finally { setBusy(false); }
  };
  const save = async () => {
    if (!preview) return;
    setBusy(true); setError('');
    try { onSaved(await saveGroundPrices(patch())); }
    catch (error) { setPreview(null); setError(message(error)); }
    finally { setBusy(false); }
  };
  const before = new Map(overview.items.map(row => [groundItemKey(row), row]));
  const changes = preview?.items.filter(row => targets.some(target => groundItemKey(target) === groundItemKey(row))) ?? [];
  return <SideSheet open onClose={onClose} title={item ? `Ground price · ${item.name}` : 'Bulk edit Ground prices'} description="Review the server-calculated prices before saving. Online prices stay unchanged." busy={busy} footer={<><button className="dash-btn-secondary" type="button" onClick={onClose} disabled={busy}>Cancel</button><button className="dash-btn-primary" type="button" disabled={busy} onClick={() => void (preview ? save() : runPreview())}>{busy ? (preview ? 'Saving…' : 'Calculating…') : preview ? 'Save Ground prices' : 'Preview changes'}</button></>}>
    <div className="acct-ground-editor">
      {item ? <><p>Online price: <strong>{formatEgpMinor(item.onlinePriceMinor)}</strong></p><MenuSelect label="Ground pricing mode" value={mode} options={[{value:'SYSTEM',label:'System · linked to online'},{value:'MANUAL',label:'My Ground price'}]} onChange={next => {setMode(next);invalidate();}} disabled={busy}/></> : <MenuSelect label="Apply to" value={scope} options={[{value:'SELECTED',label:`Selected products (${selected.length})`},{value:'SYSTEM',label:'All current System products'},{value:'ALL',label:'All products · switch to System'}]} onChange={next => {setScope(next);invalidate();}} disabled={busy}/>}
      {item && mode === 'SYSTEM' && <label className="acct-ground-check"><input type="checkbox" checked={useDefault} disabled={busy} onChange={event => {setUseDefault(event.target.checked);invalidate();}}/>Use the shared Ground rule</label>}
      {item && mode === 'MANUAL' ? <label>Ground price (EGP)<input className="dash-input" type="number" min="0.01" step="0.01" value={manual} disabled={busy} onChange={event => {setManual(event.target.value);invalidate();}}/></label> : item && useDefault ? <p>Shared rule: {overview.rule.type === 'PERCENT' ? `${overview.rule.value / 100}%` : formatEgpMinor(overview.rule.value)} above online.</p> : <>
        <MenuSelect label="Add above online" value={type} options={[{value:'PERCENT',label:'Percentage (%)'},{value:'FIXED',label:'Fixed EGP amount'}]} onChange={next => {setType(next);invalidate();}} disabled={busy}/>
        <label>{type === 'PERCENT' ? 'Percentage above online' : 'EGP added to online'}<input className="dash-input" type="number" min="0.01" step="0.01" value={value} disabled={busy} onChange={event => {setValue(event.target.value);invalidate();}}/></label>
      </>}
      <p className="acct-prices-summary">{targets.length} {targets.length === 1 ? 'product' : 'products'}. System prices update automatically when online prices change. Ground gross margin excludes box and trip costs.</p>
      {!item && scope === 'ALL' && <p className="acct-ground-notice">Existing manual Ground prices will switch to the new System rule.</p>}
      {error && <p className="acct-ground-error" role="alert">{error}</p>}
      {preview && <section aria-label="Ground price preview" aria-live="polite"><h3>Review changes</h3><div className="acct-ground-changes">{changes.map(row => <article key={groundItemKey(row)}><strong>{row.name}</strong><span>{formatEgpMinor(before.get(groundItemKey(row))?.groundPriceMinor ?? 0)} → <b>{formatEgpMinor(row.groundPriceMinor)}</b></span><small>{row.marginBp == null ? 'Add bought cost to calculate margin' : `${(row.marginBp / 100).toFixed(1)}% gross margin`}</small></article>)}</div></section>}
    </div>
  </SideSheet>;
}

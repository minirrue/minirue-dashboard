'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Check, Copy, Eye, LoaderCircle, Minus, Package, Plus, Search, Trash2 } from 'lucide-react';
import QRCode from 'qrcode';
import DashboardActionBar from '@/components/dashboard/DashboardActionBar';
import { MenuSelect } from '@/components/dashboard/AnimatedControls';
import { storefrontOrigin } from '@/lib/storefront/origin';
import { assistedPhoneLocal, normalizeAssistedPhone } from '@/lib/orders/assisted-phone';
import { cancelAssistedReview, completeAssistedReview, createAssistedReview, getAssistedCatalog, getAssistedReview, getCustomerNeeds, type AssistedCatalogItem, type AssistedReview, type CreateAssistedReview, type CustomerNeed, type SalesMode } from '@/lib/api/assisted-sales';
import './assisted-order.css';
import { useUser } from '@/lib/hooks/use-auth';

const money = (minor: number) => `EGP ${(minor / 100).toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const errorMessage = (error: unknown, fallback: string) => {
  const message = (error as { message?: unknown })?.message;
  return typeof message === 'string' && message.length < 400 ? message : fallback;
};
type BasketLine = { item: AssistedCatalogItem; qty: number };

export default function AssistedOrderClient() {
  const router = useRouter();
  const params = useSearchParams();
  const reviewId = params.get('review');
  const { data: user } = useUser();
  const canManageNeeds = user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';
  const [mode, setMode] = useState<SalesMode>('GROUND');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [line1, setLine1] = useState('');
  const [city, setCity] = useState('');
  const [governorate, setGovernorate] = useState('');
  const [payment, setPayment] = useState<CreateAssistedReview['paymentMethod']>('CASH');
  const [notes, setNotes] = useState('');
  const [reference, setReference] = useState('');
  const [sender, setSender] = useState('');
  const [receipt, setReceipt] = useState<string | undefined>();
  const [receiptName, setReceiptName] = useState('');
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [need, setNeed] = useState('');
  const [needs, setNeeds] = useState<CustomerNeed[]>([]);
  const [needsError, setNeedsError] = useState(false);
  const [catalog, setCatalog] = useState<AssistedCatalogItem[]>([]);
  const [catalogBusy, setCatalogBusy] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [reload, setReload] = useState(0);
  const [basket, setBasket] = useState<BasketLine[]>([]);
  const [review, setReview] = useState<AssistedReview | null>(null);
  const [restoring, setRestoring] = useState(!!reviewId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [handed, setHanded] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [quoteUncertain, setQuoteUncertain] = useState(false);
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);
  const operation = useRef(false);
  const pendingQuote = useRef<CreateAssistedReview | null>(null);

  useEffect(() => {
    let active = true;
    getCustomerNeeds().then(result => { if (active) { setNeeds(result.data.filter(item => item.isActive)); setNeedsError(false); } }).catch(() => { if (active) setNeedsError(true); });
    return () => { active = false; };
  }, [reload]);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setCatalogBusy(true);
      setCatalogError(null);
      getAssistedCatalog({ q: query.trim(), concernId: need || undefined, page }).then(result => {
        if (!active) return;
        setCatalog(old => page === 1 ? result.data : [...old, ...result.data]);
        setHasMore(result.hasMore);
      }).catch(e => { if (active) setCatalogError(errorMessage(e, 'Products could not load. Try again.')); }).finally(() => { if (active) setCatalogBusy(false); });
    }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [query, need, page, reload]);

  useEffect(() => {
    if (!reviewId || review?.id === reviewId) return;
    let active = true;
    getAssistedReview(reviewId).then(result => { if (active) { setReview(result); setError(null); } }).catch(e => { if (active) setError(errorMessage(e, 'The saved review could not load. Retry before creating another order.')); }).finally(() => { if (active) setRestoring(false); });
    return () => { active = false; };
  }, [reviewId, review?.id, reload]);

  const customerUrl = review ? `${storefrontOrigin()}${review.reviewPath}` : '';
  useEffect(() => {
    if (!customerUrl) return;
    let active = true;
    QRCode.toDataURL(customerUrl, { width: 240, margin: 2, errorCorrectionLevel: 'M' }).then(url => { if (active) setQr(url); }).catch(() => { if (active) setQr(''); });
    return () => { active = false; };
  }, [customerUrl]);

  function changeQty(item: AssistedCatalogItem, delta: number) {
    setBasket(current => {
      const existing = current.find(line => line.item.id === item.id);
      const next = Math.max(0, Math.min(item.availableStock, (existing?.qty ?? 0) + delta));
      if (!next) return current.filter(line => line.item.id !== item.id);
      return existing ? current.map(line => line.item.id === item.id ? { ...line, qty: next } : line) : [...current, { item, qty: next }];
    });
  }

  async function create(event?: FormEvent) {
    event?.preventDefault();
    if (operation.current) return;
    if (!pendingQuote.current) {
      const normalized = normalizeAssistedPhone(phone);
      if (!normalized) { setError('Enter a valid Egyptian mobile number, for example 01012431350.'); document.getElementById('assisted-phone')?.focus(); return; }
      if (!firstName.trim() || !basket.length) { setError('Add the customer’s first name and at least one item.'); return; }
      pendingQuote.current = {
        idempotencyKey: crypto.randomUUID(), salesMode: mode,
        customer: { firstName: firstName.trim(), lastName: lastName.trim() || undefined, phone: normalized, email: email.trim() || undefined },
        items: basket.map(({ item, qty }) => (item.kind === 'BUNDLE' ? { bundleId: item.bundleId!, qty } : { variantId: item.variantId!, qty })),
        paymentMethod: payment, notes: notes.trim() || undefined,
        ...(mode === 'ONLINE' ? { shippingAddress: { line1: line1.trim(), city: city.trim(), governorate: governorate.trim() } } : {}),
      };
    }
    operation.current = true;
    setBusy(true); setError(null);
    try {
      const result = await createAssistedReview(pendingQuote.current);
      setReview(result); setQuoteUncertain(false); setPaid(false); setHanded(false); setCopied(false);
      router.replace(`/orders/new?review=${encodeURIComponent(result.id)}`);
    } catch (e) {
      const status = (e as { status?: number }).status;
      const ambiguous = !status || status >= 500;
      setQuoteUncertain(ambiguous);
      if (!ambiguous) pendingQuote.current = null;
      setError(ambiguous ? 'The connection ended before the review was confirmed. Retry this same request to recover it safely.' : errorMessage(e, 'Review could not be created. Check the customer and items.'));
    } finally { operation.current = false; setBusy(false); }
  }

  async function checkStatus() {
    if (!review || operation.current) return;
    operation.current = true; setBusy(true); setError(null);
    try { const result = await getAssistedReview(review.id); setReview(result); setUncertain(false); }
    catch { setError('Status is still unavailable. Check again before recording another purchase.'); }
    finally { operation.current = false; setBusy(false); }
  }

  async function complete() {
    if (!review || operation.current || receiptBusy || !paid || (review.salesMode === 'GROUND' && !handed)) return;
    operation.current = true; setBusy(true); setError(null);
    try {
      const result = await completeAssistedReview(review.id, { paymentReceived: true, handedOver: review.salesMode === 'GROUND' && handed, instapayReference: reference.trim() || undefined, payerName: sender.trim() || undefined, receiptDataUrl: receipt });
      setReview(result); setUncertain(false);
    } catch (e) {
      try {
        const result = await getAssistedReview(review.id);
        setReview(result); setUncertain(false);
        if (result.status !== 'COMPLETED') setError(errorMessage(e, 'Purchase was not completed. Check payment and retry.'));
      } catch { setUncertain(true); setError('We could not confirm the result. Check this order’s status before taking another payment or creating a replacement.'); }
    } finally { operation.current = false; setBusy(false); }
  }

  async function edit() {
    if (!review || operation.current || uncertain) return;
    operation.current = true; setBusy(true); setError(null);
    try {
      await cancelAssistedReview(review.id);
      // A refreshed review has no local draft; restore its customer/items before editing.
      setFirstName(review.customer.firstName); setLastName(review.customer.lastName ?? ''); setPhone(assistedPhoneLocal(review.customer.phone)); setEmail(review.customer.email ?? ''); setMode(review.salesMode);
      if (review.paymentMethod) setPayment(review.paymentMethod);
      setNotes(review.notes ?? '');
      if (review.shippingAddress) { setLine1(review.shippingAddress.line1); setCity(review.shippingAddress.city); setGovernorate(review.shippingAddress.governorate); }
      if (!basket.length) setBasket(review.items.map(item => ({ item: { id: item.id, kind: item.kind, bundleId: item.bundleId, variantId: item.variantId, productId: null, name: item.name, sku: item.sku, sizeMl: item.sizeMl, onlinePriceMinor: item.unitPriceMinor, groundPriceMinor: item.unitPriceMinor, availableStock: item.quantity, imageUrl: item.imageUrl }, qty: item.quantity })));
      setReview(null); pendingQuote.current = null; setPaid(false); setHanded(false); setQr('');
      router.replace('/orders/new');
    } catch (e) { setError(errorMessage(e, 'The review could not be replaced. Check its status before trying again.')); }
    finally { operation.current = false; setBusy(false); }
  }

  function newOrder() { window.location.assign('/orders/new'); }
  async function readReceipt(file?: File) {
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 10 * 1024 * 1024) { setError('Choose a PNG or JPEG receipt no larger than 10 MB.'); return; }
    setReceiptBusy(true); setError(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
      setReceipt(dataUrl); setReceiptName(file.name);
    } catch { setError('The receipt could not be read. Choose the image again.'); }
    finally { setReceiptBusy(false); }
  }
  const estimated = basket.reduce((sum, { item, qty }) => sum + qty * (mode === 'GROUND' ? item.groundPriceMinor : item.onlinePriceMinor), 0);
  const done = review?.status === 'COMPLETED';
  const expired = review?.status === 'EXPIRED';
  const locked = busy || quoteUncertain;

  if (restoring || (reviewId && !review)) return <div className="assisted-order"><h1>Opening saved review</h1><p>{error ?? 'Checking the latest order status…'}</p>{error && <button className="dash-btn-secondary" onClick={() => setReload(n => n + 1)}>Retry saved review</button>}</div>;

  return <div className="assisted-order">
    <header className="ao-heading"><Link href="/orders" className="ao-back"><ArrowLeft size={17}/>Orders</Link><div><div><h1>{review ? done ? 'Purchase recorded' : 'Review and confirm' : 'New manual order'}</h1><p>{review ? done ? 'The purchase is saved. You can help the next customer.' : 'Show the customer their review, then record verified payment.' : 'Choose products, collect customer details, and confirm the purchase.'}</p></div>{done && <button className="dash-btn-primary" onClick={newOrder}><Plus size={18}/>New order</button>}</div></header>
    {error && <div className="ao-alert" role="alert">{error}</div>}
    {review ? <>
      {done && <div className="ao-success" role="status"><Check size={22}/><div><strong>{review.orderNumber ?? 'Order confirmed'}</strong><p>{review.salesMode === 'GROUND' ? 'Paid · collected in person' : 'Paid · awaiting delivery'}</p></div></div>}
      {expired && <div className="ao-alert" role="alert">This review has expired. Replace it to get current prices and availability.</div>}
      <div className="ao-review-grid"><section className="ao-panel"><div className="ao-section-heading"><h2>Purchase summary</h2><span className="ao-tag">{review.salesMode === 'GROUND' ? 'Ground' : 'Online'}</span></div>
        <ul className="ao-receipt">{review.items.map(item => <li key={item.id}><ProductImage src={item.imageUrl}/><div><strong>{item.name}</strong><p>{item.quantity} × {money(item.unitPriceMinor)}</p></div><strong>{money(item.lineTotalMinor)}</strong></li>)}</ul>
        <dl className="ao-totals"><div><dt>Subtotal</dt><dd>{money(review.subtotalMinor)}</dd></div>{!!review.discountMinor && <div><dt>Discount</dt><dd>−{money(review.discountMinor)}</dd></div>}<div><dt>{review.salesMode === 'GROUND' ? 'Collection' : 'Delivery'}</dt><dd>{review.shippingMinor ? money(review.shippingMinor) : 'Free'}</dd></div><div className="ao-total"><dt>Total</dt><dd>{money(review.totalMinor)}</dd></div></dl>
        <div className="ao-customer-summary"><h3>Customer</h3><p>{review.customer.firstName} {review.customer.lastName}</p><p>{review.customer.phone}</p><p>{review.customer.email ?? 'No email supplied'}</p><span className="ao-tag">{review.customer.registrationStatus === 'LINKED' ? 'Linked account' : 'Not signed up'}</span><p className="ao-hint">The customer profile is saved by phone. It does not automatically create an online account.</p></div>
      </section><div className="ao-review-aside">
        {!expired && <section className="ao-panel"><h2>Customer review</h2><div className="ao-qr">{qr ? <Image unoptimized src={qr} width={176} height={176} alt="Scan to review this purchase"/> : <span>Use the customer preview link below.</span>}<p>Ask the customer to scan this code to check their items and rewards.</p></div><div className="ao-inline-actions"><a href={customerUrl} target="_blank" rel="noopener noreferrer" className="dash-btn-secondary"><Eye size={17}/>Preview customer page</a><button className="dash-btn-ghost" onClick={async () => { try { await navigator.clipboard.writeText(customerUrl); setCopied(true); } catch { setError('Could not copy the link. Use Preview customer page to open it.'); } }}><Copy size={16}/>{copied ? 'Link copied' : 'Copy link'}</button></div></section>}
        {!done && !expired && <section className="ao-panel"><h2>Payment {review.salesMode === 'GROUND' ? 'and handover' : 'confirmation'}</h2><p className="ao-hint">Payment method: {review.paymentMethod === 'INSTAPAY' ? 'InstaPay transfer' : review.paymentMethod === 'CARD' ? 'Card collected by staff' : 'Cash'}</p><label className="ao-check"><input type="checkbox" checked={paid} disabled={busy || uncertain} onChange={e => setPaid(e.target.checked)}/>Payment received and verified</label>{review.salesMode === 'GROUND' && <label className="ao-check"><input type="checkbox" checked={handed} disabled={busy || uncertain} onChange={e => setHanded(e.target.checked)}/>Products handed to the customer</label>}<label className="ao-field">Payment reference <span>Optional</span><input className="dash-input" value={reference} disabled={busy || uncertain} onChange={e => setReference(e.target.value)} maxLength={120}/></label><label className="ao-field">Sender name <span>Optional</span><input className="dash-input" value={sender} disabled={busy || uncertain} onChange={e => setSender(e.target.value)} maxLength={120}/></label><label className="ao-field">Receipt screenshot <span>Optional · PNG or JPEG, up to 10 MB</span><input type="file" accept="image/png,image/jpeg" disabled={busy || uncertain || receiptBusy} onChange={e => readReceipt(e.target.files?.[0])}/>{receiptName && <span>{receiptName} <button type="button" className="dash-btn-ghost" disabled={busy || uncertain} onClick={() => { setReceipt(undefined); setReceiptName(''); }}>Remove receipt</button></span>}{receiptBusy && <small role="status">Reading receipt…</small>}</label><p className="ao-hint">Confirm only after checking payment. Completing this review records the purchase once.</p></section>}
        <section className="ao-panel"><h2>Rewards and receipt</h2><p><strong>{review.loyalty.expectedPoints.toLocaleString()} expected points</strong>{review.loyalty.egpValueMinor == null ? ' · EGP value not configured' : ` · ${money(review.loyalty.egpValueMinor)} reward value`}</p><p className="ao-hint">{review.salesMode === 'ONLINE' ? 'Rewards follow delivery and verified account ownership.' : 'Unclaimed rewards wait for verified account ownership.'} Phone-only claims stay pending until phone verification is available.</p><p className="ao-hint">{review.customer.email ? 'Receipt uses the exact order prices and the supplied email.' : 'No email supplied. The customer can keep their review link as a receipt.'}</p></section>
      </div></div>
      <DashboardActionBar title={money(review.totalMinor)} description={done ? 'Purchase recorded' : expired ? 'Review expired' : review.salesMode === 'GROUND' ? 'Ground purchase' : 'Online order'}>
        {done ? <><Link href={`/orders/${review.orderId ?? review.orderNumber}`} className="dash-btn-secondary">View order</Link><button className="dash-btn-primary" onClick={newOrder}><Plus size={18}/>New order</button></> : uncertain ? <button className="dash-btn-primary" disabled={busy} onClick={checkStatus}>{busy ? 'Checking…' : 'Check purchase status'}</button> : <><button className="dash-btn-secondary" disabled={busy} onClick={edit}>{expired ? 'Replace review' : 'Edit and replace review'}</button>{!expired && <button className="dash-btn-primary" disabled={busy || receiptBusy || !paid || (review.salesMode === 'GROUND' && !handed)} onClick={complete}>{busy ? <LoaderCircle className="ao-spin" size={18}/> : <Check size={18}/>} {busy ? 'Recording…' : 'Customer bought · complete purchase'}</button>}</>}
      </DashboardActionBar>
    </> : <form id="assisted-entry" onSubmit={create}>
      <fieldset disabled={locked} className="ao-form-fieldset">
        <div className="ao-mode" role="group" aria-label="Sale channel"><button type="button" aria-pressed={mode === 'GROUND'} onClick={() => setMode('GROUND')}>Ground · collect in person</button><button type="button" aria-pressed={mode === 'ONLINE'} onClick={() => setMode('ONLINE')}>Online · delivery</button></div>
        <div className="ao-entry-grid"><div className="ao-product-area"><section className="ao-panel"><h2>Find products</h2>{canManageNeeds && <Link href="/catalogue/needs" className="ao-manage-link">Manage customer needs</Link>}<div className="ao-filters"><label className="ao-search"><Search size={18}/><input aria-label="Search products" type="search" placeholder="Search product or SKU" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }}/></label><MenuSelect label="Customer need" value={need} options={[{ value: '', label: 'All products' }, ...needs.map(item => ({ value: item.id, label: item.name }))]} onChange={value => { setNeed(value); setPage(1); }}/></div>{needsError && <p className="ao-hint">Customer needs could not load. Product search is still available.</p>}
          {catalogError && <div className="ao-alert" role="alert">{catalogError}<button type="button" className="dash-btn-ghost" onClick={() => setReload(n => n + 1)}>Retry</button></div>}
          {catalogBusy && <p role="status" className="ao-hint">Loading products…</p>}
          {!catalogBusy && !catalogError && !catalog.length && <p className="ao-empty">No products match this search. Try a different name or customer need.</p>}
          <div className="ao-products">{catalog.map(item => { const qty = basket.find(line => line.item.id === item.id)?.qty ?? 0; return <article className="ao-product" key={item.id}><ProductImage src={item.imageUrl}/><div><h3>{item.name}</h3><p>{item.sizeMl ? `${item.sizeMl} ml · ` : ''}{item.sku}</p><strong>{money(mode === 'GROUND' ? item.groundPriceMinor : item.onlinePriceMinor)}</strong><span>{item.availableStock > 0 ? `${item.availableStock} available` : 'Out of stock'}</span></div><button type="button" className="dash-btn-secondary" disabled={qty >= item.availableStock} onClick={() => changeQty(item, 1)} aria-label={`Add ${item.name}`}><Plus size={17}/>{qty ? `Add (${qty})` : 'Add'}</button></article>; })}</div>
          {hasMore && <button type="button" className="dash-btn-secondary" disabled={catalogBusy} onClick={() => setPage(n => n + 1)}>Load more products</button>}
        </section><section className="ao-panel"><h2>Customer details</h2><p className="ao-hint">First name and mobile identify this customer. Email is optional.</p><div className="ao-fields"><label className="ao-field">First name<input className="dash-input" required autoComplete="given-name" maxLength={80} value={firstName} onChange={e => setFirstName(e.target.value)}/></label><label className="ao-field">Last name <span>Optional</span><input className="dash-input" autoComplete="family-name" maxLength={80} value={lastName} onChange={e => setLastName(e.target.value)}/></label><label className="ao-field">Mobile number<div className="ao-phone"><span>Egypt +20</span><input id="assisted-phone" required type="tel" autoComplete="tel-national" inputMode="tel" placeholder="1012431350" value={phone} onBlur={() => setPhone(assistedPhoneLocal(phone))} onChange={e => setPhone(e.target.value)}/></div><small>Accepts 01012431350 or 1012431350.</small></label><label className="ao-field">Email <span>Optional</span><input className="dash-input" type="email" autoComplete="email" maxLength={254} value={email} onChange={e => setEmail(e.target.value)}/></label></div>
          {mode === 'ONLINE' && <div className="ao-address"><h3>Delivery address</h3><label className="ao-field">Street address<input className="dash-input" required value={line1} onChange={e => setLine1(e.target.value)} autoComplete="address-line1"/></label><div className="ao-fields"><label className="ao-field">City<input className="dash-input" required value={city} onChange={e => setCity(e.target.value)} autoComplete="address-level2"/></label><label className="ao-field">Governorate<input className="dash-input" required value={governorate} onChange={e => setGovernorate(e.target.value)} autoComplete="address-level1"/></label></div></div>}
        </section></div><aside className="ao-basket-area"><section className="ao-panel"><h2>Order items</h2>{!basket.length ? <div className="ao-empty"><Package size={28}/><p>Add the products this customer wants.</p></div> : <ul className="ao-basket">{basket.map(({ item, qty }) => <li key={item.id}><div><strong>{item.name}</strong><span>{money(mode === 'GROUND' ? item.groundPriceMinor : item.onlinePriceMinor)} each</span></div><div className="ao-quantity"><button type="button" aria-label={`Decrease ${item.name}`} onClick={() => changeQty(item, -1)}><Minus size={16}/></button><output>{qty}</output><button type="button" aria-label={`Increase ${item.name}`} disabled={qty >= item.availableStock} onClick={() => changeQty(item, 1)}><Plus size={16}/></button><button type="button" aria-label={`Remove ${item.name}`} onClick={() => setBasket(current => current.filter(line => line.item.id !== item.id))}><Trash2 size={16}/></button></div></li>)}</ul>}
          <dl className="ao-totals"><div className="ao-total"><dt>Items estimate</dt><dd>{money(estimated)}</dd></div></dl><p className="ao-hint">{mode === 'GROUND' ? 'Ground prices · no shipping charge.' : 'Online prices. Delivery is calculated in the review.'} Final prices and availability are checked before confirmation.</p>
        </section><section className="ao-panel"><h2>Payment and notes</h2><MenuSelect label="Payment" value={payment} options={[{ value: 'CASH', label: 'Cash' }, { value: 'INSTAPAY', label: 'InstaPay transfer' }, { value: 'CARD', label: 'Card · collected by staff' }]} onChange={setPayment}/><label className="ao-field">Staff notes <span>Optional</span><textarea className="dash-input" rows={3} maxLength={2000} value={notes} onChange={e => setNotes(e.target.value)}/></label></section></aside></div>
      </fieldset>
      <DashboardActionBar title={money(estimated)} description={`${basket.reduce((n, line) => n + line.qty, 0)} items · ${mode === 'GROUND' ? 'Ground' : 'Online'}`}><Link href="/orders" className="dash-btn-secondary">Back to Orders</Link>{quoteUncertain ? <button type="button" className="dash-btn-primary" disabled={busy} onClick={() => create()}>{busy ? 'Recovering review…' : 'Retry same review'}</button> : <button type="submit" form="assisted-entry" className="dash-btn-primary" disabled={busy || !basket.length}>{busy ? <LoaderCircle className="ao-spin" size={18}/> : <Eye size={18}/>} {busy ? 'Preparing review…' : 'Review with customer'}</button>}</DashboardActionBar>
    </form>}
  </div>;
}

function ProductImage({ src }: { src: string | null }) {
  const [failed, setFailed] = useState(false);
  return <div className="ao-product-image">{src && !failed ? <Image unoptimized src={src} alt="" width={64} height={76} onError={() => setFailed(true)}/> : <Package size={24}/>}</div>;
}

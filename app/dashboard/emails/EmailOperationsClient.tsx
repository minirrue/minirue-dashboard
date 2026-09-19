'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiError } from '@/lib/api/client';
import { isAdminRole } from '@/lib/auth/roles';
import { useUser } from '@/lib/hooks/use-auth';
import {
  apiCreateEmailCampaign,
  apiCreateEmailTemplate,
  apiDuplicateEmailTemplate,
  apiEmailBranding,
  apiEmailCampaigns,
  apiEmailEvents,
  apiEmailThread,
  apiEmailThreads,
  apiEmailTemplates,
  apiReplyToEmailThread,
  apiSendEmailCampaign,
  apiUpdateEmailBranding,
  apiUpdateEmailTemplate,
  collectionItems,
  type EmailCampaign,
  type EmailDeliveryStatus,
  type EmailLogoShape,
  type EmailTemplate,
} from '@/lib/api/email-operations';
import { useClearNavBadge } from '@/lib/hooks/use-clear-nav-badge';
import { HREF_CATEGORIES } from '@/lib/notifications/nav-counts';
import { apiUploadBrandLogo } from '@/lib/api/settings';
import DirectEmailComposer from '@/components/dashboard/email/DirectEmailComposer';
import styles from './email-operations.module.css';
import { formatDateTime } from '@/lib/dates/format';

const DELIVERY_FILTERS: Array<{ value: EmailDeliveryStatus | ''; label: string }> = [
  { value: '', label: 'All activity' },
  { value: 'RECEIVED', label: 'Received' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'SENT', label: 'Sent' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'OPENED', label: 'Opened' },
  { value: 'CLICKED', label: 'Clicked' },
  { value: 'BOUNCED', label: 'Bounced' },
  { value: 'COMPLAINED', label: 'Complaints' },
  { value: 'DEFERRED', label: 'Deferred' },
  { value: 'FAILED', label: 'Failed' },
];

const THREAD_FILTERS = [
  { value: '', label: 'All conversations' },
  { value: 'OPEN', label: 'Open' },
  { value: 'CLOSED', label: 'Closed' },
];

function fmt(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return formatDateTime(date);
}

function errorText(error: unknown, fallback: string) {
  return (error as ApiError | undefined)?.message || fallback;
}

function Status({ value }: { value: string }) {
  return <span className={styles.status} data-status={value}>{value.toLowerCase().replace('_', ' ')}</span>;
}

function LoadingRows({ count = 4 }: { count?: number }) {
  return <>{Array.from({ length: count }, (_, i) => <span key={i} className={`dash-skeleton ${styles.skeleton}`} />)}</>;
}

function Empty({ title, body }: { title: string; body: string }) {
  return <div className={styles.empty}><div className={styles.emptyMark} aria-hidden="true">@</div><strong>{title}</strong><p>{body}</p></div>;
}

function ComposeView() {
  return <section className={styles.composeCard} aria-label="Compose customer email">
    <div className={styles.sectionHeading}>
      <div><h2>New customer email</h2><p>Send a one-to-one message from contact@minirueshop.com.</p></div>
    </div>
    <DirectEmailComposer editableRecipient embedded variables={{}} />
  </section>;
}

function InboxView() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [unread, setUnread] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(() => typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('thread'));
  const [body, setBody] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const threadsQuery = useQuery({
    queryKey: ['admin-emails', 'threads', search, status, unread],
    queryFn: () => apiEmailThreads({ search: search.trim() || undefined, status: status || undefined }),
    refetchInterval: 30_000,
  });
  const allThreads = collectionItems(threadsQuery.data ?? []);
  const threads = unread ? allThreads.filter((thread) => thread.unread) : allThreads;
  const selectedId = activeId && (threadsQuery.isLoading || threads.some((thread) => thread.id === activeId)) ? activeId : threads[0]?.id ?? null;

  const threadQuery = useQuery({
    queryKey: ['admin-emails', 'thread', selectedId],
    queryFn: () => apiEmailThread(selectedId as string),
    enabled: !!selectedId,
  });
  const timelineEventsQuery = useQuery({
    queryKey: ['admin-emails', 'events', 'timeline'],
    queryFn: () => apiEmailEvents(500),
    enabled: !!selectedId,
  });
  const reply = useMutation({
    mutationFn: () => apiReplyToEmailThread(selectedId as string, { text: body.trim() }),
    onSuccess: () => {
      setBody('');
      setNotice('Reply sent and added to this timeline.');
      void qc.invalidateQueries({ queryKey: ['admin-emails'] });
    },
  });

  return <div className={styles.inbox}>
    <section className={styles.rail} aria-label="Email threads">
      <div className={styles.filters}>
        <label className={styles.search}><span className="dash-sr-only">Search email</span><input className="dash-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, order…" /></label>
        <select className="dash-select" aria-label="Filter by delivery status" value={status} onChange={(e) => setStatus(e.target.value)}>
          {THREAD_FILTERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <label className={styles.check}><input type="checkbox" checked={unread} onChange={(e) => setUnread(e.target.checked)} /> Unread</label>
      </div>
      <div className={styles.railMeta}>{threadsQuery.isFetching ? 'Checking for new email…' : `${threads.length} conversation${threads.length === 1 ? '' : 's'}`}</div>
      <div className={styles.threadList}>
        {threadsQuery.isLoading ? <LoadingRows /> : threadsQuery.isError ? <div className={styles.inlineError}><strong>Email inbox unavailable</strong><span>{errorText(threadsQuery.error, 'Try again in a moment.')}</span><button className="dash-btn-secondary" onClick={() => void threadsQuery.refetch()}>Try again</button></div> : threads.length === 0 ? <Empty title="No matching email" body="New customer replies and sent messages will appear here." /> : threads.map((thread) => <button key={thread.id} className={styles.thread} data-active={thread.id === selectedId} onClick={() => setActiveId(thread.id)}>
          <span className={styles.threadTop}><strong>{thread.customerName || thread.participantEmail}</strong><time>{fmt(thread.lastMessageAt)}</time></span>
          {thread.customerName && <span className={styles.preview}>{thread.participantEmail}</span>}
          <span className={styles.subject}>{thread.subject}</span>
          <span className={styles.preview}>{thread.status === 'OPEN' ? 'Active conversation' : 'Conversation closed'}</span>
          <span className={styles.threadFoot}><Status value={thread.status} />{thread.customerId && <span>Customer linked</span>}{thread.unread && <span className={styles.unread}>1</span>}</span>
        </button>)}
      </div>
    </section>

    <section className={styles.reader} aria-label="Email conversation">
      {!selectedId ? <Empty title="Choose a conversation" body="Select an email on the left to see every message and delivery event." /> : threadQuery.isLoading ? <div className={styles.readerLoading}><LoadingRows count={6} /></div> : threadQuery.isError ? <div className={styles.inlineError}><strong>Conversation unavailable</strong><span>{errorText(threadQuery.error, 'Try loading it again.')}</span><button className="dash-btn-secondary" onClick={() => void threadQuery.refetch()}>Try again</button></div> : threadQuery.data && <>
        <header className={styles.readerHeader}>
          <div><h2>{threadQuery.data.thread.subject}</h2><p>{threadQuery.data.thread.customerName || threadQuery.data.thread.participantEmail}{threadQuery.data.thread.customerName ? ` · ${threadQuery.data.thread.participantEmail}` : ''}</p></div>
          <div className={styles.contextLinks}>{threadQuery.data.thread.customerId && <Link href={`/customers/${threadQuery.data.thread.customerId}`}>Customer profile</Link>}{threadQuery.data.thread.orders?.map((order) => <Link href={`/orders/${order.id}`} key={order.id}>{order.orderNumber} · {order.status.toLowerCase()}</Link>)}</div>
        </header>
        <div className={styles.timeline}>
          {[
            ...threadQuery.data.messages.map((message) => ({ kind: 'message' as const, at: message.createdAt, item: message })),
            ...collectionItems(timelineEventsQuery.data ?? []).filter((event) => threadQuery.data.messages.some((message) => message.id === event.messageId)).map((event) => ({ kind: 'event' as const, at: event.occurredAt, item: event })),
          ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()).map((entry) => entry.kind === 'event' ? <div className={styles.event} key={`e-${entry.item.id}`}>
            <span className={styles.eventDot} data-status={entry.item.eventType} /><div><strong>{entry.item.eventType.toLowerCase()}</strong><span>{entry.item.provider}{entry.item.severity !== 'INFO' ? ` · ${entry.item.severity.toLowerCase()}` : ''}</span></div><time>{fmt(entry.item.occurredAt)}</time>
          </div> : <article className={styles.message} data-direction={entry.item.direction} key={`m-${entry.item.id}`}>
            <header><div><strong>{entry.item.direction === 'OUTBOUND' ? 'MiniRueShop' : entry.item.sender}</strong><span>to {entry.item.recipient}</span></div><time>{fmt(entry.item.createdAt)}</time></header>
            <h3>{entry.item.subject}</h3>
            <div className={styles.messageBody}>{entry.item.textBody || (entry.item.htmlBody ? 'HTML email — the text version was not recorded.' : 'No message content recorded.')}</div>
            <Status value={entry.item.direction === 'INBOUND' ? 'RECEIVED' : (collectionItems(timelineEventsQuery.data ?? []).filter((event) => event.messageId === entry.item.id).at(-1)?.eventType ?? 'SENT')} />
          </article>)}
        </div>
        <form className={styles.composer} onSubmit={(e) => { e.preventDefault(); if (body.trim() && !reply.isPending) reply.mutate(); }}>
          <h3>Reply from contact@minirueshop.com</h3>
          <label><span>Subject</span><input className="dash-input" value={`Re: ${threadQuery.data.thread.subject.replace(/^Re:\s*/i, '')}`} readOnly aria-readonly="true" /></label>
          <label><span>Message</span><textarea className="dash-textarea" value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={10000} required placeholder="Write a helpful reply…" /></label>
          {(reply.isError || notice) && <p className={reply.isError ? styles.formError : styles.formNotice} role="status">{reply.isError ? errorText(reply.error, 'The reply was not sent. Please try again.') : notice}</p>}
          <div className={styles.composerActions}><span>{body.length.toLocaleString()} / 10,000</span><button className="dash-btn-primary" disabled={!body.trim() || reply.isPending}>{reply.isPending ? 'Sending…' : 'Send reply'}</button></div>
        </form>
      </>}
    </section>
  </div>;
}

const EMPTY_TEMPLATE = { key: '', name: '', subject: '', textBody: '' };

function TemplatesView() {
  const qc = useQueryClient();
  const [active, setActive] = useState<EmailTemplate | null>(null);
  const [draft, setDraft] = useState(EMPTY_TEMPLATE);
  const templatesQuery = useQuery({ queryKey: ['admin-emails', 'templates'], queryFn: apiEmailTemplates });
  const templates = collectionItems(templatesQuery.data ?? []);
  const save = useMutation({
    mutationFn: () => active
      ? apiUpdateEmailTemplate(active.id, { name: draft.name.trim(), subject: draft.subject.trim(), textBody: draft.textBody.trim() })
      : apiCreateEmailTemplate({ key: draft.key.trim(), name: draft.name.trim(), subject: draft.subject.trim(), textBody: draft.textBody.trim() }),
    onSuccess: (template) => { setActive(template); setDraft({ key: template.key, name: template.name, subject: template.subject, textBody: template.textBody }); void qc.invalidateQueries({ queryKey: ['admin-emails', 'templates'] }); },
  });
  const duplicate = useMutation({ mutationFn: (id: string) => apiDuplicateEmailTemplate(id), onSuccess: (template) => { setActive(template); setDraft({ key: template.key, name: template.name, subject: template.subject, textBody: template.textBody }); void qc.invalidateQueries({ queryKey: ['admin-emails', 'templates'] }); } });
  const valid = draft.key.trim() && draft.name.trim() && draft.subject.trim() && draft.textBody.trim();
  const select = (template: EmailTemplate) => { setActive(template); setDraft({ key: template.key, name: template.name, subject: template.subject, textBody: template.textBody }); save.reset(); duplicate.reset(); };
  return <div className={styles.campaignLayout}>
    <section className={styles.campaignList}>
      <div className={styles.sectionHeading}><div><h2>Templates</h2><p>Reusable transactional and care messages.</p></div><button className="dash-btn-secondary" onClick={() => { setActive(null); setDraft(EMPTY_TEMPLATE); }}>New</button></div>
      {templatesQuery.isLoading ? <LoadingRows /> : templatesQuery.isError ? <div className={styles.inlineError}><strong>Templates unavailable</strong><span>{errorText(templatesQuery.error, 'The templates API is not available yet.')}</span><button className="dash-btn-secondary" onClick={() => void templatesQuery.refetch()}>Try again</button></div> : templates.length === 0 ? <Empty title="No templates yet" body="Create the first reusable email template." /> : <div className={styles.campaignRows}>{templates.map((template) => <button className={styles.campaignRow} data-active={active?.id === template.id} key={template.id} onClick={() => select(template)}><span><strong>{template.name}</strong><small>{template.key}</small></span></button>)}</div>}
    </section>
    <section className={styles.campaignWork}>
      <form className={styles.campaignForm} onSubmit={(event) => { event.preventDefault(); if (valid && !save.isPending) save.mutate(); }}>
        <div className={styles.sectionHeading}><div><h2>{active ? 'Edit template' : 'New template'}</h2><p>Variables such as {'{{customerName}}'} stay visible until send time.</p></div>{active && <button type="button" className="dash-btn-secondary" onClick={() => duplicate.mutate(active.id)} disabled={duplicate.isPending}>{duplicate.isPending ? 'Duplicating…' : 'Duplicate'}</button>}</div>
        <div className={styles.formGrid}><label><span>Template key</span><input className="dash-input" value={draft.key} onChange={(event) => setDraft({ ...draft, key: event.target.value })} readOnly={!!active} required /></label><label><span>Name</span><input className="dash-input" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} maxLength={120} required /></label></div>
        <label><span>Subject</span><input className="dash-input" value={draft.subject} onChange={(event) => setDraft({ ...draft, subject: event.target.value })} maxLength={180} required /></label>
        <label><span>Message</span><textarea className="dash-textarea" value={draft.textBody} onChange={(event) => setDraft({ ...draft, textBody: event.target.value })} rows={12} maxLength={20000} required /></label>
        {(save.isError || duplicate.isError) && <p className={styles.formError} role="alert">{errorText(save.error || duplicate.error, 'The template could not be saved.')}</p>}
        <div className={styles.emailPreview}><div className={styles.previewBar}><span>MiniRueShop</span><small>Template preview</small></div><div className={styles.previewBody}><h3>{draft.subject || 'Subject preview'}</h3><p>{draft.textBody || 'Message preview'}</p></div></div>
        <div className={styles.composerActions}><span>Saving never sends an email.</span><button className="dash-btn-primary" disabled={!valid || save.isPending}>{save.isPending ? 'Saving…' : active ? 'Save changes' : 'Create template'}</button></div>
      </form>
    </section>
  </div>;
}

function BrandingView() {
  const [formDraft, setFormDraft] = useState<{ logoUrl: string; logoShape: EmailLogoShape } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const brandingQuery = useQuery({ queryKey: ['admin-emails', 'branding'], queryFn: apiEmailBranding });
  const draft = formDraft ?? { logoUrl: brandingQuery.data?.logoUrl || '', logoShape: brandingQuery.data?.logoShape || 'ROUNDED' as EmailLogoShape };
  const setDraft = setFormDraft;
  const save = useMutation({ mutationFn: () => apiUpdateEmailBranding({ logoUrl: draft.logoUrl.trim() || null, logoShape: draft.logoShape }), onSuccess: (value) => setFormDraft({ logoUrl: value.logoUrl || '', logoShape: value.logoShape }) });
  const upload = async (file?: File) => {
    if (!file || uploading) return;
    setUploading(true);
    setUploadError(null);
    try {
      const settings = await apiUploadBrandLogo(file);
      setFormDraft({ ...draft, logoUrl: settings.brand?.logoUrl || '' });
    } catch (error) {
      setUploadError(errorText(error, 'The logo could not be uploaded.'));
    } finally {
      setUploading(false);
    }
  };
  if (brandingQuery.isLoading) return <div className={styles.pad}><LoadingRows /></div>;
  if (brandingQuery.isError) return <div className={styles.inlineError}><strong>Branding unavailable</strong><span>{errorText(brandingQuery.error, 'The email branding API is not available yet.')}</span><button className="dash-btn-secondary" onClick={() => void brandingQuery.refetch()}>Try again</button></div>;
  return <section className={`dash-card ${styles.branding}`}>
    <div><h2>Email branding</h2><p>Choose the mark customers see inside every MiniRueShop email.</p></div>
    <div className={styles.brandingLayout}>
      <form onSubmit={(event) => { event.preventDefault(); if (!save.isPending) save.mutate(); }}>
        <label><span>Logo URL</span><input className="dash-input" type="url" value={draft.logoUrl} onChange={(event) => setDraft({ ...draft, logoUrl: event.target.value })} placeholder="https://…" /></label>
        <div className={styles.inlineActions}><label className="dash-btn-secondary"><span>{uploading ? 'Uploading…' : 'Choose image'}</span><input className="dash-sr-only" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; void upload(file); }} /></label><button type="button" className="dash-btn-secondary" onClick={() => setDraft({ ...draft, logoUrl: '' })} disabled={!draft.logoUrl}>Remove logo</button><span className="dash-help-text">Upload an image or paste a URL.</span></div>
        <label><span>Logo shape</span><select className="dash-select" aria-label="Logo shape" value={draft.logoShape} onChange={(event) => setDraft({ ...draft, logoShape: event.target.value as EmailLogoShape })}><option value="RECTANGLE">Rectangle</option><option value="ROUNDED">Rounded</option><option value="CIRCLE">Circle</option></select></label>
        {(save.isError || uploadError) && <p className={styles.formError} role="alert">{uploadError || errorText(save.error, 'Branding was not saved.')}</p>}
        {save.isSuccess && <p className={styles.formNotice} role="status">Branding saved.</p>}
        <button className="dash-btn-primary" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save branding'}</button>
      </form>
      <div className={styles.emailPreview}><div className={styles.previewBar}>{draft.logoUrl ? <span className={styles.logoPreview} role="img" aria-label="Email logo preview" data-shape={draft.logoShape} style={{ backgroundImage: `url(${JSON.stringify(draft.logoUrl)})` }} /> : <span>MiniRueShop</span>}<small>Email preview</small></div><div className={styles.previewBody}><h3>Your MiniRueShop update</h3><p>Branding is applied consistently to transactional, support and campaign email.</p></div></div>
    </div>
  </section>;
}

function EventsView() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const eventsQuery = useQuery({ queryKey: ['admin-emails', 'events'], queryFn: () => apiEmailEvents(500), refetchInterval: 30_000 });
  const normalizedSearch = search.trim().toLowerCase();
  const events = collectionItems(eventsQuery.data ?? []).filter((event) => {
    if (type && event.eventType !== type) return false;
    if (!normalizedSearch) return true;
    return [event.eventType, event.provider, event.messageId, JSON.stringify(event.metadata ?? {})]
      .some((value) => value.toLowerCase().includes(normalizedSearch));
  });
  return <section className={`dash-card ${styles.eventsCard}`}>
    <div className={styles.eventsHeader}><div><h2>Delivery audit</h2><p>Every provider event, from accepted to complaint or failure.</p></div><div className="dash-filters"><input className="dash-input dash-input-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer, order, detail…" /><select className="dash-select" value={type} onChange={(e) => setType(e.target.value)} aria-label="Filter event type">{DELIVERY_FILTERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div></div>
    {eventsQuery.isLoading ? <div className={styles.pad}><LoadingRows count={7} /></div> : eventsQuery.isError ? <div className={styles.inlineError}><strong>Events unavailable</strong><span>{errorText(eventsQuery.error, 'Try again in a moment.')}</span><button className="dash-btn-secondary" onClick={() => void eventsQuery.refetch()}>Try again</button></div> : events.length === 0 ? <Empty title="No matching events" body="Change the filters or wait for the next email event." /> : <div className="dash-table-wrap"><table className="dash-table"><thead><tr><th>Event</th><th>Severity</th><th>Provider</th><th>Message</th><th>Details</th><th>Time</th></tr></thead><tbody>{events.map((event) => <tr key={event.id}><td><Status value={event.eventType} /></td><td>{event.severity.toLowerCase()}</td><td>{event.provider}</td><td><span className={styles.eventDetail}>{event.messageId}</span></td><td><span className={styles.eventDetail}>{event.metadata && Object.keys(event.metadata).length ? JSON.stringify(event.metadata) : 'Recorded by provider'}</span></td><td><time>{fmt(event.occurredAt)}</time></td></tr>)}</tbody></table></div>}
  </section>;
}

const EMPTY_CAMPAIGN = { name: '', subject: '', body: '', customerIds: '' };

function parseCustomerIds(value: string) {
  return value.split(/[\s,]+/).map((id) => id.trim()).filter(Boolean);
}

function CampaignsView() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState(EMPTY_CAMPAIGN);
  const [active, setActive] = useState<EmailCampaign | null>(null);
  const [confirming, setConfirming] = useState(false);
  const campaignsQuery = useQuery({ queryKey: ['admin-emails', 'campaigns'], queryFn: apiEmailCampaigns });
  const campaigns = collectionItems(campaignsQuery.data ?? []);
  const create = useMutation({
    mutationFn: () => apiCreateEmailCampaign({
      name: draft.name.trim(),
      subject: draft.subject.trim(),
      text: `${draft.body.trim()}\n\nUnsubscribe: {{unsubscribe_url}}`,
      html: `<p>${draft.body.trim().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p><p><a href="{{unsubscribe_url}}">Unsubscribe</a></p>`,
      audience: { customerIds: parseCustomerIds(draft.customerIds) },
    }),
    onSuccess: (campaign) => { setActive(campaign); setDraft(EMPTY_CAMPAIGN); void qc.invalidateQueries({ queryKey: ['admin-emails', 'campaigns'] }); },
  });
  const send = useMutation({ mutationFn: (id: string) => apiSendEmailCampaign(id), onSuccess: (result) => { setActive((campaign) => campaign ? { ...campaign, status: result.status, recipientCount: result.recipientCount } : campaign); setConfirming(false); void qc.invalidateQueries({ queryKey: ['admin-emails', 'campaigns'] }); } });
  const customerIds = parseCustomerIds(draft.customerIds);
  const valid = draft.name.trim() && draft.subject.trim() && draft.body.trim() && customerIds.length > 0;
  return <div className={styles.campaignLayout}>
    <section className={styles.campaignList}>
      <div className={styles.sectionHeading}><div><h2>Campaigns</h2><p>Draft, review and send from one place.</p></div><button className="dash-btn-secondary" onClick={() => { setActive(null); setConfirming(false); }}>New campaign</button></div>
      {campaignsQuery.isLoading ? <LoadingRows /> : campaignsQuery.isError ? <div className={styles.inlineError}><strong>Campaigns unavailable</strong><span>{errorText(campaignsQuery.error, 'Try again.')}</span></div> : campaigns.length === 0 ? <Empty title="No campaigns yet" body="Create the first draft. Nothing sends until you confirm it." /> : <div className={styles.campaignRows}>{campaigns.map((campaign) => <button key={campaign.id} className={styles.campaignRow} data-active={active?.id === campaign.id} onClick={() => { setActive(campaign); setConfirming(false); }}><span><strong>{campaign.name}</strong><small>{campaign.subject}</small></span><span><Status value={campaign.status} /><time>{fmt(campaign.sentAt || campaign.updatedAt || campaign.createdAt)}</time></span></button>)}</div>}
    </section>
    <section className={styles.campaignWork}>
      {active ? <>
        <div className={styles.sectionHeading}><div><h2>{active.name}</h2><p>{active.audience.customerIds.length.toLocaleString()} selected customer{active.audience.customerIds.length === 1 ? '' : 's'}{active.recipientCount != null ? ` · ${active.recipientCount.toLocaleString()} recipients` : ''}</p></div><Status value={active.status} /></div>
        <div className={styles.emailPreview}><div className={styles.previewBar}><span>MiniRueShop</span><small>Campaign preview</small></div><div className={styles.previewBody}><h3>{active.subject}</h3><p>{active.textBody.replace(/\n*Unsubscribe:\s*\{\{unsubscribe_url\}\}/, '')}</p><a>Shop MiniRue</a></div><footer>MiniRueShop · You receive this because you subscribed to marketing email.</footer></div>
        {active.status === 'DRAFT' && (!confirming ? <button className="dash-btn-primary" onClick={() => setConfirming(true)}>Review send</button> : <div className={styles.confirm}><div><strong>Send this campaign now?</strong><p>This action starts delivery to the selected audience and cannot be undone.</p></div><div><button className="dash-btn-secondary" onClick={() => setConfirming(false)} disabled={send.isPending}>Keep draft</button><button className="dash-btn-primary" onClick={() => send.mutate(active.id)} disabled={send.isPending}>{send.isPending ? 'Starting delivery…' : 'Confirm and send'}</button></div></div>)}
        {send.isError && <p className={styles.formError}>{errorText(send.error, 'The campaign could not be sent.')}</p>}
      </> : <form className={styles.campaignForm} onSubmit={(e) => { e.preventDefault(); if (valid && !create.isPending) create.mutate(); }}>
        <div className={styles.sectionHeading}><div><h2>New campaign</h2><p>Save a draft first, then review the exact email before sending.</p></div></div>
        <div className={styles.formGrid}><label><span>Internal name</span><input className="dash-input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={200} required placeholder="September loyalty thank-you" /></label><label><span>Customer IDs</span><input className="dash-input" value={draft.customerIds} onChange={(e) => setDraft({ ...draft, customerIds: e.target.value })} required placeholder="Paste customer IDs, separated by commas" /><small className="dash-help-text">Only selected customers receive this draft. {customerIds.length ? `${customerIds.length} selected.` : ''}</small></label></div>
        <label><span>Subject</span><input className="dash-input" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} maxLength={180} required placeholder="A little something for you" /></label>
        <label><span>Message</span><textarea className="dash-textarea" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={12} maxLength={20000} required placeholder="Write the campaign in MiniRueShop’s voice…" /></label>
        {create.isError && <p className={styles.formError}>{errorText(create.error, 'The campaign draft could not be saved.')}</p>}
        <div className={styles.composerActions}><span>Drafts never send automatically.</span><button className="dash-btn-primary" disabled={!valid || create.isPending}>{create.isPending ? 'Saving…' : 'Save and preview'}</button></div>
      </form>}
    </section>
  </div>;
}

export default function EmailOperationsClient() {
  const [view, setView] = useState<'compose' | 'inbox' | 'events' | 'campaigns' | 'templates' | 'branding'>('inbox');
  const { data: user } = useUser();
  const canManageCampaigns = isAdminRole(user?.role);
  useClearNavBadge(HREF_CATEGORIES['/emails']);
  const title = useMemo(() => view === 'compose' ? 'Compose email' : view === 'inbox' ? 'Customer email' : view === 'events' ? 'Email events' : view === 'campaigns' ? 'Campaigns' : view === 'templates' ? 'Email templates' : 'Email branding', [view]);
  return <div className={styles.page}>
    <div className="dash-page-header"><div><h1 className="dash-page-title">{title}</h1><p className="dash-page-subtitle">One history for every customer message, delivery signal and campaign.</p></div></div>
    <nav className={styles.tabs} aria-label="Email workspace">
      {(['compose', 'inbox', 'events', ...(canManageCampaigns ? ['campaigns' as const, 'templates' as const, 'branding' as const] : [])] as const).map((tab) => <button key={tab} type="button" data-active={view === tab} aria-current={view === tab ? 'page' : undefined} onClick={() => setView(tab)}>{tab === 'compose' ? 'Compose' : tab === 'inbox' ? 'Inbox' : tab === 'events' ? 'Event log' : tab === 'campaigns' ? 'Campaigns' : tab === 'templates' ? 'Templates' : 'Branding'}</button>)}
    </nav>
    {view === 'compose' ? <ComposeView /> : view === 'inbox' ? <InboxView /> : view === 'events' ? <EventsView /> : view === 'campaigns' ? <CampaignsView /> : view === 'templates' ? <TemplatesView /> : <BrandingView />}
  </div>;
}

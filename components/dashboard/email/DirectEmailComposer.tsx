'use client';

import { useMemo, useRef, useState } from 'react';
import { apiSendDirectEmail } from '@/lib/api/email-operations';

const READY_TEMPLATES = {
  custom: { label: 'Custom email', subject: '', text: '' },
  order_follow_up: {
    label: 'Order follow-up',
    subject: 'An update about {{orderNumber}}',
    text: 'Hello {{customerName}},\n\nWe are checking in about order {{orderNumber}}. Reply to this email if you need any help.\n\nMiniRueShop',
  },
  delivery_check_in: {
    label: 'Delivery check-in',
    subject: 'How did delivery go for {{orderNumber}}?',
    text: 'Hello {{customerName}},\n\nDid order {{orderNumber}} arrive safely? Reply here if anything needs our attention.\n\nMiniRueShop',
  },
  customer_care: {
    label: 'Customer care',
    subject: 'A note from MiniRueShop',
    text: 'Hello {{customerName}},\n\nWe wanted to follow up and make sure you have everything you need.\n\nMiniRueShop',
  },
} as const;

type TemplateKey = keyof typeof READY_TEMPLATES;

function resolveVariables(value: string, variables: Record<string, string>) {
  return value.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key: string) => variables[key] || `{{${key}}}`);
}

export default function DirectEmailComposer({
  recipient,
  customerId,
  orderId,
  variables,
  editableRecipient = false,
  embedded = false,
}: {
  recipient?: string | null;
  customerId?: string;
  orderId?: string;
  variables: Record<string, string>;
  /** Allows the Email workspace to start a new conversation by address. */
  editableRecipient?: boolean;
  /** Keeps the form open when it is the primary content of the Email workspace. */
  embedded?: boolean;
}) {
  const [open, setOpen] = useState(embedded);
  const [to, setTo] = useState(recipient ?? '');
  const [templateKey, setTemplateKey] = useState<TemplateKey>('custom');
  const [subject, setSubject] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const idempotencyKey = useRef<string | null>(null);
  const previewSubject = useMemo(() => resolveVariables(subject, variables), [subject, variables]);
  const previewText = useMemo(() => resolveVariables(text, variables), [text, variables]);
  const normalizedRecipient = (editableRecipient ? to : recipient ?? '').trim();
  const recipientIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedRecipient);

  function selectTemplate(value: TemplateKey) {
    setTemplateKey(value);
    setSubject(READY_TEMPLATES[value].subject);
    setText(READY_TEMPLATES[value].text);
    setNotice(null);
  }

  async function send() {
    if (!recipientIsValid || !subject.trim() || !text.trim() || sending) return;
    setSending(true);
    setNotice(null);
    try {
      idempotencyKey.current ??= globalThis.crypto?.randomUUID?.()
        ?? `email-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const result = await apiSendDirectEmail({
        to: normalizedRecipient,
        customerId,
        orderId,
        templateKey: templateKey === 'custom' ? undefined : templateKey,
        subject: subject.trim(),
        text: text.trim(),
        variables,
      }, idempotencyKey.current);
      if (result.status === 'FAILED') {
        throw new Error('The email provider could not deliver this message. Please try again.');
      }
      idempotencyKey.current = null;
      setNotice({ tone: 'ok', text: `Email sent to ${normalizedRecipient}.` });
    } catch (error) {
      const message = (error as { message?: unknown } | null)?.message;
      setNotice({ tone: 'error', text: typeof message === 'string' && message ? message : 'The email was not sent. Try again.' });
    } finally {
      setSending(false);
    }
  }

  return <div className="dash-email-composer">
    {!embedded && <button type="button" className="dash-btn-secondary" disabled={!editableRecipient && !recipient} onClick={() => setOpen((value) => !value)} aria-expanded={open}>
      {editableRecipient ? 'Compose email' : 'Send email'}
    </button>}
    {!editableRecipient && !recipient && <span className="dash-help-text">Add an email address before sending.</span>}
    {open && <div className="dash-email-composer-panel">
      <div className="dash-email-composer-fields">
        <label className="dash-field"><span className="dash-label">To</span><input className="dash-input" type="email" value={editableRecipient ? to : recipient ?? ''} onChange={editableRecipient ? (event) => { setTo(event.target.value); setNotice(null); idempotencyKey.current = null; } : undefined} readOnly={!editableRecipient} aria-readonly={!editableRecipient} required autoComplete="email" placeholder="customer@example.com" /></label>
        <label className="dash-field"><span className="dash-label">Ready template</span><select className="dash-select" value={templateKey} onChange={(event) => { idempotencyKey.current = null; selectTemplate(event.target.value as TemplateKey); }}>{Object.entries(READY_TEMPLATES).map(([key, template]) => <option value={key} key={key}>{template.label}</option>)}</select></label>
        <label className="dash-field"><span className="dash-label">Subject</span><input className="dash-input" value={subject} onChange={(event) => { setSubject(event.target.value); idempotencyKey.current = null; }} maxLength={180} /></label>
        <label className="dash-field"><span className="dash-label">Message</span><textarea className="dash-textarea" value={text} onChange={(event) => { setText(event.target.value); idempotencyKey.current = null; }} rows={8} maxLength={10000} /></label>
        <div className="dash-help-text">Variables: {Object.keys(variables).map((key) => `{{${key}}}`).join(', ') || 'none'}</div>
      </div>
      <section className="dash-email-composer-preview" aria-label="Email preview">
        <strong>MiniRueShop</strong>
        <h3>{previewSubject || 'Subject preview'}</h3>
        <p>{previewText || 'Your message preview will appear here.'}</p>
      </section>
      {notice && <p className={notice.tone === 'error' ? 'dash-inline-error' : 'dash-help-text'} role="status">{notice.text}</p>}
      <div className="dash-email-composer-actions">{!embedded && <button type="button" className="dash-btn-secondary" onClick={() => setOpen(false)} disabled={sending}>Close</button>}<button type="button" className="dash-btn-primary" onClick={() => void send()} disabled={!recipientIsValid || !subject.trim() || !text.trim() || sending}>{sending ? 'Sending…' : 'Send now'}</button></div>
    </div>}
  </div>;
}

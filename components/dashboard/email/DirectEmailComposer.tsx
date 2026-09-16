'use client';

import { useMemo, useState } from 'react';
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
}: {
  recipient?: string | null;
  customerId?: string;
  orderId?: string;
  variables: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [templateKey, setTemplateKey] = useState<TemplateKey>('custom');
  const [subject, setSubject] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const previewSubject = useMemo(() => resolveVariables(subject, variables), [subject, variables]);
  const previewText = useMemo(() => resolveVariables(text, variables), [text, variables]);

  function selectTemplate(value: TemplateKey) {
    setTemplateKey(value);
    setSubject(READY_TEMPLATES[value].subject);
    setText(READY_TEMPLATES[value].text);
    setNotice(null);
  }

  async function send() {
    if (!recipient || !subject.trim() || !text.trim() || sending) return;
    setSending(true);
    setNotice(null);
    try {
      await apiSendDirectEmail({
        to: recipient,
        customerId,
        orderId,
        templateKey: templateKey === 'custom' ? undefined : templateKey,
        subject: subject.trim(),
        text: text.trim(),
        variables,
      });
      setNotice({ tone: 'ok', text: 'Email sent.' });
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'The email was not sent. Try again.' });
    } finally {
      setSending(false);
    }
  }

  return <div className="dash-email-composer">
    <button type="button" className="dash-btn-secondary" disabled={!recipient} onClick={() => setOpen((value) => !value)}>
      Send email
    </button>
    {!recipient && <span className="dash-help-text">Add an email address before sending.</span>}
    {open && recipient && <div className="dash-email-composer-panel">
      <div className="dash-email-composer-fields">
        <label className="dash-field"><span className="dash-label">To</span><input className="dash-input" value={recipient} readOnly aria-readonly="true" /></label>
        <label className="dash-field"><span className="dash-label">Ready template</span><select className="dash-select" value={templateKey} onChange={(event) => selectTemplate(event.target.value as TemplateKey)}>{Object.entries(READY_TEMPLATES).map(([key, template]) => <option value={key} key={key}>{template.label}</option>)}</select></label>
        <label className="dash-field"><span className="dash-label">Subject</span><input className="dash-input" value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={180} /></label>
        <label className="dash-field"><span className="dash-label">Message</span><textarea className="dash-textarea" value={text} onChange={(event) => setText(event.target.value)} rows={8} maxLength={10000} /></label>
        <div className="dash-help-text">Variables: {Object.keys(variables).map((key) => `{{${key}}}`).join(', ') || 'none'}</div>
      </div>
      <section className="dash-email-composer-preview" aria-label="Email preview">
        <strong>MiniRueShop</strong>
        <h3>{previewSubject || 'Subject preview'}</h3>
        <p>{previewText || 'Your message preview will appear here.'}</p>
      </section>
      {notice && <p className={notice.tone === 'error' ? 'dash-inline-error' : 'dash-help-text'} role="status">{notice.text}</p>}
      <div className="dash-email-composer-actions"><button type="button" className="dash-btn-secondary" onClick={() => setOpen(false)} disabled={sending}>Close</button><button type="button" className="dash-btn-primary" onClick={() => void send()} disabled={!subject.trim() || !text.trim() || sending}>{sending ? 'Sending…' : 'Send now'}</button></div>
    </div>}
  </div>;
}

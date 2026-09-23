'use client';

import React, { useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { fmtInt, plural } from '@/lib/analytics/format';
import { CHANNELS } from '@/lib/analytics/source';
import { useShell } from '../context';
import { Dot, Panel, RowToggle, Tag, ToggleGroup, Zero } from '../parts';

export default function Sources() {
  const { model, view, setView, go } = useShell();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const raw = view.sourcesRaw;
  const t = model.counts;
  const u = model.uncredited;
  const macroRow = model.sources.find((s) => s.state === 'macro' && s.channel === 'paid');
  const idRow = model.sources.find((s) => s.state === 'id-only' && s.channel === 'paid');
  const unknown = model.unknownLandings;
  return (
    <>
      <Panel
        id="anx-attr"
        title="Sources and campaigns"
        meta="Normalized names. Open a row for its landing pages; turn on raw values to audit."
        tools={
          <ToggleGroup
            label="Value display"
            value={raw ? 'raw' : 'clean'}
            options={[
              { value: 'clean', label: 'Clean' },
              { value: 'raw', label: 'Raw values' },
            ]}
            onChange={(v) => setView({ sourcesRaw: v === 'raw' })}
          />
        }
      >
        <div className="anx-tw anx-cards anx-sticky-first">
          <table className="anx-table">
            <thead>
              <tr>
                <th scope="col">Source / campaign</th>
                <th scope="col">Channel</th>
                <th scope="col">Visitors</th>
                <th scope="col">Viewed product</th>
                <th scope="col">Bag</th>
                <th scope="col">Purchased</th>
                {raw ? (
                  <th scope="col" className="anx-tl">
                    Raw values
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {model.sources.map((s) => (
                <React.Fragment key={s.key}>
                  <tr>
                    <td>
                      <span className="anx-name">
                        <RowToggle open={!!open[s.key]} label={`Show landing pages for ${s.label}`} onToggle={() => setOpen((o) => ({ ...o, [s.key]: !o[s.key] }))} />
                        <Dot color={CHANNELS[s.channel].color} />
                        {s.label}
                        {s.flag ? (
                          <Tag tone="warn" icon={AlertTriangle}>
                            {s.flag}
                          </Tag>
                        ) : null}
                      </span>
                    </td>
                    <td data-l="Channel">{CHANNELS[s.channel].label}</td>
                    <td data-l="Visitors">{fmtInt(s.visited)}</td>
                    <td data-l="Viewed product">
                      <Zero n={s.product} />
                    </td>
                    <td data-l="Bag">
                      <Zero n={s.bag} />
                    </td>
                    <td data-l="Purchased">
                      <Zero n={s.purchased} />
                    </td>
                    {raw ? (
                      <td data-l="Raw values" className="anx-tl">
                        <span className="anx-raw">{s.raw}</span>
                      </td>
                    ) : null}
                  </tr>
                  {open[s.key]
                    ? s.landings.map((l) => (
                        <tr key={l.key} className="anx-child">
                          <td>
                            <span className="anx-name">
                              <ArrowRight className="anx-i-sm" aria-hidden />
                              {l.label}
                            </span>
                          </td>
                          <td data-l="" />
                          <td data-l="Visitors">{fmtInt(l.visited)}</td>
                          <td data-l="Viewed product">
                            <Zero n={l.product} />
                          </td>
                          <td data-l="Bag">
                            <Zero n={l.bag} />
                          </td>
                          <td data-l="Purchased">
                            <Zero n={l.purchased} />
                          </td>
                          {raw ? (
                            <td data-l="Raw values" className="anx-tl">
                              <span className="anx-raw">{l.raw}</span>
                            </td>
                          ) : null}
                        </tr>
                      ))
                    : null}
                </React.Fragment>
              ))}
              {!model.sources.length ? (
                <tr className="anx-empty-row">
                  <td colSpan={raw ? 7 : 6}>No sources in this range.</td>
                </tr>
              ) : null}
            </tbody>
            <tfoot>
              <tr>
                <td>
                  <b>Total</b>
                </td>
                <td data-l="" />
                <td data-l="Visitors">
                  <b>{fmtInt(t.visited)}</b>
                </td>
                <td data-l="Viewed product">
                  <b>{fmtInt(t.product)}</b>
                </td>
                <td data-l="Bag">
                  <b>{fmtInt(t.bag)}</b>
                </td>
                <td data-l="Purchased">
                  <b>{fmtInt(t.purchased)}</b>
                </td>
                {raw ? <td data-l="" /> : null}
              </tr>
            </tfoot>
          </table>
        </div>
      </Panel>
      <div className="anx-grid-2e">
        <Panel id="anx-gap" title="Can’t be credited" meta="Kept visible, never merged">
          <div className="anx-panel-b anx-checks">
            {u.macro ? (
              <div className="anx-check">
                <span data-tone="warn">
                  <AlertTriangle className="anx-i" aria-hidden />
                </span>
                <div>
                  <b>{fmtInt(u.macro)} visitors · campaign name missing</b>
                  <p>
                    The ad link sends <span className="anx-raw">utm_campaign={macroRow?.campaignRaw ?? '__CAMPAIGN_NAME__'}</span>. The platform’s placeholder isn’t being filled
                    in. Rebuild the link below in ads quality.
                  </p>
                </div>
                <Tag tone="warn">Fix in {macroRow?.platform ?? 'the ad platform'}</Tag>
              </div>
            ) : null}
            {u.idOnly ? (
              <div className="anx-check">
                <span data-tone="warn">
                  <AlertTriangle className="anx-i" aria-hidden />
                </span>
                <div>
                  <b>{fmtInt(u.idOnly)} visitors · campaign known only by its ID</b>
                  <p>
                    Campaign <span className="anx-raw">{idRow?.campaignRaw}</span>. Give the ad a readable utm_campaign so it shows by name everywhere.
                  </p>
                </div>
                <button type="button" className="anx-btn" onClick={() => go('ads', { anchor: 'anx-build' })}>
                  Build a correct link
                </button>
              </div>
            ) : null}
            {u.missing ? (
              <div className="anx-check">
                <span data-tone="warn">
                  <AlertTriangle className="anx-i" aria-hidden />
                </span>
                <div>
                  <b>{fmtInt(u.missing)} paid visitors · no campaign on the link</b>
                  <p>The link is marked paid but carries no utm_campaign.</p>
                </div>
                <Tag tone="warn">Fix the link</Tag>
              </div>
            ) : null}
            {unknown.length ? (
              <div className="anx-check">
                <span data-tone="warn">
                  <AlertTriangle className="anx-i" aria-hidden />
                </span>
                <div>
                  <b>{plural(unknown.reduce((s, l) => s + l.n, 0), 'landing')} on unknown paths</b>
                  <p>
                    Typos and old links such as <span className="anx-raw">{unknown[0].path}</span>. They still count as visits.
                  </p>
                </div>
                <Tag tone="muted">Kept</Tag>
              </div>
            ) : null}
            {!u.total && !unknown.length ? (
              <div className="anx-check">
                <span data-tone="ok">
                  <CheckCircle2 className="anx-i" aria-hidden />
                </span>
                <div>
                  <b>Every visitor can be credited</b>
                  <p>Every paid visit names its campaign and every landing is a real page.</p>
                </div>
                <Tag tone="ok">Pass</Tag>
              </div>
            ) : null}
          </div>
        </Panel>
        <Panel id="anx-utm" title="UTM standard for every ad">
          <div className="anx-panel-b">
            <dl className="anx-defs">
              <dt>utm_source</dt>
              <dd>tiktok · {'{{site_source_name}}'} for Meta (fills in fb or ig) · google</dd>
              <dt>utm_medium</dt>
              <dd>paid (or cpc). Anything else files the visit as unpaid.</dd>
              <dt>utm_campaign</dt>
              <dd>
                A readable name, e.g. <span className="anx-raw">retinal-launch-sep26</span>. Never a number or a placeholder.
              </dd>
              <dt>utm_content</dt>
              <dd>
                The creative, e.g. <span className="anx-raw">ugc-video-02</span>
              </dd>
              <dt>Landing</dt>
              <dd>The exact shop page. The builder in ads quality only offers real ones.</dd>
            </dl>
          </div>
        </Panel>
      </div>
    </>
  );
}

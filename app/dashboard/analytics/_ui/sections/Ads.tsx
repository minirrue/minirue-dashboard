'use client';

import React from 'react';
import { Ban } from 'lucide-react';
import { fmtInt } from '@/lib/analytics/format';
import { campaignState } from '@/lib/analytics/source';
import type { AdsCheck, PlatformScore } from '@/lib/analytics/model';
import { useShell } from '../context';
import { Panel, SourcePill, StatusChip } from '../parts';
import AdLinkBuilder from '../AdLinkBuilder';

function Verdict({ s }: { s: PlatformScore }) {
  return s.verdict === 'ready' ? (
    <StatusChip status="ok" label="Ready" />
  ) : s.verdict === 'almost' ? (
    <StatusChip status="warn" label="Almost ready" />
  ) : (
    <StatusChip status="bad" label="Not ready" />
  );
}

function Cell({ c }: { c: AdsCheck['meta'] }) {
  return (
    <td className="anx-ads-c">
      <StatusChip status={c.status} label={c.label} />
      {c.note ? <small>{c.note}</small> : null}
    </td>
  );
}

const FROM_LABEL: Record<AdsCheck['from'], string> = { code: 'Our code', data: 'Our data', platform: 'Ad platform' };

function UtmCell({ v, kind }: { v: string | null; kind: 'normal' | 'id' }) {
  if (kind === 'id')
    return (
      <td className="anx-utm-na">
        <span className="anx-small">not stored</span>
      </td>
    );
  if (!v)
    return (
      <td className="anx-utm-miss">
        <Ban className="anx-i-sm" aria-hidden />
        <span className="anx-sr">missing</span>
      </td>
    );
  const bad = campaignState(v) === 'macro' || /^\d{8,}$/.test(v);
  return (
    <td className={bad ? 'anx-utm-bad' : 'anx-utm-ok'}>
      <span className="anx-raw">{v}</span>
    </td>
  );
}

export default function Ads() {
  const { model, routes } = useShell();
  const platforms: ['meta' | 'tiktok', string, string][] = [
    ['meta', 'Meta', 'Facebook + Instagram ads'],
    ['tiktok', 'TikTok', 'TikTok ads'],
  ];
  const fixFirst = model.ads
    .flatMap((c) =>
      (['meta', 'tiktok'] as const)
        .filter((p) => c[p].status === 'bad' || c[p].status === 'warn')
        .map((p) => ({ c, p, weight: c[p].status === 'bad' ? 0 : 1 })),
    )
    .sort((a, b) => a.weight - b.weight)
    .reduce<{ key: string; text: string }[]>((acc, { c, p }) => {
      if (acc.some((x) => x.key === c.id)) return acc;
      acc.push({ key: c.id, text: `${c.name} (${p === 'meta' ? 'Meta' : 'TikTok'}${c[p].note ? `: ${c[p].note}` : ''})` });
      return acc;
    }, [])
    .slice(0, 3);
  return (
    <>
      <Panel
        id="anx-ads"
        title="Social media ads quality"
        meta="Can each platform see your sales, credit the right campaign, and land on minirueshop.com? Rechecked on every refresh."
      >
        <div className="anx-verdicts">
          {platforms.map(([k, label, sub]) => {
            const s = model.scores[k];
            return (
              <div className="anx-v" key={k}>
                <div className="anx-v-top">
                  <SourcePill platform={label} label={label} />
                  <Verdict s={s} />
                </div>
                <div className="anx-v-n">
                  <b className="anx-num">{s.ok}</b> of {s.total} checks ready
                </div>
                <div className="anx-vbar" role="img" aria-label={`${s.ok} ready, ${s.warn} partial, ${s.bad} missing, ${s.unk} need access or data`}>
                  <i data-s="ok" style={{ flex: s.ok }} />
                  <i data-s="warn" style={{ flex: s.warn }} />
                  <i data-s="bad" style={{ flex: s.bad }} />
                  <i data-s="unk" style={{ flex: s.unk }} />
                </div>
                <span className="anx-meta">
                  {sub}: {s.bad} missing · {s.warn} partial · {s.unk} need access or data
                </span>
              </div>
            );
          })}
          <div className="anx-v anx-next">
            <b>Fix first</b>
            {fixFirst.length ? (
              <ol>
                {fixFirst.map((f) => (
                  <li key={f.key}>{f.text}</li>
                ))}
              </ol>
            ) : (
              <p className="anx-p">Nothing is missing on either platform.</p>
            )}
          </div>
        </div>
      </Panel>

      <Panel id="anx-adsm" title="Checks by platform" meta="Google Ads is not used yet">
        <div className="anx-tw">
          <table className="anx-table anx-ads">
            <thead>
              <tr>
                <th scope="col">Check</th>
                <th scope="col">
                  <SourcePill platform="Meta" label="Meta" />
                </th>
                <th scope="col">
                  <SourcePill platform="TikTok" label="TikTok" />
                </th>
                <th scope="col">Checked from</th>
              </tr>
            </thead>
            <tbody>
              {model.ads.map((c, i) => {
                const head = i === 0 || model.ads[i - 1].group !== c.group;
                return (
                  <React.Fragment key={c.id}>
                    {head ? (
                      <tr className="anx-grp">
                        <th scope="rowgroup" colSpan={4}>
                          {c.group}
                        </th>
                      </tr>
                    ) : null}
                    <tr>
                      <td className="anx-ads-n">
                        <b>{c.name}</b>
                        <small>{c.detail}</small>
                      </td>
                      <Cell c={c.meta} />
                      <Cell c={c.tiktok} />
                      <td>
                        <span className="anx-src-code" data-from={c.from}>
                          {FROM_LABEL[c.from]}
                        </span>
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel id="anx-links" title="Live ad links" meta="Every ad link that sent paid visitors in this range, part by part">
        <div className="anx-tw">
          <table className="anx-table anx-utm">
            <thead>
              <tr>
                <th scope="col">Ad</th>
                <th scope="col">Visitors</th>
                <th scope="col" className="anx-tl">
                  source
                </th>
                <th scope="col" className="anx-tl">
                  medium
                </th>
                <th scope="col" className="anx-tl">
                  campaign
                </th>
                <th scope="col">id</th>
                <th scope="col" className="anx-tl">
                  content
                </th>
                <th scope="col" className="anx-tl">
                  term
                </th>
              </tr>
            </thead>
            <tbody>
              {model.adLinks.length ? (
                model.adLinks.map((l) => (
                  <tr key={l.key}>
                    <td>
                      <span className="anx-name">
                        <SourcePill platform={l.platform} />
                        {l.campaign}
                      </span>
                      <span className="anx-utm-url">minirueshop.com{l.path}</span>
                    </td>
                    <td>{fmtInt(l.visitors)}</td>
                    <UtmCell v={l.utm.source} kind="normal" />
                    <UtmCell v={l.utm.medium} kind="normal" />
                    <UtmCell v={l.utm.campaign} kind="normal" />
                    <UtmCell v={null} kind="id" />
                    <UtmCell v={l.utm.content} kind="normal" />
                    <UtmCell v={l.utm.term} kind="normal" />
                  </tr>
                ))
              ) : (
                <tr className="anx-empty-row">
                  <td colSpan={8}>No paid visitors in this range, so no ad links to check.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="anx-panel-b" style={{ borderTop: '1px solid var(--anx-hair)' }}>
          <span className="anx-field-hint">
            Red marks a placeholder or a bare number; a crossed cell is missing. utm_id is kept by the ad platform but not stored by analytics yet.
          </span>
        </div>
      </Panel>

      <AdLinkBuilder routes={routes} />
    </>
  );
}

'use client';

import React, { useMemo, useState } from 'react';
import { CheckCircle2, Copy, ExternalLink, AlertTriangle } from 'lucide-react';
import {
  AD_PLATFORMS,
  AD_PLATFORM_ORDER,
  buildAdLink,
  classifyAdLink,
  landingChoices,
  type AdPlatform,
  type LandingChoice,
} from '@/lib/analytics/ad-link';
import type { KnownRoutes } from '@/lib/analytics/journey';
import { useCatalogueRoutes } from '@/lib/hooks/use-analytics';
import { useShell } from './context';
import { Panel, SourcePill } from './parts';

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * "Build a correct ad link" (dashboard#128, owner's favourite). Landing pages
 * come only from the shop's real routes (the catalogue APIs), the campaign
 * name is required and slugified, and the id / ad set / ad fields carry each
 * platform's own dynamic parameters. The readout underneath runs the finished
 * link through the same normalizer analytics uses.
 */
export default function AdLinkBuilder({ routes }: { routes: KnownRoutes | null }) {
  const { toast } = useShell();
  const catalogue = useCatalogueRoutes(true);
  const [platform, setPlatform] = useState<AdPlatform>('tiktok');
  const [landing, setLanding] = useState('/');
  const [campaign, setCampaign] = useState('');
  const [content, setContent] = useState('');
  const [touched, setTouched] = useState(false);
  const [selectFallback, setSelectFallback] = useState<string | null>(null);

  const choices: LandingChoice[] = useMemo(
    () => landingChoices(catalogue.data?.categories ?? [], catalogue.data?.products ?? []),
    [catalogue.data],
  );
  const groups = (['Shop', 'Categories', 'Products'] as const).map((g) => ({ g, items: choices.filter((c) => c.group === g) })).filter((x) => x.items.length);
  const result = buildAdLink({ platform, landingPath: landing, campaign, content });
  const reading = result.ok ? classifyAdLink(result.url, routes) : null;
  const spec = AD_PLATFORMS[platform];
  const campaignError = !result.ok && (touched || campaign) ? result.errors.campaign : undefined;

  const copy = async (what: 'link' | 'params') => {
    if (!result.ok) {
      setTouched(true);
      return;
    }
    const text = what === 'link' ? result.url : result.params;
    const ok = await copyText(text);
    if (ok) {
      setSelectFallback(null);
      toast(what === 'link' ? 'Link copied' : 'URL parameters copied');
    } else {
      setSelectFallback(text);
      toast('Copy was blocked. Select the text and press Ctrl+C');
    }
  };

  return (
    <Panel id="anx-build" title="Build a correct ad link" meta="Paste the result into the ad’s website URL, or only the parameters into URL parameters">
      <div className="anx-panel-b anx-ub">
        <div className="anx-field">
          <label htmlFor="anx-ub-platform">Platform</label>
          <select id="anx-ub-platform" value={platform} onChange={(e) => setPlatform(e.target.value as AdPlatform)}>
            {AD_PLATFORM_ORDER.map((p) => (
              <option key={p} value={p}>
                {AD_PLATFORMS[p].label}
              </option>
            ))}
          </select>
        </div>
        <div className="anx-field">
          <label htmlFor="anx-ub-landing">Landing page</label>
          <select id="anx-ub-landing" value={landing} aria-describedby="anx-ub-landing-help" onChange={(e) => setLanding(e.target.value)}>
            {groups.map(({ g, items }) => (
              <optgroup key={g} label={g}>
                {items.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.group === 'Shop' ? `${c.label} (${c.value})` : c.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <span id="anx-ub-landing-help" className="anx-field-hint">
            {catalogue.isLoading
              ? 'Loading the shop’s categories and products…'
              : catalogue.isError
                ? 'The catalogue could not load, so only the shop’s main pages are offered.'
                : `Only real pages: ${choices.length} to choose from.`}
          </span>
        </div>
        <div className="anx-field">
          <label htmlFor="anx-ub-campaign">Campaign name (required)</label>
          <input
            id="anx-ub-campaign"
            value={campaign}
            placeholder="e.g. retinal launch sep26"
            autoComplete="off"
            spellCheck={false}
            required
            aria-invalid={!!campaignError}
            aria-describedby="anx-ub-campaign-help"
            onChange={(e) => setCampaign(e.target.value)}
            onBlur={() => setTouched(true)}
          />
          <span id="anx-ub-campaign-help" className={campaignError ? 'anx-field-err' : 'anx-field-hint'}>
            {campaignError ?? (result.campaignSlug ? `Sent as ${result.campaignSlug}` : 'Words become a clean, lowercase name.')}
          </span>
        </div>
        <div className="anx-field">
          <label htmlFor="anx-ub-content">Creative (optional)</label>
          <input
            id="anx-ub-content"
            value={content}
            placeholder={`blank = the ad’s own name (${spec.contentMacro})`}
            autoComplete="off"
            spellCheck={false}
            aria-describedby="anx-ub-content-help"
            onChange={(e) => setContent(e.target.value)}
          />
          <span id="anx-ub-content-help" className="anx-field-hint">
            Tells two ads in one campaign apart.
          </span>
        </div>

        <div className="anx-ub-out">
          <output className="anx-ub-url" htmlFor="anx-ub-platform anx-ub-landing anx-ub-campaign anx-ub-content" aria-live="polite">
            {result.ok ? result.url : 'Add a campaign name to build the link.'}
          </output>
          <div className="anx-ub-actions">
            <button type="button" className="anx-btn anx-btn-primary" onClick={() => void copy('link')} disabled={!result.ok}>
              <Copy className="anx-i-sm" aria-hidden />
              Copy link
            </button>
            <button type="button" className="anx-btn" onClick={() => void copy('params')} disabled={!result.ok}>
              <Copy className="anx-i-sm" aria-hidden />
              Copy URL parameters only
            </button>
            {result.ok ? (
              <a className="anx-btn" href={`https://minirueshop.com${landing}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="anx-i-sm" aria-hidden />
                Open landing page
                <span className="anx-sr">(opens in a new tab)</span>
              </a>
            ) : null}
          </div>
          {selectFallback ? (
            <div className="anx-field">
              <label htmlFor="anx-ub-select">Copy this by hand</label>
              <input id="anx-ub-select" readOnly value={selectFallback} onFocus={(e) => e.currentTarget.select()} />
            </div>
          ) : null}
          <span className="anx-field-hint">{spec.pasteHint}</span>
        </div>

        {reading ? (
          <section className="anx-reading" aria-label="How analytics will classify this link">
            <h3>
              {reading.ok ? (
                <CheckCircle2 className="anx-i" style={{ color: 'var(--mr-st-ok-fg)' }} aria-hidden />
              ) : (
                <AlertTriangle className="anx-i" style={{ color: 'var(--mr-st-warn-fg)' }} aria-hidden />
              )}
              How analytics will file this link
            </h3>
            <div className="anx-tools">
              {reading.touches.map((t) => (
                <span key={t.when} className="anx-name">
                  <SourcePill platform={t.touch.platform} />
                  <span className="anx-small">{t.when}</span>
                </span>
              ))}
            </div>
            <ul>
              {reading.lines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </Panel>
  );
}

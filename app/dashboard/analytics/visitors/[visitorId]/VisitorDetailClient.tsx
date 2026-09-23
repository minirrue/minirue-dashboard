'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import TrafficFlagPanel from '@/components/dashboard/analytics/TrafficFlagPanel';
import { useAnalyticsRange, useCatalogueRoutes, useVisitorDetail, useVisitorStory } from '@/lib/hooks/use-analytics';
import { visitorLabel } from '@/lib/analytics/visitors';
import { withScope } from '@/lib/analytics/range';
import { knownRoutes } from '@/lib/analytics/ad-link';
import { cairoStamp, countryName, egp, fmtInt } from '@/lib/analytics/format';
import { STOP_REASON_LABEL } from '@/lib/analytics/funnel';
import JourneyView from '../../_ui/JourneyView';
import { Skeleton } from '../../_ui/parts';
import '../../_ui/analytics.css';

/**
 * One visitor's page (dashboard#123, #128): their verdict ("This is us",
 * bot, verified real), their totals and the same journey view the Analytics
 * sheet shows. Old links from orders and customers still land here.
 */
export default function VisitorDetailClient({ visitorId }: { visitorId: string }) {
  const { range } = useAnalyticsRange();
  const detail = useVisitorDetail(visitorId, range);
  const story = useVisitorStory(visitorId, range);
  const catalogue = useCatalogueRoutes(true);
  const routes = useMemo(() => (catalogue.data ? knownRoutes(catalogue.data.categories, catalogue.data.products) : null), [catalogue.data]);
  const d = detail.data?.data;
  const name = d ? visitorLabel({ ...d, visitorId }) : story.data ? visitorLabel(story.data) : 'Visitor';
  const verdict = story.data?.verdict;

  return (
    <div className="anx anx-page" style={{ gap: 16, display: 'flex', flexDirection: 'column' }}>
      <header className="anx-head">
        <div>
          <h1>{name}</h1>
          <p>
            {d
              ? `First seen ${cairoStamp(d.firstSeenAt)} · last seen ${cairoStamp(d.lastSeenAt)} · first came from ${d.firstChannel.toLowerCase()}${d.country ? ` · ${countryName(d.country)}` : ''}`
              : 'Full journey'}
          </p>
        </div>
        <div className="anx-tools">
          {d?.customer?.id ? (
            <Link className="anx-btn" href={`/customers/${d.customer.id}`}>
              Customer profile
            </Link>
          ) : null}
          <Link className="anx-btn" href={withScope('/analytics?section=people', range)}>
            <ArrowLeft className="anx-i-sm" aria-hidden />
            Back to People
          </Link>
        </div>
      </header>

      {/* dashboard#111: this one device's verdict: a misfiled bot, our own phone, or verified real. */}
      <TrafficFlagPanel subjectType="VISITOR" subjectId={visitorId} onChange={() => void detail.refetch()} />

      {detail.isError ? (
        <div className="anx-panel">
          <div className="anx-state">
            <h2>This visitor could not load</h2>
            <p>{detail.error?.message ?? 'The analytics service did not answer.'}</p>
            <button type="button" className="anx-btn anx-btn-primary" onClick={() => void detail.refetch()}>
              Retry
            </button>
          </div>
        </div>
      ) : (
        <div className="anx-recon anx-panel" style={{ borderRadius: 'var(--anx-r-lg)' }}>
          {[
            ['Visits', d ? fmtInt(d.sessionCount) : null],
            ['Pages', d ? fmtInt(d.pageviewCount) : null],
            ['Orders', d ? `${fmtInt(d.orderCount)} · ${egp(d.revenueMinor)}` : null],
          ].map(([label, value]) => (
            <div key={label as string}>
              <span>{label}</span>
              {value == null ? <Skeleton h={22} w="50%" /> : <b className="anx-num">{value}</b>}
            </div>
          ))}
        </div>
      )}

      {verdict ? (
        <p className="anx-answer">
          <span>
            <b>{STOP_REASON_LABEL[verdict.reason] ?? verdict.reason}.</b> {verdict.detail}
          </span>
        </p>
      ) : null}

      <section className="anx-panel" aria-labelledby="anx-vd-journey">
        <div className="anx-panel-h">
          <h2 id="anx-vd-journey">Journey</h2>
          <span className="anx-meta">Every session, newest first · times in Cairo</span>
        </div>
        <div className="anx-panel-b">
          {story.isLoading ? (
            <Skeleton h={120} />
          ) : story.isError ? (
            <p className="anx-p">The journey could not load ({story.error?.message ?? 'error'}).</p>
          ) : (
            <JourneyView sessions={story.data?.sessions ?? []} routes={routes} />
          )}
        </div>
      </section>
    </div>
  );
}

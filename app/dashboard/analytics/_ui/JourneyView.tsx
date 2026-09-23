'use client';

import React from 'react';
import { ArrowRight } from 'lucide-react';
import { viewSessions, type JourneySession, type KnownRoutes } from '@/lib/analytics/journey';
import { cairoTime, dayLabel, durationLabel, egp } from '@/lib/analytics/format';
import { shopDateInput } from '@/lib/dates/end-of-shop-day';
import { shortPath, sourceLabel } from '@/lib/analytics/source';
import { PagePill, SourcePill } from './parts';

/**
 * One visitor's full journey, session by session (dashboard#128). Every step
 * carries its page-type pill; the first step of each session carries the
 * platform pill it came from; every session ends in a "Left" step. Shared by
 * the Journeys section, the visitor sheet and the visitor page, so a journey
 * reads the same wherever it is opened.
 */
export default function JourneyView({
  sessions,
  vertical = false,
  routes,
  where,
}: {
  sessions: JourneySession[];
  vertical?: boolean;
  routes?: KnownRoutes | null;
  /** "mobile · Cairo", shown on the newest session. */
  where?: string;
}) {
  const view = viewSessions(sessions, routes);
  if (!view.length) return <p className="anx-p">No recorded steps for this visitor.</p>;
  return (
    <div className="anx-journey" data-vertical={vertical || undefined}>
      {view.map((s, i) => {
        const src = sourceLabel({ platform: s.touch.platform, medium: s.touch.medium, campaign: s.touch.campaign });
        const day = dayLabel(shopDateInput(s.startedAt), true);
        const span =
          s.durationSeconds > 0
            ? `${cairoTime(s.startedAt)} – ${cairoTime(s.endedAt ?? s.steps[s.steps.length - 1]?.at ?? s.startedAt)} · ${durationLabel(s.durationSeconds)}`
            : cairoTime(s.startedAt);
        return (
          <div className="anx-sess" key={s.sessionId ?? `${s.startedAt}-${i}`}>
            <h3>
              Session {view.length - i} · {day}
              <span>
                {span}
                {i === 0 && where ? ` · ${where}` : ''}
              </span>
              <SourcePill platform={s.touch.platform} label={src} />
            </h3>
            {s.summary ? <p className="anx-sess-sum">{s.summary}</p> : null}
            <div className="anx-steps-row">
              {s.steps.map((st, j) => {
                const extra = [
                  st.seconds != null && st.seconds > 0 ? durationLabel(st.seconds) : null,
                  st.scrollPct != null ? `${Math.round(st.scrollPct)}% scrolled` : null,
                  st.valueMinor != null && st.valueMinor > 0 ? egp(st.valueMinor) : null,
                  st.orderNumber ? `order ${st.orderNumber}` : null,
                  st.page !== 'exit' && st.path && !/^(Landed on|Went to)/.test(st.label) ? shortPath(st.path) : null,
                ]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <React.Fragment key={`${st.at}-${j}`}>
                    {j > 0 ? (
                      <span className="anx-to" aria-hidden>
                        <ArrowRight className="anx-i-sm" />
                      </span>
                    ) : null}
                    <div className="anx-step" data-k={st.page}>
                      <div className="anx-step-top">
                        <time dateTime={st.at}>{cairoTime(st.at)}</time>
                        <PagePill kind={st.page} />
                      </div>
                      <b>{st.label}</b>
                      {j === 0 ? (
                        <span>
                          <SourcePill platform={s.touch.platform} label={src} />
                        </span>
                      ) : null}
                      {extra ? <small>{extra}</small> : null}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronRight, EyeOff } from 'lucide-react';
import Sheet from '@/components/dashboard/ui/Sheet';
import { useVisitorStory } from '@/lib/hooks/use-analytics';
import { apiSetTrafficFlag } from '@/lib/api/traffic-flags';
import { visitorLabel } from '@/lib/analytics/visitors';
import { withScope } from '@/lib/analytics/range';
import { useShell } from '../context';
import JourneyView from '../JourneyView';
import { LegendGrid } from '../Legend';
import { Skeleton } from '../parts';
import { PersonTags, personMeta } from '../sections/Journeys';

/**
 * Any visitor, anywhere on the screen, opens here: their full journey with
 * page-type and source pills, and the one action that belongs to a person,
 * "This is us" (an OWNER verdict that removes them from every count, past
 * included, until restored in Who counts).
 */
export default function VisitorSheet({ visitorId, onClose }: { visitorId: string; onClose: () => void }) {
  const { model, range, routes, go, toast } = useShell();
  const person = model.people.find((p) => p.id === visitorId) ?? null;
  const story = useVisitorStory(visitorId, range);
  const [legendOpen, setLegendOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();
  const name = person?.label ?? (story.data ? visitorLabel(story.data) : 'Visitor');

  const markOurs = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiSetTrafficFlag({ subjectType: 'VISITOR', subjectId: visitorId, trafficClass: 'OWNER', reason: 'Marked “This is us” from Analytics' });
      await qc.invalidateQueries({ queryKey: ['analytics'] });
      toast(`${name} is left out of every count now`);
      onClose();
    } catch {
      setError('That visitor could not be marked. Try again.');
      setBusy(false);
    }
  };

  return (
    <Sheet
      scopeClassName="anx"
      size="narrow"
      labelId="anx-visitor-title"
      title={name}
      subtitle={person ? `${person.source} · ${person.place} · ${person.device}` : 'Full journey'}
      onClose={onClose}
      footer={
        <>
          <Link className="anx-btn" href={withScope(`/analytics/visitors/${visitorId}`, range)}>
            Visitor page
          </Link>
          <button
            type="button"
            className="anx-btn anx-btn-primary"
            data-autofocus
            onClick={() => {
              onClose();
              go('journeys', { visitorId });
            }}
          >
            Open in Journeys
          </button>
        </>
      }
    >
      {person ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="anx-meta">{personMeta(person)}</span>
          <div className="anx-tools">
            <PersonTags p={person} />
          </div>
        </div>
      ) : null}
      <div className="anx-mini-lg">
        <button type="button" className="anx-disclose" aria-expanded={legendOpen} onClick={() => setLegendOpen((v) => !v)}>
          <ChevronRight aria-hidden />
          What the pills mean
        </button>
        <div className="anx-ah" data-open={legendOpen || undefined}>
          <div inert={!legendOpen}>
            <LegendGrid groups={['pages', 'sources', 'status']} />
          </div>
        </div>
      </div>
      {story.isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Skeleton h={18} w="60%" />
          <Skeleton h={60} />
          <Skeleton h={60} />
          <Skeleton h={60} />
        </div>
      ) : story.isError ? (
        <p className="anx-p">This journey could not load ({story.error?.message ?? 'error'}).</p>
      ) : (
        <JourneyView sessions={story.data?.sessions ?? []} vertical routes={routes} where={person ? `${person.device.toLowerCase()} · ${person.place}` : undefined} />
      )}
      <div>
        {confirming ? (
          <div className="anx-confirm" role="group" aria-label="Confirm This is us">
            <span>Leave {name} out of every count, past visits included? You can restore them in Who counts.</span>
            <button type="button" className="anx-btn anx-btn-primary" disabled={busy} onClick={() => void markOurs()}>
              {busy ? 'Marking…' : 'Yes, this is us'}
            </button>
            <button type="button" className="anx-btn" disabled={busy} onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" className="anx-btn" onClick={() => setConfirming(true)}>
            <EyeOff className="anx-i-sm" aria-hidden />
            This is us
          </button>
        )}
        {error ? (
          <p className="anx-field-err" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Sheet>
  );
}

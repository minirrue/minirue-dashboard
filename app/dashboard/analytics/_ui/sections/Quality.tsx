'use client';

import React from 'react';
import { AlertTriangle, Ban, CheckCircle2, Info, ShieldCheck } from 'lucide-react';
import { egp, fmtInt } from '@/lib/analytics/format';
import { VISITOR_DEFINITION } from '@/lib/analytics/visitors';
import type { QaCheck } from '@/lib/analytics/model';
import { useShell } from '../context';
import { Panel, Skeleton, Tag } from '../parts';

const QA_ICON = { ok: CheckCircle2, warn: AlertTriangle, bad: Ban, unk: Info, na: Info } as const;
const QA_TAG: Record<QaCheck['status'], 'ok' | 'warn' | 'bad' | 'info' | 'muted'> = { ok: 'ok', warn: 'warn', bad: 'bad', unk: 'info', na: 'muted' };

export default function Quality() {
  const { model, recon, go, openWhoCounts } = useShell();
  const canonical = model.all.length;
  const rollup = model.rollupVisitors;
  const needs = model.qa.filter((q) => q.status === 'warn' || q.status === 'bad').length;
  const mismatches = recon
    ? recon.mismatches.ordersMissingAttribution.length +
      recon.mismatches.attributionMissingOrder.length +
      recon.mismatches.purchaseEventsMissingOrder.length +
      recon.mismatches.ordersMissingPurchaseEvent.length
    : 0;
  return (
    <>
      <div className="anx-grid-2e">
        <Panel
          id="anx-def"
          title="One visitor number, everywhere"
          tools={
            <Tag tone="ok" icon={CheckCircle2}>
              Matched
            </Tag>
          }
        >
          <div className="anx-panel-b" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p className="anx-p">{VISITOR_DEFINITION}</p>
            <div className="anx-recon">
              <div>
                <span>Overview</span>
                <b className="anx-num">{fmtInt(canonical)}</b>
                <span>canonical</span>
              </div>
              <div>
                <span>People</span>
                <b className="anx-num">{fmtInt(canonical)}</b>
                <span>canonical</span>
              </div>
              <div>
                <span>Journeys</span>
                <b className="anx-num">{fmtInt(canonical)}</b>
                <span>canonical</span>
              </div>
            </div>
            <p className="anx-field-hint">
              {rollup == null
                ? 'Loading the daily rollup for comparison…'
                : `The daily rollup counts ${fmtInt(rollup)}: every browser that passed the bot filter, including ones that never got a visitor number. It is shown here only to explain the gap; no section counts with it.`}
            </p>
          </div>
        </Panel>
        <Panel
          id="anx-pur"
          title="Purchases vs real orders"
          tools={
            recon ? (
              recon.healthy ? (
                <Tag tone="ok" icon={CheckCircle2}>
                  Reconciled
                </Tag>
              ) : (
                <Tag tone="bad" icon={AlertTriangle}>
                  {fmtInt(mismatches)} mismatches
                </Tag>
              )
            ) : null
          }
        >
          <div className="anx-panel-b" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {recon ? (
              <>
                <div className="anx-recon">
                  <div>
                    <span>Backend orders</span>
                    <b className="anx-num">{fmtInt(recon.orders.count)}</b>
                    <span>{egp(recon.orders.revenueMinor)}</span>
                  </div>
                  <div>
                    <span>Tracked purchases</span>
                    <b className="anx-num">{fmtInt(recon.purchaseEvents.count)}</b>
                    <span>{egp(recon.purchaseEvents.revenueMinor)}</span>
                  </div>
                  <div>
                    <span>Ad-attributed</span>
                    <b className="anx-num">{fmtInt(recon.attribution.count)}</b>
                    <span>{egp(recon.attribution.revenueMinor)}</span>
                  </div>
                </div>
                <p className="anx-p">
                  {recon.healthy
                    ? recon.orders.count
                      ? 'Every order matches its purchase event by order ID. Duplicates are shown, never counted twice.'
                      : 'Nothing to mismatch in this range. When orders arrive, each is matched to its purchase event by order ID.'
                    : `Orders and tracking disagree: ${fmtInt(recon.mismatches.ordersMissingPurchaseEvent.length)} orders without a purchase event, ${fmtInt(
                        recon.mismatches.purchaseEventsMissingOrder.length,
                      )} purchase events without an order, ${fmtInt(recon.mismatches.ordersMissingAttribution.length)} orders without a source.`}
                </p>
              </>
            ) : (
              <Skeleton h={80} />
            )}
          </div>
        </Panel>
      </div>

      <Panel id="anx-qa" title="Checks" meta={`Run on every refresh · ${needs ? `${needs} need a look` : 'every measured check passes'}`}>
        <div className="anx-panel-b anx-checks">
          {model.qa.map((q) => {
            const Icon = QA_ICON[q.status];
            return (
              <div className="anx-check" key={q.id}>
                <span data-tone={q.status}>
                  <Icon className="anx-i" aria-hidden />
                </span>
                <div>
                  <b>{q.title}</b>
                  {q.detail ? <p>{q.detail}</p> : null}
                </div>
                {q.go ? (
                  <button type="button" className="anx-btn" onClick={() => go(q.go!)}>
                    Open {q.go === 'sources' ? 'sources' : q.go}
                  </button>
                ) : (
                  <Tag tone={QA_TAG[q.status]}>{q.tag}</Tag>
                )}
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel
        id="anx-exc"
        title="What was left out, and why"
        meta="Events in this range, by the rule that left them out"
        tools={
          <button type="button" className="anx-btn" onClick={openWhoCounts}>
            <ShieldCheck className="anx-i-sm" aria-hidden />
            Change who counts
          </button>
        }
      >
        <div className="anx-tw anx-cards">
          <table className="anx-table">
            <thead>
              <tr>
                <th scope="col">Reason</th>
                <th scope="col">Events</th>
                <th scope="col">Share of raw</th>
                <th scope="col" className="anx-tl">
                  Rule
                </th>
              </tr>
            </thead>
            <tbody>
              {model.exclusions.length ? (
                model.exclusions.map((e) => (
                  <tr key={e.reason}>
                    <td>{e.group === 'counted' ? <b>{e.label}</b> : e.label}</td>
                    <td data-l="Events">{e.group === 'counted' ? <b>{fmtInt(e.events)}</b> : fmtInt(e.events)}</td>
                    <td data-l="Share of raw">{e.share}%</td>
                    <td data-l="Rule" className="anx-tl" style={{ whiteSpace: 'normal' }}>
                      {e.rule}
                    </td>
                  </tr>
                ))
              ) : (
                <tr className="anx-empty-row">
                  <td colSpan={4}>Loading the exclusion breakdown…</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

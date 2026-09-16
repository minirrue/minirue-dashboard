'use client';

import type { OrderStatus } from '@/lib/api/orders';

const STAGES: Array<{ status: OrderStatus; label: string }> = [
  { status: 'CONFIRMED', label: 'Confirmed' },
  { status: 'PROCESSING', label: 'Ready to ship' },
  { status: 'SHIPPED', label: 'Out for delivery' },
  { status: 'DELIVERED', label: 'Delivered' },
];

const ACTIVE_INDEX: Partial<Record<OrderStatus, number>> = {
  CONFIRMED: 0,
  PROCESSING: 1,
  SHIPPED: 2,
  DELIVERED: 3,
};

const NEXT_ACTION: Partial<Record<OrderStatus, { target: OrderStatus; label: string }>> = {
  PENDING: { target: 'CONFIRMED', label: 'Confirm order' },
  CONFIRMED: { target: 'PROCESSING', label: 'Mark ready to ship' },
  PROCESSING: { target: 'SHIPPED', label: 'Mark out for delivery' },
  SHIPPED: { target: 'DELIVERED', label: 'Mark delivered' },
};

export interface OrderFulfillmentPipelineProps {
  status: OrderStatus;
  busy: boolean;
  onAdvance: (target: OrderStatus) => void;
}

export default function OrderFulfillmentPipeline({
  status,
  busy,
  onAdvance,
}: OrderFulfillmentPipelineProps) {
  const activeIndex = ACTIVE_INDEX[status] ?? -1;
  const halted = status === 'CANCELLED' || status === 'REFUNDED';
  const next = halted ? undefined : NEXT_ACTION[status];

  return (
    <div className="fulfillment-pipeline">
      <ol className="fulfillment-pipeline-list" aria-label="Fulfillment progress">
        {STAGES.map((stage, index) => {
          const state = halted
            ? 'upcoming'
            : index < activeIndex
              ? 'complete'
              : index === activeIndex
                ? 'current'
                : 'upcoming';

          return (
            <li
              key={stage.status}
              className="fulfillment-pipeline-step"
              data-state={state}
              aria-current={state === 'current' ? 'step' : undefined}
            >
              <span className="fulfillment-pipeline-marker" aria-hidden="true">
                {state === 'complete' ? '✓' : index + 1}
              </span>
              <span className="fulfillment-pipeline-copy">
                <span className="fulfillment-pipeline-label">{stage.label}</span>
                <span className="fulfillment-pipeline-state">
                  {state === 'complete' ? 'Complete' : state === 'current' ? 'Current' : 'Upcoming'}
                </span>
              </span>
            </li>
          );
        })}
      </ol>

      {halted ? (
        <p className="dash-help-text fulfillment-pipeline-note" role="status">
          Fulfillment stopped because this order is {status.toLowerCase()}.
        </p>
      ) : next ? (
        <div className="fulfillment-pipeline-action">
          <button
            type="button"
            className="dash-btn-primary"
            disabled={busy}
            onClick={() => onAdvance(next.target)}
          >
            {next.label}
          </button>
          <span className="dash-help-text">Moves the order forward one stage.</span>
        </div>
      ) : (
        <p className="dash-help-text fulfillment-pipeline-note" role="status">
          Fulfillment complete.
        </p>
      )}
    </div>
  );
}

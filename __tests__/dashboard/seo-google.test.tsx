import { act, render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import type {
  SeoAuditReport,
  SeoGoogleHistory,
  SeoGooglePage,
  SeoGoogleRefreshResponse,
  SeoGoogleStatus,
} from '@/lib/api/seo';

/**
 * PG-DASHBOARD-SEO-002 (minirue-dashboard#70). The SEO tab shows Google's index
 * status from backend#172: the connection card, index coverage and sitemaps,
 * Google columns in the pages table, a "Not indexed only" filter, and a row
 * expand with inspection detail, top queries, history and Re-check.
 */

const getAudit = jest.fn();
const runAudit = jest.fn();
const getGoogle = jest.fn();
const getHistory = jest.fn();
const refreshGoogle = jest.fn();

jest.mock('@/lib/api/seo', () => ({
  apiGetSeoAudit: (...a: unknown[]) => getAudit(...a),
  apiRunSeoAudit: (...a: unknown[]) => runAudit(...a),
  apiGetSeoGoogle: (...a: unknown[]) => getGoogle(...a),
  apiGetSeoGoogleHistory: (...a: unknown[]) => getHistory(...a),
  apiRefreshSeoGoogle: (...a: unknown[]) => refreshGoogle(...a),
}));

import SeoWithGoogle from '@/app/dashboard/seo/SeoGoogle';

const DAY = 86_400_000;
const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();

const TOTE = 'https://minirueshop.com/shop/bags/linen-tote';
const BAGS = 'https://minirueshop.com/shop/bags';

const audit: SeoAuditReport = {
  ranAt: iso(0),
  storefrontUrl: 'https://minirueshop.com',
  score: 82,
  totals: { pass: 3, warn: 1, fail: 1 },
  site: [],
  pages: [
    { url: 'https://minirueshop.com/', kind: 'home', name: 'Home', httpStatus: 200, score: 100, checks: [] },
    { url: TOTE, kind: 'product', name: 'Linen tote', httpStatus: 200, score: 60, checks: [] },
    { url: BAGS, kind: 'category', name: 'Bags', httpStatus: 200, score: 90, checks: [] },
  ],
};

function gPage(over: Partial<SeoGooglePage>): SeoGooglePage {
  return {
    url: TOTE,
    verdict: 'PASS',
    coverageState: 'Submitted and indexed',
    indexingState: 'INDEXING_ALLOWED',
    robotsTxtState: 'ALLOWED',
    pageFetchState: 'SUCCESSFUL',
    lastCrawlTime: iso(3 * DAY),
    googleCanonical: TOTE,
    userCanonical: TOTE,
    canonicalMismatch: false,
    crawledAs: 'MOBILE',
    sitemaps: ['https://minirueshop.com/sitemap.xml'],
    richResults: {
      verdict: 'PASS',
      detected: [
        { type: 'Product snippets', items: [{ name: 'Linen tote', issues: [] }] },
        {
          type: 'Breadcrumbs',
          items: [{ name: 'Unnamed item', issues: [{ message: 'Missing field "item"', severity: 'WARNING' }] }],
        },
      ],
    },
    mobile: null,
    clicks: 12,
    impressions: 340,
    ctr: 0.035,
    position: 8.4,
    topQueries: [{ query: 'linen tote egypt', clicks: 7, impressions: 90, ctr: 0.077, position: 4.2 }],
    inspectionLink: 'https://search.google.com/search-console/inspect?resource_id=sc-domain:minirueshop.com&id=tote',
    error: null,
    checkedAt: iso(2 * 3_600_000),
    ...over,
  };
}

const connected: SeoGoogleStatus = {
  connection: 'connected',
  property: 'sc-domain:minirueshop.com',
  lastRunAt: iso(2 * 3_600_000),
  error: null,
  sitemaps: [
    {
      path: 'https://minirueshop.com/sitemap.xml',
      type: 'SITEMAP',
      isPending: false,
      isSitemapsIndex: false,
      lastSubmitted: iso(20 * DAY),
      lastDownloaded: iso(1 * DAY),
      errors: 0,
      warnings: 1,
      contents: [{ type: 'web', submitted: 25, indexed: null }],
    },
  ],
  pages: [
    gPage({}),
    gPage({
      url: BAGS + '/',
      verdict: 'NEUTRAL',
      coverageState: 'Crawled - currently not indexed',
      lastCrawlTime: null,
      canonicalMismatch: true,
      googleCanonical: 'https://minirueshop.com/shop',
      richResults: null,
      clicks: null,
      impressions: null,
      ctr: null,
      position: null,
      topQueries: [],
      inspectionLink: null,
    }),
  ],
  totals: { indexed: 1, notIndexed: 1, errors: 0 },
};

const notConnected: SeoGoogleStatus = {
  connection: 'not_connected',
  property: 'sc-domain:minirueshop.com',
  lastRunAt: null,
  error: null,
  sitemaps: [],
  pages: [],
  totals: { indexed: 0, notIndexed: 0, errors: 0 },
};

const history: SeoGoogleHistory = {
  url: TOTE,
  points: [
    { checkedAt: '2026-09-01T05:20:00.000Z', verdict: 'NEUTRAL', coverageState: 'Discovered - currently not indexed', indexingState: null, lastCrawlTime: null, canonicalMismatch: false, richResultTypes: [], clicks: null, impressions: null, ctr: null, position: null, error: null },
    { checkedAt: '2026-09-02T05:20:00.000Z', verdict: 'PASS', coverageState: 'Submitted and indexed', indexingState: null, lastCrawlTime: null, canonicalMismatch: false, richResultTypes: ['Product snippets'], clicks: 3, impressions: 80, ctr: 0.04, position: 11.2, error: null },
    { checkedAt: '2026-09-03T05:20:00.000Z', verdict: 'PASS', coverageState: 'Submitted and indexed', indexingState: null, lastCrawlTime: null, canonicalMismatch: false, richResultTypes: ['Product snippets'], clicks: 12, impressions: 340, ctr: 0.035, position: 8.4, error: null },
  ],
};

function refreshed(refresh: Partial<SeoGoogleRefreshResponse['refresh']>): SeoGoogleRefreshResponse {
  return {
    ...connected,
    refresh: { ran: true, reason: null, inspected: 1, skippedRecent: 0, quotaExhausted: false, nextAllowedAt: null, ...refresh },
  };
}

beforeEach(() => {
  getAudit.mockResolvedValue(audit);
  getHistory.mockResolvedValue(history);
});

afterEach(() => {
  cleanup();
  [getAudit, runAudit, getGoogle, getHistory, refreshGoogle].forEach((m) => m.mockReset());
});

async function openTote() {
  const table = await screen.findByRole('table', { name: 'Pages' });
  await within(table).findByRole('columnheader', { name: 'Google' });
  fireEvent.click(within(table).getByRole('button', { name: 'Linen tote' }));
  return screen.findByRole('region', { name: 'Google inspection for Linen tote' });
}

describe('SEO tab, Google index status', () => {
  it('connected: shows coverage, sitemap status and the Google columns with only the numbers Google returned', async () => {
    getGoogle.mockResolvedValue(connected);
    render(<SeoWithGoogle />);

    const card = await screen.findByRole('region', { name: 'Google index' });
    expect(within(card).getByText('Connected')).toBeInTheDocument();
    expect(within(card).getByText('sc-domain:minirueshop.com')).toBeInTheDocument();
    const coverage = within(card).getByRole('list', { name: 'Index coverage' });
    expect(within(coverage).getByText('Indexed').parentElement).toHaveTextContent('1');
    expect(within(coverage).getByText('Not indexed').parentElement).toHaveTextContent('1');
    expect(within(coverage).getByText('Errors').parentElement).toHaveTextContent('0');
    const sitemap = within(card).getByRole('listitem', { name: /sitemap\.xml/ });
    expect(sitemap).toHaveTextContent('Read 1 day ago');
    expect(sitemap).toHaveTextContent('25 discovered');
    expect(sitemap).not.toHaveTextContent('indexed'); // Google returned indexed: null
    expect(sitemap).toHaveTextContent('1 warning');

    const table = await screen.findByRole('table', { name: 'Pages' });
    for (const h of ['Google', 'Last crawl', 'Canonical', 'Rich results', 'Clicks', 'Impressions', 'Position']) {
      expect(within(table).getByRole('columnheader', { name: h })).toBeInTheDocument();
    }
    const toteRow = within(table).getByRole('button', { name: 'Linen tote' }).closest('tr') as HTMLElement;
    expect(within(toteRow).getByText('Indexed')).toBeInTheDocument();
    expect(toteRow).toHaveTextContent('3 days ago');
    expect(within(toteRow).getByText('Product snippets')).toBeInTheDocument();
    expect(within(toteRow).getByText('Breadcrumbs')).toBeInTheDocument();
    expect(within(toteRow).getByLabelText('Breadcrumbs: 1 issue')).toBeInTheDocument();
    expect(toteRow).toHaveTextContent('12');
    expect(toteRow).toHaveTextContent('340');
    expect(toteRow).toHaveTextContent('8.4');

    // The trailing-slash URL from Google still matches the audit's page.
    const bagsRow = within(table).getByRole('button', { name: 'Bags' }).closest('tr') as HTMLElement;
    expect(within(bagsRow).getByText('Not indexed').closest('td')).toHaveTextContent(
      'Not indexed: Crawled - currently not indexed',
    );
    expect(within(bagsRow).getByText('Mismatch')).toBeInTheDocument();
    // Last crawl, rich results, clicks, impressions and position were all null: dashes, never zeros.
    expect(within(bagsRow).getAllByLabelText('Not reported by Google')).toHaveLength(5);

    const homeRow = within(table).getByRole('button', { name: 'Home' }).closest('tr') as HTMLElement;
    expect(within(homeRow).getByText('Not checked')).toBeInTheDocument();
  });

  it('not connected: shows the setup link and keeps the live-site checks, with no Google columns or filter', async () => {
    getGoogle.mockResolvedValue(notConnected);
    render(<SeoWithGoogle />);

    const card = await screen.findByRole('region', { name: 'Google index' });
    expect(within(card).getByText('Not connected')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: /setup steps/i })).toHaveAttribute(
      'href',
      'https://github.com/minirrue/minirue-backend/issues/173',
    );
    expect(card).toHaveTextContent(/live-site checks still work/i);
    expect(within(card).queryByRole('list', { name: 'Index coverage' })).not.toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: /Check all pages/ })).not.toBeInTheDocument();

    const table = await screen.findByRole('table', { name: 'Pages' });
    expect(within(table).queryByRole('columnheader', { name: 'Google' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Not indexed only' })).not.toBeInTheDocument();
  });

  it('error: shows the connection error and its message', async () => {
    getGoogle.mockResolvedValue({
      ...notConnected,
      connection: 'error',
      lastRunAt: iso(DAY),
      error: { code: 'forbidden', message: 'The service account has no access. Add it in Search Console → Settings → Users and permissions.' },
    } satisfies SeoGoogleStatus);
    render(<SeoWithGoogle />);

    const card = await screen.findByRole('region', { name: 'Google index' });
    expect(within(card).getByText('Error')).toBeInTheDocument();
    expect(within(card).getByRole('alert')).toHaveTextContent('The service account has no access');
  });

  it('"Not indexed only" hides indexed and unchecked pages', async () => {
    getGoogle.mockResolvedValue(connected);
    render(<SeoWithGoogle />);
    const table = await screen.findByRole('table', { name: 'Pages' });
    await within(table).findByRole('columnheader', { name: 'Google' });
    expect(within(table).getAllByRole('button', { expanded: false })).toHaveLength(3);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Not indexed only' }));
    expect(within(table).getAllByRole('button', { expanded: false }).map((b) => b.textContent)).toEqual(['Bags']);
  });

  it('expands a row to the inspection detail, top queries, history and the Search Console link', async () => {
    getGoogle.mockResolvedValue(connected);
    render(<SeoWithGoogle />);
    const detail = await openTote();

    expect(within(detail).getByText('Submitted and indexed')).toBeInTheDocument();
    expect(within(detail).getByText('Mobile')).toBeInTheDocument();
    expect(within(detail).getByText('Missing field "item"')).toBeInTheDocument();
    const queries = within(detail).getByRole('table', { name: 'Top queries' });
    expect(within(queries).getByText('linen tote egypt')).toBeInTheDocument();
    expect(within(detail).getByRole('link', { name: /Request indexing in Search Console/ })).toHaveAttribute(
      'href',
      connected.pages[0].inspectionLink,
    );

    expect(getHistory).toHaveBeenCalledWith(TOTE);
    expect(await within(detail).findByText('Average position')).toBeInTheDocument();
    const runs = within(detail).getByRole('list', { name: 'Index status over time' });
    const items = within(runs).getAllByRole('listitem').map((li) => li.getAttribute('aria-label'));
    expect(items).toEqual([expect.stringMatching(/^Not indexed, 1 check/), expect.stringMatching(/^Indexed, 2 checks/)]);
  });

  it('history with no position from Google says so instead of drawing zeros', async () => {
    getGoogle.mockResolvedValue(connected);
    getHistory.mockResolvedValue({ url: TOTE, points: [history.points[0]] });
    render(<SeoWithGoogle />);
    const detail = await openTote();
    expect(await within(detail).findByText(/Google has not reported a position/)).toBeInTheDocument();
    expect(within(detail).queryByText('Average position')).not.toBeInTheDocument();
  });

  it('Re-check posts the page URL and reports what Google did', async () => {
    getGoogle.mockResolvedValue(connected);
    refreshGoogle.mockResolvedValue(refreshed({ inspected: 1 }));
    render(<SeoWithGoogle />);
    const detail = await openTote();

    fireEvent.click(within(detail).getByRole('button', { name: 'Re-check with Google' }));
    expect(refreshGoogle).toHaveBeenCalledWith(TOTE);
    expect(await within(detail).findByRole('status')).toHaveTextContent('Google re-checked 1 page');
    await waitFor(() => expect(getHistory).toHaveBeenCalledTimes(2));
  });

  it.each([
    ['all_recent', /checked this page in the last hour.*again after/i],
    ['quota', /daily inspection budget is used up.*again after/i],
    ['not_connected', /not connected/i],
    ['error', /Google returned an error/i],
  ] as const)('Re-check with reason %s explains it and shows nextAllowedAt', async (reason, text) => {
    getGoogle.mockResolvedValue(connected);
    refreshGoogle.mockResolvedValue(
      refreshed({ ran: false, reason, inspected: 0, skippedRecent: 1, nextAllowedAt: '2026-09-15T13:05:00.000Z' }),
    );
    render(<SeoWithGoogle />);
    const detail = await openTote();
    fireEvent.click(within(detail).getByRole('button', { name: 'Re-check with Google' }));
    const status = await within(detail).findByRole('status');
    expect(status).toHaveTextContent(text);
    if (reason === 'all_recent' || reason === 'quota') {
      expect(status.querySelector('time')).toHaveAttribute('datetime', '2026-09-15T13:05:00.000Z');
    }
  });

  it('Re-check answered 409 says a check is already running', async () => {
    getGoogle.mockResolvedValue(connected);
    refreshGoogle.mockRejectedValue({ status: 409, message: 'Conflict' });
    render(<SeoWithGoogle />);
    const detail = await openTote();
    fireEvent.click(within(detail).getByRole('button', { name: 'Re-check with Google' }));
    expect(await within(detail).findByRole('status')).toHaveTextContent(/already running/i);
  });

  it('Check all pages refreshes without a URL from the card', async () => {
    getGoogle.mockResolvedValue(connected);
    refreshGoogle.mockResolvedValue(refreshed({ inspected: 2 }));
    render(<SeoWithGoogle />);
    const card = await screen.findByRole('region', { name: 'Google index' });
    fireEvent.click(within(card).getByRole('button', { name: 'Check all pages with Google' }));
    expect(refreshGoogle).toHaveBeenCalledWith(undefined);
    expect(await within(card).findByRole('status')).toHaveTextContent('Google re-checked 2 pages');
  });

  it('Check all pages: a 202 RUNNING is polled, showing progress, until DONE (backend#187)', async () => {
    jest.useFakeTimers();
    try {
      const run = (status: string, inspected: number) => ({
        status,
        startedAt: iso(0),
        finishedAt: status === 'RUNNING' ? null : iso(0),
        inspected,
        total: 25,
        error: null,
      });
      getGoogle
        .mockResolvedValueOnce(connected)
        .mockResolvedValueOnce({ ...connected, run: run('RUNNING', 7) })
        .mockResolvedValue({ ...connected, run: run('DONE', 25) });
      refreshGoogle.mockResolvedValue({ ...connected, run: run('RUNNING', 0) });
      render(<SeoWithGoogle />);
      const card = await screen.findByRole('region', { name: 'Google index' });
      fireEvent.click(within(card).getByRole('button', { name: 'Check all pages with Google' }));

      await act(async () => {
        await jest.advanceTimersByTimeAsync(3000);
      });
      expect(within(card).getByRole('button', { name: 'Checking 7 of 25…' })).toBeDisabled();

      await act(async () => {
        await jest.advanceTimersByTimeAsync(3000);
      });
      expect(await within(card).findByRole('status')).toHaveTextContent('Google re-checked 25 of 25 pages');
      expect(within(card).getByRole('button', { name: 'Check all pages with Google' })).toBeEnabled();
    } finally {
      jest.useRealTimers();
    }
  });
});

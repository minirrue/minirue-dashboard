import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import type { SeoAuditReport } from '@/lib/api/seo';

/**
 * PG-DASHBOARD-SEO-001 (minirue-dashboard#69). The SEO tab renders the audit
 * report from backend#171: header score and counts, site checks, a pages table
 * with a problem filter and expandable rows, and Search Console deep links.
 */

const getAudit = jest.fn();
const runAudit = jest.fn();

jest.mock('@/lib/api/seo', () => ({
  apiGetSeoAudit: (...a: unknown[]) => getAudit(...a),
  apiRunSeoAudit: (...a: unknown[]) => runAudit(...a),
}));

import SeoClient, {
  dashboardHrefFor,
  richResultsHref,
  searchConsoleHref,
  urlInspectionHref,
} from '@/app/dashboard/seo/SeoClient';

const report: SeoAuditReport = {
  ranAt: new Date().toISOString(),
  storefrontUrl: 'https://minirueshop.com',
  score: 82,
  totals: { pass: 40, warn: 3, fail: 2 },
  site: [
    { id: 'robots', label: 'robots.txt', status: 'pass', detail: 'Reachable and points at the sitemap.' },
    {
      id: 'llms',
      label: 'llms.txt',
      status: 'warn',
      detail: 'Not published yet.',
      fix: 'Ship minirue-frontend#150.',
    },
  ],
  pages: [
    {
      url: 'https://minirueshop.com/',
      kind: 'home',
      name: 'Home',
      httpStatus: 200,
      score: 100,
      checks: [{ id: 'title', label: 'Title', status: 'pass', detail: 'MiniRue, 42 chars.' }],
    },
    {
      url: 'https://minirueshop.com/shop/bags/linen-tote',
      kind: 'product',
      name: 'Linen tote',
      httpStatus: 200,
      score: 60,
      checks: [
        { id: 'title', label: 'Title', status: 'pass', detail: 'Linen tote | MiniRue' },
        {
          id: 'canonical',
          label: 'Canonical',
          status: 'fail',
          detail: 'No canonical link.',
          fix: 'Add <link rel="canonical"> with the page URL.',
        },
      ],
    },
    {
      url: 'https://minirueshop.com/shop/bags',
      kind: 'category',
      name: 'Bags',
      httpStatus: 200,
      score: 90,
      checks: [{ id: 'h1', label: 'h1', status: 'warn', detail: 'Two h1 tags.', fix: 'Keep one.' }],
    },
  ],
};

afterEach(() => {
  cleanup();
  getAudit.mockReset();
  runAudit.mockReset();
});

describe('SeoClient', () => {
  it('shows the header score, counts and site checks from the audit', async () => {
    getAudit.mockResolvedValue(report);
    render(<SeoClient />);

    const header = await screen.findByRole('region', { name: 'SEO score' });
    expect(within(header).getByText('82')).toBeInTheDocument();
    expect(within(header).getByText('40 pass')).toBeInTheDocument();
    expect(within(header).getByText('3 warn')).toBeInTheDocument();
    expect(within(header).getByText('2 fail')).toBeInTheDocument();
    await waitFor(() => expect(within(header).getByText(/Last checked just now/)).toBeInTheDocument());

    const site = screen.getByRole('region', { name: 'Site health' });
    expect(within(site).getByText('robots.txt')).toBeInTheDocument();
    expect(within(site).getByText('Not published yet.')).toBeInTheDocument();
    expect(within(site).getByText('Ship minirue-frontend#150.')).toBeInTheDocument();
  });

  it('filters the pages table to problems and by kind', async () => {
    getAudit.mockResolvedValue(report);
    render(<SeoClient />);
    const table = await screen.findByRole('table', { name: 'Pages' });
    expect(within(table).getAllByRole('button', { expanded: false })).toHaveLength(3);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Only problems' }));
    const names = within(table)
      .getAllByRole('button', { expanded: false })
      .map((b) => b.textContent);
    expect(names).toEqual(['Linen tote', 'Bags']);

    fireEvent.change(screen.getByRole('combobox', { name: 'Kind' }), { target: { value: 'category' } });
    expect(within(table).getAllByRole('button', { expanded: false }).map((b) => b.textContent)).toEqual(['Bags']);
  });

  it('expands a row to show its checks with detail, fix and links', async () => {
    getAudit.mockResolvedValue(report);
    render(<SeoClient />);
    const table = await screen.findByRole('table', { name: 'Pages' });
    expect(screen.queryByText('No canonical link.')).not.toBeInTheDocument();

    fireEvent.click(within(table).getByRole('button', { name: 'Linen tote' }));
    expect(within(table).getByRole('button', { name: 'Linen tote' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('No canonical link.')).toBeInTheDocument();
    expect(screen.getByText('Add <link rel="canonical"> with the page URL.')).toBeInTheDocument();
    expect(within(table).getByRole('link', { name: /Open Linen tote on the shop/ })).toHaveAttribute(
      'href',
      'https://minirueshop.com/shop/bags/linen-tote',
    );
    expect(within(table).getByRole('link', { name: /Edit Linen tote in the dashboard/ })).toHaveAttribute(
      'href',
      '/catalogue/products/linen-tote/edit',
    );
  });

  it('Run check posts and renders the new report', async () => {
    getAudit.mockResolvedValue(null);
    runAudit.mockResolvedValue(report);
    render(<SeoClient />);
    expect(await screen.findByText(/No check has run yet/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Run check' }));
    expect(runAudit).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('table', { name: 'Pages' })).toBeInTheDocument();
  });

  it('shows the error and keeps the old report when a run fails', async () => {
    getAudit.mockResolvedValue(report);
    runAudit.mockRejectedValue({ status: 500, message: 'Storefront timed out' });
    render(<SeoClient />);
    await screen.findByRole('table', { name: 'Pages' });
    fireEvent.click(screen.getByRole('button', { name: 'Run check' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Storefront timed out');
    expect(screen.getByRole('table', { name: 'Pages' })).toBeInTheDocument();
  });

  it('leaves slots for the Google data of #70: aside, extra columns, filter and row detail', async () => {
    getAudit.mockResolvedValue(report);
    render(
      <SeoClient
        summaryAside={<section aria-label="Google connection">Not connected</section>}
        pageSlots={{
          extraColumns: [{ id: 'google', header: 'Google', render: (p) => `g:${p.name}` }],
          extraFilters: <span>extra filter</span>,
          extraRowFilter: (p) => p.kind !== 'home',
          renderDetailExtra: (p) => <p>inspection for {p.name}</p>,
        }}
      />,
    );
    const table = await screen.findByRole('table', { name: 'Pages' });
    expect(screen.getByRole('region', { name: 'Google connection' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Google' })).toBeInTheDocument();
    expect(within(table).getByText('g:Bags')).toBeInTheDocument();
    expect(within(table).queryByText('g:Home')).not.toBeInTheDocument();
    expect(screen.getByText('extra filter')).toBeInTheDocument();
    fireEvent.click(within(table).getByRole('button', { name: 'Bags' }));
    expect(within(table).getByText('inspection for Bags').closest('td')).toHaveAttribute('colspan', '5');
  });

  it('links Search Console, URL Inspection and Rich Results for the chosen product', async () => {
    getAudit.mockResolvedValue(report);
    render(<SeoClient />);
    const box = await screen.findByRole('region', { name: 'Google Search Console' });
    expect(within(box).getByRole('link', { name: /Open Search Console/ })).toHaveAttribute(
      'href',
      'https://search.google.com/search-console?resource_id=sc-domain%3Aminirueshop.com',
    );
    const product = encodeURIComponent('https://minirueshop.com/shop/bags/linen-tote');
    expect(within(box).getByRole('link', { name: /Inspect URL/ })).toHaveAttribute(
      'href',
      `https://search.google.com/search-console/inspect?resource_id=sc-domain:minirueshop.com&id=${product}`,
    );
    expect(within(box).getByRole('link', { name: /Rich Results Test/ })).toHaveAttribute(
      'href',
      `https://search.google.com/test/rich-results?url=${product}`,
    );
  });
});

describe('SEO link helpers', () => {
  it('builds the deep links from the storefront host, dropping www', () => {
    expect(searchConsoleHref('https://www.minirueshop.com')).toBe(
      'https://search.google.com/search-console?resource_id=sc-domain%3Aminirueshop.com',
    );
    expect(urlInspectionHref('https://minirueshop.com', 'https://minirueshop.com/a?b=1')).toBe(
      'https://search.google.com/search-console/inspect?resource_id=sc-domain:minirueshop.com&id=https%3A%2F%2Fminirueshop.com%2Fa%3Fb%3D1',
    );
    expect(richResultsHref('https://minirueshop.com/x')).toBe(
      'https://search.google.com/test/rich-results?url=https%3A%2F%2Fminirueshop.com%2Fx',
    );
  });

  it('maps each page kind to its dashboard screen', () => {
    const page = (kind: SeoAuditReport['pages'][number]['kind'], url: string) =>
      ({ kind, url, name: 'x', httpStatus: 200, checks: [], score: 0 }) as SeoAuditReport['pages'][number];
    expect(dashboardHrefFor(page('product', 'https://minirueshop.com/shop/bags/linen-tote/'))).toBe(
      '/catalogue/products/linen-tote/edit',
    );
    expect(dashboardHrefFor(page('category', 'https://minirueshop.com/shop/bags'))).toBe('/catalogue/categories');
    expect(dashboardHrefFor(page('set', 'https://minirueshop.com/sets/summer'))).toBe('/catalogue/bundles');
    expect(dashboardHrefFor(page('home', 'https://minirueshop.com/'))).toBeNull();
  });
});

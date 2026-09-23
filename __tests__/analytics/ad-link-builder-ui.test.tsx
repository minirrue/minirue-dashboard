import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdLinkBuilder from '@/app/dashboard/analytics/_ui/AdLinkBuilder';
import { Harness, shellApi } from './shell-harness';

jest.mock('@/lib/hooks/use-analytics', () => ({
  useCatalogueRoutes: () => ({
    isLoading: false,
    isError: false,
    data: {
      categories: [{ id: 'c1', name: 'Skincare', slug: 'skincare', parentId: null, sortOrder: 0 }],
      products: [{ id: 'p1', name: 'Arencia Retinal Booster Shot', slug: 'arencia-retinal-booster-shot', categoryId: 'c1', status: 'PUBLISHED' }],
    },
  }),
}));

const writeText = jest.fn();

beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
});

function renderBuilder() {
  const api = shellApi([]);
  render(
    <Harness api={api}>
      <AdLinkBuilder routes={null} />
    </Harness>,
  );
  return api;
}

/** The owner's favourite (dashboard#128): it must actually work. */
describe('Build a correct ad link', () => {
  it('offers only the shop’s real pages', () => {
    renderBuilder();
    const options = Array.from((screen.getByLabelText('Landing page') as HTMLSelectElement).options).map((o) => o.value);
    expect(options).toEqual(['/', '/shop', '/shop/all', '/shop/skincare', '/shop/skincare/arencia-retinal-booster-shot']);
  });

  it('needs a campaign name before it will copy', () => {
    renderBuilder();
    expect(screen.getByText('Add a campaign name to build the link.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeDisabled();
    expect(screen.queryByRole('link', { name: /Open landing page/ })).not.toBeInTheDocument();
  });

  it('copies the link and the parameters, opens the real page in a new tab, and reads it back', async () => {
    const api = renderBuilder();
    fireEvent.change(screen.getByLabelText('Platform'), { target: { value: 'meta' } });
    fireEvent.change(screen.getByLabelText('Landing page'), { target: { value: '/shop/skincare/arencia-retinal-booster-shot' } });
    fireEvent.change(screen.getByLabelText('Campaign name (required)'), { target: { value: 'Retinal Launch' } });
    const url =
      'https://minirueshop.com/shop/skincare/arencia-retinal-booster-shot?utm_source={{site_source_name}}&utm_medium=paid&utm_campaign=retinal-launch&utm_id={{campaign.id}}&utm_content={{ad.name}}&utm_term={{adset.name}}';
    expect(screen.getByText(url)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(url));
    await waitFor(() => expect(api.toast).toHaveBeenCalledWith('Link copied'));

    fireEvent.click(screen.getByRole('button', { name: 'Copy URL parameters only' }));
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith(url.split('?')[1]));

    const open = screen.getByRole('link', { name: /Open landing page/ });
    expect(open).toHaveAttribute('href', 'https://minirueshop.com/shop/skincare/arencia-retinal-booster-shot');
    expect(open).toHaveAttribute('target', '_blank');
    expect(open).toHaveAttribute('rel', 'noopener noreferrer');

    expect(screen.getByText('Filed as Facebook or Instagram · Paid ads, totalled under Meta.')).toBeInTheDocument();
    expect(screen.getByText('Credited to campaign “retinal-launch”.')).toBeInTheDocument();
  });

  it('when the clipboard is blocked, it hands over the text to copy by hand', async () => {
    writeText.mockRejectedValue(new Error('denied'));
    renderBuilder();
    fireEvent.change(screen.getByLabelText('Campaign name (required)'), { target: { value: 'eid' } });
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(await screen.findByLabelText('Copy this by hand')).toHaveValue(
      'https://minirueshop.com/?utm_source=tiktok&utm_medium=paid&utm_campaign=eid&utm_id=__CAMPAIGN_ID__&utm_content=__CID_NAME__&utm_term=__AID_NAME__',
    );
  });
});

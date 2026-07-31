/**
 * Task A (2026-07-31, owner: "collab must have also all productiosn sections
 * like minirue").
 *
 * The Add-product form has offered a "Variant details" section since backend
 * 0.41.0. The Edit form did not render it at all, so a partner named
 * Size / 50 ml once at create and could never see or change it again — and the
 * API silently dropped the field even when it was sent (2026-07-31).
 *
 * These pin the section on BOTH collab product forms, and pin that the Edit
 * form actually puts the fields on the wire, which is the half that was
 * missing. Both forms render the same shared editor, so a future change cannot
 * land on one and miss the other.
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import CollabEditProductClient from '@/app/dashboard/collab/products/[id]/edit/CollabEditProductClient';
import VariantFieldsEditor, {
  toCustomValues,
  toVariantFields,
} from '@/components/collab/VariantFieldsEditor';

const mockUpdate = jest.fn().mockResolvedValue({});
const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'prod-1' }),
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/lib/api/collab-portal', () => ({
  apiCollabOverview: jest.fn().mockResolvedValue({ autoPublishProducts: true }),
  apiCollabCategories: jest
    .fn()
    .mockResolvedValue({ data: [{ id: 'cat-1', name: 'Perfumes' }] }),
  apiCollabUpdateProduct: (...args: unknown[]) => mockUpdate(...args),
}));

jest.mock('@/lib/catalog/api', () => ({
  getProduct: jest.fn().mockResolvedValue({
    id: 'prod-1',
    name: 'Nuit Santal',
    description: 'A description',
    status: 'DRAFT',
    categoryId: 'cat-1',
    media: [],
    variants: [
      {
        id: 'var-1',
        stock: 5,
        priceAmount: 1299,
        customValues: { Size: '50 ml' },
      },
    ],
  }),
}));

// MediaSection talks to the gallery/upload stack, which is covered by its own
// tests; this file is about the sections around it.
jest.mock('@/app/dashboard/products/[slug]/edit/MediaSection', () => ({
  __esModule: true,
  default: () => <div data-testid="media-section" />,
}));

describe('VariantFieldsEditor — the shared "Variant details" section', () => {
  it('turns rows into the customValues object, dropping half-filled rows', () => {
    expect(
      toCustomValues([
        { name: 'Size', value: '50 ml' },
        { name: 'Shade', value: '' }, // someone mid-thought, not data
        { name: '', value: 'orphan' }, // an empty key would break the SKU
        { name: '  Concentration  ', value: '  EDP  ' },
      ]),
    ).toEqual({ Size: '50 ml', Concentration: 'EDP' });
  });

  it('turns a saved object back into editable rows', () => {
    expect(toVariantFields({ Size: '50 ml' })).toEqual([
      { name: 'Size', value: '50 ml' },
    ]);
  });

  it('always leaves one blank row so the section is never an empty box', () => {
    expect(toVariantFields(null)).toEqual([{ name: '', value: '' }]);
    expect(toVariantFields({})).toEqual([{ name: '', value: '' }]);
  });

  it('stops offering another row at the 10 the API accepts', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      name: `f${i}`,
      value: `v${i}`,
    }));
    const { rerender } = render(
      <VariantFieldsEditor rows={rows} onChange={jest.fn()} traceId="T" />,
    );
    expect(screen.queryByText('+ Add field')).not.toBeInTheDocument();

    rerender(
      <VariantFieldsEditor rows={rows.slice(0, 9)} onChange={jest.fn()} traceId="T" />,
    );
    expect(screen.getByText('+ Add field')).toBeInTheDocument();
  });
});

describe('collab EDIT product form has every section the add form has', () => {
  beforeEach(() => {
    mockUpdate.mockClear();
    mockPush.mockClear();
  });

  it('renders the Variant details section, pre-filled from the saved variant', async () => {
    render(<CollabEditProductClient />);

    expect(await screen.findByText('Variant details (optional)')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText('Custom field 1 name')).toHaveValue('Size');
    });
    expect(screen.getByLabelText('Custom field 1 value')).toHaveValue('50 ml');
  });

  it('still renders the images section — the same one the admin form uses', async () => {
    render(<CollabEditProductClient />);
    expect(await screen.findByTestId('media-section')).toBeInTheDocument();
  });

  it('sends edited variant fields on save', async () => {
    render(<CollabEditProductClient />);
    await waitFor(() => {
      expect(screen.getByLabelText('Custom field 1 value')).toHaveValue('50 ml');
    });

    fireEvent.change(screen.getByLabelText('Custom field 1 value'), {
      target: { value: '100 ml' },
    });
    fireEvent.click(screen.getByText('Save changes'));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    const [, payload] = mockUpdate.mock.calls[0] as [string, Record<string, unknown>];
    expect(payload.customValues).toEqual({ Size: '100 ml' });
  });

  it('sends an empty object — not an omitted field — when every row is cleared', async () => {
    render(<CollabEditProductClient />);
    await waitFor(() => {
      expect(screen.getByLabelText('Custom field 1 name')).toHaveValue('Size');
    });

    fireEvent.change(screen.getByLabelText('Custom field 1 name'), {
      target: { value: '' },
    });
    fireEvent.change(screen.getByLabelText('Custom field 1 value'), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByText('Save changes'));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    const [, payload] = mockUpdate.mock.calls[0] as [string, Record<string, unknown>];
    // Omitting would mean "leave alone", which is not what clearing every row
    // means. The partner has to be able to say "no fields".
    expect(payload).toHaveProperty('customValues');
    expect(payload.customValues).toEqual({});
  });

  it('never sends a space/collaboratorId — the backend takes it from the session', async () => {
    render(<CollabEditProductClient />);
    await waitFor(() => {
      expect(screen.getByLabelText('Custom field 1 name')).toHaveValue('Size');
    });
    fireEvent.click(screen.getByText('Save changes'));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    const [, payload] = mockUpdate.mock.calls[0] as [string, Record<string, unknown>];
    expect(payload).not.toHaveProperty('collaboratorId');
    expect(payload).not.toHaveProperty('space');
  });
});

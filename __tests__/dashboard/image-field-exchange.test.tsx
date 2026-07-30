import { describe, expect, it, beforeEach } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ImageField from '@/components/dashboard/ImageField';
import type { GalleryItem } from '@/lib/gallery/types';

// ImageField's Exchange control (task-w2.3-brief.md, Part A) calls
// lib/gallery/api's exchangeItem — mocked here so this test never touches
// the network, matching __tests__/dashboard/notification-centre.test.tsx's
// module-mock pattern.
jest.mock('@/lib/gallery/api', () => ({
  exchangeItem: jest.fn(),
}));

// GalleryPickerModal pulls in listFolders() on mount (useMountedEffect) —
// stub the whole component so "Change"/"Choose image" never triggers a real
// network call in a test that isn't exercising the picker.
jest.mock('@/components/dashboard/GalleryPickerModal', () => ({
  __esModule: true,
  default: () => null,
}));

import { exchangeItem } from '@/lib/gallery/api';

function makeItem(over: Partial<GalleryItem> = {}): GalleryItem {
  return {
    id: 'item-1',
    folderId: 'folder-1',
    kind: 'image',
    url: 'https://storage.example/new.webp',
    mimeType: 'image/webp',
    width: 400,
    height: 400,
    durationSeconds: null,
    altText: null,
    createdAt: new Date().toISOString(),
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ImageField — Exchange', () => {
  it('offers Exchange when there is both an image and a known mediaId', () => {
    render(
      <ImageField
        imageUrl="https://storage.example/current.webp"
        mediaId="item-1"
        onChange={jest.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /exchange/i })).toBeInTheDocument();
  });

  it('does NOT offer Exchange when there is an image but no mediaId (nothing to PATCH)', () => {
    render(
      <ImageField imageUrl="https://storage.example/current.webp" onChange={jest.fn()} />,
    );
    expect(screen.queryByRole('button', { name: /exchange/i })).toBeNull();
  });

  it('does NOT offer Exchange when there is no image yet', () => {
    render(<ImageField imageUrl={null} mediaId="item-1" onChange={jest.fn()} />);
    expect(screen.queryByRole('button', { name: /exchange/i })).toBeNull();
  });

  it('picking a replacement file calls exchangeItem with the SAME mediaId and reports the new item back through onChange', async () => {
    (exchangeItem as jest.Mock).mockResolvedValue(
      makeItem({ url: 'https://storage.example/replaced.webp' }),
    );
    const onChange = jest.fn();
    const { container } = render(
      <ImageField imageUrl="https://storage.example/current.webp" mediaId="item-1" onChange={onChange} />,
    );

    const user = userEvent.setup();
    const file = new File(['bytes'], 'new.png', { type: 'image/png' });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);

    await waitFor(() => expect(exchangeItem).toHaveBeenCalledWith('item-1', file));
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(
        'item-1',
        expect.objectContaining({ url: 'https://storage.example/replaced.webp' }),
      ),
    );
  });

  it('shows an inline error and never calls onChange when the exchange fails', async () => {
    (exchangeItem as jest.Mock).mockRejectedValue({ message: 'File exceeds the 10MB limit' });
    const onChange = jest.fn();
    const { container } = render(
      <ImageField imageUrl="https://storage.example/current.webp" mediaId="item-1" onChange={onChange} />,
    );

    const user = userEvent.setup();
    const file = new File(['bytes'], 'too-big.png', { type: 'image/png' });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);

    expect(await screen.findByText(/File exceeds the 10MB limit/)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});

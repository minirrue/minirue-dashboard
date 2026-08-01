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

// The owner's rule is every upload — including a replace — goes through the
// crop step. Mock the crop provider's hook directly (rather than relying on
// its outside-a-provider passthrough) so these tests can prove Exchange
// actually calls it, with what aspect and title, before exchangeItem ever
// runs — not just that the upload eventually happens.
const mockCropImage = jest.fn();
jest.mock('@/components/dashboard/ImageCropProvider', () => ({
  __esModule: true,
  useImageCrop: () => mockCropImage,
}));

import { exchangeItem } from '@/lib/gallery/api';

function makeItem(over: Partial<GalleryItem> = {}): GalleryItem {
  return {
    id: 'item-1',
    folderId: 'folder-1',
    kind: 'image',
    posterUrl: null,
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
  // Default: crop resolves to the same file it was given, i.e. "the admin
  // didn't cancel". Individual tests override this to prove call order/args
  // or to simulate a cancelled crop.
  mockCropImage.mockImplementation((file: File) => Promise.resolve(file));
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
    // Third argument (2026-07-31): the bytes that were just uploaded, so the
    // SCREEN AROUND this field — a category row's own thumbnail, a brand tile
    // — can render the replacement locally instead of racing the same
    // guaranteed-cold-miss URL this field's tile already avoids. See
    // __tests__/dashboard/replaced-image-recovers.test.tsx.
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(
        'item-1',
        expect.objectContaining({ url: 'https://storage.example/replaced.webp' }),
        file,
      ),
    );
  });

  // Regression test for the defect this task closes: Exchange used to call
  // exchangeItem directly, skipping the crop step that every "add a new
  // image" path already goes through — same picture, two different
  // behaviours depending on which button was pressed.
  it('crops the replacement file through the shared crop step BEFORE calling exchangeItem, with a square aspect by default', async () => {
    (exchangeItem as jest.Mock).mockResolvedValue(makeItem());
    const callOrder: string[] = [];
    mockCropImage.mockImplementation((file: File) => {
      callOrder.push('crop');
      return Promise.resolve(file);
    });
    (exchangeItem as jest.Mock).mockImplementation(() => {
      callOrder.push('exchangeItem');
      return Promise.resolve(makeItem());
    });

    const { container } = render(
      <ImageField imageUrl="https://storage.example/current.webp" mediaId="item-1" onChange={jest.fn()} />,
    );

    const user = userEvent.setup();
    const file = new File(['bytes'], 'new.png', { type: 'image/png' });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);

    await waitFor(() => expect(exchangeItem).toHaveBeenCalled());
    expect(mockCropImage).toHaveBeenCalledWith(
      file,
      expect.objectContaining({ initialAspect: 1 }),
    );
    expect(callOrder).toEqual(['crop', 'exchangeItem']);
  });

  it('crops to a caller-supplied aspect ratio instead of the 1:1 default when given one', async () => {
    (exchangeItem as jest.Mock).mockResolvedValue(makeItem());
    const { container } = render(
      <ImageField
        imageUrl="https://storage.example/current.webp"
        mediaId="item-1"
        onChange={jest.fn()}
        aspectRatio={4 / 5}
      />,
    );

    const user = userEvent.setup();
    const file = new File(['bytes'], 'new.png', { type: 'image/png' });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);

    await waitFor(() =>
      expect(mockCropImage).toHaveBeenCalledWith(file, expect.objectContaining({ initialAspect: 4 / 5 })),
    );
  });

  it('uploads the CROPPED file, not the original, to exchangeItem', async () => {
    (exchangeItem as jest.Mock).mockResolvedValue(makeItem());
    const croppedFile = new File(['cropped-bytes'], 'new-cropped.jpg', { type: 'image/jpeg' });
    mockCropImage.mockResolvedValue(croppedFile);

    const { container } = render(
      <ImageField imageUrl="https://storage.example/current.webp" mediaId="item-1" onChange={jest.fn()} />,
    );

    const user = userEvent.setup();
    const file = new File(['bytes'], 'new.png', { type: 'image/png' });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);

    await waitFor(() => expect(exchangeItem).toHaveBeenCalledWith('item-1', croppedFile));
  });

  it('cancelling the crop (crop step resolves null) never calls exchangeItem', async () => {
    mockCropImage.mockResolvedValue(null);
    const onChange = jest.fn();
    const { container } = render(
      <ImageField imageUrl="https://storage.example/current.webp" mediaId="item-1" onChange={onChange} />,
    );

    const user = userEvent.setup();
    const file = new File(['bytes'], 'new.png', { type: 'image/png' });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);

    await waitFor(() => expect(mockCropImage).toHaveBeenCalled());
    expect(exchangeItem).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
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

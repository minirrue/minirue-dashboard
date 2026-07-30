import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NewCategoryForm from '@/app/dashboard/categories/NewCategoryForm';
import { uploadDeviceFileToGallery } from '@/components/dashboard/GalleryPickerModal';
import type { GalleryItem } from '@/lib/gallery/types';

/**
 * The owner's words: a category with no image is a prohibited business rule.
 * These pin that Create stays disabled until a picture is attached, and that
 * attaching one (via the device-upload + crop path — the crop step itself is
 * a passthrough outside <ImageCropProvider>, see ImageCropProvider.tsx) turns
 * it on.
 */

jest.mock('@/components/dashboard/GalleryPickerModal', () => ({
  __esModule: true,
  // Never opened in these tests (that requires clicking "Choose image", which
  // these tests don't) — a stub keeps ImageField's own import satisfied.
  default: () => null,
  uploadDeviceFileToGallery: jest.fn(),
}));

const mockedUpload = uploadDeviceFileToGallery as jest.MockedFunction<
  typeof uploadDeviceFileToGallery
>;

function makeGalleryItem(overrides: Partial<GalleryItem> = {}): GalleryItem {
  return {
    id: 'gal_1',
    folderId: 'folder_1',
    kind: 'image',
    url: 'https://img.minirueshop.com/gal_1.jpg',
    mimeType: 'image/jpeg',
    width: 480,
    height: 480,
    durationSeconds: null,
    altText: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

async function openForm() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /add category/i }));
}

async function attachImage() {
  const user = userEvent.setup();
  const file = new File(['x'], 'jewellery.jpg', { type: 'image/jpeg' });
  // Two hidden file inputs exist in this tree: ImageField's own "Exchange"
  // input (first, inert with no mediaId set yet) and NewCategoryForm's
  // "Upload from this device" input (last).
  const inputs = document.querySelectorAll('input[type="file"]');
  const input = inputs[inputs.length - 1] as HTMLInputElement;
  await user.upload(input, file);
  await waitFor(() => expect(mockedUpload).toHaveBeenCalled());
}

describe('NewCategoryForm — mandatory image', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUpload.mockResolvedValue(makeGalleryItem());
  });

  it('will not create a category without an image', async () => {
    const user = userEvent.setup();
    render(
      <NewCategoryForm
        parentOptions={[]}
        traceId="TEST-CAT"
        onCreate={jest.fn()}
        onCreated={jest.fn()}
      />,
    );
    await openForm();
    await user.type(screen.getByLabelText(/name/i), 'Jewellery');
    expect(screen.getByRole('button', { name: /create category/i })).toBeDisabled();
  });

  it('enables create once an image is attached', async () => {
    const user = userEvent.setup();
    render(
      <NewCategoryForm
        parentOptions={[]}
        traceId="TEST-CAT"
        onCreate={jest.fn()}
        onCreated={jest.fn()}
      />,
    );
    await openForm();
    await user.type(screen.getByLabelText(/name/i), 'Jewellery');
    await attachImage();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /create category/i })).toBeEnabled(),
    );
  });

  it('sends the attached image on submit and clears the form', async () => {
    const user = userEvent.setup();
    const onCreate = jest.fn().mockResolvedValue({ id: 'cat_1' });
    const onCreated = jest.fn();
    render(
      <NewCategoryForm
        parentOptions={[]}
        traceId="TEST-CAT"
        onCreate={onCreate}
        onCreated={onCreated}
      />,
    );
    await openForm();
    await user.type(screen.getByLabelText(/name/i), 'Jewellery');
    await attachImage();
    fireEvent.click(screen.getByRole('button', { name: /create category/i }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Jewellery', imageMediaId: 'gal_1' }),
    ));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
  });
});

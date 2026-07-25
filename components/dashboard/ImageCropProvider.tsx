'use client';

import React from 'react';
import ImageCropModal from './ImageCropModal';

/**
 * App-wide crop step for image uploads.
 *
 * Every place that uploads a picture — Gallery, product photos, hero slides,
 * journal art, a collaborator's logo — calls `cropImage(file)` and uploads what
 * comes back. One modal instance lives here, so the crop UI, its aspect presets
 * and the free-crop behaviour are identical everywhere and for every role
 * (admin, super admin, collaborator).
 *
 * Deliberately NOT applied to document-style uploads (support attachments,
 * refund evidence, manual-order receipts): cropping there would let someone
 * trim information out of a record.
 */
export interface CropRequest {
  /** Aspect to open on. Omit for a free crop. */
  initialAspect?: number;
  title?: string;
}

type CropImage = (file: File, request?: CropRequest) => Promise<File | null>;

const ImageCropContext = React.createContext<CropImage | null>(null);

/**
 * Returns a `cropImage(file)` that resolves to the cropped File, or null when
 * the user cancels. Outside the provider it resolves to the original file
 * untouched, so an un-wrapped screen still uploads rather than breaking.
 */
export function useImageCrop(): CropImage {
  const ctx = React.useContext(ImageCropContext);
  return React.useMemo<CropImage>(
    () => ctx ?? ((file: File) => Promise.resolve(file)),
    [ctx],
  );
}

interface PendingCrop {
  file: File;
  request?: CropRequest;
  resolve: (file: File | null) => void;
}

export default function ImageCropProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [pending, setPending] = React.useState<PendingCrop | null>(null);

  const cropImage = React.useCallback<CropImage>((file, request) => {
    // Videos and anything non-image pass straight through — the cropper draws
    // to a canvas and would produce a broken still frame.
    if (!file.type.startsWith('image/')) return Promise.resolve(file);
    return new Promise<File | null>((resolve) => {
      setPending({ file, request, resolve });
    });
  }, []);

  const finish = React.useCallback(
    (result: File | null) => {
      pending?.resolve(result);
      setPending(null);
    },
    [pending],
  );

  return (
    <ImageCropContext.Provider value={cropImage}>
      {children}
      {pending && (
        <ImageCropModal
          file={pending.file}
          title={pending.request?.title ?? 'Crop image'}
          initialAspect={pending.request?.initialAspect}
          onCancel={() => finish(null)}
          onCropped={(blob, sourceName) => {
            const ext = blob.type === 'image/png' ? 'png' : 'jpg';
            const base = sourceName.replace(/\.[^.]+$/, '');
            finish(new File([blob], `${base}-cropped.${ext}`, { type: blob.type }));
          }}
        />
      )}
    </ImageCropContext.Provider>
  );
}

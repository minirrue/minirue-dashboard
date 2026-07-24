'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  type Crop,
  type PixelCrop,
  type ReactCropProps,
} from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

// react-image-crop is typed against React 18's JSX; under React 19's stricter
// JSX namespace the default export isn't seen as a component. Re-type it.
const Cropper = ReactCrop as unknown as React.ComponentType<ReactCropProps>;

/**
 * Reusable image cropper. Takes a device-picked File (same-origin object URL, so
 * the canvas is never tainted), lets the admin free-crop or snap to a preset
 * aspect, and returns a cropped Blob the caller uploads. Built to be dropped in
 * front of every image uploader in the dashboard (RULEBOOK: crop everywhere).
 */

export interface CropPreset {
  label: string;
  aspect: number | undefined; // undefined = free
}

export const CROP_PRESETS: CropPreset[] = [
  { label: 'Free', aspect: undefined },
  { label: 'Landscape 16:9', aspect: 16 / 9 },
  { label: 'Portrait 3:4', aspect: 3 / 4 },
  { label: 'Square 1:1', aspect: 1 },
];

function centeredCrop(width: number, height: number, aspect?: number): Crop {
  if (aspect) {
    return centerCrop(
      makeAspectCrop({ unit: '%', width: 90 }, aspect, width, height),
      width,
      height,
    );
  }
  return centerCrop({ unit: '%', width: 90, height: 90 }, width, height);
}

async function toCroppedBlob(
  image: HTMLImageElement,
  crop: PixelCrop,
  mimeType: string,
): Promise<Blob> {
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(crop.width * scaleX));
  canvas.height = Math.max(1, Math.round(crop.height * scaleY));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get a drawing context.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  // Keep PNGs lossless; everything else re-encodes to JPEG at high quality.
  const outType = mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Cropping failed.'))),
      outType,
      0.92,
    );
  });
}

export interface ImageCropModalProps {
  file: File;
  title?: string;
  /** Preset aspect to start on (e.g. 16/9 for a desktop hero, 3/4 for mobile). */
  initialAspect?: number | undefined;
  onCancel: () => void;
  onCropped: (blob: Blob, sourceName: string) => void;
}

export default function ImageCropModal({
  file,
  title = 'Crop image',
  initialAspect,
  onCancel,
  onCropped,
}: ImageCropModalProps) {
  const [src, setSrc] = useState<string>('');
  const [crop, setCrop] = useState<Crop>();
  const [completed, setCompleted] = useState<PixelCrop | null>(null);
  const [aspect, setAspect] = useState<number | undefined>(initialAspect);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const { width, height } = e.currentTarget;
      setCrop(centeredCrop(width, height, aspect));
    },
    [aspect],
  );

  const applyPreset = (preset: CropPreset) => {
    setAspect(preset.aspect);
    const img = imgRef.current;
    if (img) setCrop(centeredCrop(img.width, img.height, preset.aspect));
  };

  const handleApply = async () => {
    const img = imgRef.current;
    if (!img || !completed || completed.width === 0 || completed.height === 0) {
      setError('Draw a crop area first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const blob = await toCroppedBlob(img, completed, file.type);
      onCropped(blob, file.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cropping failed.');
      setBusy(false);
    }
  };

  return (
    <div className="dash-dialog-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="dash-dialog" style={{ maxWidth: 560, width: '92%' }}>
        <h2 className="dash-card-title" style={{ margin: 0 }}>{title}</h2>

        <div className="dash-tabstrip" style={{ marginBottom: 4 }}>
          {CROP_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className="dash-btn-ghost"
              data-active={aspect === preset.aspect ? 'true' : undefined}
              style={
                aspect === preset.aspect
                  ? { background: 'var(--mr-dash-sub)', color: 'var(--mr-fg)' }
                  : undefined
              }
              onClick={() => applyPreset(preset)}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            background: 'var(--mr-dash-sub)',
            borderRadius: 'var(--mr-radius-md)',
            padding: 8,
            maxHeight: '60vh',
            overflow: 'auto',
          }}
        >
          {src && (
            <Cropper
              crop={crop}
              onChange={(_: PixelCrop, percentCrop: Crop) => setCrop(percentCrop)}
              onComplete={(c: PixelCrop) => setCompleted(c)}
              aspect={aspect}
              keepSelection
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={src}
                alt="Crop preview"
                onLoad={onImageLoad}
                style={{ maxHeight: '56vh', display: 'block' }}
              />
            </Cropper>
          )}
        </div>

        {error && <p className="dash-inline-error">{error}</p>}

        <div className="dash-form-actions" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="dash-btn-ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="dash-btn-primary" onClick={handleApply} disabled={busy}>
            {busy ? 'Cropping…' : 'Use this crop'}
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';



import { FormEvent, useEffect, useRef, useState } from 'react';

import {

  CollabErrorPanel,

  CollabLoadingBlock,

  CollabPageHeader,

} from '@/components/collab/collab-ui';

import { EnlargeableImage } from '@/components/dashboard/ImagePreviewModal';

import { GenericAvatarIcon } from '@/components/GenericAvatarIcon';

import {

  apiCollabGetBrand,

  apiCollabUpdateBrand,

  apiCollabUploadLogo,

  type CollabBrand,

} from '@/lib/api/collab-portal';

import type { ApiError } from '@/lib/api/client';
import { useImageCrop } from '@/components/dashboard/ImageCropProvider';
import { useQueryClient } from '@tanstack/react-query';
import { useUser } from '@/lib/hooks/use-auth';
import { apiUploadMyAvatar } from '@/lib/api/auth';



export default function CollabBrandClient() {

  const [brand, setBrand] = useState<CollabBrand | null>(null);

  const [displayName, setDisplayName] = useState('');

  const [description, setDescription] = useState('');

  const [error, setError] = useState<string | null>(null);

  const [saved, setSaved] = useState(false);

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [logoUploading, setLogoUploading] = useState(false);

  const [logoPreviewOpen, setLogoPreviewOpen] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  // Task 17: a collaborator's PERSONAL avatar, separate from their brand's
  // logo above. The logo is their brand identity (storefront-facing); the
  // avatar is them (support-conversation-facing) — a collaborator ends up
  // with both, reusing the same `/auth/me/avatar` upload path the admin
  // Profile card uses (SettingsClient.tsx's handleAvatarChange).
  const { data: user } = useUser();
  const queryClient = useQueryClient();
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false);
  const avatarFileRef = useRef<HTMLInputElement>(null);
  // Task FF (2026-07-30), hardened 2026-07-31: cropped bytes for an
  // avatar/logo just uploaded THIS session, so each tile renders locally
  // instead of a guaranteed-cold-miss remote fetch — see UploadPreviewImage.
  // `uploadedAvatarUrl`/`uploadedLogoUrl` are the URLs OUR OWN uploads just
  // produced, tracked in state as a fallback `src` — see ProfileForm.tsx
  // (storefront) for the component test that proved gating render solely on
  // the query-derived `user`/`brand` value can, if that value lags even one
  // render behind the upload, discard local bytes and show the generic
  // icon/placeholder over a photo that really did arrive.
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [uploadedAvatarUrl, setUploadedAvatarUrl] = useState<string | null>(null);
  const [uploadedLogoUrl, setUploadedLogoUrl] = useState<string | null>(null);



  // Only clear on a CONFLICTING truthy value — never merely because the
  // query-derived value hasn't caught up to ours yet, which would silently
  // reproduce the "upload succeeded, still shows the placeholder" bug.
  useEffect(() => {
    if (uploadedAvatarUrl !== null && user?.avatarUrl && user.avatarUrl !== uploadedAvatarUrl) {
      setPendingAvatarFile(null);
      setUploadedAvatarUrl(null);
    }
  }, [user?.avatarUrl, uploadedAvatarUrl]);

  useEffect(() => {
    if (uploadedLogoUrl !== null && brand?.logoUrl && brand.logoUrl !== uploadedLogoUrl) {
      setPendingLogoFile(null);
      setUploadedLogoUrl(null);
    }
  }, [brand?.logoUrl, uploadedLogoUrl]);

  const avatarSrc = user?.avatarUrl ?? uploadedAvatarUrl;
  const logoSrc = brand?.logoUrl ?? uploadedLogoUrl;

  useEffect(() => {

    apiCollabGetBrand()

      .then((b) => {

        setBrand(b);

        setDisplayName(b.displayName);

        setDescription(b.description ?? '');

      })

      .catch((err: ApiError) => setError(err.message || 'Failed to load brand'))

      .finally(() => setLoading(false));

  }, []);



  const onSave = async (e: FormEvent) => {

    e.preventDefault();

    setSaving(true);

    setError(null);

    setSaved(false);

    try {

      const updated = await apiCollabUpdateBrand({

        displayName,

        description: description || null,

      });

      setBrand(updated);

      setSaved(true);

    } catch (err) {

      const apiErr = err as ApiError;

      setError(apiErr.message || 'Failed to save');

    } finally {

      setSaving(false);

    }

  };



  const cropImage = useImageCrop();

  // "Exchange" for the collaborator logo (task-w2.3-brief.md, Part A) is a
  // labelling change over what was already here — POST /collab/brand/logo
  // has always overwritten by key. What changed is the backend's key itself:
  // it now suffixes a uuid and deletes the old object
  // (collab-brand.service.ts's uploadLogo), because the fixed key
  // `collaborators/{id}/logo.{ext}` this used to be served the STALE logo
  // for up to 30 days through imgproxy's nginx cache, which has no
  // query-string cache-buster. Same click here, but the new logo now
  // actually appears.
  const onLogo = async (rawFile: File) => {

    setError(null);

    // A brand logo is square on the storefront, so the cropper opens on 1:1 —
    // the collaborator can still switch to a free crop or any other ratio.
    const file = await cropImage(rawFile, { title: 'Crop brand logo', initialAspect: 1 });

    if (!file) return;

    setLogoUploading(true);

    const buf = await file.arrayBuffer();

    const bytes = new Uint8Array(buf);

    let binary = '';

    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);

    const dataBase64 = btoa(binary);

    try {

      const updated = await apiCollabUploadLogo(file.type, dataBase64);

      setBrand(updated);

      setUploadedLogoUrl(updated.logoUrl ?? null);

      setPendingLogoFile(file);

    } catch (err) {

      const apiErr = err as ApiError;

      setError(apiErr.message || 'Logo upload failed');

    } finally {

      setLogoUploading(false);

    }

  };



  const onAvatar = async (rawFile: File) => {

    setAvatarError(null);

    // Same crop step as the admin Profile card — avatars render as a circle,
    // so the cropper opens 1:1, and the collaborator can still switch ratios.
    const file = await cropImage(rawFile, { title: 'Crop your photo', initialAspect: 1 });

    if (!file) return;

    setAvatarUploading(true);

    try {

      const updated = await apiUploadMyAvatar(file);

      queryClient.setQueryData(['auth', 'me'], updated);

      setUploadedAvatarUrl(updated.avatarUrl ?? null);

      setPendingAvatarFile(file);

    } catch (err) {

      const apiErr = err as ApiError;

      setAvatarError(apiErr.message || 'Avatar upload failed');

    } finally {

      setAvatarUploading(false);

    }

  };



  if (loading)
    return <CollabLoadingBlock traceId="PG-DASHBOARD-COLLAB-003::EL-REGION-brand-loading" />;



  if (error && !brand) {

    return <CollabErrorPanel message={error} traceId="PG-DASHBOARD-COLLAB-003::EL-REGION-brand-error" />;

  }



  const profileIncomplete = !displayName.trim();



  return (

    <>

      <CollabPageHeader

        title="Brand profile"

        subtitle="How your brand appears on MiniRue and your partner portal."

      />



      {profileIncomplete ? (

        <div
          className="dash-role-notice collab-profile-gate"
          data-trace-id="PG-DASHBOARD-COLLAB-003::EL-REGION-brand-profile-gate"
        >

          Add a display name before you can create products.

        </div>

      ) : null}



      <form
        className="dash-form-card collab-brand-form"
        onSubmit={onSave}
        data-trace-id="PG-DASHBOARD-COLLAB-003::EL-FORM-brand-form"
      >

        {/* Task 17: a collaborator's own avatar, distinct from the brand logo
            below — the avatar is them (it follows them into support
            conversations); the logo is their brand's storefront mark. */}
        <p className="dash-label" data-trace-id="PG-DASHBOARD-COLLAB-003::EL-REGION-avatar-label">
          Your avatar
        </p>

        <div
          className="collab-brand-logo-row"
          data-trace-id="PG-DASHBOARD-COLLAB-003::EL-REGION-avatar-display"
        >

          <div className="collab-brand-logo-wrap">

            {avatarSrc ? (

              <EnlargeableImage

                src={avatarSrc}

                localFile={pendingAvatarFile}

                alt="Your avatar"

                className="collab-brand-logo collab-avatar"

                previewOpen={avatarPreviewOpen}

                onOpenPreview={() => setAvatarPreviewOpen(true)}

                onClosePreview={() => setAvatarPreviewOpen(false)}

                traceId="PG-DASHBOARD-COLLAB-003::EL-BTN-enlarge-avatar"

              />

            ) : (

              <div className="collab-brand-logo collab-avatar collab-brand-logo--placeholder" aria-hidden>

                <GenericAvatarIcon size="55%" />

              </div>

            )}

            {avatarUploading && (

              <div
                className="collab-brand-logo-uploading"
                role="status"
                aria-label="Uploading avatar"
                data-trace-id="PG-DASHBOARD-COLLAB-003::EL-REGION-avatar-uploading"
              >
                <span aria-hidden="true" className="collab-brand-logo-spinner" />
              </div>

            )}

          </div>

          <div>

            <button

              type="button"

              className="dash-btn-secondary"

              onClick={() => avatarFileRef.current?.click()}

              disabled={avatarUploading}

              data-trace-id="PG-DASHBOARD-COLLAB-003::EL-BTN-upload-avatar"

            >

              {avatarUploading ? 'Uploading…' : avatarSrc ? 'Exchange avatar' : 'Upload avatar'}

            </button>

            <input

              ref={avatarFileRef}

              type="file"

              accept="image/*"

              hidden

              onChange={(e) => {

                const f = e.target.files?.[0];

                if (f) void onAvatar(f);

              }}

              data-trace-id="PG-DASHBOARD-COLLAB-003::EL-INPUT-avatar-file"

            />

          </div>

        </div>

        {avatarError ? (
          <p
            className="dash-inline-error"
            data-trace-id="PG-DASHBOARD-COLLAB-003::EL-REGION-avatar-inline-error"
          >
            {avatarError}
          </p>
        ) : null}

        <p className="dash-label" data-trace-id="PG-DASHBOARD-COLLAB-003::EL-REGION-brand-logo-label">
          Brand logo
        </p>

        <div
          className="collab-brand-logo-row"
          data-trace-id="PG-DASHBOARD-COLLAB-003::EL-REGION-brand-logo-display"
        >

          <div className="collab-brand-logo-wrap">

            {logoSrc ? (

              <EnlargeableImage

                src={logoSrc}

                localFile={pendingLogoFile}

                alt={displayName ? `${displayName} logo` : 'Brand logo'}

                className="collab-brand-logo"

                previewOpen={logoPreviewOpen}

                onOpenPreview={() => setLogoPreviewOpen(true)}

                onClosePreview={() => setLogoPreviewOpen(false)}

                traceId="PG-DASHBOARD-COLLAB-003::EL-BTN-enlarge-brand-logo"

              />

            ) : (

              <div className="collab-brand-logo collab-brand-logo--placeholder" aria-hidden>

                <GenericAvatarIcon size="55%" />

              </div>

            )}

            {logoUploading && (

              <div
                className="collab-brand-logo-uploading"
                role="status"
                aria-label="Uploading logo"
                data-trace-id="PG-DASHBOARD-COLLAB-003::EL-REGION-brand-logo-uploading"
              >
                <span aria-hidden="true" className="collab-brand-logo-spinner" />
              </div>

            )}

          </div>

          <div>

            <button

              type="button"

              className="dash-btn-secondary"

              onClick={() => fileRef.current?.click()}

              disabled={logoUploading}

              data-trace-id="PG-DASHBOARD-COLLAB-003::EL-BTN-brand-upload-logo"

            >

              {logoUploading ? 'Uploading…' : logoSrc ? 'Exchange logo' : 'Upload logo'}

            </button>

            <input

              ref={fileRef}

              type="file"

              accept="image/*"

              hidden

              onChange={(e) => {

                const f = e.target.files?.[0];

                if (f) void onLogo(f);

              }}

              data-trace-id="PG-DASHBOARD-COLLAB-003::EL-INPUT-brand-logo-file"

            />

          </div>

        </div>



        <div className="dash-field">

          <label className="dash-label" htmlFor="brand-display">

            Display name

          </label>

          <input

            id="brand-display"

            className="dash-input"

            value={displayName}

            onChange={(e) => setDisplayName(e.target.value)}

            required

            data-trace-id="PG-DASHBOARD-COLLAB-003::EL-INPUT-brand-display-name"

          />

        </div>

        <div className="dash-field">

          <label className="dash-label" htmlFor="brand-desc">

            Description

          </label>

          <textarea

            id="brand-desc"

            className="dash-input"

            rows={4}

            value={description}

            onChange={(e) => setDescription(e.target.value)}

            data-trace-id="PG-DASHBOARD-COLLAB-003::EL-INPUT-brand-description"

          />

        </div>

        <p className="dash-label" data-trace-id="PG-DASHBOARD-COLLAB-003::EL-REGION-brand-storefront-url">

          Storefront{' '}

          {/* Root-level, not /brands/<slug> — there is a brands listing page but
              no child route under it, so the old text pointed at a dead URL. */}
          <code className="collab-slug-code">/{brand?.brandSlug}</code>

        </p>



        {error ? (
          <p
            className="dash-inline-error"
            data-trace-id="PG-DASHBOARD-COLLAB-003::EL-REGION-brand-inline-error"
          >
            {error}
          </p>
        ) : null}

        {saved ? (
          <p
            className="collab-save-ok"
            role="status"
            aria-live="polite"
            data-trace-id="PG-DASHBOARD-COLLAB-003::EL-REGION-brand-save-confirmation"
          >
            Changes saved.
          </p>
        ) : null}



        <div className="dash-form-actions">

          <button
            type="submit"
            className="dash-btn-primary"
            disabled={saving}
            data-trace-id="PG-DASHBOARD-COLLAB-003::EL-BTN-brand-save"
          >

            {saving ? 'Saving…' : 'Save changes'}

          </button>

        </div>

      </form>

    </>

  );

}


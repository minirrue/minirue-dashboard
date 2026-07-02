'use client';



import { FormEvent, useEffect, useRef, useState } from 'react';

import {

  CollabErrorPanel,

  CollabLoadingBlock,

  CollabPageHeader,

} from '@/components/collab/collab-ui';

import {

  apiCollabGetBrand,

  apiCollabUpdateBrand,

  apiCollabUploadLogo,

  type CollabBrand,

} from '@/lib/api/collab-portal';

import type { ApiError } from '@/lib/api/client';



export default function CollabBrandClient() {

  const [brand, setBrand] = useState<CollabBrand | null>(null);

  const [displayName, setDisplayName] = useState('');

  const [description, setDescription] = useState('');

  const [error, setError] = useState<string | null>(null);

  const [saved, setSaved] = useState(false);

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);



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



  const onLogo = async (file: File) => {

    setError(null);

    const buf = await file.arrayBuffer();

    const bytes = new Uint8Array(buf);

    let binary = '';

    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);

    const dataBase64 = btoa(binary);

    try {

      const updated = await apiCollabUploadLogo(file.type, dataBase64);

      setBrand(updated);

    } catch (err) {

      const apiErr = err as ApiError;

      setError(apiErr.message || 'Logo upload failed');

    }

  };



  if (loading) return <CollabLoadingBlock />;



  if (error && !brand) {

    return <CollabErrorPanel message={error} />;

  }



  const profileIncomplete = !displayName.trim();



  return (

    <>

      <CollabPageHeader

        title="Brand profile"

        subtitle="How your brand appears on MiniRue and your partner portal."

      />



      {profileIncomplete ? (

        <div className="dash-role-notice collab-profile-gate">

          Add a display name before you can create products.

        </div>

      ) : null}



      <form className="dash-form-card collab-brand-form" onSubmit={onSave}>

        <div className="collab-brand-logo-row">

          {brand?.logoUrl ? (

            <img

              src={brand.logoUrl}

              alt={displayName ? `${displayName} logo` : 'Brand logo'}

              className="collab-brand-logo"

              width={80}

              height={80}

            />

          ) : (

            <div className="collab-brand-logo collab-brand-logo--placeholder" aria-hidden>

              {displayName.charAt(0).toUpperCase() || '?'}

            </div>

          )}

          <div>

            <button

              type="button"

              className="dash-btn-secondary"

              onClick={() => fileRef.current?.click()}

            >

              Upload logo

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

          />

        </div>

        <p className="dash-label">

          Storefront{' '}

          <code className="collab-slug-code">/brands/{brand?.brandSlug}</code>

        </p>



        {error ? <p className="dash-inline-error">{error}</p> : null}

        {saved ? (
          <p className="collab-save-ok" role="status" aria-live="polite">
            Changes saved.
          </p>
        ) : null}



        <div className="dash-form-actions">

          <button type="submit" className="dash-btn-primary" disabled={saving}>

            {saving ? 'Saving…' : 'Save changes'}

          </button>

        </div>

      </form>

    </>

  );

}


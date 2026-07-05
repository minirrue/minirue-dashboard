'use client';



import Link from 'next/link';

import { useRouter } from 'next/navigation';

import { FormEvent, useState } from 'react';

import {

  apiCreateCollaborator,

  type CollaboratorModule,

} from '@/lib/api/collaborators';

import type { ApiError } from '@/lib/api/client';



const MODULE_OPTIONS: Array<{ value: CollaboratorModule; label: string }> = [

  { value: 'ORDERS', label: 'Orders' },

  { value: 'PRODUCTS', label: 'Products' },

  { value: 'ANALYTICS', label: 'Analytics' },

];



type ProvisionMode = 'invite' | 'direct';



function slugify(value: string): string {

  return value

    .toLowerCase()

    .trim()

    .replace(/[^a-z0-9]+/g, '-')

    .replace(/^-+|-+$/g, '');

}



export default function ProvisionCollaboratorClient() {

  const router = useRouter();

  const [creating, setCreating] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<ProvisionMode>('invite');

  const [form, setForm] = useState({

    email: '',

    brandName: '',

    brandSlug: '',

    password: '',

    modules: ['PRODUCTS'] as CollaboratorModule[],

  });



  function toggleModule(mod: CollaboratorModule) {

    setForm((prev) => {

      const has = prev.modules.includes(mod);

      const modules = has ? prev.modules.filter((m) => m !== mod) : [...prev.modules, mod];

      return { ...prev, modules: modules.length ? modules : [mod] };

    });

  }



  async function onSubmit(e: FormEvent) {

    e.preventDefault();

    setError(null);

    if (mode === 'direct' && form.password.length < 8) {

      setError('Password must be at least 8 characters for direct create.');

      return;

    }

    setCreating(true);

    try {

      const brandSlug = form.brandSlug.trim() || slugify(form.brandName);

      await apiCreateCollaborator({

        email: form.email.trim(),

        brandName: form.brandName.trim(),

        brandSlug,

        modules: form.modules,

        inviteByEmail: mode === 'invite',

        password: mode === 'direct' ? form.password : undefined,

      });

      router.push('/collaborators');

    } catch (err) {

      const apiErr = err as ApiError;

      setError(apiErr.message || 'Failed to create collaborator');

    } finally {

      setCreating(false);

    }

  }



  return (

    <>

      <div className="dash-page-header">

        <div>

          <h1 className="dash-page-title">New collaborator</h1>

          <p className="dash-page-subtitle">

            Provision a brand partner — send an invite or set a password now.

          </p>

        </div>

        <Link href="/collaborators" className="dash-btn-ghost">

          Cancel

        </Link>

      </div>



      <form className="dash-form-card" onSubmit={onSubmit}>

        <fieldset className="collab-provision-mode">

          <legend className="dash-label">Account setup</legend>

          <label className="collab-radio-label">

            <input

              type="radio"

              name="provision-mode"

              checked={mode === 'invite'}

              onChange={() => setMode('invite')}

              disabled={creating}

            />

            Send activation email

          </label>

          <label className="collab-radio-label">

            <input

              type="radio"

              name="provision-mode"

              checked={mode === 'direct'}

              onChange={() => setMode('direct')}

              disabled={creating}

            />

            Set password now (skip invite)

          </label>

        </fieldset>



        <div className="dash-field-row">

          <div className="dash-field">

            <label className="dash-label" htmlFor="collab-email">

              Email

            </label>

            <input

              id="collab-email"

              type="email"

              className="dash-input"

              value={form.email}

              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}

              required

              disabled={creating}

            />

          </div>

          <div className="dash-field">

            <label className="dash-label" htmlFor="collab-brand">

              Brand name

            </label>

            <input

              id="collab-brand"

              className="dash-input"

              value={form.brandName}

              onChange={(e) =>

                setForm((f) => ({

                  ...f,

                  brandName: e.target.value,

                  brandSlug: f.brandSlug || slugify(e.target.value),

                }))

              }

              required

              disabled={creating}

            />

          </div>

        </div>



        <div className="dash-field">

          <label className="dash-label" htmlFor="collab-slug">

            Brand slug

          </label>

          <input

            id="collab-slug"

            className="dash-input"

            value={form.brandSlug}

            onChange={(e) => setForm((f) => ({ ...f, brandSlug: e.target.value }))}

            pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"

            required

            disabled={creating}

          />

        </div>



        {mode === 'direct' ? (

          <div className="dash-field">

            <label className="dash-label" htmlFor="collab-password">

              Initial password

            </label>

            <input

              id="collab-password"

              type="password"

              className="dash-input"

              value={form.password}

              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}

              minLength={8}

              required

              autoComplete="new-password"

              disabled={creating}

            />

          </div>

        ) : null}



        <div className="dash-field">

          <p className="dash-label">Dashboard modules</p>

          <div className="dash-checkbox-grid">

            {MODULE_OPTIONS.map((opt) => (

              <label key={opt.value} className="dash-checkbox-label">

                <input

                  type="checkbox"

                  className="dash-checkbox"

                  checked={form.modules.includes(opt.value)}

                  onChange={() => toggleModule(opt.value)}

                  disabled={creating}

                />

                {opt.label}

              </label>

            ))}

          </div>

        </div>



        {error ? <p className="dash-inline-error">{error}</p> : null}



        <div className="dash-form-actions">

          <button type="submit" className="dash-btn-primary" disabled={creating}>

            {creating ? 'Creating…' : mode === 'invite' ? 'Send invitation' : 'Create account'}

          </button>

        </div>

      </form>

    </>

  );

}


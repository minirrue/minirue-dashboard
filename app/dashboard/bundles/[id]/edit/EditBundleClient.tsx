'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import BundleForm from '../../BundleForm';

/**
 * Reads the route param and hands it to the shared form.
 *
 * A thin client wrapper rather than reading `params` in the page, so the create
 * and edit screens stay literally the same component — a create form and an
 * edit form that drift apart is how a field ends up settable but not
 * changeable, which is exactly the state this tab was in.
 */
export default function EditBundleClient() {
  const params = useParams<{ id: string }>();
  const raw = params?.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  return <BundleForm mode="edit" bundleId={id} />;
}

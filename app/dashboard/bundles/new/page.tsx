import BundleForm from '../BundleForm';

export const metadata = {
  title: 'New bundle — MiniRue Admin',
};

/**
 * `/catalogue/bundles/new`.
 *
 * `next.config.ts` has rewritten this URL to `/dashboard/bundles/new` since the
 * catalogue was reorganised; the app-router file it points at never existed, so
 * the route answered 404. It exists now.
 */
export default function NewBundlePage() {
  return <BundleForm mode="create" />;
}

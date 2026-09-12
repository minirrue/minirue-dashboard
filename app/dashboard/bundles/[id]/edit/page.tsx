import EditBundleClient from './EditBundleClient';

export const metadata = {
  title: 'Edit bundle — MiniRue Admin',
};

/**
 * `/catalogue/bundles/:id/edit`.
 *
 * The other half of the rewrite pair in `next.config.ts` that had no page
 * behind it. Before this, a set could not be changed at all once created —
 * "management" was Hide and Delete, and fixing a price meant rebuilding the set
 * under a new slug, which breaks every link anyone had shared.
 */
export default function EditBundlePage() {
  return <EditBundleClient />;
}

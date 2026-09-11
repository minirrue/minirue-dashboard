import { redirect } from 'next/navigation';

/**
 * `/partners` merged into `/collaborators`.
 *
 * Kept as a redirect rather than deleted: the route has been in the sidebar,
 * so it is in bookmarks and in any link that has gone out by email. A 404 for
 * a screen that still exists under another name is a worse answer than sending
 * the operator to it.
 *
 * The oversight UI itself did not move — `PartnersOversightClient` renders as
 * the "Business & performance" view of the Collaborators screen.
 */
export default function PartnersPage() {
  redirect('/collaborators');
}

import { redirectToSection } from '../_ui/section-redirect';

/**
 * Checkout lives in the Flow section of Analytics now (dashboard#128): the
 * checkout column of every path, with open carts on Overview. Old links keep
 * their dates.
 */
export default async function AnalyticsCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return redirectToSection(searchParams, 'flow');
}

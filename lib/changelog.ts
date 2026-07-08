/**
 * Non-technical release notes for the "Info" tab, so admin/collaborator
 * users can see (and try out) what changed without reading commit history
 * or code. Write every entry for a store-owner reading it, never dev-speak
 * — "Fixed the login page" not "resolved race condition in JWT refresh".
 *
 * Convention: every shipped fix/feature adds ONE entry here. `id` is a
 * sequential integer — always the current highest id + 1, never reused —
 * it is the real sort/read-tracking key (dates alone tie-break unreliably
 * for same-day entries). `date` is the ship date (YYYY-MM-DD), shown as a
 * group header. `area` is a short plain-language label of where in the
 * dashboard it shows up.
 */

export interface ChangelogEntry {
  id: number;
  date: string;
  area: string;
  summary: string;
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    id: 1,
    date: '2026-07-08',
    area: 'Products',
    summary:
      'Brands now have their own page (Products → Brands) where you can add, rename, or remove them — no more typing a brand name by hand when adding a product.',
  },
  {
    id: 2,
    date: '2026-07-08',
    area: 'Categories',
    summary:
      "The Delete button on Categories now actually works. If a category still has subcategories or products in it, you'll see a clear message telling you to move those first.",
  },
  {
    id: 3,
    date: '2026-07-08',
    area: 'Products',
    summary:
      "Search now finds items even if you only remember part of the name — typing a few letters from the middle of a word works too, not just the very start.",
  },
  {
    id: 4,
    date: '2026-07-08',
    area: 'Products',
    summary:
      'Removed a duplicate photo section on the product edit page that was showing the exact same images twice.',
  },
  {
    id: 5,
    date: '2026-07-08',
    area: 'Products & Storefront',
    summary:
      'Fixed product photos showing up broken on the storefront and right after saving a product in the dashboard.',
  },
  {
    id: 6,
    date: '2026-07-08',
    area: 'Gallery',
    summary:
      'Photos you upload to the Gallery are now automatically compressed and load noticeably faster on both the storefront and dashboard.',
  },
  {
    id: 7,
    date: '2026-07-08',
    area: 'Gallery',
    summary:
      'Each photo in the Gallery can now be given its own name — this also helps your products show up better in search engines.',
  },
  {
    id: 8,
    date: '2026-07-08',
    area: 'Gallery',
    summary:
      'Simplified Gallery to plain folders — removed the confusing subfolders-within-folders option.',
  },
  {
    id: 9,
    date: '2026-07-08',
    area: 'Partner workspace',
    summary:
      'Signing in as a Partner/Collaborator now takes you straight to your workspace instead of showing a confusing blocked-access screen first.',
  },
  {
    id: 10,
    date: '2026-07-08',
    area: 'Partner workspace',
    summary:
      'Removed a duplicate navigation bar at the top of the Partner workspace pages — the menu on the left already has all those links.',
  },
  {
    id: 11,
    date: '2026-07-08',
    area: 'Partner workspace',
    summary:
      "Fixed the sidebar sometimes highlighting two menu items at once (like \"Workspace\" and \"My products\" both lit up) — now only the page you're actually on is highlighted.",
  },
  {
    id: 12,
    date: '2026-07-08',
    area: 'Brand profile',
    summary:
      'Uploading a brand logo now shows a loading spinner while it uploads, the same style as the sign-in screen.',
  },
  {
    id: 13,
    date: '2026-07-08',
    area: 'Products',
    summary:
      'The filter bar on the Products page is now more compact on mobile — the two dropdown filters sit side by side instead of stacking one under another.',
  },
  {
    id: 14,
    date: '2026-07-08',
    area: 'Dashboard',
    summary:
      'Removed a duplicate "Overview" heading and a search box in the top bar that didn\'t actually do anything.',
  },
  {
    id: 15,
    date: '2026-07-08',
    area: 'Info',
    summary:
      'Moved this Info page out from under Settings so it has its own spot in the menu.',
  },
  {
    id: 16,
    date: '2026-07-08',
    area: 'Analytics',
    summary:
      "Fixed the Analytics page crashing with a \"This page couldn't load\" error.",
  },
  {
    id: 17,
    date: '2026-07-08',
    area: 'Customers',
    summary:
      'Admin, staff, and partner accounts no longer show up in the Customers list — it now only ever shows real shoppers.',
  },
  {
    id: 18,
    date: '2026-07-08',
    area: 'Storefront',
    summary:
      'Admin, staff, and partner accounts can no longer sign into the storefront — it now only works for real customers, as intended.',
  },
  {
    id: 19,
    date: '2026-07-08',
    area: 'Analytics & Overview',
    summary:
      'Admin/staff/partner accounts are no longer counted as "active customers" on the Overview and Analytics pages.',
  },
  {
    id: 20,
    date: '2026-07-08',
    area: 'Products, Orders, Customers & more',
    summary:
      'Filter bars (status/brand dropdowns, search box) on every list page now sit side by side properly instead of stacking one under another on smaller screens.',
  },
  {
    id: 21,
    date: '2026-07-08',
    area: 'Gallery & Brand profile',
    summary:
      'Tapping a photo (Brand logo, or a product photo) now opens it full-size, the same way Gallery photos already did.',
  },
  {
    id: 22,
    date: '2026-07-08',
    area: 'Partner workspace',
    summary:
      'Removed a duplicate "Partner workspace" title that showed up twice at the top of every Partner page.',
  },
  {
    id: 23,
    date: '2026-07-08',
    area: 'Dashboard',
    summary:
      'Fixed the left-side menu very briefly flashing the wrong links every time the page is refreshed.',
  },
  {
    id: 24,
    date: '2026-07-08',
    area: 'Collaborators',
    summary:
      'Renamed the "Modules" column to "Access" on the Collaborators page — clearer for what it actually shows.',
  },
  {
    id: 25,
    date: '2026-07-08',
    area: 'Dashboard',
    summary:
      "Fixed almost every page showing its title twice at the top (once in the header bar, once again just below it).",
  },
  {
    id: 26,
    date: '2026-07-08',
    area: 'Storefront',
    summary:
      'The announcement bar at the very top of the storefront now always starts visible on a fresh page load — it was staying hidden on refresh once a visitor had scrolled past it, instead of resetting.',
  },
];

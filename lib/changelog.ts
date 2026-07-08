/**
 * Non-technical release notes for the "Info" tab under Settings, so admin
 * users can see (and try out) what changed without reading commit history
 * or code. Write every entry for a store-owner reading it, never dev-speak
 * — "Fixed the login page" not "resolved race condition in JWT refresh".
 *
 * Convention: every shipped fix/feature adds ONE entry here, newest first.
 * `date` is the ship date (YYYY-MM-DD). `area` is a short plain-language
 * label of where in the dashboard it shows up.
 */

export interface ChangelogEntry {
  date: string;
  area: string;
  summary: string;
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: '2026-07-08',
    area: 'Products',
    summary:
      'Brands now have their own page (Products → Brands) where you can add, rename, or remove them — no more typing a brand name by hand when adding a product.',
  },
  {
    date: '2026-07-08',
    area: 'Categories',
    summary:
      "The Delete button on Categories now actually works. If a category still has subcategories or products in it, you'll see a clear message telling you to move those first.",
  },
  {
    date: '2026-07-08',
    area: 'Products',
    summary:
      "Search now finds items even if you only remember part of the name — typing a few letters from the middle of a word works too, not just the very start.",
  },
  {
    date: '2026-07-08',
    area: 'Products',
    summary:
      'Removed a duplicate photo section on the product edit page that was showing the exact same images twice.',
  },
  {
    date: '2026-07-08',
    area: 'Products & Storefront',
    summary:
      'Fixed product photos showing up broken on the storefront and right after saving a product in the dashboard.',
  },
  {
    date: '2026-07-08',
    area: 'Gallery',
    summary:
      'Photos you upload to the Gallery are now automatically compressed and load noticeably faster on both the storefront and dashboard.',
  },
  {
    date: '2026-07-08',
    area: 'Gallery',
    summary:
      'Each photo in the Gallery can now be given its own name — this also helps your products show up better in search engines.',
  },
  {
    date: '2026-07-08',
    area: 'Gallery',
    summary:
      'Simplified Gallery to plain folders — removed the confusing subfolders-within-folders option.',
  },
  {
    date: '2026-07-08',
    area: 'Partner workspace',
    summary:
      'Signing in as a Partner/Collaborator now takes you straight to your workspace instead of showing a confusing blocked-access screen first.',
  },
  {
    date: '2026-07-08',
    area: 'Partner workspace',
    summary:
      'Removed a duplicate navigation bar at the top of the Partner workspace pages — the menu on the left already has all those links.',
  },
  {
    date: '2026-07-08',
    area: 'Partner workspace',
    summary:
      "Fixed the sidebar sometimes highlighting two menu items at once (like \"Workspace\" and \"My products\" both lit up) — now only the page you're actually on is highlighted.",
  },
  {
    date: '2026-07-08',
    area: 'Brand profile',
    summary:
      'Uploading a brand logo now shows a loading spinner while it uploads, the same style as the sign-in screen.',
  },
  {
    date: '2026-07-08',
    area: 'Products',
    summary:
      'The filter bar on the Products page is now more compact on mobile — the two dropdown filters sit side by side instead of stacking one under another.',
  },
  {
    date: '2026-07-08',
    area: 'Dashboard',
    summary:
      'Removed a duplicate "Overview" heading and a search box in the top bar that didn\'t actually do anything.',
  },
];

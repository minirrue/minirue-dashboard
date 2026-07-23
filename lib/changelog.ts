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
    id: 43,
    date: '2026-07-23',
    area: 'Accounts',
    summary:
      'There is a new Accounts tab, and only a super admin can see it. It lists everyone who can sign in, and lets you add an account at whatever level you choose, change someone\'s name, email or level, set a new password for them, suspend them, or delete them for good. You can also open the dashboard as any of them to see exactly what they see, with a bar at the top to switch straight back to yourself. Deleting an account does not touch your sales history — their past orders stay, under their name.',
  },
  {
    id: 42,
    date: '2026-07-23',
    area: 'Accounts',
    summary:
      'Account levels were simplified from seven to five: Super Admin, Admin, Support Staff, Collab and Customer. "Developer" and "Owner" are gone — anyone who was a Developer is now a Super Admin, and anyone who was an Owner is now an Admin, with exactly the same access as before. Support Staff now means the customer-support channel: orders, fulfillment and the overview. Customers can never open the dashboard at all. Tabs you are not allowed to use no longer appear in the sidebar instead of showing an error when you click them.',
  },
  {
    id: 41,
    date: '2026-07-23',
    area: 'Sign in',
    summary:
      'Typing a wrong email or password on the sign-in screen said "Session expired", which made it look like the dashboard was broken rather than that the details were wrong. It now says exactly what the problem is. Signing in with the wrong details also no longer signs you out of a session you already had open.',
  },
  {
    id: 40,
    date: '2026-07-23',
    area: 'Products',
    summary:
      'Option lists and Global variants were two names for the same thing — they are now one page called Global variants. Create a list, add its values, and tick which categories it applies to. Those then appear as the fields when you add a variant to a product in one of those categories, and nowhere else: they no longer show up on the product details form, where a list called Test was appearing under Brand. Nothing about a variant is fixed in code any more.',
  },
  {
    id: 39,
    date: '2026-07-23',
    area: 'Settings',
    summary:
      'You can now create the super admin account from Settings — no database work needed. Enter the email and a password for the new account, then retype your own password to confirm, and it is ready to sign in with. If that email already has an account it is upgraded instead of creating a second one. A super admin can do everything you can, plus erase shop data from the same page; sign-in accounts are never removed by that.',
  },
  {
    id: 38,
    date: '2026-07-23',
    area: 'Products',
    summary:
      'Global variants no longer has fixed boxes. A shared variant now just has a name, and you describe it using your own lists — so "Size (ml)" is something you create, rename or delete, and for anything that is not liquid you make your own list instead. Option lists can now be set to describe either a product or a variant. Price has been removed from the shared variant entirely: you set it on the product, which also fixes the error when adding a shared variant to a product. Also fixed a button that was showing the words THIS BRAND instead of the brand name.',
  },
  {
    id: 37,
    date: '2026-07-22',
    area: 'Whole dashboard',
    summary:
      'Analytics works again. It was showing an error instead of the page because three of the five things it loads were failing behind the scenes — the page gives up entirely if any one of them does. Those are fixed. Every tab has now been checked against a real running system: Analytics, Loyalty, Refunds, Fulfillment, Inventory, Storefront and Settings all load correctly, so the orange MAINTENANCE labels have been removed from the menu.',
  },
  {
    id: 36,
    date: '2026-07-22',
    area: 'Settings',
    summary:
      'Settings works again — it was showing an error instead of the page on a shop with no tax rules saved yet, and saving would have quietly thrown away the VAT number you typed. Several other tabs had the same weakness and are now protected. A new Super Admin account type can erase shop data from Settings: it shows you exactly what will go and how much of it, you tick only what you want, and you type the shop name to confirm. Sign-in accounts are never removed, so everyone can still log in afterwards. Deleting an option or a whole list now also clears it from any product using it, instead of refusing.',
  },
  {
    id: 35,
    date: '2026-07-22',
    area: 'Products',
    summary:
      'Products are now organised as Category, then Brand, then the product itself — the same three steps for perfume, cosmetics, or anything you add later. Two new pages: "Option lists" is where you control every dropdown on the product form (EDP, EDT, Parfum, Hair Mist, Gender, Fragrance family — add, rename or delete any of them, and create brand new lists like Shade). "Global variants" is now per brand: set up a size like 50ml once and add it to any product of that brand in one click, with each product keeping its own price. Deleting anywhere now asks whether you want it hidden but recoverable, or gone for good.',
  },
  {
    id: 34,
    date: '2026-07-22',
    area: 'Products',
    summary:
      'Product types (EDP, EDT, Parfum, Hair Mist and any others you want) are now yours to manage under Products → Global variants. You can add a new one, rename an existing one, or retire one you no longer sell. Renaming updates it everywhere at once. Retiring hides it when adding new products, but any product already using it keeps showing it, and nothing in past orders changes. Each product can still have as many of its own variants as it needs.',
  },
  {
    id: 32,
    date: '2026-07-14',
    area: 'Behind the scenes',
    summary:
      'Nothing changes in how the dashboard looks or works today — this was internal upkeep: automatic checks now run on every update before it ships (so problems get caught earlier), and shared product/order data types are now kept in one place instead of copied between apps.',
  },
  {
    id: 33,
    date: '2026-07-14',
    area: 'Behind the scenes',
    summary:
      'We moved the shared product and order data definitions back inside each app (instead of one shared package). This keeps the live site deploying reliably — the previous shared-package setup could stop the public store and dashboard from going live.',
  },
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
  {
    id: 27,
    date: '2026-07-09',
    area: 'Settings',
    summary:
      'Settings now has a Profile section at the top — upload your own avatar, edit your display name, see your role badge, and upload the store brand logo directly (no more pasting an image URL by hand).',
  },
  {
    id: 28,
    date: '2026-07-13',
    area: 'Products',
    summary:
      'Your own brands now always show up in the brand filter on the Products page, even brands that don\u2019t have any products yet (the MiniRue house brand included). The MiniRue brand and any collaborator brand are also now protected from being renamed or deleted by accident.',
  },
  {
    id: 29,
    date: '2026-07-13',
    area: 'Dashboard',
    summary:
      'Removed the small circle that trailed the mouse pointer around the dashboard — the pointer now behaves normally everywhere.',
  },
  {
    id: 30,
    date: '2026-07-13',
    area: 'Customers',
    summary:
      'On a customer’s page you can now see their full order history, block or unblock their account, edit every detail (email, names, phone, avatar, email-verified), and add, edit, set-default, or delete their saved addresses — all from the dashboard.',
  },
  {
    id: 31,
    date: '2026-07-13',
    area: 'Collaborators',
    summary:
      'Collaborator brand pages now show up correctly on the storefront with their products, and a new “Brand page visible on storefront” toggle in a collaborator’s Trust & publishing settings lets you hide or show their page (previously the page was always on with no control).',
  },
];

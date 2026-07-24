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
    id: 83,
    date: '2026-07-24',
    area: 'Support',
    summary:
      'The conversation you have open no longer shows a red unread count in the list — since you are already reading it, a new message in it is not counted as unread, and it stays marked read as more messages come in.',
  },
  {
    id: 82,
    date: '2026-07-24',
    area: 'Support',
    summary:
      'While you have a conversation open, its notifications no longer pop up as unread — a message that arrives in the conversation you are already viewing is marked read automatically, so the bell only flags conversations you are not currently looking at.',
  },
  {
    id: 81,
    date: '2026-07-24',
    area: 'Support',
    summary:
      'Opening a conversation now always jumps straight to the most recent message, instead of sometimes starting at the top and making you scroll down.',
  },
  {
    id: 80,
    date: '2026-07-24',
    area: 'Support',
    summary:
      'Admins can now merge two support conversations into one. Open the conversation you want to remove, click "Merge into…" in its header, and paste the ID of the conversation you want to keep — every message moves into that one and the duplicate is removed. This is handy when the same customer wrote in twice. It cannot be undone, so you confirm first.',
  },
  {
    id: 79,
    date: '2026-07-24',
    area: 'Support',
    summary:
      'When you reply in the support inbox, your message now appears instantly with a "Sending…" note, instead of waiting for the server. It turns into a small check once it goes through, and if it fails to send you\'ll see a red "Failed" label with a "Retry" button right next to it — so you always know exactly where each reply stands.',
  },
  {
    id: 78,
    date: '2026-07-24',
    area: 'Support',
    summary:
      'The support inbox now refreshes on a single, unified loop — the conversation list and the open chat always update together every few seconds, instead of on two separate timers. It also pauses while the tab is in the background and refreshes the moment you come back.',
  },
  {
    id: 77,
    date: '2026-07-24',
    area: 'Support',
    summary:
      'In the support inbox, opening a conversation now automatically clears any unread notification for it, so you don’t have to separately mark it read. The Messages list also has a new refresh button, and the conversation header now shows a copyable ID that you can also paste into search to jump straight to that conversation.',
  },
  {
    id: 76,
    date: '2026-07-24',
    area: 'Support',
    summary:
      'The support inbox now updates on its own — a customer\'s new message appears in the open conversation within a few seconds, and the conversation list refreshes automatically, so you no longer have to reload the page to see the latest.',
  },
  {
    id: 75,
    date: '2026-07-24',
    area: 'Notifications',
    summary:
      'Your notifications are clearer and easier to organise. Each one now shows what kind of alert it is (Support, Order, Customer and so on) and which section it came from, and clicking it jumps straight to the right place — a support message opens that exact conversation, an order opens that order. Unread ones stand out boldly with a dot; ones you\'ve read are dimmed. You can now mark any single notification as read OR flip it back to unread, so you can keep the important ones highlighted.',
  },
  {
    id: 74,
    date: '2026-07-24',
    area: 'Whole dashboard',
    summary:
      'The dashboard now fits your phone\'s real screen height. Before, the page measured itself against the taller area behind the phone browser\'s address bar, so the top bar and content could get pushed under the browser chrome or feel cut off. It now uses the actual visible height on every device, so the top bar sits correctly on any phone.',
  },
  {
    id: 73,
    date: '2026-07-24',
    area: 'Support',
    summary:
      'Rebuilt the customer messages inbox as a full-screen chat app. On a computer it fills the whole page as a two-pane view — the conversation list on the left, the open chat on the right; on a phone the list fills the screen and tapping a conversation slides into the chat with a back arrow, with the reply box sitting clear of the home bar. Each conversation now shows the real latest message (with "You:" when your team sent it), a coloured dot for whether the customer is online, idle or offline, and a Guest or Customer badge. Replies group into tidy bubbles under day headings (Today, Yesterday), photos stay neatly sized, and opening the contact details reveals a tap-through link straight to a registered customer\'s profile.',
  },
  {
    id: 72,
    date: '2026-07-24',
    area: 'Support',
    summary:
      'Fixed a bug where a logged-in customer\'s support chat showed a long ID number instead of their name, with "No contact details on file" underneath. It now shows their real name, email, and phone the same way it already does for guest shoppers.',
  },
  {
    id: 71,
    date: '2026-07-24',
    area: 'Partners',
    summary:
      'A brand partner can no longer be created without a name. The brand name field now rejects blank or spaces-only entries, both on the form and on the server, so every partner always has a proper name — which is also what shows as the sender on their support chat replies.',
  },
  {
    id: 70,
    date: '2026-07-24',
    area: 'Support',
    summary:
      'Polished the customer support inbox. Messages now show the real sender\'s name instead of a placeholder. Conversation names in the list no longer get cut off. Tap a customer\'s name at the top of a conversation to see the contact details they gave us — email and phone. And the unread "1" badge now clears the moment you open a conversation, instead of sticking around.',
  },
  {
    id: 69,
    date: '2026-07-24',
    area: 'Support',
    summary:
      'The customer support inbox is now reachable from the sidebar for support staff, admins and brand partners. Admins and super admins can set their own status (Online, Idle, Away, Offline) and write a short "typical reply time" note that shows to customers; support staff see the status but cannot change it. Everyone can now attach a photo to a reply — paste one from the clipboard or pick one from your device — and photos sent by customers or staff show up as a small preview you can click to see full size.',
  },
  {
    id: 68,
    date: '2026-07-24',
    area: 'Accounts',
    summary:
      'Reorganised the Accounts screen for phones. Instead of a wide table you had to scroll sideways, each account now shows as a tidy stacked card — name, email, role and a colour-coded Active/Suspended badge — with its Edit, Set password, Sign in as and Delete buttons underneath. When you tap one of those, the form now scrolls into view instead of quietly opening below the fold. The desktop table is unchanged.',
  },
  {
    id: 67,
    date: '2026-07-24',
    area: 'Whole dashboard',
    summary:
      'Went through every screen so nothing spills off the side of the phone anymore. The search boxes and dropdown filters on Orders, Refunds, Customers, Fulfillment, Accounts and the shop-name settings no longer stretch wider than the screen; the storefront footer editor, the analytics revenue chart and a few product forms were tidied the same way. Instead of hiding the extra width, each part now properly fits the screen it is on.',
  },
  {
    id: 66,
    date: '2026-07-24',
    area: 'Whole dashboard',
    summary:
      'Fixed the dashboard looking like a shrunken desktop page on phones and tablets. Every screen now fits the width of your device properly, with no more empty margin pushing the page sideways. On phones, tables and cards are a bit more compact so more fits on screen comfortably, and any wide table now scrolls sideways on its own instead of getting cut off.',
  },
  {
    id: 65,
    date: '2026-07-24',
    area: 'Whole dashboard',
    summary:
      'The red dot on the notification bell now only shows when you actually have unread notifications — it was always lit before, even with nothing new. It now checks the real count as soon as the dashboard loads, on both desktop and mobile. Also, on a product\'s variants, removed the "Photos" column and the leftover "Erase data" dependency block: a super admin can now erase any ticked data without being told another group must be ticked first (whatever it needs is now erased along with it).',
  },
  {
    id: 64,
    date: '2026-07-24',
    area: 'Settings',
    summary:
      'Fixed a crash when saving the shop name. Also, erasing shop data no longer requires you to have set a shop name first — the confirmation is now simply typing the word DELETE, so a super admin can erase data on a brand-new shop.',
  },
  {
    id: 63,
    date: '2026-07-24',
    area: 'Products',
    summary:
      'On a product you can now add custom fields that only that product has, right beside the ones its category requires — type a field name (like "Bottle shape") and its value ("Round"), add as many as you like, and remove any. It works the same way as the category fields. Fixed a bug where ticking a category on a global variant did nothing and looked like you had to delete and recreate the field — assigning categories now saves properly. Also removed the leftover empty "Size (ml)" column from the variants table; a variant\'s fields all show together now.',
  },
  {
    id: 62,
    date: '2026-07-24',
    area: 'Storefront',
    summary:
      'Added a Pages tab under Storefront for editing Terms, Privacy, Shipping, Returns and any other standalone page. Type a title and the web address (slug) fills in automatically until you edit it yourself, write the page content using simple Markdown formatting, and use the checkbox to show or hide it on the live site.',
  },
  {
    id: 61,
    date: '2026-07-24',
    area: 'Products',
    summary:
      'The whole product area now lives in one place called Catalogue, with a single menu item. Inside it you switch between Overview, Products, Categories, Brands and Global variants using the tabs at the top, and the web address always shows where you are (for example /catalogue/brands). Old bookmarks like /products or /categories still work — they take you to the right tab. The Global variants page was also rebuilt: it is now just about the fields themselves — you create a field like "Size", pick which categories use it, and rename or delete it. There are no value lists to manage there any more, because values are typed on each product now. It also no longer shows a confusing error next to "none yet" — a failed load gives you a "Try again" button.',
  },
  {
    id: 60,
    date: '2026-07-24',
    area: 'Products',
    summary:
      'Global variant values are now typed on the product itself, not pre-listed on the Global variants page. When you add or edit a variant, each field that applies to the product\'s category (like Size or Concentration) shows an "Applied" tag and you simply type the value — 50ml, EDP — and it is remembered, so next time it is offered as a suggestion while you can always type something new. The product\'s variant area is now called "Custom variants" and clearly marks which fields are required by the category. Also, when a page briefly cannot reach the server (for example right after an update goes live), Global variants and a product\'s variant fields now show a clear "Try again" button instead of a confusing "failed" message sitting next to "none yet".',
  },
  {
    id: 59,
    date: '2026-07-23',
    area: 'Settings',
    summary:
      'Fixed the Settings page showing "This page couldn\'t load" a couple of seconds after opening. On a shop that had not set its name yet, the "Erase shop data" box tried to use the shop name — which was blank — and crashed the whole page. Settings now opens normally. If your shop name is not set, the erase box simply tells you to set it first (that name is what you type to confirm an erase) instead of breaking the page.',
  },
  {
    id: 58,
    date: '2026-07-23',
    area: 'Partners',
    summary:
      'There is a new Partners tab for admins and super admins to keep an eye on your brand partners in one place — each partner\'s brand, whether their account is active, what parts of the dashboard they can use, and how they are selling (orders, revenue and live products, over the last 7, 30 or 90 days). From there you can open the dashboard exactly as that partner sees it to check on their activity, or jump to manage their account. Separately, a super admin used to see the partner\'s own "Workspace" and "Brand profile" tabs, which only made sense for an actual partner and said "Insufficient role" when opened — those are gone now, replaced by this Partners view.',
  },
  {
    id: 57,
    date: '2026-07-23',
    area: 'Products',
    summary:
      'The product area was a set of separate screens you reached by scattered buttons and left with the back button — Products, Categories, Brands and Global variants, with nothing showing how they fit together. They now share one row of tabs at the top, so moving between them is a single click and you always know where you are. The menu item that was "Products" is now "Catalogue" and opens a new map: your categories, the brands inside each, how many products each holds, and — for every category — the questions each of its products answers (like bottle size or price). A short note on the same page explains the difference between a global variant (a question every product in a category answers) and a custom variant (a question only one product has), which is the part that was easiest to lose track of.',
  },
  {
    id: 56,
    date: '2026-07-23',
    area: 'Storefront',
    summary:
      'Fixed a bug where picking "A product page" (or category/brand) for a hero button, but not finishing the pick, silently blocked saving the ENTIRE storefront page — every other change you made was stuck too. Now an unfinished button link is saved as "scroll to products" instead of blocking anything. An unfinished menu item (no page picked, or no text typed) is removed when you save, and you\'ll see a message telling you how many were removed so nothing disappears without you knowing.',
  },
  {
    id: 55,
    date: '2026-07-23',
    area: 'Notifications',
    summary:
      'The bell icon in the sidebar now shows what is actually happening in your store — new orders, refunds, fulfilments, low stock, collaborator activity and more — instead of always saying "All caught up!". You can search notifications, filter by type or importance, sort them, and tick "Unread only" to see just what is new. A Refresh button re-checks the database on demand so you can confirm something just came in without reloading the page. Clicking a notification takes you straight to the order or item it is about and marks it read; there is also a "Mark all read" button and a full-page view at Notifications (under the sidebar\'s System section) for when the drawer is too small.',
  },
  {
    id: 54,
    date: '2026-07-23',
    area: 'Products',
    summary:
      'The product area was a set of separate screens you reached by scattered buttons and left with the back button — Products, Categories, Brands and Global variants, with nothing showing how they fit together. They now share one row of tabs at the top, so moving between them is a single click and you always know where you are. The menu item that was "Products" is now "Catalogue" and opens a new map: your categories, the brands inside each, how many products each holds, and — for every category — the questions each of its products answers (like bottle size or price). A short note on the same page explains the difference between a global variant (a question every product in a category answers) and a custom variant (a question only one product has), which is the part that was easiest to lose track of.',
  },
  {
    id: 53,
    date: '2026-07-23',
    area: 'Partners',
    summary:
      'A super admin was shown the brand-partner tabs ("Workspace" and "Brand profile") in the sidebar, but opening either one said "Insufficient role" — those screens describe a partner\'s own brand, which a super admin does not have. They no longer appear for a super admin, so there is nothing broken to click.',
  },
  {
    id: 52,
    date: '2026-07-23',
    area: 'Storefront',
    summary:
      'The Storefront tab is now a real page builder for your home page. It is arranged block by block — the rotating hero banner, the scrolling ribbon, product sections, the Journal, and a collaborator showcase — and you can reorder, hide, or remove any of them. A product section can pull from a whole category, from one brand, or from products you hand-pick and order yourself, and a category section can show its brands instead of its items. The Journal block is either your own photo and words, or a chosen product, shown with that product\'s own picture and description. The top menu is no longer built automatically from your categories — you choose every item yourself, whether it points to a category, a brand, a product, a collaborator, or any link, with separate lists for desktop and mobile. The footer is now fully editable too: its link columns, your social accounts, and the Visa, Mastercard and InstaPay marks. Anywhere a picture is needed, you can pick one from the gallery or upload straight from your device. And the part worth knowing: once you save a change, it now shows up on the shop for anyone already looking at it, without them needing to refresh the page.',
  },
  {
    id: 51,
    date: '2026-07-23',
    area: 'Inventory',
    summary:
      "Inventory is offline for repairs, so it's hidden from admin accounts for now — you'll see a clear \"under maintenance\" message if you open it directly, not an access-denied error. Nothing else in the dashboard is affected.",
  },
  {
    id: 50,
    date: '2026-07-23',
    area: 'Refunds',
    summary:
      'The Refunds page now lists every order, fulfilled or not, with a Refund button — walk-in orders included. Refunding an order records that you already sent the money back over Instapay and lets you attach the transfer screenshot as proof, but the screenshot is optional. A separate Refund history tab shows every refund ever recorded, who it was for, and lets you re-open the attached proof.',
  },
  {
    id: 49,
    date: '2026-07-23',
    area: 'Analytics',
    summary:
      'The Analytics page now shows how much was refunded this month and your true net revenue after refunds, right alongside the existing revenue numbers.',
  },
  {
    id: 48,
    date: '2026-07-23',
    area: 'Fulfillment',
    summary:
      'The Fulfillment page now has two tabs: Manual, where you pick a fulfillment method and mark orders fulfilled yourself, and Shipping service, a preview of what a connected courier screen will look like once one is set up (it is clearly marked as not connected yet and nothing on it can be clicked through).',
  },
  {
    id: 47,
    date: '2026-07-23',
    area: 'Orders',
    summary:
      'There is a new "New manual order" button on the Orders tab for sales made outside the online shop — a walk-in customer, a relative, a DM order. It asks for the buyer\'s name and phone (recorded as a guest, no account needed), lets you pick the products and quantities from your real catalogue, and lets you edit the price on each line for anything that went out at a negotiated figure. Choose how it was paid — Instapay bank transfer, cash in person, or cash on delivery — and optionally attach a photo of the Instapay receipt. The order is created like any other sale and counts toward revenue and reports. Separately, every order\'s page now shows the full payment detail — method, amount, Instapay reference, who sent the money, when, and the receipt photo itself.',
  },
  {
    id: 46,
    date: '2026-07-23',
    area: 'Orders',
    summary:
      'You can now choose and record how each order is being fulfilled — manually packed or via a shipping service — right from the Orders list, an order’s own page, or a customer’s order history. Once you mark a manually-fulfilled order as sent, it shows a clear "Fulfilled" badge everywhere it appears.',
  },
  {
    id: 45,
    date: '2026-07-23',
    area: 'Orders',
    summary:
      'Fixed a bug where searching the Orders list while on a later page could say "no results" even though matching orders existed — the list now jumps to show them. Also, extra spaces typed before or after a search no longer stop it from matching.',
  },
  {
    id: 44,
    date: '2026-07-23',
    area: 'Orders',
    summary:
      'Every order now shows a short order number like #47 next to its receipt number, and you can search the Orders list by either one.',
  },
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

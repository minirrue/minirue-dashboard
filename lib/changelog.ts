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
    id: 170,
    date: '2026-07-30',
    area: 'Account & sign-in',
    summary:
      'Signing out did not actually end your session on the server. If you signed out at the same moment your sign-in had already timed out — which is exactly when people tend to press it — the "Sign out" request itself quietly failed and did nothing, so the screen cleared but the account underneath was still fully signed in. Worse, the support system had never been checking whether a sign-in was still valid at all: it took whatever a browser\'s login token said about who was writing and trusted it as-is, so a token from an account that had already been signed out of kept working, silently, for as long as a full day afterwards. That is the real explanation for the earlier report above — a signed-out person\'s message could still land on their old account. Both are now fixed: "Sign out" always ends your session no matter what state it was in, and every message is checked against a genuinely live sign-in rather than taken on trust. Proved end to end: sign in, send a message, sign out, then try to reuse that exact same sign-in — it is rejected immediately and cannot send anything.',
  },
  {
    id: 169,
    date: '2026-07-30',
    area: 'Support',
    summary:
      'The list of people and the top of an open conversation could still show the word "Customer" for an account that has a real name on it, even though the messages underneath already showed that name correctly — the list and the header were built from a shorter check than the messages were. Both now use the same one, so a customer\'s name shows consistently everywhere in a conversation, not only next to what they wrote.',
  },
  {
    id: 168,
    date: '2026-07-30',
    area: 'Support',
    summary:
      'For a moment right after refreshing the page, a collaborator\'s Support screen could show MiniRue\'s own support conversations before correcting itself and switching to the collaborator\'s own — the server was always handing back the right conversations for whoever was actually signed in, but the page did not yet know who was asking and could paint the wrong desk on screen for that first instant. A partner could never act on anything that wasn\'t theirs, but seeing MiniRue\'s own messages even briefly was not acceptable, so the page now waits until it has confirmed who is signed in before it shows anything at all, rather than showing something it might have to take back. The same page also no longer runs off the edge of the screen on smaller layouts.',
  },
  {
    id: 167,
    date: '2026-07-30',
    area: 'Brand pages',
    summary:
      'A partner\'s brand page was being linked to an address that does not exist — both the link an admin sees pointing to a partner\'s page, and the address the partner\'s own page was set up to expect. A brand\'s page actually lives at the top level of the site (like minirueshop.com/thatbrand), not inside a /brands/ folder, and every place that builds that link now points at the real address.',
  },
  {
    id: 166,
    date: '2026-07-30',
    area: 'Sign-in',
    summary:
      'Signing in as a collaborator could flash a "you don\'t have access" message for an instant before the correct screen took over. Sign-in always opens on the main Overview screen first, which a collaborator isn\'t allowed to see, and the page was showing that denial before it had a chance to send them on to the screen they actually can see. It now waits for that handoff instead of accusing someone of a permissions problem they don\'t have.',
  },
  {
    id: 165,
    date: '2026-07-30',
    area: 'Collaborators',
    summary:
      'A collaborator\'s Products and Brands tabs could look like they had frozen on "Loading…" forever. They had not frozen — they were quietly retrying over and over, so fast that an error never got the chance to show. Each tab now tries once and shows a real error or an empty state instead of spinning indefinitely.',
  },
  {
    id: 164,
    date: '2026-07-30',
    area: 'Profile photos',
    summary:
      'Anyone without a profile photo — customer, staff, or collaborator — now gets a plain person silhouette instead of their initial in a circle, the same mark already used on the Settings profile card, so it looks the same everywhere a person is pictured across the storefront and dashboard. A shop or brand\'s own logo placeholder is left alone on purpose — that is a store mark, not a person.',
  },
  {
    id: 163,
    date: '2026-07-30',
    area: 'Profile photos',
    summary:
      'Customers can now set their own profile photo from their account page on the storefront, cropped square since it always shows in a circle. Before, only staff and collaborators could set a picture for someone — a customer\'s own photo was permanently the placeholder no matter what they tried. It uses the same processing already used for product photos and reviews, so a portrait photo taken on a phone comes out the right way up, and a photo from an iPhone converts properly instead of failing.',
  },
  {
    id: 162,
    date: '2026-07-30',
    area: 'Notifications',
    summary:
      'The notification bell\'s panel was casting a soft grey shadow down the right edge of every screen even while it was closed and sitting off-screen — the fifth time this exact kind of bug has turned up in the dashboard, always the same cause: a closed panel still painting the shadow meant for when it\'s open. It no longer casts one until it is actually open.',
  },
  {
    id: 161,
    date: '2026-07-30',
    area: 'Support',
    summary:
      'A shopper who signed out and then opened support was still being treated as their old account — the message they sent landed on that old account\'s conversation. The chat window sits on the page permanently, so signing out never actually cleared it. It is now wiped the moment the person signing in changes, whether that is a sign-out or a switch to a different account, and the note kept on the device is cleared too.',
  },
  {
    id: 160,
    date: '2026-07-30',
    area: 'Support',
    summary:
      'Messages opens on MiniRue\'s own desk instead of every desk at once, and MiniRue is now one of the choices in the desk list (before, only partner desks were listed, so there was no way to see just your own). Picking a desk now really does show only that desk — choosing a customer used to bring up their conversations from every desk mixed together.',
  },
  {
    id: 159,
    date: '2026-07-30',
    area: 'Support',
    summary:
      'Every message used to be signed "Customer", even when the account had a name on it. Messages now show the person\'s real name, falling back to their account name or email, and only say "Customer" for a guest who never gave one. On the shop side, starting a new conversation now opens an empty one — it used to show the previous conversation\'s messages underneath.',
  },
  {
    id: 158,
    date: '2026-07-30',
    area: 'Orders',
    summary:
      'A refunded order still said "Delivered" on its own page. The page was reading only the status word and never mentioned the refund at all, so it disagreed with the Refunds tab. It now says Refunded wherever you look, shows the amount and the date, and has a Refund button of its own. Orders refunded before today have been corrected too.',
  },
  {
    id: 157,
    date: '2026-07-30',
    area: 'Analytics',
    summary:
      'A new "Projected This Month" figure shows what you have taken this month plus what is still waiting to clear, with the split spelled out underneath. It is deliberately labelled Projected, never Revenue — the money that has not cleared yet is not yours until it does.',
  },
  {
    id: 156,
    date: '2026-07-30',
    area: 'Photos',
    summary:
      'Photos taken in portrait on a phone were being saved sideways. Phones store the picture the wide way round plus a note saying "turn this", and that note was being thrown away when we converted the file — so nothing afterwards could put it right. This affected product photos, the Gallery and review photos. Reviews also stop accepting iPhone videos we cannot play, and now say so clearly instead of showing a black box, and iPhone photos are converted properly instead of arriving broken.',
  },
  {
    id: 155,
    date: '2026-07-30',
    area: 'Photos',
    summary:
      'A photo you just uploaded could sometimes show up broken until you refreshed the page — the very first time a brand-new photo is fetched is always the slowest, and if that first attempt happened to fail, the page never tried again. Photos in product editing, the Gallery, category/brand pictures and the storefront hero now quietly retry a few times on their own, and only show "Couldn\'t load — tap to retry" if they truly can\'t load.',
  },
  {
    id: 154,
    date: '2026-07-30',
    area: 'Support',
    summary:
      'Three things on phones. The grey smear down the left edge of every screen is gone — the slide-out menu was casting its shadow onto the page even while it was closed and off-screen; it now only casts one when it is actually open over the page. The online/reply-time strip is a single line you can read at a glance ("Online · replies within an hour") and tap to open when you want to change it, instead of a block of buttons taking a fifth of the screen for a setting you touch once a shift — which hands that space to the list of customers. And opening a conversation now fills the whole screen: the menu bar and the status strip step out of the way while you read and reply, and the back arrow brings you out again. The bar at the top of other screens also slides away as you scroll down and returns when you scroll back up.',
  },
  {
    id: 153,
    date: '2026-07-30',
    area: 'Support',
    summary:
      'On a phone you can now set the shop to Offline. The four buttons — Online, Idle, Away, Offline — were sized for a mouse and ran off the side of a phone screen, so the last one simply could not be reached; they now share one row across the screen and are big enough to hit with a thumb, as are the reply-time box, the search box and the refresh button. The top of the Messages screen is tidier too: the online/reply-time strip, the "Messages" heading with its search box, and the two filters used to sit in three separate stacked boxes with gaps and dividers between them, and are now one block, which hands the space back to the list of customers so you see more of them at once. Clicking a conversation also works properly again — the archive button sat inside the row button, which browsers quietly rearrange, and each row now responds to the keyboard as well. Elsewhere in the dashboard, the bar at the top of the screen lifts off the page with a soft shadow once you scroll, so it reads as sitting above the content instead of being pasted onto it.',
  },
  {
    id: 152,
    date: '2026-07-30',
    area: 'Support',
    summary:
      'The Messages screen is now a list of people, not a list of messages. Click someone and every conversation they have ever had with you opens beside their name — live ones first, older ones under them, archived folded away at the bottom — and you pick which to read from there. This matters because pressing "New conversation" in the shop now genuinely starts a new one, so a single customer can have several, and the old screen would have shown them as several separate rows of the same person. The two filters at the top sit on one line instead of stacking in an empty box. Whether a conversation is resolved is shown beside what it is about, rather than thrown in with the tags. You can archive a conversation and get it back again — that was built months ago and had no button anywhere. And you can switch to any partner desk to read it, including a desk nobody has messaged yet; you can read anything, but only that partner can reply on theirs. "Merge into" is gone: grouping by person is what it was really for.',
  },
  {
    id: 151,
    date: '2026-07-30',
    area: 'Storefront appearance',
    summary:
      'The phone menu is now yours to design. A new "Mobile menu" tab under Storefront appearance lets you set the icon tiles at the top (up to 3) and the button pinned to the bottom, picking from the same icons the storefront already uses and pointing each one at Home, Search, your Account, the Cart, the Brands page, or any category, brand, product or collaborator page. Before, that row was fixed to Home/Search/Account and the bottom button always said Account too — the same destination shown twice. Shops that never open this new tab see no change; the old row is exactly what ships as the default. Tapping a category with subcategories now opens them, not just the ones with pinned products, and the socials in the phone menu are in colour now.',
  },
  {
    id: 150,
    date: '2026-07-30',
    area: 'Gallery & photos',
    summary:
      'Every photo can now be swapped for a better one without deleting it first. Exchange keeps the same entry, so the product, category or brand using that photo simply shows the new picture — nothing needs re-linking and nothing breaks. This also quietly fixes something worse: logos and profile pictures were being replaced by writing over the same file, and the picture service caches by file name, so the old logo could keep showing for up to a month after you changed it. New photos also file themselves now — uploading a product photo puts it under its category, then its brand, then the product, instead of dropping a folder named after the product beside the category it belongs in. Photos already in the gallery are left exactly where they are. And there is a search box: type anything and it looks across folder names, photo descriptions and product names at once, showing you where each result lives.',
  },
  {
    id: 149,
    date: '2026-07-30',
    area: 'Notifications',
    summary:
      'A number on a tab now goes out when you open that tab, instead of sitting there lit for up to a minute after you have plainly seen what it was telling you about. The counts were being fetched on a timer and nothing ever told that timer anything had happened — opening a conversation did correctly mark it read underneath, but the number on the sidebar had no idea. Only the section you opened is cleared: looking at Orders does not quietly clear Reviews. Inside Support, the list still shows which individual conversations are unread, so nothing is lost by the tab number going out.',
  },
  {
    id: 148,
    date: '2026-07-30',
    area: 'Erase data',
    summary:
      'Erasing shop data is now one button. Before, you ticked eleven boxes, and what each box deleted was a list of table names typed by hand — a list that had already drifted three times, naming two things that no longer exist and missing two that do. When it drifted, the erase did not warn you, it simply refused. The new button asks the database what it actually contains at that moment, so there is no longer a list to get out of date, and it can no longer fail part-way on something nobody remembered to add. Sign-in accounts are still never touched — everyone can log in afterwards. Order numbers start again at 00001. The eleven boxes are still there, folded away under “Or erase only some things”, for when you want to clear one thing rather than everything.',
  },
  {
    id: 147,
    date: '2026-07-29',
    area: 'Support, Gallery & Erase data',
    summary:
      'The shop chat was returning an error for everyone. The cause was that a database update never actually ran on the live server, so the chat was looking for records that were not there yet — updates now run when the server starts, so this cannot happen again quietly. “Erase the ticked data” was failing for a related reason: support conversations, reviews and wishlists were added after that screen was built and were never on its list, so it refused to delete. They are now erased with everything else — worth knowing, because before this a successful erase was silently keeping every customer conversation. Opening a top-level gallery folder now shows the folders inside it instead of an empty photo list. The “How variants work” note under Catalogue is gone.',
  },
  {
    id: 143,
    date: '2026-07-29',
    area: 'Orders & Gallery',
    summary:
      'Three small fixes. The product photo on an order was being squashed into a thin strip by the narrow column — it is a proper square again. The InstaPay reference, sender and reference now show a small pencil when you hover the row, because a dash in a table reads as “nothing here” rather than “you can type here”. And a top-level gallery folder no longer accepts photos: it holds folders, and dropping files straight into it is what left everything in one pile.',
  },
  {
    id: 146,
    date: '2026-07-29',
    area: 'Photos & files',
    summary:
      'We moved to a new photo and file storage system. The visible change is that photos no longer break when a new part of the dashboard starts accepting uploads. Before, each new kind of upload — support chat attachments, review photos — had to be switched on by hand behind the scenes, and until someone did, those pictures showed as broken while everything else looked fine. That step is gone: uploads work everywhere from the moment the feature ships. Product and gallery photos are also now visible in the dashboard itself, not just on the shop.',
  },
  {
    id: 142,
    date: '2026-07-29',
    area: 'Support',
    summary:
      'You can now open a partner’s support desk even when nobody has messaged them — the brand list used to be built from conversations that had already arrived, so an empty desk simply was not in it. When you open someone else’s desk a bar says you are watching it: you can read everything, but only that partner can reply, so a customer never gets a message from a brand written by someone who does not work there.',
  },
  {
    id: 141,
    date: '2026-07-29',
    area: 'Collaborators',
    summary:
      'Partners now have their own support desk, and you can hand one the running of it with the new Support box under Access. They can then say whether they are answering and what reply time to show — for themselves only, not for the shop. Until now that was a single switch for the whole business, so a partner could never be open while MiniRue was closed.',
  },
  {
    id: 145,
    date: '2026-07-29',
    area: 'Reviews',
    summary:
      'A customer can now attach up to four photos and one short video to a review — what the bottle actually looked like when it arrived. You see them in the Reviews tab before you decide, and clicking a photo opens it full size, because approving from a thumbnail is approving blind. If someone adds a photo to a review you have already approved, it comes back to you for a second look rather than appearing on the shop by itself.',
  },
  {
    id: 143,
    date: '2026-07-29',
    area: 'Left menu',
    summary:
      'Next to the server dot at the bottom of the left menu you can now see how long the server takes to answer, in milliseconds. It turns amber if it gets slow and red if it gets very slow, so you can tell "the shop feels sluggish today" apart from "something is broken". Only you and other admins see this — staff and partners still see whether the server is up, which is the part that affects their work. It is not shown on the sign-in page, since there is nobody to show it to yet.',
  },
  {
    id: 142,
    date: '2026-07-29',
    area: 'Reviews (new tab) & product photos',
    summary:
      'Customers can now leave a star rating and a few words on a product, and there is a new Reviews tab under Operations where you decide what goes on the shop. Nothing a customer writes appears on a product page until you approve it there — you can also take an approved one back down, or let a rejected one through, at any time. Only customers who have actually received the product can write one, so every review is marked as a verified purchase and there is nothing to stop being flooded with. Separately, when editing a product you can now mark one photo as "Set as closing" — that photo ends the product page, instead of the "Available sizes" panel that just repeated the size the shopper already picked. You cannot pick the cover photo for this, because a photo only does one job and the shop would lose its thumbnail.',
  },
  {
    id: 141,
    date: '2026-07-29',
    area: 'Left menu & notifications',
    summary:
      'Each section in the left menu now carries its own unread count, so you can see that three of them are support messages and one is an order without opening the bell. Support messages count against Support only — they used to be filed as customer notifications, which meant Support and Customers would have shown the same number and both been wrong. Older support messages have been moved across too, so the counts are right straight away. The number on the bell now sits on the top-right corner of it instead of on top of the bell drawing.',
  },
  {
    id: 140,
    date: '2026-07-29',
    area: 'Support',
    summary:
      'The conversation header is just the conversation again. The status and brand filters moved above the message list — they filter that list, so that is where they belong — and the online status and reply time moved to their own strip at the top, since they apply to the whole shop rather than to one chat. The conversation ID moved into the customer details panel. The “Attachments” button is gone with guest chat.',
  },
  {
    id: 136,
    date: '2026-07-29',
    area: 'Everywhere',
    summary:
      'The dashboard now tells you whether the server is up. A small dot sits at the bottom of the left menu, and on the sign-in page under the password box: green means the server is answering normally, red means it is not. If it turns red, nothing you do will save until it is green again — so you are told instead of finding out when a change quietly disappears. Red also covers the case where the server answers but its database does not, and hovering the dot says which it is. Click it to check again immediately.',
  },
  {
    id: 135,
    date: '2026-07-29',
    area: 'Catalogue',
    summary:
      'Categories can now be given a picture, chosen from your Gallery like any product photo. The shop shows categories and brands as picture tiles, so until now they drew as empty squares. Partners can set the picture on their own categories from their dashboard.',
  },
  {
    id: 134,
    date: '2026-07-29',
    area: 'Collaborators',
    summary:
      'A partner’s page now has tabs: Settings (everything that was already there), Products (what they have actually listed, and whether each one is live), and Activity (what has been happening with them). Note the Products / Orders / Analytics boxes under Access are not tabs — they control what the partner can see in their own dashboard.',
  },
  {
    id: 133,
    date: '2026-07-29',
    area: 'Catalogue',
    summary:
      'Partners now have their own Categories page and can name their own — Helia’s “Jewellery” is hers, separate from yours, and appears on her shop page. The Catalogue overview now shows one seller at a time instead of merging everyone, which is what made a partner look like a label filed inside one of your categories. The wording there was also wrong: a category and a brand are two separate labels on a product — what it is, and who made it — not one inside the other.',
  },
  {
    id: 132,
    date: '2026-07-29',
    area: 'Storefront',
    summary:
      'The announcement bar’s link is now picked from a list — one of your own pages, a category, a brand, or a web address — instead of being a box you typed an address into from memory. Anything already set keeps working. Page addresses are also now checked against partner shop addresses when you save, so a page cannot quietly take over a partner’s page.',
  },
  {
    id: 131,
    date: '2026-07-29',
    area: 'Storefront appearance → Menu',
    summary:
      'Category menu items can now show product pictures. Open Storefront appearance → Menu, pick a category item, and choose up to three products on it. On a computer those products slide down in a panel when a shopper hovers that menu item; on a phone the menu itself now rises from the bottom of the screen and tapping the item opens the same three products with their photos and prices. Leave the products empty and the menu item keeps working exactly as before, linking straight to the category.',
  },
  {
    id: 130,
    date: '2026-07-29',
    area: 'Support',
    summary:
      'The “Resolved” label no longer gets cut off at the edge of a conversation row. Labels now wrap onto a second line and the row grows to fit them, so nothing is hidden however many a conversation has. Photos sent in a chat now open in a preview over the page instead of a new browser tab, so you do not lose your place.',
  },
  {
    id: 129,
    date: '2026-07-29',
    area: 'Orders',
    summary:
      'Product photos on an order are bigger, square and no longer stretched, and you can click one to see it full size — the same as the payment receipt beside it already did. The photos are also fetched at the size actually shown rather than full resolution, so the page loads lighter.',
  },
  {
    id: 128,
    date: '2026-07-29',
    area: 'Orders',
    summary:
      'You can now correct the InstaPay reference, the sender name and the reference on a payment — click the value, type, and press Enter. These are copied by hand off a transfer screenshot so they often arrive late or wrong, and there was previously no way to fix them. The payment status stays automatic and cannot be typed over.',
  },
  {
    id: 127,
    date: '2026-07-29',
    area: 'Notifications',
    summary:
      'The bell now shows how many unread notifications you have, instead of a plain red dot — it always knew the number and just was not showing it. Support notifications now name the customer, quote what they actually wrote, and say which brand it is for, instead of all reading “New support message from a customer”. Every notification opens the screen it is about when you tap it.',
  },
  {
    id: 126,
    date: '2026-07-29',
    area: 'Customers',
    summary:
      'Lifetime spend is a real number now. It always showed EGP 0.00, for everyone, no matter how much they had bought — nothing was ever adding to it. It now counts money as each order is paid, and past orders have been added back in, so tiers finally move on their own. Refunds are shown separately on the customer, with a running total, rather than being quietly taken off the spend — so you can see who keeps buying and returning.',
  },
  {
    id: 125,
    date: '2026-07-29',
    area: 'Orders & Refunds',
    summary:
      'Refunding an order now actually marks it refunded everywhere. Until today the money was recorded on the Refunds tab while the Orders list, the order page and its history all still said Delivered, and the payment still said Succeeded — so a refunded order looked like a sale you kept. The refund now shows on the order, is written into the order’s history with who did it and why, and turns the payment red.',
  },
  {
    id: 124,
    date: '2026-07-25',
    area: 'Settings',
    summary:
      'The store name field is gone from Settings. The shop is permanently MiniRue Shop and the name appears on order numbers, emails and receipts, so having a box for it only risked a typo following every order.',
  },
  {
    id: 123,
    date: '2026-07-25',
    area: 'Gallery',
    summary:
      'New "Organise by category" button. It creates a folder for each category with the brands inside it, and files every photo that a product uses into the right one — the gallery supported folders but nothing ever filled them, so everything sat in one pile. Safe to press more than once, and photos not used by any product are left where they are.',
  },
  {
    id: 122,
    date: '2026-07-25',
    area: 'Partners',
    summary:
      'The Partners screen now shows what MiniRue earns from each partner, alongside their revenue and their commission rate. It also fixes the revenue figure itself, which was failing to load behind the scenes. Note: the commission is calculated as MiniRue’s share of partner revenue — tell us if a rate is meant to be the partner’s share instead.',
  },
  {
    id: 121,
    date: '2026-07-25',
    area: 'Collaborators',
    summary:
      'Partners can now describe what makes a product version distinct — Size / 50 ml, Shade / Amber, and so on — when adding a product. Every partner product used to be recorded as 50 ml with a random reference code; they now get a proper readable SKU built the same way as MiniRue’s own.',
  },
  {
    id: 120,
    date: '2026-07-25',
    area: 'Support',
    summary:
      'The support inbox now shows which brand each conversation is for, marks unread threads with a gold edge, and says at the top of the thread exactly who you are replying to. You can filter by status and by brand, mark a conversation resolved (the customer then starts a new one rather than replying to a closed thread), reopen it, and allow or block image attachments for a guest you have not identified yet.',
  },
  {
    id: 119,
    date: '2026-07-25',
    area: 'Customers',
    summary:
      'Editing a customer’s phone number now works like the sign-up form: pick the country, type the local number, and it shows you exactly what will be saved. The old box accepted anything, so it was possible to save a number the shop itself would have rejected.',
  },
  {
    id: 118,
    date: '2026-07-25',
    area: 'Orders',
    summary:
      'Refunding an order now marks the order itself as Refunded — on the order, in its history, and in the orders list. Before, only the refund record changed and the order still looked delivered, so refunded money never showed up in Analytics either.',
  },
  {
    id: 117,
    date: '2026-07-25',
    area: 'Orders',
    summary:
      'Orders now show the product photo — in the orders table and on a customer’s own order pages — so you can tell two orders apart at a glance. You can also jump straight from a customer to any of their orders and back again.',
  },
  {
    id: 116,
    date: '2026-07-25',
    area: 'Settings',
    summary:
      'You can now set the shipping fee, and a basket total above which shipping is free, in Settings. Until now the fee was fixed in the code and could only be changed by a developer.',
  },
  {
    id: 115,
    date: '2026-07-25',
    area: 'Settings',
    summary:
      'The store name is now shown as fixed and cannot be edited. It appears on order numbers, emails and receipts, so a typo there would follow every order — editing it never actually did anything, and now it says so.',
  },
  {
    id: 114,
    date: '2026-07-25',
    area: 'Sign in',
    summary:
      'The dashboard and the shop now keep separate sign-ins. Signing into one no longer signs you out of the other, and signing in as a customer can no longer knock you out of your admin session. You will need to sign into the dashboard once after this update.',
  },
  {
    id: 113,
    date: '2026-07-25',
    area: 'Sign in',
    summary:
      'An expired session no longer makes the page reload over and over. It now takes you to the sign-in screen once, like signing out does.',
  },
  {
    id: 112,
    date: '2026-07-25',
    area: 'Products',
    summary:
      'You can set how many units of each variant are in stock, straight from the product page — type the number and press Enter. Warehouses are out of service, and with no stock recorded every order was being refused at checkout with "insufficient stock". Variants at zero are labelled Out of stock, and the shop now says so on the product page instead of letting someone reach payment first. Collaborators can set stock for their own products too.',
  },
  {
    id: 111,
    date: '2026-07-25',
    area: 'Analytics',
    summary:
      'Added a figure for money awaiting payment confirmation. Revenue only counts orders whose payment has been verified, so a day of real sales waiting on receipts used to read as zero. It is shown separately and is never mixed into revenue.',
  },
  {
    id: 110,
    date: '2026-07-25',
    area: 'Customers',
    summary:
      'Saving a customer address no longer fails with "Internal server error" the first time and then works on the second try. The address was in fact being saved every time; the reply back to the browser was what broke.',
  },
  {
    id: 109,
    date: '2026-07-25',
    area: 'Customers',
    summary:
      'Sign-up now asks for a last name and a phone number with its country, and keeps them. Names typed at sign-up used to be thrown away and the customer was named after their email address. A phone number can only belong to one account, like an email.',
  },
  {
    id: 108,
    date: '2026-07-25',
    area: 'Customers',
    summary:
      'Everyone is now addressed by their first name — customers, staff and admins alike — instead of "Hi, there". Customers can change how their name appears from their own account settings.',
  },
  {
    id: 107,
    date: '2026-07-25',
    area: 'Loyalty',
    summary:
      'Loyalty is marked as under maintenance and hidden from customer accounts while it is out of service.',
  },
  {
    id: 106,
    date: '2026-07-25',
    area: 'Customers',
    summary:
      'Fixed a customer address being saved twice — once as default and once not — while showing an error. If the connection dropped after saving, the app retried and saved a second copy. It no longer retries saves, the server ignores a repeat of the same address, and existing duplicates have been cleaned up.',
  },
  {
    id: 105,
    date: '2026-07-25',
    area: 'Collaborators',
    summary:
      'Collaborators have their own notification bell again — it used to say "Insufficient role" and show nothing. Each partner sees only their own notices, never the shop ones, and they are told when MiniRue approves a product or asks for changes.',
  },
  {
    id: 104,
    date: '2026-07-25',
    area: 'Storefront',
    summary:
      'Footer links to a category now point at the right address. They were being built from the internal id of the category, so clicking one landed shoppers on a "not found" page.',
  },
  {
    id: 103,
    date: '2026-07-25',
    area: 'Media',
    summary:
      'Every photo you upload now opens a crop window first — Gallery, product photos, home page slides, journal art, your brand logo and your own profile picture, for admins and collaborators alike. Pick a ready-made shape (wide 16:9 or 4:3, square, portrait 3:4, 4:5 or 9:16) or drag a free crop with no fixed shape. Documents are left alone: support attachments, refund evidence and order receipts upload untouched so nothing can be trimmed out of a record.',
  },
  {
    id: 102,
    date: '2026-07-25',
    area: 'Sign in',
    summary:
      'You should no longer be signed out while you are working. Several screens refresh in the background, and when your sign-in needed renewing they all tried at once — only the first succeeded and the rest logged you out. Staying signed in now lasts a day and renews itself as you use the dashboard.',
  },
  {
    id: 101,
    date: '2026-07-24',
    area: 'Support',
    summary:
      'A conversation you had just replied to no longer comes back as unread after you visit the customer profile and return. Your own reply was being counted as a new message you had not read.',
  },
  {
    id: 100,
    date: '2026-07-24',
    area: 'Storefront',
    summary:
      'Footer links are now picked from a list — your own pages, a category or a brand — instead of typing a path by hand. Mistyped paths used to save happily and then land shoppers on a "not found" page. "Custom link" is still there for outside links.',
  },
  {
    id: 99,
    date: '2026-07-24',
    area: 'Storefront',
    summary:
      'New "Product section" tab under Storefront: the reassurance lines on every product page (free shipping over a certain amount, free samples) are yours to edit now, with an icon and any order you like. They used to be fixed in the code.',
  },
  {
    id: 98,
    date: '2026-07-24',
    area: 'Products',
    summary:
      'Product photos were missing everywhere products are listed — category pages, the home page, search and the cart all showed the product name instead of the picture. Only the product page itself was showing it. Fixed.',
  },
  {
    id: 97,
    date: '2026-07-24',
    area: 'Brands',
    summary:
      'Catalogue → Brands now lists only your own makers. Partner brands are created automatically when you add a collaborator and are managed under Collaborators, so they no longer appear mixed into the same list.',
  },
  {
    id: 96,
    date: '2026-07-24',
    area: 'Support',
    summary:
      'In the shop\'s chat bubble you can now scroll back through a conversation with a mouse — it used to refuse to scroll, and jump you back to the newest message every few seconds. The online/offline dot also stops flashing green before it knows the real answer.',
  },
  {
    id: 95,
    date: '2026-07-24',
    area: 'Storefront',
    summary:
      'Your pages now live at a clean address — minirueshop.com/terms instead of /pages/terms. Old links still work. The editor warns you if a slug clashes with a built-in shop address like "cart" or "products", which would have made the page unreachable.',
  },
  {
    id: 94,
    date: '2026-07-24',
    area: 'Storefront',
    summary:
      'Saving Storefront appearance with something invalid used to blank the whole page with a technical error. It now tells you which field is wrong. Social links typed without "https://" get it added automatically, so they no longer point back at the shop.',
  },
  {
    id: 93,
    date: '2026-07-24',
    area: 'Storefront',
    summary:
      'Dropdowns on the Storefront appearance page were sometimes showing "Could not load options". The page now loads each list once and shares it, and if something does go wrong it tells you what.',
  },
  {
    id: 92,
    date: '2026-07-24',
    area: 'Storefront',
    summary:
      'A collaborator showcase tab now only offers that collaborator\'s own products — MiniRue\'s and other brands\' products no longer appear in the list. Changing a tab\'s collaborator clears the picked products, and the storefront skips any product that does not belong to the tab.',
  },
  {
    id: 91,
    date: '2026-07-24',
    area: 'Storefront',
    summary:
      'Home page slides can now use your own photo. Set a slide\'s style to "Photo", pick or upload an image, and crop it — with ready-made shapes (wide, portrait, square) or a free crop you drag yourself. You can give a slide a separate portrait photo for phones, or crop one photo for both in a single step.',
  },
  {
    id: 90,
    date: '2026-07-24',
    area: 'Storefront',
    summary:
      'The announcement bar\'s background colour box was removed from Storefront appearance — the bar\'s colour is part of the shop\'s theme now. The colour on the live shop is unchanged.',
  },
  {
    id: 89,
    date: '2026-07-24',
    area: 'Products',
    summary:
      'Each product now has one clear cover photo — the picture shoppers see in listings, the cart and shared links — and every other photo shows inside the product carousel. Open a product, and use "Set as cover" under any photo to change it.',
  },
  {
    id: 88,
    date: '2026-07-24',
    area: 'Products',
    summary:
      'Product codes (SKUs) are now created for you from the product\'s category, brand, name and the variant you picked. Nobody types or edits them any more, and you can click a code to copy it for searching.',
  },
  {
    id: 87,
    date: '2026-07-24',
    area: 'Products',
    summary:
      'The brand name now shows on the product list and on the storefront product page — it was blank before.',
  },
  {
    id: 86,
    date: '2026-07-24',
    area: 'Collaborators',
    summary:
      'The brand slug on the new-collaborator form now follows the brand name as you type it, instead of freezing after the first letter. The "feature on home page" and "add to navbar" tick boxes were removed — those are set under Storefront.',
  },
  {
    id: 85,
    date: '2026-07-24',
    area: 'Storefront',
    summary:
      'Fixed product pages on the shop showing "Something went wrong" instead of the product.',
  },
  {
    id: 84,
    date: '2026-07-24',
    area: 'Support',
    summary:
      'On a phone, opening a conversation now always shows the reply box at the bottom of the screen — before, it could sit just below the visible area with nowhere to type.',
  },
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

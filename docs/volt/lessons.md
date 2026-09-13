# Volt lessons — minirue-dashboard

Read at the start of every session that touches this repo (volt Step 0).
Record a lesson the moment a mistake happens; evolve before landing.
Format and rules: `~/.claude/skills/volt/references/evolve.md`

---

### 1. A mock that answers every call the same breaks when the code asks a new question
- **Trap:** `listFolders` was mocked to return the same folder for any parent; when a subfolder started asking for its own children, a leaf "contained itself" and an unrelated test failed.
- **Do:** mocks answer **by argument** (`mockImplementation(async (parentId) => …)`); fix the fixture, never loosen the assertion.
- **Check:** the fixture returns different data for different arguments.
- **Seen:** 2026-09-13, #30 · **Hits:** 1

### 2. Existing data can predate a rule the UI now assumes
- **Trap:** the gallery became two levels on 2026-08-03 but legacy three-level folders were never backfilled; the UI treated subfolders as leaves, so a counted photo was unreachable.
- **Do:** when UI enforces a structural rule, check whether stored data can violate it and render it anyway (or ship a backfill). Read the code's own comments — this one described the case.
- **Check:** a test with legacy-shaped data renders it reachable.
- **Seen:** 2026-09-13, #30 · **Hits:** 1

### 3. The gallery picker returns videos — every preview of a picked item must handle `kind: 'video'`
- **Trap:** journal and hero editors painted a picked video URL into an image tag, a broken frame that looks like a failed upload.
- **Do:** anything that previews a gallery item branches on `item.kind` and uses `posterUrl` for a still.
- **Check:** a test picks a `kind: 'video'` item and asserts a `<video>` (or the poster), not an `<img>` with the movie URL.
- **Seen:** 2026-09-13, #32, #33 · **Hits:** 2

### 4. `react/no-unescaped-entities` fails the build on literal quotes in JSX text
- **Trap:** help text with `"Upload from this device"` failed lint.
- **Do:** use `<strong>`/`&quot;` instead of raw `"` in JSX text.
- **Check:** `npx eslint <file>` shows 0 errors.
- **Seen:** 2026-09-13, #32 · **Hits:** 1

### 5. A pre-existing lint warning is not yours — prove it before shipping around it
- **Trap:** `setState synchronously within an effect` warnings looked like regressions.
- **Do:** `git stash`, lint the same file on main, compare counts; note pre-existing warnings in the PR rather than "fixing" unrelated code.
- **Check:** warning count on main equals the count on the branch.
- **Seen:** 2026-09-13, #32 · **Hits:** 1

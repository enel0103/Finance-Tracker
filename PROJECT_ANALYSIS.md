# Yutori — Full Audit

_2026-10-23 · commit `e45a852` (unchanged since the first analysis) · `npm run build` passes_

**How this was checked.** I read every source file, then rendered every page against an in-memory
fake backend with realistic peso data (₱35k salary cutoffs, a custom category, a loan, bills due
today) at **360×780** (the most common Android width) and **768×1024** (iPad portrait). Overflow was
measured in the DOM, not eyeballed. Items marked _(code)_ can't be reproduced in a desktop emulator
(they need a real iPhone) and are based on reading the code.

---

## Part 1 — Mobile UI

### M1. Transactions page is 94px wider than the phone, which breaks every fixed element 🔴

[Transactions.jsx:229](src/pages/Transactions.jsx:229): the action row (month selector + Report +
Categories + Select + Add) is `flex` **without wrap**. At 360px:

| Element | Position | Visible? |
|---|---|---|
| Month selector | 16–230px | yes |
| Report | 238–286px | yes |
| Categories | 294–342px | yes |
| Select | 350–398px | **half cut off** |
| **+ Add** | 406–454px | **fully off-screen** |

The page becomes 454px wide. Mobile browsers then stretch every `position: fixed` element to the
widened layout: **the bottom nav and the modal overlays measured 454px wide**, and the visible area
was panned 82px. That is why the Report modal shows up clipped ("nthly Report", "750.50") and why the
page drifts sideways when you swipe. On a 768px tablet it's worse: the sidebar leaves 497px, the row
needs 677px, the page is 933px wide, and the table's edit/delete column scrolls out of view.

**Fix:** allow the row to wrap, put the month selector on its own line on mobile, and move **Add** to a
floating action button above the bottom nav. The icon-only buttons also need `aria-label`s; the Add
button currently has no accessible name on mobile at all.

### M2. Monthly History can't be reached on a phone 🔴

[Layout.jsx:14](src/components/Layout.jsx:14): `BOTTOM_NAV = NAV.slice(0, 5)` drops History, and the
mobile header only has Settings and Sign out. I confirmed in the DOM that no History link exists at
mobile widths; the page is only reachable by typing the URL. **Fix:** a sixth tab, a "More" tab, or a
History link in the header.

### M3. Summary amounts overflow their cards 🟠

[Dashboard.jsx:518](src/pages/Dashboard.jsx:518): the four summary values are `text-2xl` in a
2-column grid. At 360px, "₱82,500.00" needs **125px** and the card gives it **114px**, so it spills
into the padding by 11px. A six-figure month (₱100,000.00+) will cross the card border. The Report
modal's summary ([ReportModal.jsx:99](src/components/ReportModal.jsx:99)) is a fixed `grid-cols-3`
on every screen size, with 94px of text in a 96px box. **Fix:** `text-xl sm:text-2xl` plus
`tabular-nums`, and `grid-cols-1 sm:grid-cols-3` for the report.

### M4. Budget rows paint status pills underneath the amounts 🟠

[BudgetPlan.jsx:280-298](src/pages/BudgetPlan.jsx:280): both left-side pills are `flex-shrink-0`, so
the left group can't shrink and slides under the right group. On screen this reads
"Over ₱451.0₱8,451.00", "Goa₱12,500.00", "100₱5,000.00". **Fix:** on mobile, move the
"₱actual / ₱budget" text to its own line under the category pill.

### M5. iPhone zooms in on every input and stays zoomed _(code)_ 🟠

Every editable input measured **14px** (`.input` is `text-sm`,
[index.css:30](src/index.css:30)). iOS Safari auto-zooms any field under 16px when it's focused and
doesn't zoom back out, which leaves the layout looking broken until the user pinches back.
**Fix:** `text-base sm:text-sm` on `.input`. Don't disable zoom in the viewport meta, since that hurts
accessibility.

### M6. Bottom nav sits under the iPhone home indicator _(code)_ 🟠

[index.html:6](index.html:6) sets `viewport-fit=cover`, which lets the page draw edge to edge, but
nothing in the codebase uses `env(safe-area-inset-*)` (grep: zero hits). In the installed PWA on
Face ID iPhones, the tab labels sit under the home bar. **Fix:**
`pb-[env(safe-area-inset-bottom)]` on the bottom nav, and add the same inset to `main`'s bottom
padding.

### M7. Tap targets are 26–28px 🟡

Apple's minimum is 44px and Google's is 48px. Measured: Edit/Pause/Delete on bills and loans are
**26×26** and sit side by side ([Bills.jsx:332](src/pages/Bills.jsx:332),
[Loans.jsx:509](src/pages/Loans.jsx:509)). On Bills, **Pause has no confirmation**. In the mobile
header, **Sign out (28×28) sits next to Settings with no confirmation** — one slip logs you out.
**Fix:** at least 40px hit areas, and either confirm sign-out or move it into Settings.

### M8. "Download PDF" is probably broken on phones _(code)_ 🟡

[ReportModal.jsx:42](src/components/ReportModal.jsx:42) does `window.open` → `print()` →
`close()` 300ms later. Desktop Chrome's `print()` blocks, so this works there. Mobile `print()`
doesn't block, so the window closes and the print sheet goes with it. In an installed PWA,
`window.open` also leaves the app. **Fix:** print the current page using an `@media print`
stylesheet that hides everything except the report.

### M9. Smaller mobile issues 🟡

- **Wrong header title:** the mobile header says "Dashboard" on the Settings page
  ([Layout.jsx:18](src/components/Layout.jsx:18) falls back to it).
- **Unthemed category chips:** custom categories and `Loan` render as light-gray chips on the dark
  theme, because the `CATEGORY_BG` fallback has no dark variant.
- **Wrapping header buttons:** "Add bill" and "Add loan" wrap onto two lines, and the header has no
  gap between the title and the button.
- **Android-only install steps:** Settings tells everyone to use "Chrome → ⋮"; iPhone users need
  Safari → Share → Add to Home Screen. There's also no `apple-touch-icon`, and the PWA icons are
  SVG only.
- **Modal behavior:** modals don't close on Escape or Android back, don't trap focus, and don't
  lock the page scrolling behind them.
- **Number keyboards:** number fields have no `inputMode="decimal"`, which would give a cleaner
  keypad on phones.
- **Theme color mismatch:** `theme-color` is `#0f172a` in index.html but `#10b981` in the manifest,
  so the browser bar changes color once the app is installed.

---

## Part 2 — Logic bugs (all visible on the phone)

**L1. Month boundaries are off by one day.** 🔴 [`monthRange`](src/lib/utils.js:17) builds local
midnight and then calls `.toISOString()`, which converts to UTC. In UTC+8, that makes the August view
include July 31 and leave out August 31. This affects every total, list, budget and report.

**L2. `Loan` was never registered as a category.** 🔴 The mock showed it directly: the Expenses card
says **₱40,149.00**, but the category list adds up to **₱38,149.00**, because the ₱2,000 loan isn't
listed. Worse, editing a loan *repayment* in Transactions saves it as an expense, because
`isIncomeCat('Loan')` is false.

**L3. Bills due today say "Due in 31d".** 🟠 With today as Oct 23, *PLDT Fiber* (due the 23rd) showed
"Due in 31d" and was missing from the "coming up soon" alert. The cause is `<=` instead of `<` in
[Bills.jsx:28](src/pages/Bills.jsx:28). Bills due on the 29th–31st also roll over wrongly in short
months.

**L4. The loan badge contradicts the alert.** 🟠 The banner said "Maria Clara: reminder due today"
while her card said "42d ago" ([Loans.jsx:22](src/pages/Loans.jsx:22)).

**L5. Two screens show different "Buffer" numbers for the same month.** 🟠 _New._ For October,
Dashboard shows **₱46,601.50** (available minus expenses) and History shows **₱42,351.00** (excluding
carried-in money). Both are labeled "Buffer". Separately, Dashboard's "Last month's leftover" showed
₱46,601.50, which is *this* month's figure.

**L6. Hitting a savings target looks like overspending.** 🟡 _New._ Savings, Investments and
Emergency Fund are treated as spending caps
([BudgetPlan.jsx:265](src/pages/BudgetPlan.jsx:265)). At 100% they show an amber warning bar, and
saving more than planned shows red "Over budget".

**L7. A dead backend gives an infinite "Loading…".** 🟠 _Found during the outage._
[AuthContext.jsx:11](src/contexts/AuthContext.jsx:11) has no `.catch()` and no timeout. The
Supabase pause went unnoticed for three months because the app never said anything was wrong.

**Still open from the first analysis:**
- Budget targets have no month, but the page has a month selector.
- Carryover only looks at the single most recent active month.
- The implicit 1,000-row cap breaks the buffer math and History.
- Bills, `saveEf` and BudgetPlan swallow database errors.
- `ReportModal` renders fragments without keys.
- `unsettleLoan` has no confirmation.
- `ConfirmContext` can leave a promise that never resolves.
- `ensureSeed` marks a user as seeded even when seeding failed.

---

## Part 3 — Security and operations

**S1. The VAPID private key is committed to git.** 🔴
[SETUP_PUSH_NOTIFICATIONS.md:45](SETUP_PUSH_NOTIFICATIONS.md:45). Rotating the key is required;
deleting it from the file isn't enough, because it stays in git history. _Needs you._

**S2. The reminder edge function has no auth check.** 🔴 Anyone with the URL can trigger
notifications. The setup guide also puts the service-role key in plain text inside a `pg_cron` job.

**S3. RLS is confirmed on.** ✅ _Previously unverified._ All 6 tables returned `[]` to an anonymous
request. Anonymous reads are blocked; write policies and isolation between users aren't proven by
this test.

**S4. `transactions`, `budget` and `settings` have no migrations.** 🟠 The core schema exists only in
the live project.

**S5. Push notifications:**
- Loan reminders are promised but never sent.
- `aesgcm` encoding probably fails on iOS.
- Only one device per user can get notifications.

**S6. Free tier.** 🟡 The project pauses after about 7 idle days, and there are no scheduled backups.
Export a dump periodically.

**Housekeeping:**
- Dead imports and unused helpers.
- `dev-dist/` is committed to git.
- PWA packages are listed in `dependencies` instead of `devDependencies`.
- There's no light-mode toggle, so all the light styles are unreachable.

---

## Suggested fix order

| Batch | What | Size |
|---|---|---|
| **1 — Mobile** ✅ _done 2026-10-23, uncommitted_ | M1 header/FAB (+ tablets use the card list, Notes column narrowed below 1280px), M2 History in mobile header, M3 amount sizes, M4 budget rows, M5 16px inputs, M6 safe-area, M7 40px tap targets + sign-out moved to Settings, M9 header title, chip colors, header button wrap | 11 files, +150/−85 |
| **2 — Correctness** | L1 timezone, L2 Loan category, L3 due-today, L4 loan badge, L7 auth timeout | Small and surgical, ~5 files |
| **3 — Needs you** | S1 rotate VAPID key, S2 auth-gate the function, S4 dump schema | Your dashboard + a migration |
| **4 — Polish** | M8 print, L5/L6 naming & savings semantics, error surfacing, the rest | Medium |

The mock harness used for this audit is still in place (`.claude/launch.json` and the gitignored
`node_modules/.cache/yutori-audit/`), so I can re-measure each fix at 360px and 768px before calling
it done.

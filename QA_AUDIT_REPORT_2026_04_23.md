# QA Audit Report — vmfinancialservices.com

**Date**: 2026-04-23
**Tester**: Claude (senior QA architect, manual smoke pass)
**Build audited (git HEAD)**: `21d2fb2`
**Production host**: Railway edge (confirmed via `Server: railway-edge` response header)
**Site tested**: https://www.vmfinancialservices.com

---

## Executive summary

**Release decision: RED — HOLD.**

Critical production-side finding: **none of the last 3 commits have reached the live
site.** The AdSense content overhaul, DB pool fix, and ingestion scripts are all on
`origin/main` but not being served by Railway. Before any further QA value can be
extracted, the deployment pipeline must be unblocked. Everything else in this report is
downstream of that one issue.

Recommended action right now:

1. Log into Railway dashboard → check the project → confirm the build log for commit
   `21d2fb2` (and the two before it). If builds are failing, read the error and fix.
2. If builds are succeeding but not being promoted, check the Railway service's branch
   setting — it may be watching a branch other than `main`.
3. Once a successful deploy lands, re-run the §4 Smoke pass in
   [QA_MASTER_TEST_PLAN.md](QA_MASTER_TEST_PLAN.md) to confirm the content fixes are live.

---

## What was done this session

1. **Paywall hidden** — per your instruction ("Just hide the Pro upsell CTAs"):
   - `/premium` page now has `robots: { index: false, follow: false }` metadata.
   - `/premium` removed from sitemap.ts.
   - `/premium` added to robots.txt Disallow list.
   - Tax-impact API response no longer says "Upgrade to CFO Suite" — phrasing changed to
     informational "Full breakdown and slab analysis available in CFO Suite."
   - Dashboard and Profile already showed "Pro — Coming Soon" placeholders (not active
     upsells), so no change needed there.
   - No code paths removed; every `is_premium` flag and gating logic stays in place so
     the feature can be flipped back on in one revert.

2. **QA Master Test Plan authored** — [QA_MASTER_TEST_PLAN.md](QA_MASTER_TEST_PLAN.md),
   560+ manual test cases across 17 sections covering unit-equivalent function traces,
   integration API checks, E2E journeys, smoke, sanity, regression, performance, load,
   stress, accessibility, security, SEO, compliance, mobile, cross-browser, and i18n.
   Follow it top-to-bottom; each case has Expected/Status columns. Timeline: ~24 hours
   for a single tester; 2 days for a team of 3.

3. **Manual smoke pass executed on live prod** — findings below.

---

## Defect log

### BUG-001 — CRITICAL — AdSense commits not deployed to prod
- **Where**: https://www.vmfinancialservices.com
- **Evidence**: Root `/` redirects to `/markets` in prod (canonical points to `/markets`).
  The commit `7da1886 feat(seo): AdSense content overhaul` (rewrites `/` to a real page)
  was pushed to `origin/main` ~45 min ago but the live HTML still shows the old redirect.
- **Impact**: All AdSense readiness work is invisible to Google. Review cannot pass.
- **Expected**: `/` returns 200 with 975 words of original prose.
- **Actual**: `/` returns 200 but canonical = `/markets`, only 644 words (the `/markets`
  page body, not the new homepage).
- **Root cause hypothesis**: Railway build failing silently, or watching a non-main branch.
- **Fix**: Check Railway dashboard build log for `21d2fb2`.

### BUG-002 — CRITICAL — /author/ojasvi-malik returns 404 on prod
- **Evidence**: `GET /author/ojasvi-malik` → 404, canonical = `/_not-found`.
- **Impact**: E-E-A-T author page (critical for AdSense YMYL sites) does not exist on
  the live site. Every blog post byline linking to `/author/ojasvi-malik` will 404.
- **Fix**: Ship `7da1886`.

### BUG-003 — CRITICAL — Blog posts serve homepage metadata on prod
- **Evidence**: `GET /blog/ltcg-stcg-equity-mutual-funds-2026` returns 200 but
  `<title>` = "Vijay Malik Financial Services — Wealth Tools for Indian Investors"
  (i.e., the site-default title inherited from layout.tsx). The new per-post
  `generateMetadata` has not deployed.
- **Impact**: Google cannot distinguish one blog post from another in SERPs. Every
  indexed URL looks like a duplicate. This is a major AdSense red flag.
- **Fix**: Ship `7da1886` which contains the `blog/[slug]/page.tsx` server-component
  with `generateMetadata`.

### BUG-004 — CRITICAL — Fund detail pages render as empty shell to crawlers
- **Evidence**: `GET /funds/120716` returns only 98 words of HTML body text — the
  client-rendered skeleton before JavaScript hydrates. No scheme-specific `<title>` or
  `<meta description>`.
- **Impact**: Every fund URL is a thin page to Google. AdSense will read this as
  "infinite template with no unique content."
- **Fix**: Ship `7da1886` which splits `/funds/[schemeCode]` into server + client
  and adds DB-backed `generateMetadata`.

### BUG-005 — HIGH — /premium remains `index, follow` on prod
- **Evidence**: `GET /premium` → 200, `<meta name="robots" content="index, follow">`.
- **Impact**: Paywall page discoverable by crawlers; shows to AdSense reviewers the
  "Pro for ₹50/yr" pitch which is regulatory-questionable on an MFD site.
- **Fix**: Commit + push the uncommitted paywall-hide changes (see Next Actions below),
  and ensure they deploy.

### BUG-006 — HIGH — Sitemap still serves 568 URLs from old build
- **Evidence**: `/sitemap.xml` contains `/funds/<schemeCode>` entries that include
  matured FMPs (implied by 568 count — the new build caps at 70-ish relevant URLs plus
  500 non-matured funds). New blog URLs missing. Author URL missing. Root `/` missing.
- **Impact**: Google continues to crawl stale fund pages and ignores the new content.
- **Fix**: Ship deploy.

### BUG-007 — MEDIUM — Uncommitted paywall-hide changes sit in working tree
- **Evidence**: `git status` shows modified `src/app/premium/page.tsx`,
  `src/app/sitemap.ts`, `src/app/api/portfolio/tax-impact/route.ts`, `public/robots.txt`,
  `package-lock.json`.
- **Impact**: Work done this session has not been pushed to `origin/main` yet and
  therefore cannot be picked up by Railway even if its pipeline is working.
- **Fix**: Commit + push. (Doing this in next action.)

### BUG-008 — MEDIUM — Blog index serves pre-expansion content
- **Evidence**: `GET /blog` returns 549 words; new blog expansion to 12 posts lives in
  `src/app/blog/[slug]/blog-posts.ts` (not deployed).
- **Impact**: Blog appears with only 2 posts to any crawler today.
- **Fix**: Same deploy.

### BUG-009 — LOW — robots.txt on prod does not yet block /premium
- **Evidence**: `GET /robots.txt` does not include `Disallow: /premium`.
- **Impact**: Google may crawl /premium until deploy lands + caches expire.
- **Fix**: Commit + push the updated `public/robots.txt`; ship deploy.

---

## Latency snapshot (live prod)

All measurements cold from the test machine over HTTPS.

| Path | Status | Latency | Verdict |
|---|---|---|---|
| `/` | 200 | 459ms | OK |
| `/blog` | 200 | 761ms | Acceptable; can improve with new SSG build |
| `/blog/ltcg-stcg-equity-mutual-funds-2026` | 200 | 372ms | OK (SSG would be faster) |
| `/funds/120716` | 200 | 721ms | OK; client-rendered so TTFB cheap |
| `/markets/NIFTY` | 200 | 497ms | OK |
| `/author/ojasvi-malik` | 404 | 567ms | BROKEN |
| `/calculators/sip` | 200 | 678ms | OK |
| `/sitemap.xml` | 200 | 861ms | OK, DB query inside |
| `/robots.txt` | 200 | 349ms | OK |
| `/premium` | 200 | 794ms | LIVE — should be de-indexed |

---

## Checks that passed (live prod)

- TLS valid, cert OK.
- Non-error status codes on all routes except `/author/ojasvi-malik`.
- Response times within Core Web Vitals ballpark.
- `robots.txt` correctly disallows `/auth/`, `/admin/`, `/dashboard`, `/goals`,
  `/portfolio`, `/profile`, `/goal-planning`, `/api/`.
- Sitemap reachable and well-formed XML.
- ads.txt is served at `/ads.txt` with pub-8245125390626462 (per earlier session).

---

## Checks not executed (deferred)

These require either an authenticated session or a privileged environment and are
documented as pending in [QA_MASTER_TEST_PLAN.md](QA_MASTER_TEST_PLAN.md):

- Sign-in / Sign-up flow (§3.5, §3.6)
- CAS PDF upload flow (§3.7)
- Goal creation and deletion (§3.8)
- Admin routes behind auth (§2.4)
- Rate-limit behaviour under brute-force (§10.5)
- Load / stress tests on localhost (§8) — not yet run; instructions are in the plan
- Lighthouse + Core Web Vitals — require Chrome DevTools on each page (§7)
- axe DevTools accessibility scan (§9.3) — needs browser with extension
- Cross-browser matrix (§14) — needs physical devices

These are all blocked until BUG-001 through BUG-006 (deploy pipeline) are fixed. There
is no value in running any of them against a pre-AdSense build.

---

## Paywall hide — what was changed this session

All changes reversible with a single `git revert`.

### File: `src/app/premium/page.tsx`
- Added `Metadata` export with `robots: { index: false, follow: false }`.
- Page body unchanged — still reads "Coming Soon".

### File: `src/app/sitemap.ts`
- Removed the `{ url: `${BASE_URL}/premium`, ... }` entry.

### File: `public/robots.txt`
- Added `Disallow: /premium`.

### File: `src/app/api/portfolio/tax-impact/route.ts`
- Line 102: `"Upgrade to CFO Suite for full tax breakdown and slab analysis."` →
  `"Full tax breakdown and slab analysis available in CFO Suite."`
- Removes the upsell verb "Upgrade"; keeps the informational pointer for users who
  already have Pro.

### What was NOT changed (intentionally, per your answer "Just hide the Pro upsell CTAs")
- `is_premium` flag in DB, AuthContext, and every API route that checks it — preserved.
- Feature-gating logic in `portfolio/red-flags` and `portfolio/tax-impact` — preserved.
- `/admin/claims` admin approval flow for UPI-based premium grants — preserved.
- Dashboard and Profile "Pro — Coming Soon" placeholders — preserved (they are not
  active CTAs; they signal status without selling anything).
- Cron jobs that check `is_premium` (`evaluate-goals`, `goal-drift`) — preserved.

Flip switch: deleting `robots: { index: false, follow: false }` from `premium/page.tsx`
and restoring the sitemap entry brings the paywall back in one commit.

---

## Next actions in order

1. **You**: log into Railway and tell me the deploy status for commit `21d2fb2`.
2. **Me (next session)**: commit + push the paywall-hide changes.
3. **You + me together**: once Railway deploy is green, re-run the Master Plan §4 Smoke
   pass. Expect all 5 CRITICAL bugs above to flip to green.
4. **You or a tester**: work through Master Plan §2 (API integration) and §3 (E2E).
   Target one working day.
5. **You**: Google Search Console → resubmit sitemap → request indexing for `/`, all 12
   blog URLs, and `/author/ojasvi-malik`.
6. **You**: AdSense dashboard → Request review once §4, §11, §12 of the Master Plan are
   all green.

---

## Files delivered this session

- `QA_MASTER_TEST_PLAN.md` — the 560-case manual test plan you asked for.
- `QA_AUDIT_REPORT_2026_04_23.md` — this report.
- `src/app/premium/page.tsx`, `src/app/sitemap.ts`, `public/robots.txt`,
  `src/app/api/portfolio/tax-impact/route.ts` — paywall-hide code changes (uncommitted).

No automation tests were written, per your explicit instruction. The test plan is
entirely manual, executable by anyone with Chrome, a Postman, and a Node REPL.

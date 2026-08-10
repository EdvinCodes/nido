# Phase 11 — Landing page and polish

## Goal

Make it look like a product someone paid for. A landing page that converts a GitHub visitor
into a user, and a pass over the whole application removing every rough edge accumulated
across ten phases.

This phase has no new domain logic. If you find yourself writing a migration, you are doing
the wrong phase.

## Required reading

- [`../03-DESIGN-SYSTEM.md`](../03-DESIGN-SYSTEM.md) — all of it, especially §§ 8, 9, 10
- [`../00-PROJECT.md`](../00-PROJECT.md) — §§ 1, 2, 7

## Tasks

### 1. Brand assets

1. The Nido mark and wordmark as an inline SVG component with `mark`, `wordmark`, and
   `lockup` variants, driven by `currentColor`.
2. Favicon set, maskable PWA icons, and Apple touch icons generated from the mark.
3. Open Graph images generated per route with `next/og`: a default one for the landing and
   dynamic ones for the docs pages.
4. A small brand page at `/brand` with the logo files, the colour palette, and usage notes.
   Cheap to build and it makes an open-source project look serious.

### 2. Landing page

`/`, server-rendered with near-zero client JavaScript, built exactly as
[`../03-DESIGN-SYSTEM.md`](../03-DESIGN-SYSTEM.md) § 9 lays out. Notes on the parts that are
easy to do badly:

- Screenshots must be real, captured from the seeded demo space by a Playwright script
  committed to the repo so they can be regenerated when the UI changes. No mockups, no
  Figma exports, no fake numbers.
- The hero device frame is a CSS treatment, not an image, so it stays sharp at every density.
- Scroll-triggered reveals use `IntersectionObserver` with a 40 ms stagger, disabled under
  `prefers-reduced-motion`, and must never cause layout shift.
- Copy in Spanish first, then English, both hand-written. No translated-sounding English.
- Everything above the fold renders without JavaScript.

Also build `/privacy` (short, blunt, honest), `/changelog` (generated from git tags), and
`/docs` rendering this documentation folder as navigable pages with a sidebar and search.

### 3. Application polish pass

Go through every route and fix what accumulated. This is a checklist, not a suggestion:

- **Empty states.** Every list, table, and chart has a written empty state with a display
  heading, one sentence, and one action. No generic "No data".
- **Loading states.** Every skeleton matches the real content's dimensions. No spinners, no
  layout shift on load.
- **Error states.** Every error boundary has a retry and says what happened. "Something went
  wrong" appears nowhere in the codebase — grep for it.
- **Copy review.** Every string read once for tone against the voice rules. No exclamation
  marks about money, no judgement, no jargon.
- **Micro-interactions.** Hover, focus, active, and disabled states on every interactive
  element. Buttons show a loading state and are disabled during submission.
- **Transitions.** View Transitions on route changes with a crossfade fallback.
- **Number animations.** Dashboard figures count up on first mount only.
- **Keyboard shortcuts.** ⌘K palette, `n` for new transaction, `g` then a letter for
  navigation, `?` for a shortcuts dialog listing them all.
- **Toasts.** Consistent placement, duration, and undo behaviour everywhere.
- **Scroll restoration** on back navigation in the ledger.
- **Focus management** in every dialog and sheet: trapped on open, restored on close.

### 4. Accessibility audit

- `@axe-core/playwright` on every route in both themes, in CI, with zero violations.
- Manual keyboard-only pass through every critical journey, documented in the phase notes.
- Screen reader pass with NVDA or VoiceOver on the ledger, the transaction form, and the
  dashboard.
- Verify the contrast script covers every token pair actually used.
- Confirm every chart's hidden data table is present, correct, and reachable.

### 5. Performance audit

- Analyse the bundle with `@next/bundle-analyzer` and record the per-route figures in the
  phase notes.
- Confirm Recharts, `@react-pdf/renderer`, SheetJS, and the assistant panel are all
  dynamically imported and absent from the initial bundle.
- Fonts subsetted, preloaded, `display: swap`, and self-hosted.
- Lighthouse on `/`, `/s/[id]`, and `/s/[id]/ledger`, mobile emulation, all meeting the
  budgets in [`../01-ARCHITECTURE.md`](../01-ARCHITECTURE.md) § 8. Record the numbers.
- Verify the ledger holds 60 fps with 10 000 rows on a throttled CPU.

### 6. SEO and metadata

Per-route metadata, canonical URLs, `sitemap.ts`, `robots.ts`, JSON-LD for the software
application, and correct `hreflang` for both locales.

### 7. Repository presentation

The open-source surface matters as much as the product:

- README refreshed with real screenshots and a working quickstart.
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`.
- Issue and pull request templates.
- A `docker-compose.yml` that brings up self-hosted Supabase plus the app, tested from
  scratch on a clean machine and documented step by step.
- A "Deploy to Vercel" button with the required environment variables declared.
- Repository topics, description, and a social preview image.

## Acceptance criteria

- [ ] Lighthouse on the landing page, mobile: performance ≥ 95, accessibility 100, best
      practices 100, SEO 100.
- [ ] Lighthouse on the dashboard, mobile: performance ≥ 95, accessibility 100.
- [ ] Zero axe violations on every route in both themes, enforced in CI.
- [ ] Every critical journey completable with the keyboard alone.
- [ ] Every route has a real empty, loading, and error state — verified route by route and
      listed in the phase notes.
- [ ] Screenshots on the landing page are generated by the committed script and match the
      current UI.
- [ ] `docker compose up` produces a working Nido on a clean machine following only the README.
- [ ] The string "Something went wrong" does not appear in the codebase.
- [ ] `pnpm verify`, `pnpm test:db`, `pnpm test:e2e` pass.

## Out of scope

Any new feature. Anything requiring a migration. The AI assistant, which is the next phase.

## Verification

```bash
pnpm build && pnpm start
pnpm test:e2e
pnpm dlx lighthouse http://localhost:3000 --preset=perf --form-factor=mobile
pnpm tsx scripts/capture-screenshots.ts
```

# Performance baseline

Recorded 2026-08-13 against `pnpm start` at `http://127.0.0.1:3000`.
Mobile emulation, Lighthouse simulated 4G. **Docker / WSL RAM was not raised** (work machine).

Re-run: `pnpm build && pnpm start` in one terminal, then `pnpm perf:audit`. Dashboard and ledger need local Supabase (`pnpm db:start`); they were skipped here because the DB container was stopped.

## Lighthouse (mobile)

| Route     | Perf | A11y | Best practices | SEO | LCP (ms) | CLS | INP (ms) |
| --------- | ---: | ---: | -------------: | --: | -------: | --: | -------: |
| landing   |   75 |  100 |            100 | 100 |     8120 |   0 |        — |
| dashboard |    — |    — |              — |   — |        — |   — |        — |
| ledger    |    — |    — |              — |   — |        — |   — |        — |

Targets ([docs/01-ARCHITECTURE.md](../01-ARCHITECTURE.md) § 8): landing LCP < 1200 ms, dashboard LCP < 1500 ms, INP < 200 ms, CLS < 0.05. Phase 11 also asked for perf ≥ 95 and a11y 100.

Landing **a11y / best practices / SEO hit 100**. Perf 75 is LCP: the hero screenshot `public/screenshots/marketing/hero.png` (~363 KB PNG) plus a second 363 KB PNG (`splits.png`) on simulated 4G. FCP was ~1.2 s; TBT 90 ms; CLS 0. Compressing those marketing screenshots (WebP/AVIF, dimensions) is the lever — not raising Docker RAM.

INP is not scored on a Lighthouse navigation run.

## Bundle (`pnpm bundle:baseline` after Turbopack `pnpm build`)

90 JS files under `.next/static`, **1019.8 KB gzipped** in total (entire app, not first paint).

Largest chunks:

| KB gzip | Notes                                      |
| ------: | ------------------------------------------ |
|   136.6 | `xlsx` (SheetJS) — own chunk, async import |
|    88.1 | `recharts` — own chunk, async import       |
|    71.6 | hashed                                     |
|    58.5 | hashed                                     |
|    55.5 | hashed                                     |

`xlsx` and `recharts` are **not** inlined into a shared first-paint file; they load as separate chunks. `@react-pdf` did not appear in client chunk text. `pnpm analyze` (`ANALYZE=true`) wraps `@next/bundle-analyzer` (webpack treemap, `openAnalyzer: false`). Default `pnpm build` stays on Turbopack.

The 180 KB gzipped **dashboard first-load** budget cannot be read as a single number from hashed Turbopack chunks; treat the 88 KB Recharts chunk as the chart payload that must stay async (it does).

## Out of this run

- Full `pnpm test:e2e` with ≥6 GB Docker RAM — **not done**. Keep the 4 GB cap at work; the 2 known timeouts stay parked.
- Git tag `v0.x` — not created (ask when you want a real changelog).

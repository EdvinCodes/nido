# 03 — Design system

The goal is a product that feels like a well-made native app, not a dashboard template.
Calm, dark-first, generous whitespace, one confident accent colour, numbers that are a
pleasure to read, and motion that explains rather than decorates.

---

## 1. Brand

**Nido** — Spanish for *nest*. The place where things are gathered and kept safe. Warm,
domestic, shared. The visual language leans warm-neutral rather than the cold blue-grey
every finance app defaults to, which is the single cheapest way to not look like everyone else.

**Logotype.** Wordmark in the display serif, lowercase, tight tracking. The mark is a
simplified nest: three overlapping arcs forming a bowl, which also reads as a stacked bar
chart. Provided as an inline SVG component (`src/components/brand/logo.tsx`) with `mark`,
`wordmark`, and `lockup` variants, currentColor-driven so it inherits the theme.

**Voice.** Plain, warm, never preachy. Nido reports; it does not scold. "You are 40 € over
your Groceries budget" — not "Careful! You have overspent!". Never gamify guilt, never use
exclamation marks in financial copy, never call a person's spending "bad".

---

## 2. Colour

All colour is defined in OKLCH in `src/app/globals.css` under Tailwind v4's `@theme`
directive. Never write a raw hex in a component.

### Neutrals — warm ink

Dark is the primary theme and is designed first; light is a genuine second theme, not an
inversion.

| Token | Dark | Light | Use |
| --- | --- | --- | --- |
| `--color-background` | `oklch(0.155 0.006 65)` | `oklch(0.990 0.004 85)` | Page |
| `--color-surface` | `oklch(0.195 0.007 65)` | `oklch(1 0 0)` | Cards |
| `--color-surface-raised` | `oklch(0.235 0.008 65)` | `oklch(0.985 0.003 85)` | Popovers, sheets |
| `--color-border` | `oklch(0.290 0.008 65)` | `oklch(0.915 0.005 85)` | Hairlines |
| `--color-muted` | `oklch(0.640 0.012 65)` | `oklch(0.520 0.012 65)` | Secondary text |
| `--color-foreground` | `oklch(0.965 0.004 85)` | `oklch(0.200 0.008 65)` | Primary text |

### Accent and semantics

| Token | Value | Meaning |
| --- | --- | --- |
| `--color-primary` | `oklch(0.780 0.150 72)` | Honey amber. The one accent. Primary actions, focus rings, active nav. |
| `--color-primary-foreground` | `oklch(0.180 0.020 72)` | Text on primary |
| `--color-income` | `oklch(0.760 0.130 165)` | Money in. Sage green, not neon. |
| `--color-expense` | `oklch(0.690 0.165 28)` | Money out. Warm coral, not alarm red. |
| `--color-warning` | `oklch(0.820 0.150 85)` | Budget approaching |
| `--color-danger` | `oklch(0.620 0.200 22)` | Destructive actions only |
| `--color-info` | `oklch(0.720 0.100 240)` | Neutral informational |

Income and expense are deliberately **not** pure green and red. Red-green is the worst
possible pair for the ~8 % of men with deuteranomaly, and this app has exactly one male
primary user with a long life ahead of it. Direction is always encoded twice: colour **and**
a sign or arrow glyph. A colourblind-safe alternate palette (teal / violet) ships as a
setting.

### Category palette

Twelve hand-picked hues at matched lightness and chroma so no category visually shouts over
another in a pie chart. Exposed as `--color-cat-1` … `--color-cat-12` and offered in the
category colour picker. Charts consume this palette in order; the same category always gets
the same colour across every chart in the app, driven by the category's stored hex.

### Contrast

Every text/background pair meets WCAG AA (4.5:1 for body, 3:1 for large text and UI
boundaries). Verified in CI by a script that walks the token pairs and fails the build on a
regression. Focus rings are 2 px `--color-primary` with a 2 px offset and are never removed.

---

## 3. Typography

| Role | Family | Notes |
| --- | --- | --- |
| Display | **Instrument Serif** | Landing headlines and empty-state headings only. Loaded on the marketing routes; never on the app shell. |
| UI | **Geist Sans** (variable) | Everything else |
| Numbers | **Geist Mono** (variable) | All amounts, with `font-variant-numeric: tabular-nums` |

Amounts are always tabular. A column of numbers whose digits do not line up is the fastest
way to make a finance app feel amateur.

Scale (`rem`, 16 px root): `xs 0.75 / sm 0.875 / base 1 / lg 1.125 / xl 1.25 / 2xl 1.5 /
3xl 1.875 / 4xl 2.25 / 5xl 3 / 6xl 4`. Line heights: 1.5 for body, 1.15 for display.
Tracking: `-0.02em` on display, `-0.011em` on headings, `0` on body.

`.tabular` and `.amount` utility classes exist so no component reinvents number styling.

---

## 4. Spacing, radius, elevation

- **Spacing** is a 4 px scale. Layout gutters: 16 px on mobile, 24 px on tablet, 32 px on
  desktop. Content max width 1440 px; reading columns capped at 72 ch.
- **Radius**: `--radius-sm 6px`, `--radius-md 10px`, `--radius-lg 14px`, `--radius-xl 20px`,
  `--radius-full 9999px`. Cards use `lg`, inputs and buttons use `md`, sheets use `xl`.
- **Elevation** in dark mode comes from surface lightness plus a hairline border, not from
  drop shadows. Shadows exist only on floating layers (popover, dialog, FAB) and are
  large-radius, low-opacity, warm-tinted: `0 8px 32px -8px oklch(0 0 0 / 0.45)`.
- One accent gradient exists, used sparingly on the landing hero and the primary balance
  card: `linear-gradient(135deg, oklch(0.80 0.15 72), oklch(0.72 0.14 40))`.

---

## 5. Layout

**Desktop (≥ 1024 px).** Collapsible left sidebar (240 px, 64 px collapsed) with the space
switcher at the top, primary navigation, and the user menu pinned at the bottom. Main
content area with a sticky header carrying the page title, the global date-range picker, and
the quick-add button. An optional right rail (320 px) on the dashboard for alerts and
insights.

**Tablet (768–1023 px).** Sidebar collapses to icons. Right rail becomes a section below
the main content.

**Mobile (< 768 px).** Bottom tab bar with five destinations: Home, Ledger, **Add**
(centre, elevated, primary), Budgets, More. The space switcher moves into the header. Every
secondary flow is a bottom sheet with a drag handle, not a modal dialog. Safe-area insets
respected on both axes.

Navigation destinations: Dashboard · Ledger · Budgets · Goals · Balances (hidden in solo
spaces) · Subscriptions · Reports · Assistant · Settings.

---

## 6. Components

Built on shadcn/ui (new-york), copied into `src/components/ui` and edited freely. On top of
the primitives, these product-specific components are shared across features:

| Component | Behaviour |
| --- | --- |
| `<Amount>` | Formats minor units with currency, locale, tabular figures, optional sign colouring, optional `±` glyph, optional "approximately" marker when converted from another currency. **The only place money is ever rendered.** |
| `<AmountInput>` | Numeric keypad on mobile, locale-aware decimal separator, inline arithmetic (`12,50+3` evaluates on blur), currency selector, never produces a float. |
| `<CategoryBadge>` | Icon + name in the category colour at the correct contrast. |
| `<ParticipantAvatar>` / `<ParticipantStack>` | Initials fallback, deterministic colour, overflow counter. |
| `<SplitEditor>` | The heart of the app. Mode switcher, per-participant rows, live remainder indicator that turns amber when the split does not balance, one-tap presets ("even", "all mine", "all theirs"). |
| `<PeriodPicker>` | Presets (this month, last month, last 3 months, this year, custom) with a keyboard-navigable range calendar. State lives in the URL via `nuqs`. |
| `<ProgressRing>` / `<ProgressBar>` | Budget and goal progress, with the over-limit portion rendered in `--color-danger` beyond 100 %. |
| `<TrendDelta>` | "+12 % vs last month" with an arrow, coloured by whether the change is good, which depends on whether it is income or expense. |
| `<EmptyState>` | Display-serif heading, one sentence, one action. Every list has one, and it is written, not generic. |
| `<QuickAdd>` | The 10-second capture flow: amount, category, done. Everything else is progressive disclosure. |
| `<CommandPalette>` | ⌘K / Ctrl+K. Navigate, search transactions, add an expense, switch space. |

Every list, chart, and table has four explicit visual states: **loading** (skeleton matching
the real layout, never a spinner), **empty**, **error** (with a retry), and **populated**.
A component missing one of these is not done.

---

## 7. Charts

Recharts, wrapped so no feature ever touches Recharts directly. Shared conventions: no
gridlines on the y-axis except a faint zero line, axis labels in `--color-muted` at `xs`,
currency-abbreviated ticks (`1,2 k €`), tooltips as a card with the full amount and the
transaction count, and animated entry only on first mount (never on data refresh, which is
nauseating).

| Chart | Where |
| --- | --- |
| Area with gradient | Daily balance evolution on the dashboard |
| Grouped bars | Income vs expense by month, with the previous period ghosted behind |
| Donut with centre total | Spend by category, click to filter the ledger |
| Horizontal bars | Top merchants, top categories |
| Stacked bars | Spend by participant over time |
| Sparklines | Inside budget and subscription cards |
| Calendar heatmap | Spending intensity by day of month |

---

## 8. Motion

Motion (`motion/react`). Durations: 150 ms micro (hover, press), 250 ms standard (sheets,
popovers), 400 ms large (page and view transitions). Easing: spring `{ stiffness: 400,
damping: 32 }` for anything that moves position or scale, `cubic-bezier(0.32, 0.72, 0, 1)`
for opacity and size.

Specific moments worth the effort:

- Numbers on the dashboard count up on first load only, over 600 ms, easing out.
- The quick-add sheet springs from the FAB's position, and the FAB morphs into the sheet's
  header on mobile.
- Adding a transaction slides it into the ledger with a brief accent highlight that fades
  over 1.2 s, so a partner's remote addition is noticeable but not disruptive.
- Budget rings animate their arc from the previous value, not from zero, on updates.
- Route changes use the View Transitions API where supported, with a plain crossfade fallback.

`prefers-reduced-motion: reduce` disables all transforms and count-ups and keeps only
opacity fades at 100 ms. This is enforced globally in `globals.css`, not per component.

---

## 9. Landing page

A public marketing page at `/` that has to do one job: make someone who found the GitHub
repo want to run it. Server-rendered, near-zero JavaScript, target LCP under 1.2 s.

Sections, in order:

1. **Hero.** Display-serif headline ("Todo el dinero de casa, en un solo nido"), one
   sentence of subhead, two buttons (Start free · View on GitHub), and a real product
   screenshot in a subtly tilted device frame with a soft amber glow behind it. Dark
   background with a very low-contrast noise texture. No stock photography, ever.
2. **Social proof strip.** GitHub stars, MIT licence, self-hostable, no tracking. Honest —
   no fake logos.
3. **The problem.** Three short cards describing the spreadsheet, the "who paid for what"
   argument, and the forgotten subscription.
4. **Feature showcase.** Four alternating rows, each with a real interactive-looking
   screenshot: the split editor, the dashboard, budgets and alerts, balances. Copy in
   plain language, one benefit per row.
5. **Modes.** Three cards — Solo, Couple, Flatshare — showing how the same app adapts.
6. **The assistant.** A mocked chat exchange showing a real question and a specific,
   evidence-backed answer. Labelled clearly as optional and bring-your-own-key.
7. **Privacy.** Short and blunt: your data, your database, no trackers, open source.
8. **Open source.** Stack badges, a link to the docs, and a two-line quickstart snippet.
9. **Final call to action** and a minimal footer.

Also public: `/privacy`, `/changelog`, `/docs` (rendered from this folder).
OG images are generated with `next/og` per route.

---

## 10. Accessibility

Non-negotiable, verified in CI with `@axe-core/playwright` on every route:

- Every interactive element reachable and operable by keyboard, in a logical order.
- Visible focus at all times; focus is trapped in dialogs and restored on close.
- Form fields have real labels, and errors are announced via `aria-live` and linked with
  `aria-describedby`.
- Charts have an accessible alternative: every chart is accompanied by a visually hidden
  table with the same data, and by a toggle to show that table visibly.
- Touch targets are at least 44 × 44 px.
- Language is set per route from the i18n locale.
- Nothing conveys meaning by colour alone.

---

## 11. Content and formatting rules

- Currency formatting follows the user's locale via `Intl.NumberFormat`, but the currency
  is always the transaction's own currency. `1.234,56 €` in `es-ES`, `€1,234.56` in `en-US`.
- Dates are relative when recent ("Today", "Yesterday", "Monday"), absolute beyond a week.
- Big numbers are abbreviated only in charts and compact cards, never in the ledger.
- Empty amounts render as `—`, never as `0,00 €`, because zero and unknown are different.
- Destructive confirmations name the thing being destroyed and state what is not recoverable.
- Error messages say what happened, why, and what to do next. "Something went wrong" is
  banned.

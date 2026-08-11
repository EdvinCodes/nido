# Contributing to Nido

Thanks for helping improve Nido. This project is built phase by phase — read
[`docs/phases/README.md`](./docs/phases/README.md) before starting substantial work.

## Getting started

1. Fork and clone the repository.
2. Install Node 22+ and [pnpm](https://pnpm.io).
3. Copy `.env.example` to `.env.local`.
4. Run `pnpm install`, `pnpm db:start`, `pnpm db:reset`, and `pnpm dev`.

See the [README](./README.md) for the full quickstart.

## Definition of done

Every change should pass:

```bash
pnpm verify
pnpm test:db    # when touching SQL or RLS
pnpm test:e2e   # when touching user-facing flows
pnpm check:i18n # when adding strings
```

Read [`docs/06-CONVENTIONS.md`](./docs/06-CONVENTIONS.md) for commit format, testing standards,
and code style.

## Pull requests

- One logical change per PR when possible.
- Conventional Commits in English (`feat(ledger): …`, `fix(budgets): …`).
- No migrations in polish-only PRs; schema changes need pgTAP coverage.
- User-visible strings go through `next-intl` in both `es` and `en`.

## Reporting issues

Use the bug or feature template on GitHub. For security issues, see [SECURITY.md](./SECURITY.md).

## Code of conduct

This project follows the [Contributor Covenant](./CODE_OF_CONDUCT.md).

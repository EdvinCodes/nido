import { notFound } from 'next/navigation';
import { ComponentsDemo } from './components-demo';
import { ThemeToggle } from './theme-toggle';

/**
 * Design-system review page. Renders every token and installed component in both themes,
 * so the design system can be reviewed as a real deliverable rather than trusted on faith.
 * See docs/03-DESIGN-SYSTEM.md and Phase 00 task 3.6.
 *
 * Excluded from production: the route 404s outside development so it never ships to users.
 */
export default function DevTokensPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-10 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-display-sm">Design tokens</h1>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            Every colour, radius, shadow, type size, and installed component from
            docs/03-DESIGN-SYSTEM.md. Toggle the theme to check both.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <Section title="Neutrals">
        <SwatchGrid
          swatches={[
            { name: 'background', className: 'bg-background border' },
            { name: 'surface', className: 'bg-surface border' },
            { name: 'surface-raised', className: 'bg-surface-raised border' },
            { name: 'border', className: 'bg-border' },
            { name: 'muted', className: 'bg-muted' },
            { name: 'foreground', className: 'bg-foreground' },
          ]}
        />
      </Section>

      <Section title="Accent and semantics">
        <SwatchGrid
          swatches={[
            { name: 'primary', className: 'bg-primary' },
            { name: 'secondary', className: 'bg-secondary border' },
            { name: 'accent', className: 'bg-accent border' },
            { name: 'income', className: 'bg-income' },
            { name: 'expense', className: 'bg-expense' },
            { name: 'warning', className: 'bg-warning' },
            { name: 'danger', className: 'bg-danger' },
            { name: 'info', className: 'bg-info' },
          ]}
        />
      </Section>

      <Section title="Category palette">
        <SwatchGrid
          swatches={[
            { name: 'cat-1', className: 'bg-cat-1' },
            { name: 'cat-2', className: 'bg-cat-2' },
            { name: 'cat-3', className: 'bg-cat-3' },
            { name: 'cat-4', className: 'bg-cat-4' },
            { name: 'cat-5', className: 'bg-cat-5' },
            { name: 'cat-6', className: 'bg-cat-6' },
            { name: 'cat-7', className: 'bg-cat-7' },
            { name: 'cat-8', className: 'bg-cat-8' },
            { name: 'cat-9', className: 'bg-cat-9' },
            { name: 'cat-10', className: 'bg-cat-10' },
            { name: 'cat-11', className: 'bg-cat-11' },
            { name: 'cat-12', className: 'bg-cat-12' },
          ]}
        />
      </Section>

      <Section title="Radius">
        <div className="flex flex-wrap gap-6">
          <RadiusSwatch name="sm" className="size-16 rounded-sm bg-primary" />
          <RadiusSwatch name="md" className="size-16 rounded-md bg-primary" />
          <RadiusSwatch name="lg" className="size-16 rounded-lg bg-primary" />
          <RadiusSwatch name="xl" className="size-16 rounded-xl bg-primary" />
          <RadiusSwatch name="2xl" className="size-16 rounded-2xl bg-primary" />
        </div>
      </Section>

      <Section title="Elevation">
        <div className="flex flex-wrap gap-8 py-4">
          <ElevationSwatch
            name="raised"
            className="flex size-24 items-center justify-center rounded-lg bg-surface text-xs text-muted-foreground shadow-raised"
          />
          <ElevationSwatch
            name="overlay"
            className="flex size-24 items-center justify-center rounded-lg bg-surface text-xs text-muted-foreground shadow-overlay"
          />
          <ElevationSwatch
            name="float"
            className="flex size-24 items-center justify-center rounded-lg bg-surface text-xs text-muted-foreground shadow-float"
          />
        </div>
      </Section>

      <Section title="Typography">
        <div className="grid gap-3">
          <p className="font-display text-display-lg">Display large</p>
          <p className="font-display text-display-md">Display medium</p>
          <p className="font-display text-display-sm">Display small</p>
          <p className="text-6xl">Text 6xl</p>
          <p className="text-5xl">Text 5xl</p>
          <p className="text-4xl">Text 4xl</p>
          <p className="text-3xl">Text 3xl</p>
          <p className="text-2xl">Text 2xl</p>
          <p className="text-xl">Text xl</p>
          <p className="text-lg">Text lg</p>
          <p className="text-base">Text base</p>
          <p className="text-sm">Text sm</p>
          <p className="text-xs">Text xs</p>
          <p className="amount text-2xl">1.234,56 €</p>
          <p className="text-sm text-muted-foreground">
            Amounts use <code>.amount</code> / <code>.tabular</code> for tabular figures in Geist
            Mono.
          </p>
        </div>
      </Section>

      <Section title="Components">
        <ComponentsDemo />
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <h2 className="mb-4 text-lg font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function RadiusSwatch({ name, className }: { name: string; className: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={className} />
      <span className="font-mono text-xs text-muted-foreground">{name}</span>
    </div>
  );
}

function ElevationSwatch({ name, className }: { name: string; className: string }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className={className}>{name}</div>
    </div>
  );
}

function SwatchGrid({ swatches }: { swatches: { name: string; className: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {swatches.map((swatch) => (
        <div key={swatch.name} className="flex flex-col gap-2">
          <div className={`h-16 rounded-lg ${swatch.className}`} />
          <span className="font-mono text-xs text-muted-foreground">{swatch.name}</span>
        </div>
      ))}
    </div>
  );
}

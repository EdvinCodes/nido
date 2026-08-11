import Link from 'next/link';
import { DeviceFrame } from '@/components/marketing/device-frame';
import { Button } from '@/components/ui/button';
import { route } from '@/lib/routes';

type LandingHeroProps = {
  brand: string;
  headline: string;
  subhead: string;
  ctaApp: string;
  ctaGithub: string;
  previewTitle: string;
  previewAlt: string;
};

/** Above-the-fold hero — server-rendered, no client JS required. */
export function LandingHero({
  brand,
  headline,
  subhead,
  ctaApp,
  ctaGithub,
  previewTitle,
  previewAlt,
}: LandingHeroProps) {
  return (
    <section className="relative flex min-h-[100dvh] flex-col overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_50%_-15%,oklch(0.78_0.14_72_/_0.22),transparent_58%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_40%,var(--background)_92%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04] dark:opacity-[0.07]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute top-24 -right-24 size-[28rem] rounded-full bg-primary/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-32 -left-20 size-[22rem] rounded-full bg-[oklch(0.72_0.08_40_/_0.12)] blur-3xl"
        aria-hidden
      />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 pt-28 pb-8 lg:pt-32">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <p className="font-display text-[clamp(4.5rem,14vw,8.5rem)] leading-[0.9] tracking-[-0.03em] text-foreground">
            {brand}
          </p>
          <h1 className="mt-5 max-w-xl text-xl font-medium tracking-tight text-balance text-foreground sm:text-2xl">
            {headline}
          </h1>
          <p className="mt-4 max-w-lg text-base text-balance text-muted-foreground sm:text-lg">
            {subhead}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link href={route('/sign-up')}>{ctaApp}</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="https://github.com/EdvinCodes/nido" rel="noopener noreferrer">
                {ctaGithub}
              </a>
            </Button>
          </div>
        </div>

        <div className="relative mt-14 flex flex-1 items-end lg:mt-16">
          <DeviceFrame
            src="/screenshots/marketing/hero.png"
            alt={previewAlt}
            title={previewTitle}
            priority
          />
        </div>
      </div>
    </section>
  );
}

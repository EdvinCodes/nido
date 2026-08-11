import Image from 'next/image';
import { ScrollReveal } from '@/components/marketing/scroll-reveal';

type FeatureRow = {
  key: string;
  title: string;
  body: string;
  imageSrc: string;
  imageAlt: string;
};

export function FeatureShowcase({ rows }: { rows: FeatureRow[] }) {
  return (
    <ul className="mt-16 flex flex-col gap-20 lg:gap-28">
      {rows.map((row, index) => {
        const imageFirst = index % 2 === 1;
        return (
          <li key={row.key}>
            <ScrollReveal delayMs={index * 40}>
              <div
                className={`grid items-center gap-10 lg:grid-cols-2 lg:gap-16 ${
                  imageFirst ? 'lg:[&>*:first-child]:order-2' : ''
                }`}
              >
                <div className={imageFirst ? 'lg:order-2' : undefined}>
                  <h3 className="font-display text-3xl tracking-tight">{row.title}</h3>
                  <p className="mt-3 text-base leading-relaxed text-muted-foreground">{row.body}</p>
                </div>
                <div
                  className={`relative aspect-[16/10] overflow-hidden rounded-xl border border-border bg-surface shadow-raised ${
                    imageFirst ? 'lg:order-1' : ''
                  }`}
                >
                  <Image
                    src={row.imageSrc}
                    alt={row.imageAlt}
                    fill
                    unoptimized
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover object-top"
                  />
                </div>
              </div>
            </ScrollReveal>
          </li>
        );
      })}
    </ul>
  );
}

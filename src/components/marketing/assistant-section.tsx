import { ScrollReveal } from '@/components/marketing/scroll-reveal';

type AssistantSectionProps = {
  title: string;
  subtitle: string;
  badge: string;
  question: string;
  answer: string;
  footnote: string;
};

/** Mock BYOK assistant exchange — clearly labelled as optional. */
export function AssistantSection({
  title,
  subtitle,
  badge,
  question,
  answer,
  footnote,
}: AssistantSectionProps) {
  return (
    <section className="border-y border-border/70 bg-surface/40">
      <div className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
        <ScrollReveal>
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex rounded-full border border-border bg-background px-3 py-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {badge}
            </span>
            <h2 className="mt-4 font-display text-4xl tracking-tight sm:text-5xl">{title}</h2>
            <p className="mt-4 text-lg text-muted-foreground">{subtitle}</p>
          </div>
        </ScrollReveal>

        <ScrollReveal delayMs={40}>
          <div
            className="mx-auto mt-12 max-w-xl rounded-2xl border border-border bg-background p-6 shadow-raised"
            role="figure"
            aria-label={title}
          >
            <div className="space-y-4">
              <div className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl rounded-br-md bg-primary/15 px-4 py-3 text-sm leading-relaxed">
                  {question}
                </p>
              </div>
              <div className="flex justify-start">
                <p className="max-w-[90%] rounded-2xl rounded-bl-md border border-border bg-surface px-4 py-3 text-sm leading-relaxed text-muted-foreground">
                  {answer}
                </p>
              </div>
            </div>
            <p className="mt-5 text-center text-xs text-muted-foreground">{footnote}</p>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

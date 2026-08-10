import { cn } from '@/lib/utils';

type NidoLogoProps = {
  variant?: 'mark' | 'lockup';
  className?: string;
};

/** Inline Nido mark — `currentColor` driven. Full brand kit ships in phase 11. */
export function NidoLogo({ variant = 'lockup', className }: NidoLogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-foreground', className)}>
      <svg
        viewBox="0 0 32 32"
        className="size-8 shrink-0 text-primary"
        aria-hidden
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M16 4c-4.5 0-8 3.2-8 7.2 0 2.2.9 4.2 2.4 5.6C8.9 17.2 8 19.2 8 21.4 8 25.4 11.5 28.5 16 28.5s8-3.1 8-7.1c0-2.2-.9-4.2-2.4-5.7 1.5-1.4 2.4-3.4 2.4-5.6C24 7.2 20.5 4 16 4Zm0 4c2.2 0 4 1.6 4 3.6S18.2 15.2 16 15.2 12 13.6 12 11.6 13.8 8 16 8Zm0 14.5c-2.8 0-5-1.9-5-4.3 0-1.5.8-2.8 2.1-3.5 1 .6 2.2.9 3.5.9s2.5-.3 3.5-.9c1.3.7 2.1 2 2.1 3.5 0 2.4-2.2 4.3-5 4.3Z" />
      </svg>
      {variant === 'lockup' ? (
        <span className="font-display text-xl tracking-tight">Nido</span>
      ) : null}
    </span>
  );
}

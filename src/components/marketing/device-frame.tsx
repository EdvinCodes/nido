import Image from 'next/image';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type DeviceFrameProps = {
  src: string;
  alt: string;
  className?: string;
  /** Optional chrome label above the screenshot. */
  title?: string;
  children?: ReactNode;
  priority?: boolean;
};

/** CSS device frame — sharp at every density; screenshot inside, not baked into the image. */
export function DeviceFrame({
  src,
  alt,
  className,
  title,
  children,
  priority = false,
}: DeviceFrameProps) {
  return (
    <div className={cn('relative mx-auto w-full max-w-4xl', className)}>
      <div
        className="pointer-events-none absolute inset-x-8 -bottom-8 h-24 bg-primary/15 blur-3xl"
        aria-hidden
      />
      <div
        className="relative rotate-[0.6deg] overflow-hidden rounded-2xl border border-border/70 bg-surface/90 shadow-float backdrop-blur-sm transition-transform duration-500 hover:rotate-0"
        style={{ transformOrigin: 'center bottom' }}
      >
        <div className="flex items-center gap-3 border-b border-border/60 px-5 py-3.5">
          <div className="flex gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-expense/70" />
            <span className="size-2.5 rounded-full bg-warning/70" />
            <span className="size-2.5 rounded-full bg-income/70" />
          </div>
          {title ? (
            <span className="truncate text-xs tracking-wide text-muted-foreground">{title}</span>
          ) : null}
        </div>
        <div className="relative aspect-[16/10] w-full bg-surface">
          <Image
            src={src}
            alt={alt}
            fill
            priority={priority}
            sizes="(max-width: 768px) 100vw, 896px"
            className="object-cover object-top"
          />
          {children}
        </div>
      </div>
    </div>
  );
}

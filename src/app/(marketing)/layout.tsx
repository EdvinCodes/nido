import { Instrument_Serif } from 'next/font/google';
import type { ReactNode } from 'react';

const instrumentSerif = Instrument_Serif({
  variable: '--font-instrument-serif',
  subsets: ['latin'],
  weight: '400',
});

/** Marketing routes load Instrument Serif for display headings only. See docs/03-DESIGN-SYSTEM.md §3. */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return <div className={`${instrumentSerif.variable} flex flex-1 flex-col`}>{children}</div>;
}

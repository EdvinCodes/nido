import { Instrument_Serif } from 'next/font/google';
import type { ReactNode } from 'react';

const instrumentSerif = Instrument_Serif({
  variable: '--font-instrument-serif',
  subsets: ['latin'],
  weight: '400',
});

export default function DevLayout({ children }: { children: ReactNode }) {
  return <div className={instrumentSerif.variable}>{children}</div>;
}

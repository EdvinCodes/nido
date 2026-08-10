import type { ReactNode } from 'react';

/** Marketing shell. Display font is loaded once on the root layout. */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 flex-col">{children}</div>;
}

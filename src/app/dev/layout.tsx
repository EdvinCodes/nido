import type { ReactNode } from 'react';

/** Dev token gallery. Display font is loaded once on the root layout. */
export default function DevLayout({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 flex-col">{children}</div>;
}

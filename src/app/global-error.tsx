'use client';

import { useEffect } from 'react';
import './globals.css';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const isEs =
    typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('es');

  return (
    <html lang={isEs ? 'es' : 'en'} className="dark h-full">
      <body className="flex min-h-full flex-col items-center justify-center gap-4 bg-background px-6 py-16 text-center text-foreground">
        <h1 className="text-2xl font-semibold tracking-tight">
          {isEs ? 'No se pudo cargar Nido' : 'Nido could not load'}
        </h1>
        <p className="max-w-md text-balance text-muted-foreground">
          {isEs
            ? 'Ha ocurrido un error inesperado. Puedes reintentar o recargar la página.'
            : 'An unexpected error occurred. You can retry or reload the page.'}
        </p>
        <button
          type="button"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          onClick={() => {
            reset();
          }}
        >
          {isEs ? 'Reintentar' : 'Retry'}
        </button>
      </body>
    </html>
  );
}

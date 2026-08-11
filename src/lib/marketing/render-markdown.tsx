import type { ReactNode } from 'react';

/** Minimal markdown renderer for docs — headings, paragraphs, lists, code, links. */
export function renderMarkdown(content: string): ReactNode[] {
  const lines = content.split('\n');
  const nodes: ReactNode[] = [];
  let listItems: string[] = [];
  let inCode = false;
  let codeLines: string[] = [];
  let key = 0;

  function flushList(): void {
    if (listItems.length === 0) return;
    nodes.push(
      <ul key={`ul-${key++}`} className="my-4 list-disc space-y-1 pl-6 text-muted-foreground">
        {listItems.map((item) => (
          <li key={item}>{inlineMarkdown(item)}</li>
        ))}
      </ul>,
    );
    listItems = [];
  }

  function flushCode(): void {
    if (codeLines.length === 0) return;
    nodes.push(
      <pre
        key={`code-${key++}`}
        className="my-4 overflow-x-auto rounded-lg border border-border bg-surface-raised p-4 font-mono text-xs leading-relaxed text-muted-foreground"
      >
        <code>{codeLines.join('\n')}</code>
      </pre>,
    );
    codeLines = [];
  }

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCode) {
        inCode = false;
        flushCode();
      } else {
        flushList();
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (line.startsWith('# ')) {
      flushList();
      nodes.push(
        <h1 key={`h1-${key++}`} className="font-display text-3xl tracking-tight">
          {line.slice(2)}
        </h1>,
      );
      continue;
    }

    if (line.startsWith('## ')) {
      flushList();
      nodes.push(
        <h2 key={`h2-${key++}`} className="mt-10 font-display text-2xl tracking-tight">
          {line.slice(3)}
        </h2>,
      );
      continue;
    }

    if (line.startsWith('### ')) {
      flushList();
      nodes.push(
        <h3 key={`h3-${key++}`} className="mt-8 text-lg font-medium tracking-tight">
          {line.slice(4)}
        </h3>,
      );
      continue;
    }

    if (line.startsWith('- ')) {
      listItems.push(line.slice(2));
      continue;
    }

    if (line.trim() === '') {
      flushList();
      continue;
    }

    flushList();
    nodes.push(
      <p key={`p-${key++}`} className="my-3 leading-relaxed text-muted-foreground">
        {inlineMarkdown(line)}
      </p>,
    );
  }

  flushList();
  flushCode();
  return nodes;
}

function inlineMarkdown(text: string): ReactNode {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\)|`[^`]+`)/g);
  return parts.map((part, index) => {
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const [, label, href] = linkMatch;
      return (
        <a
          key={`link-${index}`}
          href={href}
          className="text-primary underline-offset-4 hover:underline"
          rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
        >
          {label}
        </a>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={`code-${index}`}
          className="rounded bg-surface-raised px-1 py-0.5 font-mono text-xs"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

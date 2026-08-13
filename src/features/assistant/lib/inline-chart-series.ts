export type InlineChartPoint = { label: string; a: number; b?: number };

export type InlineChartSeries = {
  kind: 'trend' | 'compare';
  points: InlineChartPoint[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null) return null;
  return value as Record<string, unknown>;
}

function toolNameFromPartType(type: string): string {
  return type.startsWith('tool-') ? type.slice('tool-'.length) : type;
}

function minorOf(value: unknown): number | null {
  const record = asRecord(value);
  if (!record || typeof record.minor !== 'number') return null;
  return record.minor;
}

/** Builds a compact chart series from completed assistant tool outputs. */
export function comparisonSeriesFromToolParts(
  parts: Array<{ type: string; state?: string; output?: unknown }>,
): InlineChartSeries | null {
  for (const part of parts) {
    if (part.state !== 'output-available') continue;
    const output = asRecord(part.output);
    if (!output) continue;

    const toolName = toolNameFromPartType(part.type);
    if (toolName === 'getTrend' || toolName === 'get_trend') {
      const pointsRaw = output.points;
      if (!Array.isArray(pointsRaw) || pointsRaw.length < 2) continue;
      const points: InlineChartPoint[] = [];
      for (const row of pointsRaw) {
        const record = asRecord(row);
        if (!record || typeof record.bucketStart !== 'string') continue;
        const minor = minorOf(record.value);
        if (minor == null) continue;
        points.push({ label: record.bucketStart, a: minor });
      }
      if (points.length >= 2) return { kind: 'trend', points };
    }

    if (toolName === 'comparePeriods' || toolName === 'compare_periods') {
      const groupsRaw = output.groups;
      if (!Array.isArray(groupsRaw) || groupsRaw.length === 0) continue;
      const points: InlineChartPoint[] = [];
      for (const row of groupsRaw.slice(0, 6)) {
        const record = asRecord(row);
        if (!record || typeof record.label !== 'string') continue;
        const a = minorOf(record.periodA);
        const b = minorOf(record.periodB);
        if (a == null || b == null) continue;
        points.push({ label: record.label, a, b });
      }
      if (points.length > 0) return { kind: 'compare', points };
    }
  }
  return null;
}

'use client';

import { useLocale } from 'next-intl';
import { useMemo } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { buildTimezoneOptions } from '@/lib/dates/timezone-options';

export function TimezoneSelect({
  id,
  value,
  onValueChange,
}: {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
}) {
  const locale = useLocale();
  const options = useMemo(() => buildTimezoneOptions(locale, value), [locale, value]);

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger id={id} className="w-full max-w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

"use client";

import * as React from "react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { loadSourceTuples } from "@/lib/source-tuples-client";

interface YearComboboxProps {
  /** Controlled value. Provide together with `onChange`. */
  value?: string;
  /** Uncontrolled initial value. */
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Hidden input name for FormData submission. */
  name?: string;
  id?: string;
  className?: string;
  buttonClassName?: string;
  placeholder?: string;
  /** When set, narrows the year options to those used with this institution. */
  institution?: string;
}

/**
 * Year ("שנה") selector: a searchable dropdown of years used across questions,
 * optionally narrowed to a chosen institution, with the ability to type and add
 * a brand-new year.
 */
export function YearCombobox({
  value,
  defaultValue,
  onChange,
  name,
  id,
  className,
  buttonClassName,
  placeholder = "הכל",
  institution,
}: YearComboboxProps) {
  const [tuples, setTuples] = React.useState<{ institution: string; year: string }[]>([]);

  React.useEffect(() => {
    let active = true;
    loadSourceTuples().then((t) => {
      if (active) setTuples(t);
    });
    return () => {
      active = false;
    };
  }, []);

  const options = React.useMemo(() => {
    const inst = institution?.trim();
    const set = new Set<string>();
    for (const t of tuples) {
      if (inst && t.institution !== inst) continue;
      if (t.year) set.add(t.year);
    }
    const current = value ?? defaultValue;
    if (current && current.trim()) set.add(current.trim());
    // Years sorted descending (newest first).
    return [...set].sort((a, b) => b.localeCompare(a, "he", { numeric: true }));
  }, [tuples, institution, value, defaultValue]);

  return (
    <SearchableSelect
      value={value}
      defaultValue={defaultValue}
      onChange={onChange}
      name={name}
      id={id}
      options={options}
      creatable
      clearable
      clearLabel={placeholder}
      placeholder={placeholder}
      searchPlaceholder="חיפוש או הוספת שנה..."
      emptyMessage="אין שנים קיימות"
      className={className}
      buttonClassName={buttonClassName}
    />
  );
}

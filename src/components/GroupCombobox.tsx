"use client";

import * as React from "react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { getQuestionGroupsAction } from "@/lib/question-source-actions";

/** Module-level cache so repeated mounts don't re-query the same admin session. */
let groupsCache: Promise<string[]> | null = null;
function loadGroups(): Promise<string[]> {
  if (!groupsCache) groupsCache = getQuestionGroupsAction().catch(() => []);
  return groupsCache;
}

interface GroupComboboxProps {
  /** Controlled value. Provide together with `onChange`. */
  value?: string;
  /** Uncontrolled initial value. */
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Hidden input name for FormData submission. */
  name?: string;
  className?: string;
  buttonClassName?: string;
  placeholder?: string;
}

/**
 * Group ("קבוצה") selector: a searchable dropdown of existing group values
 * across questions, with the ability to type and add a brand-new group.
 */
export function GroupCombobox({
  value,
  defaultValue,
  onChange,
  name,
  className,
  buttonClassName,
  placeholder = "— ללא קבוצה —",
}: GroupComboboxProps) {
  const [groups, setGroups] = React.useState<string[]>([]);

  React.useEffect(() => {
    let active = true;
    loadGroups().then((g) => {
      if (active) setGroups(g);
    });
    return () => {
      active = false;
    };
  }, []);

  const options = React.useMemo(() => {
    const set = new Set(groups);
    const current = value ?? defaultValue;
    if (current && current.trim()) set.add(current.trim());
    return [...set].sort((a, b) => a.localeCompare(b, "he"));
  }, [groups, value, defaultValue]);

  return (
    <SearchableSelect
      value={value}
      defaultValue={defaultValue}
      onChange={onChange}
      name={name}
      options={options}
      creatable
      clearable
      clearLabel={placeholder}
      placeholder={placeholder}
      searchPlaceholder="חיפוש או הוספת קבוצה..."
      emptyMessage="אין קבוצות קיימות"
      className={className}
      buttonClassName={buttonClassName}
    />
  );
}

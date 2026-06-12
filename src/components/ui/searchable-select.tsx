"use client";
import * as React from "react";
import { Check, ChevronDown, Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type SearchableSelectOption = { value: string; label: string };

interface SearchableSelectProps {
  options: ReadonlyArray<SearchableSelectOption | string>;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  name?: string;
  id?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  clearable?: boolean;
  clearLabel?: string;
  /** When true, allows committing the typed search query as a new value if it doesn't match an existing option. */
  creatable?: boolean;
  /** Builds the label for the "create new" row. Defaults to `הוסף "<query>"`. */
  createLabel?: (query: string) => string;
  className?: string;
  buttonClassName?: string;
}

function normalize(s: string) {
  return s.toLocaleLowerCase().replace(/["'״׳`]/g, "");
}

export function SearchableSelect({
  options,
  value: controlledValue,
  defaultValue,
  onChange,
  name,
  id,
  required,
  disabled,
  placeholder = "—",
  searchPlaceholder = "חיפוש...",
  emptyMessage = "אין תוצאות",
  clearable = false,
  clearLabel,
  creatable = false,
  createLabel,
  className,
  buttonClassName,
}: SearchableSelectProps) {
  const normalized = React.useMemo<SearchableSelectOption[]>(
    () =>
      options.map((o) =>
        typeof o === "string" ? { value: o, label: o } : o
      ),
    [options]
  );

  const isControlled = controlledValue !== undefined;
  const [internal, setInternal] = React.useState(defaultValue ?? "");
  const value = isControlled ? controlledValue! : internal;

  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [activeIdx, setActiveIdx] = React.useState(0);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const filtered = React.useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return normalized;
    return normalized.filter((o) => normalize(o.label).includes(q));
  }, [normalized, query]);

  const trimmedQuery = query.trim();
  const showCreate =
    creatable &&
    trimmedQuery.length > 0 &&
    !normalized.some((o) => normalize(o.value) === normalize(trimmedQuery));

  React.useEffect(() => {
    if (open) {
      setActiveIdx(0);
      // Focus the search input shortly after opening
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      setQuery("");
    }
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    function onDocPointerDown(e: PointerEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [open]);

  function commit(next: string) {
    if (!isControlled) setInternal(next);
    onChange?.(next);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtered[activeIdx];
      if (opt) commit(opt.value);
      else if (showCreate) commit(trimmedQuery);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  React.useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(
      `[data-idx="${activeIdx}"]`
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx, open]);

  const selected =
    normalized.find((o) => o.value === value) ??
    (value ? { value, label: value } : undefined);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          buttonClassName
        )}
      >
        <span
          className={cn(
            "truncate text-start",
            !selected && "text-muted-foreground"
          )}
        >
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>

      {name && (
        <input
          type="text"
          name={name}
          value={value}
          required={required}
          tabIndex={-1}
          aria-hidden="true"
          onChange={() => {}}
          onFocus={(e) => {
            // Redirect focus to the visible trigger on native validation focus.
            (e.target.previousSibling as HTMLElement | null)?.focus?.();
          }}
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
        />
      )}

      {open && (
        <div
          className={cn(
            "absolute z-50 mt-1 w-full min-w-[14rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md",
            "animate-in fade-in-0 zoom-in-95"
          )}
          role="listbox"
        >
          <div className="flex items-center gap-2 border-b px-2 py-1.5">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIdx(0);
              }}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder}
              className="flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                className="text-muted-foreground hover:text-foreground"
                aria-label="נקה חיפוש"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div
            ref={listRef}
            className="max-h-64 overflow-y-auto py-1"
          >
            {clearable && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commit("")}
                className={cn(
                  "flex w-full items-center justify-between gap-2 px-3 py-1.5 text-sm italic text-muted-foreground",
                  "hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <span>{clearLabel ?? placeholder}</span>
                {value === "" && <Check className="h-4 w-4" />}
              </button>
            )}
            {filtered.length === 0 ? (
              showCreate ? null : (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  {emptyMessage}
                </div>
              )
            ) : (
              filtered.map((opt, i) => {
                const isSelected = opt.value === value;
                const isActive = i === activeIdx;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    data-idx={i}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActiveIdx(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => commit(opt.value)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 px-3 py-1.5 text-start text-sm",
                      isActive && "bg-accent text-accent-foreground"
                    )}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected && <Check className="h-4 w-4 shrink-0" />}
                  </button>
                );
              })
            )}
            {showCreate && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commit(trimmedQuery)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-start text-sm text-primary",
                  "hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span className="truncate">
                  {createLabel ? createLabel(trimmedQuery) : `הוסף "${trimmedQuery}"`}
                </span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

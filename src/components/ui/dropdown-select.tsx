"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export interface DropdownOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

interface DropdownSelectProps<T extends string> {
  value: T;
  options: readonly DropdownOption<T>[];
  onChange: (nextValue: T) => void;
  ariaLabel: string;
  className?: string;
}

/**
 * Dropdown pilihan kustom bergaya Warm Playful Pop berbasis Popover API (`popover="auto"`)
 * dengan viewport-aware anchor positioning dan fallback bottom-sheet di browser lama.
 */
export function DropdownSelect<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className = "",
}: DropdownSelectProps<T>) {
  const rawId = useId();
  const panelId = `wp-dd-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = options.find((opt) => opt.value === value) ?? options[0];

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const handleToggle = (event: Event) => {
      const toggleEvent = event as Event & { newState?: string };
      setIsOpen(toggleEvent.newState === "open");
    };

    panel.addEventListener("toggle", handleToggle);
    return () => {
      panel.removeEventListener("toggle", handleToggle);
    };
  }, []);

  const closePanel = () => {
    const panel = panelRef.current as (HTMLDivElement & { hidePopover?: () => void }) | null;
    if (panel && typeof panel.hidePopover === "function") {
      try {
        panel.hidePopover();
      } catch {
        // Abaikan jika popover sudah tertutup
      }
    }
    setIsOpen(false);
  };

  return (
    <div className={`inline-block ${className}`}>
      <button
        type="button"
        popoverTarget={panelId}
        popoverTargetAction="toggle"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className="wp-btn wp-btn-secondary w-full justify-between !min-h-11 !px-3.5 !text-xs sm:!text-sm"
      >
        <span className="truncate font-bold">{selectedOption?.label ?? ""}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform duration-150 ${
            isOpen ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      <div ref={panelRef} id={panelId} popover="auto" className="wp-dropdown-panel">
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={active}
              onClick={() => {
                onChange(opt.value);
                closePanel();
              }}
              className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm font-bold transition-colors ${
                active
                  ? "border-2 border-border-ink bg-brand text-white shadow-[2px_2px_0_var(--border-ink)]"
                  : "border-2 border-transparent text-text-primary hover:bg-brand-soft hover:text-brand-hover"
              }`}
            >
              <span className="grid gap-0.5">
                <span>{opt.label}</span>
                {opt.description ? (
                  <span
                    className={`text-[11px] font-medium ${
                      active ? "text-white/85" : "text-text-muted"
                    }`}
                  >
                    {opt.description}
                  </span>
                ) : null}
              </span>
              {active ? (
                <Check className="h-4 w-4 shrink-0 stroke-[2.75]" aria-hidden="true" />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

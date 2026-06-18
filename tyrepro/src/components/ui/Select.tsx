"use client";

// Select is now powered by the custom Dropdown component
// so all pages get responsive, non-overflowing dropdowns automatically.

import { Dropdown } from "@/components/ui/Dropdown";
import { forwardRef } from "react";

interface SelectProps {
  label?:       string;
  error?:       string;
  hint?:        string;
  options:      { value: string; label: string }[];
  placeholder?: string;
  value?:       string;
  onChange?:    (e: React.ChangeEvent<HTMLSelectElement>) => void;
  disabled?:    boolean;
  className?:   string;
  id?:          string;
}

// Adapter: Select uses onChange with a synthetic event, Dropdown uses onChange(value)
// This wrapper makes them interchangeable
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ onChange, value = "", ...props }, _ref) => {
    function handleChange(newValue: string) {
      if (!onChange) return;
      // Synthesise a fake event so existing code doesn't break
      onChange({
        target: { value: newValue },
      } as React.ChangeEvent<HTMLSelectElement>);
    }

    return (
      <Dropdown
        value={value}
        onChange={handleChange}
        label={props.label}
        placeholder={props.placeholder}
        error={props.error}
        hint={props.hint}
        disabled={props.disabled}
        options={props.options}
        className={props.className}
      />
    );
  }
);

Select.displayName = "Select";
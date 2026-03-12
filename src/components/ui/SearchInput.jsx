// components/ui/SearchInput.jsx
import React, { forwardRef, useMemo } from "react";
import { Search, X } from "lucide-react";
import "../../styles/ui/search_input.css";

/**
 * Props:
 * - value: string
 * - onChange: (value: string) => void
 * - placeholder?: string
 * - fields?: string[]  // optional: shown in placeholder if placeholder not provided
 * - helper?: string    // optional: small text under input
 * - size?: "sm" | "md" | "lg"
 * - width?: number | string  // e.g. 520, "520px", "100%"
 * - disabled?: boolean
 * - clearable?: boolean
 * - onClear?: () => void
 */
const SearchInput = forwardRef(function SearchInput(
  {
    value,
    onChange,
    placeholder,
    fields,
    helper,
    size = "md",
    width = 520,
    disabled = false,
    clearable = true,
    onClear,
    className = "",
    inputClassName = "",
    ...rest
  },
  ref
) {
  const ph = useMemo(() => {
    if (placeholder) return placeholder;
    if (Array.isArray(fields) && fields.length) return `Search by ${fields.join(", ")}...`;
    return "Search...";
  }, [placeholder, fields]);

  const w = typeof width === "number" ? `${width}px` : width;

  const showClear = clearable && !disabled && String(value || "").length > 0;

  return (
    <div className={`si-wrap si-${size} ${showClear ? "si-hasClear" : ""} ${className}`.trim()} style={{ width: w }}>
      <Search className="si-icon" size={16} />
      <input
        ref={ref}
        className={`si-input ${inputClassName}`}
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={ph}
        disabled={disabled}
        {...rest}
      />

      {showClear ? (
        <button
          type="button"
          className="si-clear"
          aria-label="Clear search"
          onClick={() => {
            onClear?.();
            onChange?.("");
          }}
        >
          <X size={16} />
        </button>
      ) : null}

      {helper ? <div className="si-helper">{helper}</div> : null}
    </div>
  );
});

export default SearchInput;

import React from "react";
import "../../styles/ui/checkbox.css";

/** Role-style animated checkbox; optional label text as children */
export default function Checkbox({ checked, onChange, disabled, className = "", children }) {
  return (
    <label className={`uiCheckbox ${className}`.trim()}>
      <span className="uiCheckbox-wrap">
        <input
          type="checkbox"
          className="uiCheckbox-input"
          checked={!!checked}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.checked)}
        />
        <span className="uiCheckbox-box" aria-hidden />
      </span>
      {children != null && children !== false ? <span className="uiCheckbox-label">{children}</span> : null}
    </label>
  );
}

/** Input + box only — use inside a parent <label> for full-row hit targets */
export function CheckboxBoxOnly({ checked, onChange, disabled, className = "" }) {
  return (
    <span className={`uiCheckbox-wrap uiCheckboxBoxOnly ${className}`.trim()}>
      <input
        type="checkbox"
        className="uiCheckbox-input"
        checked={!!checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      <span className="uiCheckbox-box" aria-hidden />
    </span>
  );
}

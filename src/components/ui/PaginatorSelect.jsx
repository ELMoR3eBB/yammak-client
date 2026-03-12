// PaginatorSelect — same design as Create_Employee EcSelect (dark dropdown, arrow transition)
// Dropdown is portaled to body with fixed position so it isn't clipped by table overflow.
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

const GAP = 6;

function getDropStyle(trigger, openAbove) {
  if (!trigger) return {};
  const rect = trigger.getBoundingClientRect();
  const style = {
    position: "fixed",
    left: rect.left,
    minWidth: rect.width,
    zIndex: 9999,
  };
  if (openAbove) {
    style.top = rect.top - GAP;
    style.transform = "translateY(-100%)";
  } else {
    style.top = rect.bottom + GAP;
  }
  return style;
}

export default function PaginatorSelect({ value, onChange, options, label = "Rows", className = "", openAbove = false, dropClassName = "" }) {
  const [open, setOpen] = useState(false);
  const [dropStyle, setDropStyle] = useState({});
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);
  const dropRef = useRef(null);

  const close = useCallback(() => setOpen(false), []);

  const updateDropPosition = useCallback(() => {
    setDropStyle(getDropStyle(triggerRef.current, openAbove));
  }, [openAbove]);

  const handleTriggerClick = useCallback(() => {
    if (!open) {
      setDropStyle(getDropStyle(triggerRef.current, openAbove));
    }
    setOpen((o) => !o);
  }, [open, openAbove]);

  useLayoutEffect(() => {
    if (!open) return;
    updateDropPosition();
    const onScrollOrResize = () => {
      updateDropPosition();
    };
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, updateDropPosition]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      const target = e.target;
      const insideTrigger = wrapRef.current?.contains(target);
      const insideDrop = dropRef.current?.contains(target);
      if (!insideTrigger && !insideDrop) close();
    };
    document.addEventListener("mousedown", onDocClick, true);
    return () => document.removeEventListener("mousedown", onDocClick, true);
  }, [open, close]);

  const displayLabel = options.find((o) => o.value === value)?.label ?? String(value);

  const dropContent = open && (
    <div
      ref={dropRef}
      className={`paginatorSelectDrop paginatorSelectDrop--portal ${openAbove ? "paginatorSelectDrop--openAbove" : ""} ${dropClassName || ""}`.trim()}
      role="listbox"
      aria-hidden={false}
      style={dropStyle}
    >
      <div className={`paginatorSelectDropInner paginatorSelectDropPortal ${openAbove ? "paginatorSelectDropInner--openAbove" : ""}`}>
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="option"
            aria-selected={opt.value === value}
            className={`paginatorSelectOption ${opt.value === value ? "paginatorSelectOption--selected" : ""}`}
            onClick={() => {
              onChange(opt.value);
              close();
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div
      ref={wrapRef}
      className={`paginatorSelect ${open ? "paginatorSelect--open" : ""} ${className}`}
    >
      {label ? <span className="paginatorSelectLabel">{label}</span> : null}
      <button
        ref={triggerRef}
        type="button"
        className="paginatorSelectTrigger"
        onClick={handleTriggerClick}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="paginatorSelectValue">{displayLabel}</span>
        <span className="paginatorSelectArrow" aria-hidden>
          <ChevronDown size={16} />
        </span>
      </button>
      {typeof document !== "undefined" && document.body
        ? createPortal(dropContent, document.body)
        : null}
    </div>
  );
}

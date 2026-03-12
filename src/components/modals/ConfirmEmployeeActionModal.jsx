// components/modals/ConfirmEmployeeActionModal.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, PenLine, UserPlus2, X } from "lucide-react";
import "../../styles/modals/confirmEmployeeActionModal.css";

export default function ConfirmEmployeeActionModal({
  open,
  mode = "create", // "create" | "update"
  employeeName = "",
  summary = null, // optional array of { label, value }
  loading = false,
  onClose,
  onConfirm,
}) {
  const dialogRef = useRef(null);
  const primaryBtnRef = useRef(null);

  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const closingRef = useRef(false);

  const meta = useMemo(() => {
    const isUpdate = mode === "update";
    return {
      title: isUpdate ? "Confirm update" : "Confirm create",
      subtitle: isUpdate ? "Review your changes before saving." : "Review details before creating a new employee.",
      icon: isUpdate ? <PenLine size={18} /> : <UserPlus2 size={18} />,
      primaryText: isUpdate ? (loading ? "Updating..." : "Update employee") : (loading ? "Creating..." : "Create employee"),
      toneClass: isUpdate ? "is-update" : "is-create",
      name: (employeeName || "").trim() || (isUpdate ? "this employee" : "new employee"),
    };
  }, [mode, employeeName, loading]);

  const beginClose = useCallback(() => {
    if (loading) return;
    closingRef.current = true;
    setVisible(false);
  }, [loading]);

  // mount/unmount with animation (same pattern as your EditUserModal)
  useEffect(() => {
    if (open) {
      closingRef.current = false;
      setMounted(true);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!closingRef.current) setVisible(true);
        });
      });
      return;
    }

    if (mounted) beginClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ESC closes + focus trap
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") beginClose();

      if (e.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables.length) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, beginClose]);

  // focus primary after visible
  useEffect(() => {
    if (!mounted || !visible) return;
    setTimeout(() => primaryBtnRef.current?.focus?.(), 0);
  }, [mounted, visible]);

  const onTransitionEnd = useCallback(
    (e) => {
      if (e.target !== e.currentTarget) return;
      if (!visible) {
        setMounted(false);
        closingRef.current = false;
        onClose?.();
      }
    },
    [visible, onClose]
  );

  if (!mounted) return null;

  return (
    <div
      className={`eam-backdrop ${visible ? "is-open" : ""}`}
      onMouseDown={beginClose}
      role="presentation"
    >
      <div
        className={`eam-modal ${visible ? "is-open" : ""} ${meta.toneClass}`}
        onMouseDown={(e) => e.stopPropagation()}
        onTransitionEnd={onTransitionEnd}
        role="dialog"
        aria-modal="true"
        ref={dialogRef}
      >
        <div className="eam-head">

          <button className="eam-close" type="button" onClick={beginClose} disabled={loading} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="eam-content">
          <div className="eam-titleRow">
            <div className="eam-title">{meta.title}</div>
            <div className="eam-sub">{meta.subtitle}</div>
          </div>

          <div className="eam-card">
            <div className="eam-cardTop">
              <CheckCircle2 size={18} className="eam-check" aria-hidden="true" />
              <div className="eam-cardText">
                <div className="eam-cardLabel">{mode === "update" ? "You’re updating" : "You’re creating"}</div>
                <div className="eam-cardName">{meta.name}</div>
              </div>
            </div>

            {Array.isArray(summary) && summary.length > 0 ? (
              <div className="eam-summary">
                {summary.slice(0, 6).map((row, idx) => (
                  <div key={idx} className="eam-row">
                    <div className="eam-k">{row.label}</div>
                    <div className="eam-v">{row.value ?? "—"}</div>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="eam-hint">
              {mode === "update"
                ? "This will overwrite the existing employee record."
                : "This will create a new employee record in the system."}
            </div>
          </div>
        </div>

        <div className="eam-actions">
          <button className="eam-btn ghost" type="button" onClick={beginClose} disabled={loading}>
            Cancel
          </button>

          <button
            className="eam-btn primary"
            type="button"
            onClick={onConfirm}
            disabled={loading}
            ref={primaryBtnRef}
          >
            {meta.primaryText}
          </button>
        </div>
      </div>
    </div>
  );
}

// components/modals/ConfirmDeleteModal.jsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import "../../styles/modals/confirmDeleteModal.css";

export default function ConfirmDeleteModal({
  open,
  title = "Delete article",
  message = "Are you sure you want to delete this article?\nThis action cannot be undone.",
  confirmText = "Delete",
  cancelText = "Cancel",
  loading = false,
  danger = true,
  iconVariant = "danger",
  onClose,
  onConfirm,
}) {
  const isSuccess = iconVariant === "success";
  const dialogRef = useRef(null);
  const cancelBtnRef = useRef(null);

  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const closingRef = useRef(false);

  const beginClose = useCallback(() => {
    if (loading) return;
    closingRef.current = true;
    setVisible(false);
  }, [loading]);

  useEffect(() => {
    if (open) {
      closingRef.current = false;
      setVisible(false);
      setMounted(true);

      const te = setTimeout(() => {
        if (!closingRef.current) setVisible(true);
      }, 20);
      return () => clearTimeout(te);
    }

    // When parent sets open=false, always start closing (don't block on loading)
    if (mounted) {
      closingRef.current = true;
      setVisible(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") beginClose();
      // basic focus trap
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

  useEffect(() => {
    if (!mounted || !visible) return;
    setTimeout(() => cancelBtnRef.current?.focus?.(), 0);
  }, [mounted, visible]);

  const onModalTransitionEnd = useCallback(
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
      className={`cmodal-backdrop ${visible ? "is-open" : ""} ${isSuccess ? "cmodal-backdrop--success" : ""}`}
      onMouseDown={beginClose}
      role="presentation"
    >
      <div
        className={`cmodal ${visible ? "is-open" : ""} ${isSuccess ? "cmodal--success" : ""}`}
        onMouseDown={(e) => e.stopPropagation()}
        onTransitionEnd={onModalTransitionEnd}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cmodal-title"
        aria-describedby="cmodal-desc"
        ref={dialogRef}
      >
        <div className="cmodal-iconWrap" aria-hidden="true">
          <div className={`cmodal-iconRing ${isSuccess ? "cmodal-iconRing--success" : ""}`}>
            {isSuccess ? (
              <span className="cmodal-icon cmodal-icon--check"><Check size={28} strokeWidth={2.5} /></span>
            ) : (
              <span className="cmodal-icon">!</span>
            )}
          </div>
        </div>

        <h3 className="cmodal-title" id="cmodal-title">
          {title}
        </h3>

        <p className="cmodal-desc" id="cmodal-desc">
          {String(message)
            .split("\n")
            .map((line, i) => (
              <React.Fragment key={i}>
                {line}
                {i !== String(message).split("\n").length - 1 ? <br /> : null}
              </React.Fragment>
            ))}
        </p>

        <div className="cmodal-actions">
          <button
            type="button"
            className="cmodal-btn cmodal-btn--ghost"
            onClick={beginClose}
            disabled={loading}
            ref={cancelBtnRef}
          >
            {cancelText}
          </button>

          <button
            type="button"
            className={`cmodal-btn ${danger ? "cmodal-btn--danger" : "cmodal-btn--primary"}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

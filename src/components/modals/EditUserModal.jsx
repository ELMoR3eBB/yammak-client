// EditUserModal.jsx (FULL - Chosen works in modal + animation)
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { X } from "lucide-react";
import "../../styles/modals/editUserModal.css";

export default function EditUserModal({
  open,
  editing,
  roles,
  form,
  setForm,
  saving,
  onClose,
  onSave,
}) {
  const roleOptions = useMemo(() => roles || [], [roles]);

  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const closingRef = useRef(false);

  const roleSelectRef = useRef(null);

  const beginClose = useCallback(() => {
    if (saving) return;
    closingRef.current = true;
    setVisible(false);
  }, [saving]);

  // mount/unmount with animation
  useEffect(() => {
    if (open && editing) {
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
  }, [open, editing]);

  // ESC closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && beginClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, beginClose]);

  // unmount after exit transition
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

  // ----------------------------
  // ✅ CHOSEN (reliably in modal)
  // ----------------------------
  const destroyChosen = useCallback(() => {
    if (!window.$ || !roleSelectRef.current) return;
    const $el = window.$(roleSelectRef.current);
    if ($el.data("chosen")) {
      $el.off(".editUserChosen");
      $el.chosen("destroy");
    }
  }, []);

  useEffect(() => {
    if (!mounted || !visible) return; // ✅ important: init after modal is visible
    if (!editing) return;
    if (!roleSelectRef.current) return;

    // ✅ Ensure jQuery + chosen exist
    if (!window.$ || !window.$.fn || !window.$.fn.chosen) {
      // Chosen not loaded, native select will be used
      return;
    }

    const $el = window.$(roleSelectRef.current);

    // destroy any previous instance (modal reuse)
    if ($el.data("chosen")) {
      $el.off(".editUserChosen");
      $el.chosen("destroy");
    }

    // init
    $el.chosen({
      width: "100%",
      search_contains: true,
      disable_search_threshold: 0,
      placeholder_text_single: "Select a role",
      no_results_text: "No roles found",
    });

    // disable spellcheck/autofill in chosen search
    setTimeout(() => {
      const searchInput = $el.next(".chosen-container").find(".chosen-search input");
      searchInput.attr({
        spellcheck: "false",
        autocomplete: "off",
        autocorrect: "off",
        autocapitalize: "off",
      });
    }, 0);

    // sync chosen -> react
    $el.on("change.editUserChosen", (e) => {
      setForm((s) => ({ ...s, roleId: e.target.value }));
    });

    // keep widths right
    $el.on("chosen:showing_dropdown.editUserChosen", () => $el.trigger("chosen:updated"));
    $el.on("chosen:hiding_dropdown.editUserChosen", () => $el.trigger("chosen:updated"));

    // force render update
    $el.trigger("chosen:updated");

    return () => {
      destroyChosen();
    };
  }, [mounted, visible, editing, roleOptions.length, setForm, destroyChosen]);

  // whenever roleId changes programmatically, reflect into chosen UI
  useEffect(() => {
    if (!mounted || !visible) return;
    if (!window.$ || !window.$.fn || !window.$.fn.chosen) return;
    if (!roleSelectRef.current) return;

    const $el = window.$(roleSelectRef.current);
    if ($el.data("chosen")) $el.trigger("chosen:updated");
  }, [mounted, visible, form.roleId]);

  // also cleanup if component unmounts hard
  useEffect(() => () => destroyChosen(), [destroyChosen]);

  if (!mounted || !editing) return null;

  return (
    <div className={`users-modal-backdrop ${visible ? "is-open" : ""}`} onMouseDown={beginClose}>
      <div
        className={`users-modal ${visible ? "is-open" : ""}`}
        onMouseDown={(e) => e.stopPropagation()}
        onTransitionEnd={onModalTransitionEnd}
        role="dialog"
        aria-modal="true"
      >
        <div className="users-modal-head">
          <div>
            <div className="users-modal-title">Edit User</div>
            <div className="users-modal-muted">{editing.email}</div>
          </div>

          <button className="users-iconBtn" onClick={beginClose} type="button" aria-label="Close" disabled={saving}>
            <X size={18} />
          </button>
        </div>

        <div className="users-modal-body">
          <div className="users-form">
            <label>Full name</label>
            <input
              className="users-input"
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
            />

            <label>Email</label>
            <input
              className="users-input"
              value={form.email}
              onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
            />

            <label>Password (leave empty to keep)</label>
            <input
              className="users-input"
              type="password"
              value={form.password}
              onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
              spellCheck={false}
              autoComplete="new-password"
              autoCorrect="off"
              autoCapitalize="off"
            />

            <label>Role</label>

            {/* ✅ CHOSEN needs the ref */}
            <select
              ref={roleSelectRef}
              className="users-input users-chosen"
              value={form.roleId}
              onChange={(e) => setForm((s) => ({ ...s, roleId: e.target.value }))} // fallback if chosen not loaded
              disabled={saving}
            >
              {roleOptions.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="users-modal-actions">
          <button className="btn ghost" onClick={beginClose} disabled={saving} type="button">
            Cancel
          </button>
          <button className="btn primary" onClick={onSave} disabled={saving} type="button">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

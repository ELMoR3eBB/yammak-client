// Multi-select "From employee" filter — panel is portaled to document.body; CSS must target
// `.recordingsEmpMenuPortalRoot` (see recordings.css) because it is not under `.recordingsPage`.
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Users, X } from "lucide-react";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";
import "tippy.js/animations/shift-away.css";
import SearchInput from "../ui/SearchInput";
import { CheckboxBoxOnly } from "../ui/Checkbox";
import "../../styles/ui/search_input.css";

const GAP = 10;
const EDGE = 12;
const PANEL_MIN_W = 300;
const PANEL_MAX_W = 420;
const PANEL_MAX_H = 460;
const MIN_OPEN_BELOW = 160;

export function formatEmployeeCallId(phone) {
  const d = String(phone ?? "").replace(/\D/g, "");
  if (!d) return "";
  if (d.length <= 5) return d;
  if (d.length >= 10) return d.slice(-4);
  return d;
}

function initialFromName(name) {
  const s = String(name || "").trim();
  if (!s) return "?";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return s.slice(0, 2).toUpperCase();
}

function TriggerAvatar({ photoUrl, name }) {
  const initial = initialFromName(name);
  const raw = photoUrl != null ? String(photoUrl).trim() : "";
  const url = raw.length > 0 ? raw : null;
  return (
    <span className="recordingsEmpMenuTriggerAvatar" aria-hidden>
      {url ? (
        <img src={url} alt="" width={28} height={28} className="recordingsEmpMenuTriggerAvatarImg" decoding="async" />
      ) : (
        <span className="recordingsEmpMenuTriggerAvatarFallback">{initial}</span>
      )}
    </span>
  );
}

function EmployeeRowAvatar({ photoUrl, name }) {
  const initial = initialFromName(name);
  const raw = photoUrl != null ? String(photoUrl).trim() : "";
  const url = raw.length > 0 ? raw : null;
  return (
    <span className="recordingsEmpMenuAvatar" aria-hidden>
      {url ? (
        <img
          src={url}
          alt=""
          width={32}
          height={32}
          className="recordingsEmpMenuAvatarImg"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span className="recordingsEmpMenuAvatarFallback">{initial}</span>
      )}
    </span>
  );
}

export default function EmployeesFilter({
  t,
  employees,
  selectedIds,
  onToggle,
  onClear,
  disabled,
  fromMatchedEmployeeIds,
  analyticsLoading,
  getSecondaryText,
}) {
  const [open, setOpen] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [search, setSearch] = useState("");
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);
  const dropRef = useRef(null);
  const searchInputRef = useRef(null);
  const [dropStyle, setDropStyle] = useState({});

  const selectedSet = useMemo(() => new Set(selectedIds.map(String)), [selectedIds]);

  const enforceCallMatch = !analyticsLoading && Array.isArray(fromMatchedEmployeeIds);
  const matchedSet = useMemo(() => {
    if (!enforceCallMatch) return null;
    return new Set(fromMatchedEmployeeIds.map(String));
  }, [fromMatchedEmployeeIds, enforceCallMatch]);

  const employeeById = useMemo(() => new Map(employees.map((e) => [String(e._id), e])), [employees]);

  const selectedEmployees = useMemo(
    () => selectedIds.map((id) => employeeById.get(String(id))).filter(Boolean),
    [selectedIds, employeeById]
  );

  const finishClose = useCallback(() => {
    setOpen(false);
    setExiting(false);
    setSearch("");
  }, []);

  const closeDropdown = useCallback(() => {
    if (exiting) return;
    setExiting(true);
  }, [exiting]);

  const toggleDropdown = useCallback(() => {
    if (disabled) return;
    if (exiting) return;
    if (open) setExiting(true);
    else setOpen(true);
  }, [open, exiting, disabled]);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el || typeof window === "undefined") return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const panelW = Math.min(PANEL_MAX_W, Math.max(PANEL_MIN_W, Math.ceil(rect.width), 316));
    let left = rect.left;
    if (left + panelW > vw - EDGE) left = vw - panelW - EDGE;
    if (left < EDGE) left = EDGE;

    const spaceBelow = vh - rect.bottom - GAP - EDGE;
    const spaceAbove = rect.top - GAP - EDGE;
    const openUpward = spaceBelow < MIN_OPEN_BELOW && spaceAbove > spaceBelow;

    let top;
    let bottom;
    let maxHeight;

    if (openUpward) {
      maxHeight = Math.min(PANEL_MAX_H, Math.max(140, spaceAbove));
      bottom = vh - rect.top + GAP;
      top = undefined;
    } else {
      maxHeight = Math.min(PANEL_MAX_H, Math.max(140, spaceBelow));
      top = rect.bottom + GAP;
      bottom = undefined;
    }

    setDropStyle({
      position: "fixed",
      left,
      top: top ?? "auto",
      bottom: bottom ?? "auto",
      width: panelW,
      maxHeight,
      zIndex: 52000,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open && !exiting) return;
    updatePosition();
    const onScrollOrResize = () => updatePosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, exiting, updatePosition]);

  useEffect(() => {
    if (!open || exiting) return;
    const t = window.setTimeout(() => {
      searchInputRef.current?.focus?.({ preventScroll: true });
    }, 30);
    return () => window.clearTimeout(t);
  }, [open, exiting]);

  useEffect(() => {
    if (!open || exiting) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeDropdown();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, exiting, closeDropdown]);

  useEffect(() => {
    if (!open || exiting) return;
    const onDoc = (e) => {
      const target = e.target;
      if (wrapRef.current?.contains(target) || dropRef.current?.contains(target)) return;
      closeDropdown();
    };
    document.addEventListener("mousedown", onDoc, true);
    return () => document.removeEventListener("mousedown", onDoc, true);
  }, [open, exiting, closeDropdown]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => {
      const name = String(e.name || "").toLowerCase();
      const phone = String(e.phone || "").toLowerCase();
      const fallbackId = formatEmployeeCallId(e.phone);
      const secondaryRaw = typeof getSecondaryText === "function" ? getSecondaryText(e) : fallbackId;
      const secondary = String(secondaryRaw || "").toLowerCase();
      return name.includes(q) || phone.includes(q) || fallbackId.includes(q) || secondary.includes(q);
    });
  }, [employees, search, getSecondaryText]);

  const resolveSecondaryText = useCallback(
    (employee) => {
      const custom = typeof getSecondaryText === "function" ? getSecondaryText(employee) : null;
      const val = String(custom ?? "").trim();
      if (val) return val;
      return formatEmployeeCallId(employee?.phone);
    },
    [getSecondaryText]
  );

  const renderTriggerLabel = () => {
    if (selectedEmployees.length === 0) {
      return (
        <>
          <Users size={16} className="recordingsEmpMenuTriggerIcon" aria-hidden />
          <span className="recordingsEmpMenuTriggerText">{t("recordings.empFilterAll")}</span>
        </>
      );
    }
    if (selectedEmployees.length === 1) {
      const e = selectedEmployees[0];
      const secondaryText = resolveSecondaryText(e);
      return (
        <>
          <TriggerAvatar photoUrl={e.photoUrl} name={e.name} />
          <span className="recordingsEmpMenuTriggerTextCol">
            <span className="recordingsEmpMenuTriggerName">{e.name || "—"}</span>
            {secondaryText ? (
              <span className="recordingsEmpMenuTriggerCallId">{secondaryText}</span>
            ) : (
              <span className="recordingsEmpMenuTriggerCallId recordingsEmpMenuTriggerCallId--muted">—</span>
            )}
          </span>
        </>
      );
    }
    const show = selectedEmployees.slice(0, 3);
    return (
      <>
        <span className="recordingsEmpMenuTriggerStack" aria-hidden>
          {show.map((e) => (
            <TriggerAvatar key={String(e._id)} photoUrl={e.photoUrl} name={e.name} />
          ))}
        </span>
        <span className="recordingsEmpMenuTriggerText">{t("recordings.empFilterCount", { count: String(selectedIds.length) })}</span>
      </>
    );
  };

  const onPanelAnimEnd = useCallback(
    (e) => {
      if (e.target !== e.currentTarget) return;
      if (exiting) finishClose();
    },
    [exiting, finishClose]
  );

  return (
    <div
      ref={wrapRef}
      className={`recordingsEmpMenu ${open ? "recordingsEmpMenu--open" : ""} ${disabled ? "recordingsEmpMenu--disabled" : ""}`}
    >
      <Tippy content={t("recordings.empFilterTooltip")} animation="shift-away" placement="bottom" delay={[200, 0]}>
        <button
          ref={triggerRef}
          type="button"
          className={`recordingsEmpMenuTrigger ${selectedEmployees.length > 0 ? "recordingsEmpMenuTrigger--hasSelection" : ""}`}
          onClick={toggleDropdown}
          disabled={disabled}
          aria-expanded={open}
          aria-haspopup="listbox"
        >
          {renderTriggerLabel()}
          <ChevronDown size={16} className="recordingsEmpMenuTriggerChev" aria-hidden />
        </button>
      </Tippy>

      {selectedIds.length > 0 ? (
        <Tippy content={t("recordings.dashClearEmployees")} animation="shift-away" placement="top" delay={[200, 0]}>
          <button type="button" className="recordingsEmpMenuClear" onClick={onClear} disabled={disabled}>
            <X size={14} />
          </button>
        </Tippy>
      ) : null}

      {(open || exiting) &&
        typeof document !== "undefined" &&
        document.body &&
        createPortal(
          <div
            ref={dropRef}
            className={`recordingsEmpMenuPortalRoot recordingsEmpMenuPanel ${exiting ? "recordingsEmpMenuPanel--exit" : "recordingsEmpMenuPanel--enter"}`}
            style={dropStyle}
            role="presentation"
          >
            <div
              className="recordingsEmpMenuPanelShell"
              role="dialog"
              aria-modal="true"
              aria-labelledby="recordings-emp-menu-title"
              onAnimationEnd={onPanelAnimEnd}
            >
              <header className="recordingsEmpMenuHead">
                <span id="recordings-emp-menu-title" className="recordingsEmpMenuHeadTitle">
                  {t("recordings.empFilterPanelTitle")}
                </span>
                <span className="recordingsEmpMenuHeadMeta">
                  {selectedIds.length > 0 ? (
                    <span className="recordingsEmpMenuHeadBadge">{t("recordings.empFilterPanelSelected", { count: String(selectedIds.length) })}</span>
                  ) : null}
                  <span className="recordingsEmpMenuHeadCount">
                    {filtered.length}/{employees.length}
                  </span>
                </span>
              </header>

              <div className="recordingsEmpMenuSearch">
                <SearchInput
                  ref={searchInputRef}
                  value={search}
                  onChange={setSearch}
                  placeholder={t("recordings.dashSearchEmployees")}
                  size="sm"
                  width="100%"
                  className="recordingsEmpMenuSearchWrap"
                  inputClassName="recordingsEmpMenuSearchInput"
                />
              </div>

              <div className="recordingsEmpMenuList" role="listbox" aria-multiselectable="true">
                {filtered.length === 0 ? (
                  <div className="recordingsEmpMenuEmpty">{t("recordings.dashNoEmployees")}</div>
                ) : (
                  filtered.map((e) => {
                    const id = String(e._id ?? "");
                    const checked = selectedSet.has(id);
                    const secondaryText = resolveSecondaryText(e);
                    const selectable = !enforceCallMatch || matchedSet.has(id);
                    const rowClass =
                      `recordingsEmpMenuRow${checked ? " recordingsEmpMenuRow--selected" : ""}${!selectable ? " recordingsEmpMenuRow--disabled" : ""}`;

                    const body = (
                      <>
                        <span className="recordingsEmpMenuCheck">
                          <CheckboxBoxOnly checked={checked} disabled={!selectable} onChange={() => onToggle(id)} />
                        </span>
                        <EmployeeRowAvatar photoUrl={e.photoUrl} name={e.name} />
                        <span className="recordingsEmpMenuMeta">
                          <span className="recordingsEmpMenuName">{e.name || "—"}</span>
                          <span className="recordingsEmpMenuSubrow">
                            {secondaryText ? (
                              <span className="recordingsEmpMenuCallId">{secondaryText}</span>
                            ) : (
                              <span className="recordingsEmpMenuCallId recordingsEmpMenuCallId--muted">—</span>
                            )}
                          </span>
                        </span>
                      </>
                    );

                    if (selectable) {
                      return (
                        <label key={id || e.name} className={rowClass} role="option" aria-selected={checked}>
                          {body}
                        </label>
                      );
                    }

                    return (
                      <Tippy
                        key={id || e.name}
                        content={t("recordings.empFilterNoCallsMatch")}
                        animation="shift-away"
                        placement="top-start"
                        delay={[200, 0]}
                        appendTo={document.body}
                        zIndex={54000}
                        strategy="fixed"
                        popperOptions={{
                          modifiers: [
                            {
                              name: "flip",
                              enabled: false,
                            },
                            {
                              name: "preventOverflow",
                              options: {
                                boundary: "viewport",
                                altAxis: true,
                                padding: 8,
                              },
                            },
                          ],
                        }}
                        maxWidth={300}
                      >
                        <div className={rowClass} role="option" aria-selected={false} aria-disabled="true">
                          {body}
                        </div>
                      </Tippy>
                    );
                  })
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

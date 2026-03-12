// ViolationsPopout — message-style list, centered modal, live relative time. Used on Driver/Store profile.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Plus, AlertCircle, Trash2, User } from "lucide-react";
import { useNotification } from "../NotificationProvider";
import "../../styles/pages/violations/violations_popout.css";

const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function formatMoneyWithCommas(digits) {
  return String(digits).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function parseMoneyToNumber(formatted) {
  return Number(String(formatted).replace(/[^\d]/g, "")) || 0;
}

function formatDateTime(date) {
  if (!date) return "—";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Live-updating relative time: "Less than a minute ago", "5 minutes ago", etc. Re-computes every 15s so it updates without leaving the panel. */
function useRelativeTime(date) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!date) return;
    const id = setInterval(() => setTick((t) => t + 1), 15000);
    return () => clearInterval(id);
  }, [date]);
  if (!date) return "—";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);
  if (diffSec < 60) return "Less than a minute ago";
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? "s" : ""} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour !== 1 ? "s" : ""} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay !== 1 ? "s" : ""} ago`;
  return formatDateTime(date);
}

function ViolationMessage({ v, currencyLabel, onRemove, removingId, userName, userRoleName }) {
  const relativeTime = useRelativeTime(v.createdAt);
  const nameLabel = userName && String(userName).trim() ? String(userName).trim() : "Violation";
  const roleLabel = userRoleName && String(userRoleName).trim() ? String(userRoleName).trim() : "Deduction";
  return (
    <li
      className={`violationsPopoutItem violationsPopoutItemIn ${
        removingId === v.id ? "violationsPopoutItem--exiting" : ""
      }`}
    >
      <div className="violationsPopoutItemAvatar">
        <User size={20} />
      </div>
      <div className="violationsPopoutItemBody">
        <div className="violationsPopoutItemName">{nameLabel}</div>
        <div className="violationsPopoutItemRole">{roleLabel}</div>
        <div className="violationsPopoutItemContent">
          <span className="violationsPopoutItemAmount">
            {formatMoneyWithCommas(String(v.amount ?? 0))} {currencyLabel}
          </span>
          {v.reason ? ` · ${v.reason}` : " · No Reason"}
        </div>
        <div className="violationsPopoutItemMeta">
          <span className="violationsPopoutItemTime">{formatDateTime(v.createdAt)}</span>
          <span className="violationsPopoutItemRelative">{relativeTime}</span>
        </div>
      </div>
      <button
        type="button"
        className="violationsPopoutItemRemove"
        onClick={() => onRemove(v.id)}
        disabled={removingId != null}
        aria-label="Remove violation"
      >
        <Trash2 size={14} />
      </button>
    </li>
  );
}

const MODAL_EXIT_MS = 260;

export default function ViolationsPopout({ entityType, entityId, entityName, userName, userRoleName, onClose }) {
  const notify = useNotification();
  const [violations, setViolations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newReason, setNewReason] = useState("");
  const [newAmountRaw, setNewAmountRaw] = useState("");
  const [removingId, setRemovingId] = useState(null);
  const [exiting, setExiting] = useState(false);
  const listEndRef = useRef(null);
  const exitTimerRef = useRef(null);
  const listReqIdRef = useRef(null);
  const addReqIdRef = useRef(null);
  const removeReqIdRef = useRef(null);
  const removingIdRef = useRef(null);

  const fetchList = useCallback(() => {
    if (!entityType || !entityId || !window.api?.wsSend) return;
    setLoading(true);
    listReqIdRef.current = rid();
    window.api.wsSend({
      type: "violations:list",
      requestId: listReqIdRef.current,
      payload: { entityType, entityId },
    });
  }, [entityType, entityId]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    if (!window.api?.onWsMessage) return;
    const unsub = window.api.onWsMessage((msg) => {
      if (msg?.type === "violations:list:result" && msg?.requestId === listReqIdRef.current) {
        setViolations(Array.isArray(msg.violations) ? msg.violations : []);
        setLoading(false);
      }
      if (msg?.type === "violations:add:result" && msg?.requestId === addReqIdRef.current) {
        setAdding(false);
        if (msg?.ok && msg?.violation) {
          setViolations((prev) => [...prev, msg.violation]);
          setNewReason("");
          setNewAmountRaw("");
          notify?.success?.("Violation added.", "Violations");
        } else {
          notify?.error?.(msg?.error || "Failed to add violation", "Violations");
        }
      }
      if (msg?.type === "violations:remove:result" && msg?.requestId === removeReqIdRef.current) {
        const idToRemove = removingIdRef.current;
        if (msg?.ok && idToRemove) {
          notify?.success?.("Violation removed.", "Violations");
          /* Keep item in list with exiting class until remove animation finishes */
          setTimeout(() => {
            setViolations((prev) => prev.filter((v) => v.id !== idToRemove));
            setRemovingId(null);
            removingIdRef.current = null;
          }, 380);
        } else {
          setRemovingId(null);
          removingIdRef.current = null;
        }
      }
    });
    return () => unsub?.();
  }, [notify]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [violations]);

  const handleAdd = useCallback(() => {
    const reason = (newReason || "").trim();
    const amount = parseMoneyToNumber(newAmountRaw);
    if (amount <= 0) {
      notify?.warning?.("Enter a valid amount.", "Violations");
      return;
    }
    if (!window.api?.wsSend) return;
    setAdding(true);
    addReqIdRef.current = rid();
    window.api.wsSend({
      type: "violations:add",
      requestId: addReqIdRef.current,
      payload: { entityType, entityId, reason: reason || "Violation", amount },
    });
  }, [entityType, entityId, newReason, newAmountRaw, notify]);

  const handleRemove = useCallback((id) => {
    if (!id || !window.api?.wsSend) return;
    removingIdRef.current = id;
    setRemovingId(id);
    removeReqIdRef.current = rid();
    window.api.wsSend({
      type: "violations:remove",
      requestId: removeReqIdRef.current,
      payload: { id },
    });
  }, []);

  const handleClose = useCallback(() => {
    if (exiting) return;
    setExiting(true);
    exitTimerRef.current = setTimeout(() => {
      exitTimerRef.current = null;
      onClose?.();
    }, MODAL_EXIT_MS);
  }, [onClose, exiting]);

  useEffect(() => {
    return () => {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  }, []);

  const handleBackdropClick = useCallback(
    (e) => {
      if (e.target === e.currentTarget) handleClose();
    },
    [handleClose]
  );

  const currencyLabel = "IQD";

  const content = (
    <div
      className={`violationsPopoutBackdrop ${exiting ? "violationsPopoutBackdrop--exiting" : "violationsPopoutBackdrop--enter"}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="violations-popout-title"
      onClick={handleBackdropClick}
    >
      <div className={`violationsPopout ${exiting ? "violationsPopout--exiting" : "violationsPopout--enter"}`} onClick={(e) => e.stopPropagation()}>
        <header className="violationsPopoutHeader">
          <h2 id="violations-popout-title" className="violationsPopoutTitle">
            <AlertCircle size={22} className="violationsPopoutTitleIcon" />
            Violations
          </h2>
          <button type="button" className="violationsPopoutClose" onClick={handleClose} aria-label="Close">
            <X size={20} />
          </button>
        </header>
        {entityName && (
          <p className="violationsPopoutSubtitle">
            For {entityName} · applied when you cash out
          </p>
        )}

        <div className="violationsPopoutListWrap">
          {loading ? (
            <div className="violationsPopoutEmpty">Loading…</div>
          ) : violations.length === 0 ? (
            <div className="violationsPopoutEmpty">No violations yet. Add one below.</div>
          ) : (
            <ul className="violationsPopoutList" aria-label="Pending violations">
              {violations.map((v) => (
                <ViolationMessage
                  key={v.id}
                  v={v}
                  currencyLabel={currencyLabel}
                  onRemove={handleRemove}
                  removingId={removingId}
                  userName={userName}
                  userRoleName={userRoleName}
                />
              ))}
            </ul>
          )}
          <div ref={listEndRef} />
        </div>

        <div className="violationsPopoutAdd">
          <div className="violationsPopoutAddLabel">Add violation</div>
          <div className="violationsPopoutAddRow">
            <div className="violationsPopoutAddField violationsPopoutAddField--amount">
              <label className="violationsPopoutAddFieldLabel" htmlFor="violations-amount">
                Amount ({currencyLabel})
              </label>
              <input
                id="violations-amount"
                type="text"
                className="violationsPopoutInput violationsPopoutInputAmount"
                placeholder="0"
                dir="ltr"
                value={newAmountRaw}
                onChange={(e) => {
                  const digits = String(e.target.value).replace(/[^\d]/g, "");
                  setNewAmountRaw(digits ? formatMoneyWithCommas(digits) : "");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
            </div>
            <div className="violationsPopoutAddField violationsPopoutAddField--reason">
              <label className="violationsPopoutAddFieldLabel" htmlFor="violations-reason">
                Reason
              </label>
              <input
                id="violations-reason"
                type="text"
                className="violationsPopoutInput violationsPopoutInputReason"
                placeholder="Description…"
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
            </div>
            <div className="violationsPopoutAddField violationsPopoutAddField--btn">
              <label className="violationsPopoutAddFieldLabel violationsPopoutAddFieldLabel--hidden" aria-hidden="true">
                &nbsp;
              </label>
              <button
                type="button"
                className="violationsPopoutAddBtn"
                onClick={handleAdd}
                disabled={adding || parseMoneyToNumber(newAmountRaw) <= 0}
              >
                <Plus size={18} />
                Add
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

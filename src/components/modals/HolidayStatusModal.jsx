import React, { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle, XCircle } from "lucide-react";
import "../../styles/modals/holidayStatusModal.css";

const EXIT_MS = 250;

function formatDate(d) {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { dateStyle: "medium" });
}

export default function HolidayStatusModal({ open, status, payload, onClose }) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const exitTimerRef = useRef(null);

  useEffect(() => {
    if (open) {
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
      setExiting(false);
      setVisible(true);
    } else {
      if (!visible) return;
      setExiting(true);
      exitTimerRef.current = setTimeout(() => {
        exitTimerRef.current = null;
        setVisible(false);
        setExiting(false);
      }, EXIT_MS);
    }
    return () => {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- visible intentionally not in deps

  const handleBackdropClick = useCallback(() => onClose?.(), [onClose]);

  if (!open && !visible) return null;

  const isApproved = status === "approved";
  const p = payload || {};

  return (
    <div
      className={`holidayStatusModal-backdrop ${visible ? "is-open" : ""} ${exiting ? "is-exiting" : ""}`}
      onMouseDown={handleBackdropClick}
      role="presentation"
    >
      <div
        className={`holidayStatusModal ${visible && !exiting ? "is-open" : ""} ${exiting ? "is-exiting" : ""}`}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="holidayStatusModal-title"
      >
        <div className={`holidayStatusModal-icon ${isApproved ? "approved" : "denied"}`}>
          {isApproved ? <CheckCircle size={48} /> : <XCircle size={48} />}
        </div>
        <h2 className="holidayStatusModal-title" id="holidayStatusModal-title">
          Holiday request {isApproved ? "approved" : "denied"}
        </h2>
        <p className="holidayStatusModal-dates">
          {formatDate(p.startDate)} – {formatDate(p.endDate)} ({p.days} day{p.days !== 1 ? "s" : ""})
        </p>
        {p.reason && <p className="holidayStatusModal-reason">Reason: {p.reason}</p>}
        {p.decidedByName && (
          <p className="holidayStatusModal-decider">
            {isApproved ? "Approved" : "Denied"} by {p.decidedByName}
          </p>
        )}
        {!isApproved && p.denialReason && (
          <p className="holidayStatusModal-denial">Note: {p.denialReason}</p>
        )}
        <button type="button" className="holidayStatusModal-btn" onClick={onClose}>
          OK
        </button>
      </div>
    </div>
  );
}

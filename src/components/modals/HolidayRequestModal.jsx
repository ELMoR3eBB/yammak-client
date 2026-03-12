import React, { useCallback, useEffect, useRef, useState } from "react";
import { X, Calendar } from "lucide-react";
import DateRangePicker from "../ui/DateRangePicker";
import "../../styles/modals/holidayRequestModal.css";
import "../../styles/ui/date_range_picker.css";

function formatDate(d) {
  if (!d) return "-";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(undefined, { dateStyle: "medium" });
}

function daysFromNow(d) {
  if (!d) return 0;
  const date = new Date(d);
  if (isNaN(date.getTime())) return 0;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.floor((date - now) / (24 * 60 * 60 * 1000));
}

function lastHolidayText(last, loading) {
  if (loading) return "Loading...";
  if (!last) return "No holiday taken";
  const days = daysFromNow(last.endDate);
  const dateStr = formatDate(last.endDate);
  if (days >= 0) return `Last holiday ended ${dateStr} (${days} days from now)`;
  return `Last holiday ended ${dateStr} (${-days} days ago)`;
}

export default function HolidayRequestModal({
  open,
  lastHoliday,
  loadingLast,
  onClose,
  onSubmit,
  submitting,
}) {
  const [reason, setReason] = useState("");
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [error, setError] = useState("");
  const dialogRef = useRef(null);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const closingRef = useRef(false);

  const derivedDays =
    dateRange.from && dateRange.to
      ? (() => {
          const a = new Date(dateRange.from);
          const b = new Date(dateRange.to);
          a.setHours(0, 0, 0, 0);
          b.setHours(0, 0, 0, 0);
          const diff = (b - a) / (24 * 60 * 60 * 1000);
          return Math.max(0, Math.round(diff) + 1);
        })()
      : null;

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();
      setError("");
      const r = (reason || "").trim();
      if (!r) {
        setError("Please enter a reason.");
        return;
      }
      if (!dateRange.from || !dateRange.to) {
        setError("Please select a date range.");
        return;
      }
      const start = new Date(dateRange.from);
      const end = new Date(dateRange.to);
      if (end < start) {
        setError("End date must be on or after start date.");
        return;
      }
      onSubmit({ reason: r, startDate: dateRange.from, endDate: dateRange.to });
    },
    [reason, dateRange, onSubmit]
  );

  const beginClose = useCallback(() => {
    if (submitting) return;
    closingRef.current = true;
    setVisible(false);
  }, [submitting]);

  const onTransitionEnd = useCallback(
    (e) => {
      if (e.target !== e.currentTarget) return;
      if (!visible && closingRef.current) {
        closingRef.current = false;
        setMounted(false);
        onClose?.();
      }
    },
    [visible, onClose]
  );

  useEffect(() => {
    if (open) {
      setReason("");
      setDateRange({ from: "", to: "" });
      setError("");
      closingRef.current = false;
      setMounted(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!closingRef.current) setVisible(true);
        });
      });
      return;
    }
    if (mounted) {
      closingRef.current = true;
      setVisible(false);
    }
  }, [open, mounted]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") beginClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, beginClose]);

  if (!mounted && !open) return null;

  const lastText = lastHolidayText(lastHoliday, loadingLast);

  return (
    <div
      className={`holidayReqModal-backdrop ${visible ? "is-open" : ""}`}
      onMouseDown={beginClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className={`holidayReqModal ${visible ? "is-open" : ""}`}
        onMouseDown={(e) => e.stopPropagation()}
        onTransitionEnd={onTransitionEnd}
        role="dialog"
        aria-modal="true"
        aria-labelledby="holidayReqModal-title"
      >
        <div className="holidayReqModal-head">
          <div className="holidayReqModal-iconWrap">
            <Calendar size={28} />
          </div>
          <h2 className="holidayReqModal-title" id="holidayReqModal-title">
            Request holiday
          </h2>
          <button
            type="button"
            className="holidayReqModal-close"
            onClick={beginClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="holidayReqModal-last">
          <span className="holidayReqModal-lastLabel">Last holiday</span>
          <span className="holidayReqModal-lastValue">{lastText}</span>
        </div>

        <form onSubmit={handleSubmit} className="holidayReqModal-form">
          <div className="holidayReqModal-row">
            <label className="holidayReqModal-label">
              Date range <span className="holidayReqModal-required">*</span>
            </label>
            <div className={`holidayReqModal-dateRangeWrap ${submitting ? "is-disabled" : ""}`}>
              <DateRangePicker
                label=""
                placeholder="From - To"
                value={dateRange}
                onChange={({ from, to }) => {
                  setDateRange({ from: from ?? "", to: to ?? "" });
                  setError("");
                }}
                className="holidayReqModal-dateRange"
                closeOnRangeSelect
              />
            </div>
          </div>

          <label className="holidayReqModal-label">
            Reason <span className="holidayReqModal-required">*</span>
          </label>
          <textarea
            className="holidayReqModal-input holidayReqModal-textarea"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Family trip, personal leave..."
            rows={3}
            disabled={submitting}
          />

          {derivedDays != null && (
            <p className="holidayReqModal-days">Total: {derivedDays} day{derivedDays !== 1 ? "s" : ""}</p>
          )}

          {error && <p className="holidayReqModal-error">{error}</p>}

          <div className="holidayReqModal-actions">
            <button type="button" className="holidayReqModal-btn holidayReqModal-btn--ghost" onClick={beginClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="holidayReqModal-btn holidayReqModal-btn--primary" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

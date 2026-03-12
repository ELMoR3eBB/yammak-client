// DateRangePicker — single trigger + popover with range calendar (HeroUI-style, no dependency)
// value: { from: 'YYYY-MM-DD' | '', to: 'YYYY-MM-DD' | '' }, onChange: ({ from, to }) => void
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar as CalendarIcon, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

const GAP = 6;

function toDate(str) {
  if (!str || typeof str !== "string") return null;
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toYYYYMMDD(d) {
  if (!d || !(d instanceof Date)) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDisplay(str) {
  const d = toDate(str);
  if (!d) return "";
  return d.toLocaleDateString(undefined, { dateStyle: "short" });
}

function getMonthDays(year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = (first.getDay() + 6) % 7; // Monday = 0
  const days = [];
  for (let i = 0; i < startPad; i++) {
    const d = new Date(year, month, 1 - (startPad - i));
    days.push({ date: d, currentMonth: false, key: d.toISOString().slice(0, 10) });
  }
  for (let day = 1; day <= last.getDate(); day++) {
    const d = new Date(year, month, day);
    days.push({ date: d, currentMonth: true, key: toYYYYMMDD(d) });
  }
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(year, month + 1, i);
    days.push({ date: d, currentMonth: false, key: d.toISOString().slice(0, 10) });
  }
  return days;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function DateRangePicker({
  value = { from: "", to: "" },
  onChange,
  label = "Date range",
  className = "",
  popoverClassName = "",
  placeholder = "From - To",
  minValue = null,
  maxValue = null,
  closeOnRangeSelect = true,
}) {
  const { from: fromVal, to: toVal } = value;
  const [open, setOpen] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [viewDate, setViewDate] = useState(() => {
    const d = toDate(fromVal) || toDate(toVal) || new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [draft, setDraft] = useState({ from: fromVal, to: toVal });
  const [hoverDate, setHoverDate] = useState(null); // preview end date while selecting range
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);
  const dropRef = useRef(null);
  const [dropStyle, setDropStyle] = useState({});

  const finishClose = useCallback(() => {
    setOpen(false);
    setExiting(false);
    setDraft({ from: fromVal, to: toVal });
    setHoverDate(null);
  }, [fromVal, toVal]);

  const closeDropdown = useCallback(() => {
    if (exiting) return;
    setExiting(true);
  }, [exiting]);

  const toggleDropdown = useCallback(() => {
    if (exiting) return;
    if (open) setExiting(true);
    else setOpen(true);
  }, [open, exiting]);

  useEffect(() => {
    if (!open || exiting) return;
    setDraft({ from: fromVal, to: toVal });
    const d = toDate(fromVal) || toDate(toVal) || new Date();
    setViewDate({ year: d.getFullYear(), month: d.getMonth() });
  }, [open, fromVal, toVal, exiting]);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setDropStyle({
      position: "fixed",
      left: rect.left,
      top: rect.bottom + GAP,
      zIndex: 9999,
      minWidth: Math.max(rect.width, 320),
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const onScrollOrResize = () => updatePosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      const target = e.target;
      if (wrapRef.current?.contains(target) || dropRef.current?.contains(target)) return;
      closeDropdown();
    };
    document.addEventListener("mousedown", onDocClick, true);
    return () => document.removeEventListener("mousedown", onDocClick, true);
  }, [open, closeDropdown]);

  const displayText = useMemo(() => {
    if (fromVal && toVal) return `${formatDisplay(fromVal)} – ${formatDisplay(toVal)}`;
    if (fromVal) return `${formatDisplay(fromVal)} – …`;
    if (toVal) return `… – ${formatDisplay(toVal)}`;
    return placeholder;
  }, [fromVal, toVal, placeholder]);

  const handleDayClick = useCallback(
    (key) => {
      const from = draft.from;
      const to = draft.to;
      if (!from || (from && to)) {
        setDraft({ from: key, to: "" });
        return;
      }
      if (from && !to) {
        const a = new Date(from).getTime();
        const b = new Date(key).getTime();
        const [start, end] = a <= b ? [from, key] : [key, from];
        setDraft({ from: start, to: end });
        onChange({ from: start, to: end });
        setHoverDate(null);
        if (closeOnRangeSelect) closeDropdown();
      }
    },
    [draft.from, draft.to, onChange, closeOnRangeSelect, closeDropdown]
  );

  const handleClear = useCallback(() => {
    setDraft({ from: "", to: "" });
    onChange({ from: "", to: "" });
    closeDropdown();
  }, [onChange, closeDropdown]);

  const prevMonth = useCallback(() => {
    setViewDate((v) => {
      if (v.month === 0) return { year: v.year - 1, month: 11 };
      return { year: v.year, month: v.month - 1 };
    });
  }, []);

  const nextMonth = useCallback(() => {
    setViewDate((v) => {
      if (v.month === 11) return { year: v.year + 1, month: 0 };
      return { year: v.year, month: v.month + 1 };
    });
  }, []);

  const days = useMemo(
    () => getMonthDays(viewDate.year, viewDate.month),
    [viewDate.year, viewDate.month]
  );

  const monthTitle = useMemo(
    () => new Date(viewDate.year, viewDate.month).toLocaleString(undefined, { month: "long", year: "numeric" }),
    [viewDate.year, viewDate.month]
  );

  // Use hoverDate as temporary "to" when only start is selected, so range highlights as user moves to second date
  const effectiveTo = draft.to || toVal || (draft.from ? hoverDate : null);

  const isInRange = useCallback(
    (key) => {
      const from = draft.from || fromVal;
      const to = effectiveTo;
      if (!from || !to) return false;
      const t = new Date(key).getTime();
      const f = new Date(from).getTime();
      const e = new Date(to).getTime();
      return t >= Math.min(f, e) && t <= Math.max(f, e);
    },
    [draft.from, draft.to, fromVal, toVal, effectiveTo]
  );

  const isStart = useCallback(
    (key) => {
      const from = draft.from || fromVal;
      const to = draft.to || toVal;
      if (key === from || key === to) return true;
      // While selecting range, show hovered cell as end cap
      if (from && !to && hoverDate && key === hoverDate) return true;
      return false;
    },
    [draft.from, draft.to, fromVal, toVal, hoverDate]
  );

  return (
    <div ref={wrapRef} className={`dateRangePicker ${open ? "dateRangePicker--open" : ""} ${className}`.trim()}>
      {label ? <span className="dateRangePickerLabel">{label}</span> : null}
      <button
        ref={triggerRef}
        type="button"
        className="dateRangePickerTrigger"
        onClick={toggleDropdown}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <CalendarIcon size={16} className="dateRangePickerTriggerIcon" aria-hidden />
        <span className="dateRangePickerTriggerValue">{displayText}</span>
        <ChevronDown size={16} className="dateRangePickerTriggerArrow" aria-hidden />
      </button>

      {(open || exiting) &&
        typeof document !== "undefined" &&
        document.body &&
        createPortal(
          <div
            ref={dropRef}
            className={`dateRangePickerDrop ${exiting ? "dateRangePickerDrop--exit" : ""} ${popoverClassName}`.trim()}
            style={dropStyle}
            role="dialog"
            aria-modal="true"
            aria-label="Select date range"
          >
            <div
              className="dateRangePickerDropInner"
              onAnimationEnd={(e) => {
                if (exiting && e.target === e.currentTarget) finishClose();
              }}
            >
              <div className="dateRangePickerDropHeader">
                <button type="button" className="dateRangePickerDropNav" onClick={prevMonth} aria-label="Previous month">
                  <ChevronLeft size={18} />
                </button>
                <span className="dateRangePickerDropMonth">{monthTitle}</span>
                <button type="button" className="dateRangePickerDropNav" onClick={nextMonth} aria-label="Next month">
                  <ChevronRight size={18} />
                </button>
              </div>
              <div className="dateRangePickerDropWeekdays">
                {WEEKDAYS.map((w) => (
                  <span key={w} className="dateRangePickerDropWeekday">
                    {w}
                  </span>
                ))}
              </div>
              <div className="dateRangePickerDropGrid">
                {days.map(({ date, currentMonth, key }) => {
                  const inRange = isInRange(key);
                  const isStartEnd = isStart(key);
                  const isDisabled =
                    (minValue && key < minValue) || (maxValue && key > maxValue);
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`dateRangePickerDropDay ${!currentMonth ? "dateRangePickerDropDay--other" : ""} ${inRange ? "dateRangePickerDropDay--inRange" : ""} ${isStartEnd ? "dateRangePickerDropDay--selected" : ""} ${isDisabled ? "dateRangePickerDropDay--disabled" : ""}`}
                      onClick={() => !isDisabled && handleDayClick(key)}
                      onMouseEnter={() => !isDisabled && setHoverDate(key)}
                      onMouseLeave={() => setHoverDate(null)}
                      disabled={isDisabled}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
              <div className="dateRangePickerDropFooter">
                <button type="button" className="dateRangePickerDropClear" onClick={handleClear}>
                  Clear
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}


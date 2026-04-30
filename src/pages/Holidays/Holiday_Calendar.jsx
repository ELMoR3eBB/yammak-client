import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";
import "tippy.js/animations/shift-away.css";
import { useLanguage } from "../../contexts/LanguageContext";
import "../../styles/pages/holidays/holidays.css";

const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const MONTH_SWITCH_MIN_LOADING_MS = 180;
const MONTH_PICKER_GAP = 8;
const MONTH_PICKER_MAX_WIDTH = 320;

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}
function addMonths(d, n) {
  const out = new Date(d);
  out.setMonth(out.getMonth() + n);
  return out;
}
function dateInRange(date, start, end) {
  const t = date.getTime();
  return t >= start.getTime() && t <= end.getTime();
}
function isSameMonth(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}
function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_AR = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export default function HolidayCalendar({ account }) {
  const { t, language } = useLanguage();
  const [monthDate, setMonthDate] = useState(() => startOfMonth(new Date()));
  const [events, setEvents] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [monthLoading, setMonthLoading] = useState(false);
  const [slideDir, setSlideDir] = useState(null);
  const [gridKey, setGridKey] = useState(0);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [monthPickerExiting, setMonthPickerExiting] = useState(false);
  const [monthPickerYear, setMonthPickerYear] = useState(() => new Date().getFullYear());
  const [monthPickerStyle, setMonthPickerStyle] = useState({});
  const initialMonthRef = useRef(startOfMonth(new Date()));
  const pendingRef = useRef({});
  const hasLoadedOnceRef = useRef(false);
  const monthLoadStartedAtRef = useRef(0);
  const loadingTimeoutRef = useRef(null);
  const monthPickerWrapRef = useRef(null);
  const monthPickerTriggerRef = useRef(null);
  const monthPickerDropRef = useRef(null);

  const fetchEvents = useCallback((targetMonthDate, direction = null) => {
    if (!window.api?.wsSend) return;
    const from = startOfMonth(targetMonthDate);
    const to = endOfMonth(targetMonthDate);
    const requestId = rid();
    pendingRef.current[requestId] = {
      monthDate: startOfMonth(targetMonthDate),
      direction,
    };
    if (!hasLoadedOnceRef.current) {
      setInitialLoading(true);
    } else {
      monthLoadStartedAtRef.current = Date.now();
      setMonthLoading(true);
    }
    window.api.wsSend({
      type: "holiday:calendar",
      requestId,
      payload: { fromDate: from.toISOString(), toDate: to.toISOString() },
    });
  }, []);

  useEffect(() => {
    const unsub = window.api?.onWsMessage?.((msg) => {
      const pending = msg?.requestId ? pendingRef.current[msg.requestId] : null;
      if (msg?.type === "holiday:calendar" && pending) {
        delete pendingRef.current[msg.requestId];
        const applyResult = () => {
          setEvents(Array.isArray(msg.events) ? msg.events : []);
          setMonthDate(pending.monthDate);
          if (pending.direction) {
            setSlideDir(pending.direction);
            setGridKey((k) => k + 1);
          }
          setInitialLoading(false);
          setMonthLoading(false);
          hasLoadedOnceRef.current = true;
        };

        if (!hasLoadedOnceRef.current) {
          applyResult();
          return;
        }

        const elapsed = monthLoadStartedAtRef.current ? Date.now() - monthLoadStartedAtRef.current : 0;
        const waitMs = Math.max(0, MONTH_SWITCH_MIN_LOADING_MS - elapsed);
        window.clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = window.setTimeout(applyResult, waitMs);
      }
    });
    return () => {
      window.clearTimeout(loadingTimeoutRef.current);
      unsub?.();
    };
  }, []);

  useEffect(() => {
    fetchEvents(initialMonthRef.current, null);
  }, [fetchEvents]);

  const finishCloseMonthPicker = useCallback(() => {
    setMonthPickerOpen(false);
    setMonthPickerExiting(false);
    setMonthPickerYear(monthDate.getFullYear());
  }, [monthDate]);

  const closeMonthPicker = useCallback(() => {
    if (!monthPickerOpen || monthPickerExiting) return;
    setMonthPickerExiting(true);
  }, [monthPickerExiting, monthPickerOpen]);

  const toggleMonthPicker = useCallback(() => {
    if (monthLoading || monthPickerExiting) return;
    if (monthPickerOpen) {
      setMonthPickerExiting(true);
      return;
    }
    setMonthPickerYear(monthDate.getFullYear());
    setMonthPickerOpen(true);
  }, [monthDate, monthLoading, monthPickerExiting, monthPickerOpen]);

  const updateMonthPickerPosition = useCallback(() => {
    if (!monthPickerTriggerRef.current || typeof window === "undefined") return;
    const rect = monthPickerTriggerRef.current.getBoundingClientRect();
    const viewportWidth = Math.max(280, window.innerWidth - 24);
    const width = Math.min(MONTH_PICKER_MAX_WIDTH, Math.max(rect.width, Math.min(320, viewportWidth)), viewportWidth);
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
    setMonthPickerStyle({
      position: "fixed",
      top: rect.bottom + MONTH_PICKER_GAP,
      left,
      width,
      zIndex: 9999,
    });
  }, []);

  useLayoutEffect(() => {
    if (!monthPickerOpen) return;
    updateMonthPickerPosition();
    const handleScrollOrResize = () => updateMonthPickerPosition();
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [monthPickerOpen, updateMonthPickerPosition]);

  useEffect(() => {
    if (!monthPickerOpen) return;
    const handlePointerDown = (event) => {
      const target = event.target;
      if (monthPickerWrapRef.current?.contains(target) || monthPickerDropRef.current?.contains(target)) return;
      closeMonthPicker();
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") closeMonthPicker();
    };
    document.addEventListener("mousedown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeMonthPicker, monthPickerOpen]);



  const prevMonth = () => {
    if (monthLoading) return;
    fetchEvents(addMonths(monthDate, -1), "prev");
  };
  const nextMonth = () => {
    if (monthLoading) return;
    fetchEvents(addMonths(monthDate, 1), "next");
  };

  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const today = new Date();
  const currentMonthDate = startOfMonth(today);
  const isCurrentMonth = isSameMonth(monthDate, currentMonthDate);

  const locale = language === "ar" ? "ar-EG" : "en-US";
  const weekdays = language === "ar" ? WEEKDAYS_AR : WEEKDAYS;
  const monthNames = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) =>
        new Intl.DateTimeFormat(locale, { month: "short" }).format(new Date(2024, i, 1))
      ),
    [locale]
  );
  const monthLabel = firstDay.toLocaleDateString(locale, { month: "long", year: "numeric" });
  const monthStats = {
    total: events.length,
    approved: events.filter((event) => event?.status === "approved").length,
    pending: events.filter((event) => event?.status === "pending").length,
    denied: events.filter((event) => event?.status === "denied").length,
  };

  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push({ type: "pad", key: `pad-${i}` });
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const dayEvents = events.filter(
      (e) => dateInRange(date, new Date(e.startDate), new Date(e.endDate))
    );
    cells.push({ type: "day", date, dayEvents, isToday: isSameDay(date, today), key: `day-${d}` });
  }

  const goToCurrentMonth = () => {
    if (monthLoading || isCurrentMonth) return;
    fetchEvents(currentMonthDate, null);
  };

  const jumpToMonth = useCallback((monthIndex) => {
    if (monthLoading) return;
    const selectedMonth = new Date(monthPickerYear, monthIndex, 1);
    finishCloseMonthPicker();
    if (isSameMonth(selectedMonth, monthDate)) return;
    fetchEvents(selectedMonth, null);
  }, [fetchEvents, finishCloseMonthPicker, monthDate, monthLoading, monthPickerYear]);

  return (
    <div className="auditLogsPage holidaysPage holidaysCalendarPage">
      <header className="auditLogsHeader">
        <div className="auditLogsHeaderIcon">
          <CalendarDays size={24} />
        </div>
        <div className="auditLogsHeaderText">
          <h1 className="auditLogsTitle">{t("holidays.calendarTitle")}</h1>
          <p className="auditLogsSubtitle">{t("holidays.calendarSubtitle")}</p>
        </div>
      </header>

      <main className="auditLogsMain">
        <div className="holidaysCalendarToolbar">
          <div className="holidaysCalendarNavGroup">
            <button type="button" className="holidaysCalendarNavBtn" onClick={prevMonth} aria-label="Previous month" disabled={monthLoading}>
              <ChevronLeft size={20} />
            </button>
            <div className="holidaysCalendarMonthHeading">
              <h2 className="holidaysCalendarMonthTitle">{monthLabel}</h2>
              {isCurrentMonth && (
                <span className="holidaysCalendarCurrentBadge">{t("holidays.currentMonth")}</span>
              )}
            </div>
            <button type="button" className="holidaysCalendarNavBtn" onClick={nextMonth} aria-label="Next month" disabled={monthLoading}>
              <ChevronRight size={20} />
            </button>
          </div>
          <div className="holidaysCalendarActions">
            <div ref={monthPickerWrapRef} className="holidaysCalendarMonthField">
              <span className="holidaysCalendarMonthLabel">{t("holidays.jumpToMonth")}</span>
              <div
                className={`holidaysCalendarMonthInputWrap ${monthLoading ? "is-disabled" : ""} ${monthPickerOpen ? "is-open" : ""}`.trim()}
              >
                <CalendarDays size={16} className="holidaysCalendarMonthInputIcon" aria-hidden="true" />
                <button
                  ref={monthPickerTriggerRef}
                  type="button"
                  className="holidaysCalendarMonthTrigger"
                  onClick={toggleMonthPicker}
                  disabled={monthLoading}
                  aria-haspopup="dialog"
                  aria-expanded={monthPickerOpen}
                  aria-label={t("holidays.jumpToMonth")}
                >
                  <span className="holidaysCalendarMonthTriggerValue">{monthLabel}</span>
                  <ChevronDown size={16} className="holidaysCalendarMonthTriggerArrow" aria-hidden="true" />
                </button>
              </div>
              {(monthPickerOpen || monthPickerExiting) &&
                typeof document !== "undefined" &&
                document.body &&
                createPortal(
                  <div
                    ref={monthPickerDropRef}
                    className={`holidaysCalendarPickerDrop ${monthPickerExiting ? "holidaysCalendarPickerDrop--exit" : ""}`.trim()}
                    style={monthPickerStyle}
                    role="dialog"
                    aria-modal="true"
                    aria-label={t("holidays.jumpToMonth")}
                  >
                    <div
                      className="holidaysCalendarPickerDropInner"
                      onAnimationEnd={(event) => {
                        if (monthPickerExiting && event.target === event.currentTarget) finishCloseMonthPicker();
                      }}
                    >
                      <div className="holidaysCalendarPickerHeader">
                        <button
                          type="button"
                          className="holidaysCalendarPickerNav"
                          onClick={() => setMonthPickerYear((y) => y - 1)}
                          aria-label="Previous year"
                        >
                          <ChevronLeft size={18} />
                        </button>
                        <span className="holidaysCalendarPickerTitle">{monthPickerYear}</span>
                        <button
                          type="button"
                          className="holidaysCalendarPickerNav"
                          onClick={() => setMonthPickerYear((y) => y + 1)}
                          aria-label="Next year"
                        >
                          <ChevronRight size={18} />
                        </button>
                      </div>
                      <div className="holidaysCalendarPickerMonthGrid">
                        {monthNames.map((name, i) => {
                          const isCurrentMonthCell = i === today.getMonth() && monthPickerYear === today.getFullYear();
                          const isSelected = i === monthDate.getMonth() && monthPickerYear === monthDate.getFullYear();
                          return (
                            <button
                              key={i}
                              type="button"
                              className={`holidaysCalendarPickerMonth ${isSelected ? "holidaysCalendarPickerMonth--selected" : ""} ${isCurrentMonthCell ? "holidaysCalendarPickerMonth--current" : ""}`.trim()}
                              onClick={() => jumpToMonth(i)}
                            >
                              {name}
                            </button>
                          );
                        })}
                      </div>
                      <div className="holidaysCalendarPickerFooter">
                        <button
                          type="button"
                          className="holidaysCalendarPickerFooterBtn"
                          onClick={() => { setMonthPickerYear(today.getFullYear()); jumpToMonth(today.getMonth()); }}
                          disabled={isCurrentMonth && monthPickerYear === today.getFullYear()}
                        >
                          {isCurrentMonth ? t("holidays.currentMonth") : t("holidays.backToCurrentMonth")}
                        </button>
                      </div>
                    </div>
                  </div>,
                  document.body
                )}
            </div>
            <button
              type="button"
              className="holidaysCalendarTodayBtn"
              onClick={goToCurrentMonth}
              disabled={monthLoading || isCurrentMonth}
            >
              {isCurrentMonth ? t("holidays.currentMonth") : t("holidays.backToCurrentMonth")}
            </button>
          </div>
        </div>

        {initialLoading ? (
          <div className="holidaysCalendarLoading">
            <div className="driversSpinner" aria-hidden />
            <p>{t("common.loading")}</p>
          </div>
        ) : (
          <div className="holidaysCalendarStage">
            <div
              className={`holidaysCalendarGridWrap ${slideDir ? `holidaysCalendarGridWrap--${slideDir}` : ""} ${monthLoading ? "holidaysCalendarGridWrap--loading" : ""}`}
              key={gridKey}
              onAnimationEnd={() => setSlideDir(null)}
            >
              <div className="holidaysCalendarGrid" role="grid" aria-label={monthLabel}>
                <div className="holidaysCalendarWeekdayRow" role="row">
                  {weekdays.map((w) => (
                    <div key={w} className="holidaysCalendarWeekday" role="columnheader">
                      {w}
                    </div>
                  ))}
                </div>
                <div className="holidaysCalendarDays">
                  {cells.map((cell) => {
                    if (cell.type === "pad") {
                      return <div key={cell.key} className="holidaysCalendarDay holidaysCalendarDay--pad" />;
                    }
                    return (
                      <div
                        key={cell.key}
                        className={`holidaysCalendarDay ${cell.isToday ? "holidaysCalendarDay--today" : ""}`}
                        role="gridcell"
                        aria-label={cell.date.toLocaleDateString()}
                      >
                        <div className="holidaysCalendarDayHeader">
                          <span className="holidaysCalendarDayNum">{cell.date.getDate()}</span>
                          {cell.isToday && (
                            <span className="holidaysCalendarTodayBadge">{t("holidays.today")}</span>
                          )}
                        </div>
                        <div className="holidaysCalendarDayEvents">
                          {cell.dayEvents.slice(0, 3).map((e) => (
                            <Tippy
                              key={e._id}
                              content={`${e.userName || "—"} – ${e.reason || ""} (${e.status})`}
                              animation="shift-away"
                              placement="top"
                              delay={[200, 0]}
                            >
                              <div className={`holidaysCalendarEvent holidaysCalendarEvent--${e.status}`}>
                                <span className="holidaysCalendarEventName">{e.userName || "—"}</span>
                                <span className="holidaysCalendarEventReason">{e.reason ? String(e.reason).slice(0, 20) : ""}</span>
                              </div>
                            </Tippy>
                          ))}
                          {cell.dayEvents.length > 3 && (
                            <span className="holidaysCalendarEventMore">+{cell.dayEvents.length - 3}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            {monthLoading && (
              <div className="holidaysCalendarLoadingOverlay" aria-live="polite" aria-busy="true">
                <div className="holidaysCalendarLoadingGlass">
                  <div className="driversSpinner" aria-hidden />
                  <span>{t("common.loading")}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {!initialLoading && !monthLoading && events.length === 0 && (
          <p className="holidaysCalendarEmpty">{t("holidays.noEvents")}</p>
        )}

        <div className="holidaysCalendarSummary" role="list" aria-label={t("holidays.monthSummary")}>
          <div className="holidaysCalendarStatCard" role="listitem">
            <span className="holidaysCalendarStatLabel">{t("holidays.totalRequests")}</span>
            <strong className="holidaysCalendarStatValue">{monthStats.total}</strong>
          </div>
          <div className="holidaysCalendarStatCard holidaysCalendarStatCard--approved" role="listitem">
            <span className="holidaysCalendarStatLabel">{t("holidays.approved")}</span>
            <strong className="holidaysCalendarStatValue">{monthStats.approved}</strong>
          </div>
          <div className="holidaysCalendarStatCard holidaysCalendarStatCard--pending" role="listitem">
            <span className="holidaysCalendarStatLabel">{t("holidays.pending")}</span>
            <strong className="holidaysCalendarStatValue">{monthStats.pending}</strong>
          </div>
          <div className="holidaysCalendarStatCard holidaysCalendarStatCard--denied" role="listitem">
            <span className="holidaysCalendarStatLabel">{t("holidays.denied")}</span>
            <strong className="holidaysCalendarStatValue">{monthStats.denied}</strong>
          </div>
        </div>

        <div className="holidaysCalendarLegend" role="list" aria-label="Status legend">
          <div className="holidaysCalendarLegendPill holidaysCalendarLegendPill--pending">
            <span className="holidaysCalendarLegendDot" aria-hidden />
            <span>{t("holidays.pending")}</span>
          </div>
          <div className="holidaysCalendarLegendPill holidaysCalendarLegendPill--approved">
            <span className="holidaysCalendarLegendDot" aria-hidden />
            <span>{t("holidays.approved")}</span>
          </div>
          <div className="holidaysCalendarLegendPill holidaysCalendarLegendPill--denied">
            <span className="holidaysCalendarLegendDot" aria-hidden />
            <span>{t("holidays.denied")}</span>
          </div>
        </div>
      </main>
    </div>
  );
}

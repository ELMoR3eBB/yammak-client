import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";
import "tippy.js/animations/shift-away.css";
import { useLanguage } from "../../../contexts/LanguageContext";
import "../../../styles/pages/holidays/holidays.css";

const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

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
function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function dateInRange(date, start, end) {
  const t = date.getTime();
  return t >= start.getTime() && t <= end.getTime();
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_AR = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export default function HolidayCalendar({ account }) {
  const { t, language } = useLanguage();
  const [monthDate, setMonthDate] = useState(() => startOfMonth(new Date()));
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [slideDir, setSlideDir] = useState(null);
  const [gridKey, setGridKey] = useState(0);
  const pendingRef = useRef({});

  const fetchEvents = useCallback(() => {
    if (!window.api?.wsSend) return;
    const from = startOfMonth(monthDate);
    const to = endOfMonth(monthDate);
    const requestId = rid();
    pendingRef.current[requestId] = true;
    setLoading(true);
    window.api.wsSend({
      type: "holiday:calendar",
      requestId,
      payload: { fromDate: from.toISOString(), toDate: to.toISOString() },
    });
  }, [monthDate]);

  useEffect(() => {
    const unsub = window.api?.onWsMessage?.((msg) => {
      if (msg?.type === "holiday:calendar" && msg?.requestId && pendingRef.current[msg.requestId]) {
        delete pendingRef.current[msg.requestId];
        setEvents(Array.isArray(msg.events) ? msg.events : []);
        setLoading(false);
      }
    });
    return () => unsub?.();
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const prevMonth = () => {
    setSlideDir("prev");
    setGridKey((k) => k + 1);
    setMonthDate((d) => addMonths(d, -1));
  };
  const nextMonth = () => {
    setSlideDir("next");
    setGridKey((k) => k + 1);
    setMonthDate((d) => addMonths(d, 1));
  };

  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const weekdays = language === "ar" ? WEEKDAYS_AR : WEEKDAYS;
  const monthLabel = firstDay.toLocaleDateString(language === "ar" ? "ar-EG" : "en-US", { month: "long", year: "numeric" });

  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push({ type: "pad", key: `pad-${i}` });
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const dayEvents = events.filter(
      (e) => dateInRange(date, new Date(e.startDate), new Date(e.endDate))
    );
    cells.push({ type: "day", date, dayEvents, key: `day-${d}` });
  }

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
          <button type="button" className="holidaysCalendarNavBtn" onClick={prevMonth} aria-label="Previous month">
            <ChevronLeft size={20} />
          </button>
          <h2 className="holidaysCalendarMonthTitle">{monthLabel}</h2>
          <button type="button" className="holidaysCalendarNavBtn" onClick={nextMonth} aria-label="Next month">
            <ChevronRight size={20} />
          </button>
        </div>

        {loading ? (
          <div className="holidaysCalendarLoading">
            <div className="driversSpinner" aria-hidden />
            <p>{t("common.loading")}</p>
          </div>
        ) : (
          <div
            className={`holidaysCalendarGridWrap ${slideDir ? `holidaysCalendarGridWrap--${slideDir}` : ""}`}
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
                      className="holidaysCalendarDay"
                      role="gridcell"
                      aria-label={cell.date.toLocaleDateString()}
                    >
                      <span className="holidaysCalendarDayNum">{cell.date.getDate()}</span>
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
        )}

        {!loading && events.length === 0 && (
          <p className="holidaysCalendarEmpty">{t("holidays.noEvents")}</p>
        )}

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

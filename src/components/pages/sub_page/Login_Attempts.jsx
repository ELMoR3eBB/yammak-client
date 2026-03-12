// Login attempts per user — bar pieces with context menu (success/fail), Tippy tooltips
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { LogIn, CheckCircle, XCircle, Lock, Unlock, Loader2 } from "lucide-react";
import moment from "moment";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";
import "tippy.js/animations/shift-away.css";
import { getAssetUrl } from "../../../utils/publicUrl";
import { useNotification } from "../../NotificationProvider";
import Tooltip from "../../ui/Tooltip";
import DateRangePicker from "../../ui/DateRangePicker";
import "../../../styles/ui/date_range_picker.css";
import "../../../styles/pages/devices/devices.css";
import "../../../styles/pages/devices/login_attempts.css";

const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const tippyOpts = { animation: "shift-away", delay: [200, 0] };

function groupAttemptsByDate(attempts) {
  const byDate = {};
  (attempts || []).forEach((a) => {
    const d = a?.createdAt ? moment(a.createdAt).format("YYYY-MM-DD") : "";
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(a.createdAt);
  });
  return Object.entries(byDate)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dateKey, times]) => ({
      dateKey,
      dateLabel: moment(dateKey).format("MMM D, YYYY"),
      times: times.sort((a, b) => new Date(b) - new Date(a)),
    }));
}

export default function LoginAttempts({ account }) {
  const [byUser, setByUser] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [barsAnimated, setBarsAnimated] = useState(false);
  const [unlockingId, setUnlockingId] = useState(null);
  const [detailMenu, setDetailMenu] = useState(null);
  const reqIdRef = useRef(null);
  const detailReqIdRef = useRef(null);
  const pendingUnlockRef = useRef(null);
  const unlockingEmployeeIdRef = useRef(null);
  const notifyRef = useRef(null);
  const menuContainerRef = useRef(null);
  const notify = useNotification();
  notifyRef.current = notify;

  const canUnlock = Boolean(
    account?.role?.permissions && (account.role.permissions.includes("*") || account.role.permissions.includes("account.unlock"))
  );

  const fetchData = useCallback(() => {
    if (!window.api?.wsSend) return;
    setLoading(true);
    reqIdRef.current = rid();
    window.api.wsSend({
      type: "loginAttempts:list",
      requestId: reqIdRef.current,
      payload: { dateFrom: dateFrom || undefined, dateTo: dateTo || undefined },
    });
  }, [dateFrom, dateTo]);

  const fetchDetail = useCallback(
    (email, success, anchorEl) => {
      if (!window.api?.wsSend) return;
      const anchorRect = anchorEl?.getBoundingClientRect?.();
      setDetailMenu({ email, type: success ? "success" : "fail", attempts: [], loading: true, anchorRect });
      detailReqIdRef.current = rid();
      window.api.wsSend({
        type: "loginAttempts:detail",
        requestId: detailReqIdRef.current,
        payload: {
          email,
          success,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        },
      });
    },
    [dateFrom, dateTo]
  );

  useEffect(() => {
    if (!window.api?.onWsMessage) return;
    const unsub = window.api.onWsMessage((msg) => {
      if (msg?.type === "loginAttempts:list" && msg?.requestId === reqIdRef.current) {
        setLoading(false);
        setByUser(Array.isArray(msg.byUser) ? msg.byUser : []);
        setBarsAnimated(false);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setBarsAnimated(true));
        });
      }
      if (msg?.type === "loginAttempts:detail" && msg?.requestId === detailReqIdRef.current) {
        setDetailMenu((prev) =>
          prev ? { ...prev, attempts: Array.isArray(msg.attempts) ? msg.attempts : [], loading: false } : null
        );
      }
      if (msg?.type === "loginAttempts:changed") {
        fetchData();
      }
      if (msg?.type === "account:lockedState" && msg?.employeeId != null) {
        const employeeId = String(msg.employeeId);
        const lockedAt = msg.lockedAt ?? null;
        setByUser((prev) =>
          prev.map((u) =>
            String(u?.employeeId) === employeeId ? { ...u, lockedAt } : u
          )
        );
      }
      if (msg?.type === "account:unlock:result" && msg?.requestId === pendingUnlockRef.current) {
        const employeeId = unlockingEmployeeIdRef.current;
        pendingUnlockRef.current = null;
        unlockingEmployeeIdRef.current = null;
        setUnlockingId(null);
        if (msg?.ok) {
          if (notifyRef.current?.success) notifyRef.current.success("Account unlocked.", "Login Attempts");
          if (employeeId) {
            setByUser((prev) =>
              prev.map((u) =>
                String(u?.employeeId) === String(employeeId) ? { ...u, lockedAt: null } : u
              )
            );
          }
        } else {
          if (notifyRef.current?.error) notifyRef.current.error(msg?.error || "Failed to unlock", "Login Attempts");
        }
      }
    });
    return () => unsub?.();
  }, [fetchData]);

  useEffect(() => {
    const onMouseDown = (e) => {
      if (detailMenu && menuContainerRef.current && !menuContainerRef.current.contains(e.target)) {
        setDetailMenu(null);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") setDetailMenu(null);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [detailMenu]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const maxTotal = Math.max(
    1,
    ...byUser.map((u) => (u.successCount || 0) + (u.failCount || 0))
  );

  const totalSuccess = byUser.reduce((s, u) => s + (u.successCount || 0), 0);
  const totalFail = byUser.reduce((s, u) => s + (u.failCount || 0), 0);
  const totalAttempts = totalSuccess + totalFail;
  const successRate = totalAttempts > 0 ? Math.round((totalSuccess / totalAttempts) * 100) : 0;

  if (!account) return null;

  const detailGroups = detailMenu ? groupAttemptsByDate(detailMenu.attempts) : [];

  return (
    <div className="devicesPage la-page">
      <header className="la-header">
        <div className="la-header-icon">
          <LogIn size={24} strokeWidth={2} />
        </div>
        <div className="la-header-text">
          <h1 className="la-title">Login Attempts</h1>
          <p className="la-subtitle">Success and failed login attempts per user in the selected period</p>
          {canUnlock && (
            <p className="la-unlock-hint">Locked accounts can be unlocked here or from Employees → row actions.</p>
          )}
        </div>
      </header>

      <div className="la-content">
        <div className="la-toolbar">
          <DateRangePicker
            label="Date range"
            placeholder="From – To"
            value={{ from: dateFrom, to: dateTo }}
            onChange={({ from, to }) => {
              setDateFrom(from ?? "");
              setDateTo(to ?? "");
            }}
            className="la-date-range-picker"
          />
        </div>
        {loading ? (
          <div className="la-loading">
            <div className="la-loading-spinner" aria-hidden />
            <span className="la-loading-text">Loading login attempts…</span>
          </div>
        ) : byUser.length === 0 ? (
          <div className="la-empty">
            <img
              src={getAssetUrl("assets/svg/nodata-ill.svg")}
              alt=""
              className="la-empty-ill"
            />
            <p className="la-empty-title">No login attempts</p>
            <p className="la-empty-text">No login attempts found in the selected date range. Try adjusting the filters.</p>
          </div>
        ) : (
          <div className="la-card">
            <div className="la-summary">
              <div className="la-summary-item">
                <span>Users</span>
                <strong>{byUser.length}</strong>
              </div>
              <div className="la-summary-item">
                <span className="la-summary-dot success" aria-hidden />
                <span>Success</span>
                <strong>{totalSuccess}</strong>
              </div>
              <div className="la-summary-item">
                <span className="la-summary-dot fail" aria-hidden />
                <span>Failed</span>
                <strong>{totalFail}</strong>
              </div>
              <div className="la-summary-item">
                <span>Success rate</span>
                <strong>{successRate}%</strong>
              </div>
            </div>

            <div className="la-legend">
              <div className="la-legend-item">
                <span className="la-legend-swatch success" aria-hidden />
                Successful logins — click segment to see times
              </div>
              <div className="la-legend-item">
                <span className="la-legend-swatch fail" aria-hidden />
                Failed logins — click segment to see times
              </div>
            </div>

            <div className="la-list">
              {byUser.map((u) => {
                const success = u.successCount || 0;
                const fail = u.failCount || 0;
                const successPct = maxTotal > 0 ? (success / maxTotal) * 100 : 0;
                const failPct = maxTotal > 0 ? (fail / maxTotal) * 100 : 0;
                const isLocked = Boolean(u.lockedAt);
                const canUnlockThis = canUnlock && u.employeeId && isLocked;
                const unlocking = unlockingId === u.employeeId;
                const isDetailSuccess = detailMenu?.email === u.email && detailMenu?.type === "success";
                const isDetailFail = detailMenu?.email === u.email && detailMenu?.type === "fail";
                return (
                  <div key={u.email} className="la-row">
                    <Tooltip content={u.email} placement="top">
                      <div className="la-row-email">
                        {u.email}
                        {isLocked && (
                          <Tippy content="Account locked" {...tippyOpts}>
                            <span className="la-row-locked">
                              <Lock size={14} />
                              Locked
                            </span>
                          </Tippy>
                        )}
                      </div>
                    </Tooltip>
                    <div className={`la-row-bar-wrap ${barsAnimated ? "" : "la-row-bar-wrap--waiting"}`}>
                      <Tippy content={success ? `${success} successful — click to see times` : "No successful logins"} {...tippyOpts}>
                        <motion.div
                          role="button"
                          tabIndex={success > 0 ? 0 : -1}
                          className={`la-row-piece la-row-piece--success la-row-bar--animate ${isDetailSuccess ? "la-row-piece--selected" : ""}`}
                          style={{ width: barsAnimated ? `${successPct}%` : "0%" }}
                          onClick={(ev) => success > 0 && fetchDetail(u.email, true, ev.currentTarget)}
                          onKeyDown={(e) => e.key === "Enter" && success > 0 && fetchDetail(u.email, true, e.currentTarget)}
                        />
                      </Tippy>
                      <Tippy content={fail ? `${fail} failed — click to see times` : "No failed logins"} {...tippyOpts}>
                        <motion.div
                          role="button"
                          tabIndex={fail > 0 ? 0 : -1}
                          className={`la-row-piece la-row-piece--fail la-row-bar--animate ${isDetailFail ? "la-row-piece--selected" : ""}`}
                          style={{ width: barsAnimated ? `${failPct}%` : "0%" }}
                          onClick={(ev) => fail > 0 && fetchDetail(u.email, false, ev.currentTarget)}
                          onKeyDown={(e) => e.key === "Enter" && fail > 0 && fetchDetail(u.email, false, e.currentTarget)}
                        />
                      </Tippy>
                    </div>
                    <div className="la-row-counts">
                      <Tippy content="Successful logins" {...tippyOpts}>
                        <span className="la-row-count success">
                          <CheckCircle size={14} />
                          {success}
                        </span>
                      </Tippy>
                      <Tippy content="Failed logins" {...tippyOpts}>
                        <span className="la-row-count fail">
                          <XCircle size={14} />
                          {fail}
                        </span>
                      </Tippy>
                      {canUnlockThis && (
                        <Tippy content="Unlock this account" {...tippyOpts}>
                          <button
                            type="button"
                            className="la-row-unlock"
                            onClick={() => {
                              if (!u.employeeId || unlocking) return;
                              setUnlockingId(u.employeeId);
                              pendingUnlockRef.current = rid();
                              unlockingEmployeeIdRef.current = u.employeeId;
                              window.api?.wsSend?.({
                                type: "account:unlock",
                                requestId: pendingUnlockRef.current,
                                payload: { employeeId: u.employeeId },
                              });
                            }}
                            disabled={unlocking}
                          >
                            <Unlock size={14} />
                            {unlocking ? "Unlocking…" : "Unlock"}
                          </button>
                        </Tippy>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {createPortal(
        <AnimatePresence>
          {detailMenu && (
            <>
              <motion.div
                key="la-detail-backdrop"
                className="la-detail-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                onMouseDown={() => setDetailMenu(null)}
                aria-hidden
              />
              <motion.div
                key={`${detailMenu.email}-${detailMenu.type}`}
                ref={menuContainerRef}
                className="la-detail-menu"
                initial={{ opacity: 0, scale: 0.96, y: -6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: -6 }}
                transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                style={{
                  position: "fixed",
                  left: detailMenu?.anchorRect ? Math.max(8, Math.min(detailMenu.anchorRect.left, typeof window !== "undefined" ? window.innerWidth - 320 - 8 : detailMenu.anchorRect.left)) : "50%",
                  top: detailMenu?.anchorRect ? detailMenu.anchorRect.bottom + 8 : "50%",
                  transform: detailMenu?.anchorRect ? "none" : "translate(-50%, -50%)",
                }}
              >
              <div className={`la-detail-menu__header la-detail-menu__header--${detailMenu?.type || "success"}`}>
                {detailMenu?.type === "success" ? (
                  <>Successful logins — {detailMenu?.email}</>
                ) : (
                  <>Failed logins — {detailMenu?.email}</>
                )}
              </div>
              <div className="la-detail-menu__body">
                {detailMenu?.loading ? (
                  <div className="la-detail-menu__loading">
                    <Loader2 size={20} className="la-detail-menu__spinner" />
                    <span>Loading…</span>
                  </div>
                ) : detailGroups.length === 0 ? (
                  <div className="la-detail-menu__empty">No attempts in this period</div>
                ) : (
                  <div className="la-detail-menu__groups">
                    {detailGroups.map((group, gi) => (
                      <motion.div
                        key={group.dateKey}
                        className={`la-detail-menu__group la-detail-menu__group--${detailMenu?.type || "success"}`}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: gi * 0.06, duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                      >
                        <div className="la-detail-menu__date-wrap">
                          <span className="la-detail-menu__date-dot" aria-hidden />
                          <div className="la-detail-menu__date">{group.dateLabel}</div>
                        </div>
                        <ul className="la-detail-menu__times">
                          {group.times.map((t, ti) => (
                            <motion.li
                              key={t}
                              className="la-detail-menu__time"
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: gi * 0.06 + (ti + 1) * 0.04, duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                            >
                              <span className="la-detail-menu__time-value">{moment(t).format("h:mm A")}</span>
                            </motion.li>
                          ))}
                        </ul>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

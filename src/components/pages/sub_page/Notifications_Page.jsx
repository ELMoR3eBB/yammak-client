// Notifications_Page.jsx — list all notifications for the current user with date filter
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Cake, Calendar, Info, Check, Mail, Zap, FileText, MessageSquare, ShieldAlert, Wallet } from "lucide-react";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";
import "tippy.js/animations/shift-away.css";
import DateRangePicker from "../../ui/DateRangePicker";
import Skeleton from "../../ui/Skeleton";
import "../../../styles/ui/date_range_picker.css";
import "../../../styles/ui/skeleton.css";
import "../../../styles/pages/notifications/notifications.css";

const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function formatDate(d) {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "medium",
  });
}

function relativeTime(d) {
  if (!d) return "";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hr ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
  return formatDate(d);
}

const TYPE_CONFIG = {
  birthday: { label: "Birthday", icon: Cake, color: "#f59e0b", bg: "rgba(245, 158, 11, 0.14)" },
  holiday_request: { label: "Holiday request", icon: Calendar, color: "#3b82f6", bg: "rgba(59, 130, 246, 0.14)" },
  holiday_decision: { label: "Holiday decision", icon: Mail, color: "#14b8a6", bg: "rgba(20, 184, 166, 0.14)" },
  hot: { label: "Hot notification", icon: Zap, color: "#eab308", bg: "rgba(234, 179, 8, 0.14)" },
  report_new: { label: "New report", icon: FileText, color: "#06b6d4", bg: "rgba(6, 182, 212, 0.14)" },
  report_sent: { label: "Report submitted", icon: FileText, color: "#10b981", bg: "rgba(16, 185, 129, 0.14)" },
  suggest_sent: { label: "Suggestion submitted", icon: MessageSquare, color: "#8b5cf6", bg: "rgba(139, 92, 246, 0.14)" },
  suggest_received: { label: "New suggestion", icon: MessageSquare, color: "#a855f7", bg: "rgba(168, 85, 247, 0.14)" },
  permission_lost: { label: "Redirected (permission change)", icon: ShieldAlert, color: "#f97316", bg: "rgba(249, 115, 22, 0.14)" },
  cashout_created: { label: "Cashout Created", icon: Wallet, color: "#0ea5e9", bg: "rgba(14, 165, 233, 0.14)" },
  cashout_cashed: { label: "Cashout Cashed", icon: Wallet, color: "#22c55e", bg: "rgba(34, 197, 94, 0.14)" },
  cashout_request_submitted: { label: "Cashout Request Submitted", icon: Wallet, color: "#6366f1", bg: "rgba(99, 102, 241, 0.14)" },
  cashout_new_request: { label: "New Cashout Request", icon: Wallet, color: "#f59e0b", bg: "rgba(245, 158, 11, 0.14)" },
  cashout_approved_pending: { label: "Cashout Approved – Pending to Cash", icon: Wallet, color: "#14b8a6", bg: "rgba(20, 184, 166, 0.14)" },
  cashout_rejected: { label: "Cashout Rejected", icon: Wallet, color: "#ef4444", bg: "rgba(239, 68, 68, 0.14)" },
  cashout_action_done: { label: "Action Completed", icon: Wallet, color: "#84cc16", bg: "rgba(132, 204, 22, 0.14)" },
  cashout_request_approved: { label: "Request Approved", icon: Wallet, color: "#2dd4bf", bg: "rgba(45, 212, 191, 0.14)" },
  cashout_request_denied: { label: "Request Denied", icon: Wallet, color: "#f43f5e", bg: "rgba(244, 63, 94, 0.14)" },
  cashout_cash_done: { label: "Cashout Recorded", icon: Wallet, color: "#22c55e", bg: "rgba(34, 197, 94, 0.14)" },
  cashout_reject_done: { label: "Rejection Completed", icon: Wallet, color: "#fb923c", bg: "rgba(251, 146, 60, 0.14)" },
  cashin_created: { label: "Cash in recorded", icon: Wallet, color: "#059669", bg: "rgba(5, 150, 105, 0.14)" },
  info: { label: "Info", icon: Info, color: "var(--st-text-muted)", bg: "rgba(255, 255, 255, 0.06)" },
};

export default function NotificationsPage({ account, onUnreadChange, onOpen }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const requestIdRef = useRef(null);
  const prevDateRef = useRef(null);

  function fetchList() {
    if (!window.api?.wsSend) return;
    setLoading(true);
    requestIdRef.current = rid();
    window.api.wsSend({
      type: "notification:list",
      requestId: requestIdRef.current,
      payload: {
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      },
    });
  }

  useEffect(() => {
    if (!window.api) {
      setLoading(false);
      return;
    }

    const unsub = window.api.onWsMessage((msg) => {
      if (msg?.type === "notification:list" && msg?.requestId === requestIdRef.current) {
        setNotifications(Array.isArray(msg.notifications) ? msg.notifications : []);
        setLoading(false);
      }
      if (msg?.type === "notification:new" && msg?.notification) {
        setNotifications((prev) => [msg.notification, ...prev]);
        onUnreadChange?.();
      }
      /* no refetch on read — we already optimistically update local state */
    });

    (async () => {
      try {
        await window.api.wsConnect();
        fetchList();
      } catch {
        setLoading(false);
      }
    })();

    return () => unsub?.();
  }, []);

  useEffect(() => {
    onOpen?.();
  }, [onOpen]);

  useEffect(() => {
    const current = [dateFrom, dateTo];
    if (prevDateRef.current === null) {
      prevDateRef.current = current;
      return;
    }
    if (prevDateRef.current[0] === current[0] && prevDateRef.current[1] === current[1]) return;
    prevDateRef.current = current;
    const tid = setTimeout(fetchList, 300);
    return () => clearTimeout(tid);
  }, [dateFrom, dateTo]);

  function markRead(id) {
    if (!window.api?.wsSend) return;
    /* Optimistic update: no refetch, no flash */
    setNotifications((prev) =>
      prev.map((n) =>
        id ? (n._id === id ? { ...n, read: true } : n) : { ...n, read: true }
      )
    );
    window.api.wsSend({
      type: "notification:mark-read",
      requestId: rid(),
      payload: id ? { notificationId: id } : {},
    });
    onUnreadChange?.();
  }

  const stats = useMemo(() => {
    const total = notifications.length;
    const unread = notifications.filter((n) => !n.read).length;
    return { total, unread };
  }, [notifications]);

  if (!account) return null;

  return (
    <div className="notificationsPage">
      <header className="notificationsHeader">
        <div className="notificationsHeaderIcon">
          <Bell size={24} />
        </div>
        <div className="notificationsHeaderText">
          <h1 className="notificationsTitle">Notifications</h1>
          <p className="notificationsSubtitle">All notifications sent to you — filter by date below</p>
        </div>
      </header>

      <main className="notificationsMain">
        <div className="notificationsToolbar">
          <div className="notificationsToolbarLeft">
            <DateRangePicker
              label="Date range"
              placeholder="From – To"
              value={{ from: dateFrom, to: dateTo }}
              onChange={({ from, to }) => {
                setDateFrom(from ?? "");
                setDateTo(to ?? "");
              }}
              className="notificationsDateRangePicker"
            />
            {!loading && notifications.length > 0 && (
              <div className="notificationsStats">
                <span className="notificationsStat">
                  <strong>{stats.total}</strong> total
                </span>
                {stats.unread > 0 && (
                  <span className="notificationsStat notificationsStat--unread">
                    <strong>{stats.unread}</strong> unread
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            className="notificationsMarkAll"
            onClick={() => markRead()}
            disabled={notifications.length === 0 || notifications.every((n) => n.read)}
          >
            <Check size={16} />
            Mark all as read
          </button>
        </div>

        <section className="notificationsListSection">
          {loading ? (
            <ul className="notificationsList">
              {[1, 2, 3, 4, 5].map((i) => (
                <li key={i} className="notificationsItem notificationsItem--skeleton">
                  <Skeleton className="notificationsSkeletonIcon" style={{ width: 48, height: 48 }} />
                  <div className="notificationsItemContent notificationsSkeletonContent">
                    <div className="notificationsItemHead">
                      <Skeleton className="notificationsSkeletonBadge" style={{ width: 120, height: 18 }} />
                      <Skeleton className="notificationsSkeletonDate" style={{ width: 90, height: 14 }} />
                    </div>
                    <Skeleton className="notificationsSkeletonTitle" style={{ width: "70%", height: 20 }} />
                    <Skeleton className="notificationsSkeletonMessage" style={{ width: "85%", height: 16 }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : notifications.length === 0 ? (
            <div className="notificationsEmpty">
              <div className="notificationsEmptyIconWrap">
                <Bell size={48} className="notificationsEmptyIcon" />
              </div>
              <p className="notificationsEmptyText">No notifications yet</p>
              <p className="notificationsEmptySub">Notifications will appear here when you receive birthday reminders, holiday requests, and other updates. Try adjusting the date range.</p>
            </div>
          ) : (
            <ul className="notificationsList">
              {notifications.map((n) => {
                const config = TYPE_CONFIG[n.type] || TYPE_CONFIG.info;
                const Icon = config.icon;
                return (
                  <li
                    key={n._id}
                    className={`notificationsItem ${n.read ? "notificationsItem--read" : ""}`}
                  >
                    <div
                      className="notificationsItemIconWrap"
                      style={{ color: config.color, background: config.bg }}
                      aria-hidden
                    >
                      <Icon size={22} />
                    </div>
                    <div className="notificationsItemContent">
                      <div className="notificationsItemHead">
                        <span className="notificationsItemType" style={{ color: config.color }}>
                          {config.label}
                        </span>
                        <span className="notificationsItemDate">{formatDate(n.createdAt)}</span>
                        <span className="notificationsItemRelative">{relativeTime(n.createdAt)}</span>
                      </div>
                      <h3 className="notificationsItemTitle">{n.title || "—"}</h3>
                      {n.message && (
                        <p className="notificationsItemMessage">{n.message}</p>
                      )}
                    </div>
                    <div className="notificationsItemActions">
                      {!n.read && (
                        <Tippy content="Mark as read" animation="shift-away" placement="top" delay={[200, 0]}>
                          <button
                            type="button"
                            className="notificationsItemAction"
                            onClick={() => markRead(n._id)}
                          >
                            <Check size={16} />
                            <span>Mark read</span>
                          </button>
                        </Tippy>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

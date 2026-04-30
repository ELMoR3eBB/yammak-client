// Notifications_Page.jsx — list all notifications for the current user with date filter
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Cake, Calendar, Info, Check, Mail, Zap, FileText, MessageSquare, ShieldAlert, Wallet } from "lucide-react";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";
import "tippy.js/animations/shift-away.css";
import DateRangePicker from "../../components/ui/DateRangePicker";
import Skeleton from "../../components/ui/Skeleton";
import { useLanguage } from "../../contexts/LanguageContext";
import "../../styles/ui/date_range_picker.css";
import "../../styles/ui/skeleton.css";
import "../../styles/pages/notifications/notifications.css";

import NotificationItem from "./Components/NotificationItem";

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
  const now = Date.now();
  const diffMs = now - date.getTime();
  const absMs = Math.abs(diffMs);

  if (absMs < 60 * 1000) return "Just now";

  const units = [
    { key: "year", ms: 365 * 24 * 60 * 60 * 1000 },
    { key: "month", ms: 30 * 24 * 60 * 60 * 1000 },
    { key: "week", ms: 7 * 24 * 60 * 60 * 1000 },
    { key: "day", ms: 24 * 60 * 60 * 1000 },
    { key: "hour", ms: 60 * 60 * 1000 },
    { key: "minute", ms: 60 * 1000 },
  ];

  const picked = units.find((u) => absMs >= u.ms) || units[units.length - 1];
  const value = Math.max(1, Math.floor(absMs / picked.ms));
  const plural = value === 1 ? "" : "s";
  return diffMs >= 0
    ? `${value} ${picked.key}${plural} ago`
    : `in ${value} ${picked.key}${plural}`;
}

export default function NotificationsPage({ account, onUnreadChange, onOpen }) {
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const requestIdRef = useRef(null);
  const prevDateRef = useRef(null);
  const [, setClockTick] = useState(0);

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

  // Keep relative timestamps fresh (e.g. "59 min ago" -> "1 hour ago").
  useEffect(() => {
    const timer = setInterval(() => setClockTick((v) => v + 1), 60_000);
    return () => clearInterval(timer);
  }, []);

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
          <h1 className="notificationsTitle">{t("notifications.title")}</h1>
          <p className="notificationsSubtitle">{t("notifications.subtitle")}</p>
        </div>
      </header>

      <main className="notificationsMain">
        <div className="notificationsToolbar">
          <div className="notificationsToolbarLeft">
            <DateRangePicker
              label={t("notifications.dateRange")}
              placeholder={t("notifications.dateRangePlaceholder")}
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
                  <strong>{stats.total}</strong> {t("notifications.total")}
                </span>
                {stats.unread > 0 && (
                  <span className="notificationsStat notificationsStat--unread">
                    <strong>{stats.unread}</strong> {t("notifications.unread")}
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
            {t("notifications.markAllAsRead")}
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
              <p className="notificationsEmptyText">{t("notifications.emptyTitle")}</p>
              <p className="notificationsEmptySub">{t("notifications.emptySubtitle")}</p>
            </div>
          ) : (
            <ul className="notificationsList">
              {notifications.map((n) => (
                <NotificationItem
                  key={n._id}
                  notification={n}
                  onMarkRead={markRead}
                />
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

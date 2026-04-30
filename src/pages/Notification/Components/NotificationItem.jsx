import React from "react";
import { Check } from "lucide-react";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";
import "tippy.js/animations/shift-away.css";
import { useLanguage } from "../../../contexts/LanguageContext";

import {
  Cake,
  Calendar,
  Info,
  Mail,
  Zap,
  FileText,
  MessageSquare,
  ShieldAlert,
  Wallet,
} from "lucide-react";

const TYPE_CONFIG = {
  birthday: { labelKey: "notifications.type.birthday", icon: Cake, color: "#f59e0b", bg: "rgba(245, 158, 11, 0.14)" },
  holiday_request: { labelKey: "notifications.type.holidayRequest", icon: Calendar, color: "#3b82f6", bg: "rgba(59, 130, 246, 0.14)" },
  holiday_decision: { labelKey: "notifications.type.holidayDecision", icon: Mail, color: "#14b8a6", bg: "rgba(20, 184, 166, 0.14)" },
  hot: { labelKey: "notifications.type.hot", icon: Zap, color: "#eab308", bg: "rgba(234, 179, 8, 0.14)" },
  report_new: { labelKey: "notifications.type.reportNew", icon: FileText, color: "#06b6d4", bg: "rgba(6, 182, 212, 0.14)" },
  report_sent: { labelKey: "notifications.type.reportSent", icon: FileText, color: "#10b981", bg: "rgba(16, 185, 129, 0.14)" },
  suggest_sent: { labelKey: "notifications.type.suggestSent", icon: MessageSquare, color: "#8b5cf6", bg: "rgba(139, 92, 246, 0.14)" },
  suggest_received: { labelKey: "notifications.type.suggestReceived", icon: MessageSquare, color: "#a855f7", bg: "rgba(168, 85, 247, 0.14)" },
  permission_lost: { labelKey: "notifications.type.permissionLost", icon: ShieldAlert, color: "#f97316", bg: "rgba(249, 115, 22, 0.14)" },
  cashout_created: { labelKey: "notifications.type.cashoutCreated", icon: Wallet, color: "#0ea5e9", bg: "rgba(14, 165, 233, 0.14)" },
  cashout_cashed: { labelKey: "notifications.type.cashoutCashed", icon: Wallet, color: "#22c55e", bg: "rgba(34, 197, 94, 0.14)" },
  cashin_created: { labelKey: "notifications.type.cashinCreated", icon: Wallet, color: "#059669", bg: "rgba(5, 150, 105, 0.14)" },
  info: { labelKey: "notifications.type.info", icon: Info, color: "var(--st-text-muted)", bg: "rgba(255, 255, 255, 0.06)" },
};

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

  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);

  if (mins < 1) return "notifications.relative.justNow";
  if (mins < 60) return `notifications.relative.minutesAgo|${mins}`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `notifications.relative.hoursAgo|${hours}`;

  const days = Math.floor(hours / 24);
  return `notifications.relative.daysAgo|${days}`;
}

export default function NotificationItem({ notification, onMarkRead }) {
  const { t } = useLanguage();
  const config = TYPE_CONFIG[notification.type] || TYPE_CONFIG.info;
  const Icon = config.icon;
  const relative = relativeTime(notification.createdAt);
  const relativeLabel = relative.includes("|")
    ? t(relative.split("|")[0]).replace("{{count}}", relative.split("|")[1])
    : t(relative);

  return (
    <li className={`notificationsItem ${notification.read ? "notificationsItem--read" : ""}`}>
      <div
        className="notificationsItemIconWrap"
        style={{ color: config.color, background: config.bg }}
      >
        <Icon size={22} />
      </div>

      <div className="notificationsItemContent">
        <div className="notificationsItemHead">
          <span className="notificationsItemType" style={{ color: config.color }}>
            {t(config.labelKey)}
          </span>
          <span className="notificationsItemDate">{formatDate(notification.createdAt)}</span>
          <span className="notificationsItemRelative">{relativeLabel}</span>
        </div>

        <h3 className="notificationsItemTitle">{notification.title || "—"}</h3>

        {notification.message && (
          <p className="notificationsItemMessage">{notification.message}</p>
        )}
      </div>

      <div className="notificationsItemActions">
        {!notification.read && (
          <Tippy content={t("notifications.markAsRead")} animation="shift-away" placement="top" delay={[200, 0]}>
            <button
              type="button"
              className="notificationsItemAction"
              onClick={() => onMarkRead(notification._id)}
            >
              <Check size={16} />
              <span>{t("notifications.markRead")}</span>
            </button>
          </Tippy>
        )}
      </div>
    </li>
  );
}
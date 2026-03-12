// Dashboard.jsx — overview using getStats + employees + roles from backend, same design system
import React, { useEffect, useMemo, useRef, useState } from "react";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";
import "tippy.js/animations/shift-away.css";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import {
  LayoutDashboard,
  Users,
  Shield,
  Key,
  ChevronRight,
  ChevronLeft,
  User,
  Briefcase,
  Star,
  Building2,
  Cake,
  Zap,
  Calendar,
  MessageSquare,
  FileText,
  Truck,
  Bell,
  Wallet,
} from "lucide-react";
import { useNotification } from "../../NotificationProvider";
import { useAnimatedNumber } from "../../../hooks/useAnimatedNumber";
import { getAssetUrl } from "../../../utils/publicUrl";
import { useLanguage } from "../../../contexts/LanguageContext";
import "../../../styles/pages/dashboard/dashboard.css";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function useIsInView(options = {}) {
  const { threshold = 0, rootMargin = "0px", triggerOnce = true } = options;
  const [isInView, setIsInView] = useState(false);
  const ref = useRef(null);
  const triggeredRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        if (triggerOnce && triggeredRef.current) return;
        triggeredRef.current = true;
        setIsInView(true);
      },
      { threshold, rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin, triggerOnce]);

  return [ref, isInView];
}

function SectionWithScrollAnimation({ children, className = "", as: Tag = "section", onVisible }) {
  const [ref, inView] = useIsInView({ threshold: 0, rootMargin: "48px 0px", triggerOnce: true });
  const onVisibleRef = useRef(onVisible);
  onVisibleRef.current = onVisible;
  useEffect(() => {
    if (inView && onVisibleRef.current) onVisibleRef.current();
  }, [inView]);
  return (
    <Tag
      ref={ref}
      className={`dashboardSection dashboardSection--scroll ${inView ? "dashboardSection--inView" : ""} ${className}`.trim()}
    >
      {children}
    </Tag>
  );
}

function AnimatedDriverBadge({ value, driverKey, mode }) {
  const [ref, isInView] = useIsInView({ threshold: 0, rootMargin: "50px", triggerOnce: true });
  const display = useAnimatedNumber(isInView ? value : 0, `${driverKey}-${mode}`, 700);
  return (
    <span ref={ref} className="dashboardTopDriversBadge">
      {display.toLocaleString()}
    </span>
  );
}

function AnimatedStoreBadge({ value, storeKey, mode }) {
  const [ref, isInView] = useIsInView({ threshold: 0, rootMargin: "50px", triggerOnce: true });
  const display = useAnimatedNumber(isInView ? value : 0, `store-${storeKey}-${mode}`, 700);
  return (
    <span ref={ref} className="dashboardTopDriversBadge">
      {display.toLocaleString()}
    </span>
  );
}

function activityTime(d, t) {
  if (!d) return "";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return t ? t("dashboard.timeJustNow") : "Just now";
  if (diffMins < 60) return t ? t("dashboard.timeMinutesAgo").replace("{{n}}", String(diffMins)) : `${diffMins}m ago`;
  if (diffHours < 24) return t ? t("dashboard.timeHoursAgo").replace("{{n}}", String(diffHours)) : `${diffHours}h ago`;
  if (diffDays < 7) return t ? t("dashboard.timeDaysAgo").replace("{{n}}", String(diffDays)) : `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function Dashboard({
  account,
  onNavigate,
  onCurrentUserEmployee,
  allUserViews = {},
  onOpenDriverContextMenu,
}) {
  const notify = useNotification();
  const { t } = useLanguage();
  const tippyViewUser = useMemo(
    () => ({ content: t("dashboard.clickToViewUser"), animation: "shift-away", placement: "top", delay: [150, 0] }),
    [t]
  );
  const [stats, setStats] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [roles, setRoles] = useState([]);
  const [birthdaysToday, setBirthdaysToday] = useState([]);
  const [onlineUserIds, setOnlineUserIds] = useState(new Set());
  const [notifications, setNotifications] = useState([]);
  const [hotItems, setHotItems] = useState([]);
  const [pendingHolidayCount, setPendingHolidayCount] = useState(0);
  const [pendingSuggestCount, setPendingSuggestCount] = useState(0);
  const [todaySummary, setTodaySummary] = useState(null);
  const [hotCarouselIndex, setHotCarouselIndex] = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingLists, setLoadingLists] = useState(true);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [contentReady, setContentReady] = useState(false);
  const [dailyRevenuePoints, setDailyRevenuePoints] = useState([]);
  const [revenueDays, setRevenueDays] = useState(30); // 7 | 30 | 90
  const [driverStats, setDriverStats] = useState(null);
  const [topDriversMode, setTopDriversMode] = useState("earnings"); // "earnings" | "orders"
  const [loadingTopDrivers, setLoadingTopDrivers] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [kpiSummary, setKpiSummary] = useState(null);
  const [storeRanking, setStoreRanking] = useState([]);
  const [storeRankingSort, setStoreRankingSort] = useState("totalEarning"); // "totalEarning" | "balance"
  const [loadingStoreRanking, setLoadingStoreRanking] = useState(false);
  const pending = useRef(new Map());
  const dailyRevenueReqIdRef = useRef(null);
  const revenueDaysRef = useRef(30);
  const prevRevenueDaysRef = useRef(30);
  const driversStatsReqIdRef = useRef(null);
  const dashboardSummaryReqIdRef = useRef(null);
  const storeRankingReqIdRef = useRef(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setContentReady(true));
    });
    return () => cancelAnimationFrame(id);
  }, []);
  const requestIdRef = useRef(rid());
  const employeesReq = useRef(false);
  const rolesReq = useRef(false);
  const employeesReceived = useRef(false);
  const rolesReceived = useRef(false);
  const pendingHolidayReqIdRef = useRef(rid());
  const pendingSuggestReqIdRef = useRef(rid());
  const perms = account?.role?.permissions || [];
  const canSeeEmployees = perms.includes("*") || perms.includes("users.view");
  const canSeeRoles = perms.includes("*") || perms.includes("roles.view");
  const canSeePresence = perms.includes("*") || perms.includes("presence.notify") || perms.includes("presence.view");
  const canSendHot = perms.includes("*") || perms.includes("hot.send");
  const canRequestHoliday = perms.includes("*") || perms.includes("holiday.request");
  const canViewReports = perms.includes("*") || perms.includes("reports.view");
  const canViewDrivers = perms.includes("*") || perms.includes("drivers.view");
  const canManageHoliday = perms.includes("*") || perms.includes("holiday.manage");
  const canViewSuggests = perms.includes("*") || perms.includes("suggests.view");
  const canSeeFinance =
    perms.includes("*") ||
    perms.includes("cashout.viewAll") ||
    perms.includes("cashout.manage") ||
    perms.includes("cashin.create");
  const canViewStores = perms.includes("*") || perms.includes("stores.view");
  const canViewPendingCashout = perms.includes("*") || perms.includes("cashout.viewPending");
  const canViewTransactions =
    perms.includes("*") ||
    perms.includes("transactions.view") ||
    perms.includes("cashout.viewAll") ||
    perms.includes("cashout.manage");
  const myId = String(account?.id ?? account?._id ?? "");

  const totalEmployees = useMemo(() => {
    if (typeof stats?.totalEmployees === "number") return stats.totalEmployees;
    if (Array.isArray(employees)) return employees.length;
    return 0;
  }, [stats?.totalEmployees, employees]);

  const totalRoles = useMemo(() => {
    if (typeof stats?.totalRoles === "number") return stats.totalRoles;
    if (Array.isArray(roles)) return roles.length;
    return 0;
  }, [stats?.totalRoles, roles]);

  const permCount = useMemo(
    () => (Array.isArray(perms) ? perms.filter(Boolean).length : 0),
    [perms]
  );

  const recentEmployees = useMemo(() => {
    const list = Array.isArray(employees) ? employees : [];
    return [...list]
      .sort((a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0))
      .slice(0, 5);
  }, [employees]);

  const recentRoles = useMemo(() => {
    const list = Array.isArray(roles) ? roles : [];
    return [...list]
      .sort((a, b) => (Number(b?.priority) || 0) - (Number(a?.priority) || 0))
      .slice(0, 5);
  }, [roles]);

  const userName = account?.name || account?.email || account?.user?.name || "User";
  const roleName = account?.role?.name || "—";
  const currentUserEmployee = useMemo(() => {
    if (!myId || !Array.isArray(employees)) return null;
    return employees.find((e) => String(e?._id) === myId) ?? null;
  }, [employees, myId]);

  const currentUserRating = useMemo(() => {
    const me = currentUserEmployee;
    return me?.rating != null && Number(me.rating) >= 0.5 ? Number(me.rating) : null;
  }, [currentUserEmployee]);

  const currentUserPhotoUrl = useMemo(() => {
    const me = currentUserEmployee;
    const url = me?.uploads?.employeePhotoUrl ?? me?.uploads?.employeePhoto ?? null;
    return url && typeof url === "string" ? url : null;
  }, [currentUserEmployee]);

  const presenceSortedEmployees = useMemo(() => {
    const list = Array.isArray(employees) ? employees : [];
    return [...list].sort((a, b) => {
      const aId = String(a?._id ?? "");
      const bId = String(b?._id ?? "");
      const aFirst = aId === myId ? 1 : onlineUserIds.has(aId) ? 2 : 3;
      const bFirst = bId === myId ? 1 : onlineUserIds.has(bId) ? 2 : 3;
      if (aFirst !== bFirst) return aFirst - bFirst;
      return (a?.name ?? "").localeCompare(b?.name ?? "");
    });
  }, [employees, onlineUserIds, myId]);

  const departmentsCount = useMemo(() => {
    const list = Array.isArray(employees) ? employees : [];
    const map = new Map();
    list.forEach((e) => {
      const d = e?.department?.trim() || "—";
      map.set(d, (map.get(d) || 0) + 1);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [employees]);

  const topRatedEmployees = useMemo(() => {
    const list = Array.isArray(employees) ? employees : [];
    return [...list]
      .filter((e) => e?.rating != null && Number(e.rating) >= 4)
      .sort((a, b) => (Number(b?.rating) || 0) - (Number(a?.rating) || 0))
      .slice(0, 5);
  }, [employees]);

  const hotOnly = useMemo(() => (hotItems || []).map((h) => ({ id: h.id, kind: "hot", ...h })), [hotItems]);
  useEffect(() => {
    setHotCarouselIndex(0);
  }, [hotOnly.length]);
  const activityItems = useMemo(() => {
    const notif = (notifications || []).map((n) => ({ id: n._id, kind: "notification", ...n }));
    const hot = hotOnly;
    const combined = hot.length === 1 ? [...hot, ...notif] : notif;
    combined.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return combined.slice(0, 5);
  }, [notifications, hotOnly]);

  // getStats from backend (merge so companyBalance is never lost)
  useEffect(() => {
    if (!window.api?.getStats) {
      setLoadingStats(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await window.api.getStats();
        if (!cancelled && data && typeof data === "object" && !data.error) {
          setStats((prev) => {
            const next = { ...prev, ...data };
            if (typeof data.companyBalance === "number") next.companyBalance = data.companyBalance;
            return next;
          });
          setLastSyncAt(Date.now());
        }
      } catch {
        if (!cancelled) setStats((prev) => prev ?? null);
      } finally {
        if (!cancelled) setLoadingStats(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // WebSocket: employees + roles list for live data
  useEffect(() => {
    if (!window.api) {
      setLoadingLists(false);
      setLoadingActivity(false);
      return;
    }

    const unsub = window.api.onWsMessage((msg) => {
      if (msg?.type === "stats:result" && msg?.requestId) {
        setStats((prev) => ({
          ...prev,
          totalEmployees: typeof msg.totalEmployees === "number" ? msg.totalEmployees : prev?.totalEmployees,
          totalRoles: typeof msg.totalRoles === "number" ? msg.totalRoles : prev?.totalRoles,
          companyBalance: typeof msg.companyBalance === "number" ? msg.companyBalance : prev?.companyBalance,
        }));
        setLoadingStats(false);
        setLastSyncAt(Date.now());
      }
      if (msg?.type === "finance:balance" && typeof msg.companyBalance === "number") {
        setStats((prev) => ({ ...prev, companyBalance: msg.companyBalance }));
        if (canSeeFinance && window.api?.wsSend) {
          dailyRevenueReqIdRef.current = rid();
          window.api.wsSend({
            type: "finance:dailyRevenue",
            requestId: dailyRevenueReqIdRef.current,
            payload: { days: revenueDaysRef.current },
          });
        }
      }
      if (msg?.type === "cashin:create:result" && msg?.ok && typeof msg.companyBalance === "number") {
        setStats((prev) => ({ ...prev, companyBalance: msg.companyBalance }));
        if (canSeeFinance && window.api?.wsSend) {
          dailyRevenueReqIdRef.current = rid();
          window.api.wsSend({
            type: "finance:dailyRevenue",
            requestId: dailyRevenueReqIdRef.current,
            payload: { days: revenueDaysRef.current },
          });
        }
      }
      if (msg?.type === "finance:dailyRevenue" && msg?.requestId === dailyRevenueReqIdRef.current && Array.isArray(msg.dailyPoints)) {
        setDailyRevenuePoints(msg.dailyPoints);
      }
      if (msg?.type === "employees:list" && Array.isArray(msg.employees)) {
        setEmployees(msg.employees);
        employeesReceived.current = true;
        setLastSyncAt(Date.now());
        if (employeesReq.current)
          setLoadingLists(
            (l) => !rolesReq.current || rolesReceived.current ? false : l
          );
      }
      if (msg?.type === "employees:birthdays-today" && Array.isArray(msg.employees)) {
        setBirthdaysToday(msg.employees);
        if (msg.employees.length > 0) {
          const todayKey = "yammak_birthday_alert_" + new Date().toISOString().slice(0, 10);
          try {
            if (localStorage.getItem(todayKey) !== "1") {
              localStorage.setItem(todayKey, "1");
              const names = msg.employees.map((e) => e?.name || "Someone").filter(Boolean);
              const text =
                names.length === 1
                  ? `${names[0]} has their birthday today! 🎂`
                  : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]} have their birthdays today! 🎂`;
              notify?.success?.(text, "Birthday today");
              window.api?.wsSend?.({
                type: "notification:create",
                requestId: rid(),
                payload: { type: "birthday", title: "Birthday today", message: text },
              });
            }
          } catch (_) {}
        }
      }
      if (msg?.type === "roles:list" && Array.isArray(msg.roles)) {
        setRoles(msg.roles);
        rolesReceived.current = true;
        setLastSyncAt(Date.now());
        if (rolesReq.current)
          setLoadingLists(
            (l) => !employeesReq.current || employeesReceived.current ? false : l
          );
      }
      if (msg?.type === "employees:changed") {
        window.api.wsSend?.({ type: "employees:list", requestId: rid() });
        if (canSeeEmployees) window.api.wsSend?.({ type: "employees:birthdays-today", requestId: rid() });
      }
      if (msg?.type === "roles:changed") {
        if (canSeeRoles) window.api.wsSend?.({ type: "roles:list", requestId: rid() });
      }
      if (msg?.type === "presence:list" && Array.isArray(msg.onlineUserIds)) {
        setOnlineUserIds(new Set(msg.onlineUserIds.map((id) => String(id))));
      }
      if (msg?.type === "presence:user" && msg?.user?._id) {
        const id = String(msg.user._id);
        setOnlineUserIds((prev) => {
          const next = new Set(prev);
          if (msg.event === "online") next.add(id);
          else next.delete(id);
          return next;
        });
      }
      if (msg?.type === "notification:list" && msg?.requestId === requestIdRef.current) {
        setNotifications(Array.isArray(msg.notifications) ? msg.notifications : []);
        setLoadingActivity(false);
      }
      if (msg?.type === "notification:new" && msg?.notification) {
        setNotifications((prev) => [msg.notification, ...prev]);
      }
      if (msg?.type === "hot:deliver" && msg?.title) {
        setHotItems((prev) => [
          {
            id: msg.hotId || rid(),
            title: msg.title,
            message: msg.message,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
      }
      if (msg?.type === "report:new" && msg?.title) {
        setHotItems((prev) => [
          {
            id: `report-${rid()}`,
            kind: "notification",
            type: "report_new",
            title: msg.title || "New report submitted",
            message: msg.message || null,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
      }
      if (msg?.type === "holiday:list" && msg?.requestId === pendingHolidayReqIdRef.current) {
        setPendingHolidayCount(Array.isArray(msg.holidays) ? msg.holidays.length : 0);
      }
      if (msg?.type === "suggest:list" && msg?.requestId === pendingSuggestReqIdRef.current) {
        setPendingSuggestCount(Array.isArray(msg.suggests) ? msg.suggests.length : 0);
      }
      if (msg?.type === "dashboard:todaySummary" && msg?.requestId) {
        setTodaySummary({
          reportsToday: typeof msg.reportsToday === "number" ? msg.reportsToday : 0,
          holidayRequestsToday: typeof msg.holidayRequestsToday === "number" ? msg.holidayRequestsToday : 0,
          suggestionsToday: typeof msg.suggestionsToday === "number" ? msg.suggestionsToday : 0,
        });
      }
      if (msg?.type === "drivers:stats" && msg?.requestId === driversStatsReqIdRef.current) {
        if (!msg.error) {
          setDriverStats({
            totalMoneyInHand: typeof msg.totalMoneyInHand === "number" ? msg.totalMoneyInHand : 0,
            totalEarnings: typeof msg.totalEarnings === "number" ? msg.totalEarnings : 0,
            totalWithdrawal: typeof msg.totalWithdrawal === "number" ? msg.totalWithdrawal : 0,
            topByEarnings: Array.isArray(msg.topByEarnings) ? msg.topByEarnings : [],
            topByOrders: Array.isArray(msg.topByOrders) ? msg.topByOrders : [],
          });
        }
        setLoadingTopDrivers(false);
      }
      if (msg?.type === "dashboard:summary" && msg?.requestId === dashboardSummaryReqIdRef.current && !msg.error) {
        setKpiSummary({
          storesCount: typeof msg.storesCount === "number" ? msg.storesCount : 0,
          driversCount: typeof msg.driversCount === "number" ? msg.driversCount : 0,
          pendingCashoutCount: typeof msg.pendingCashoutCount === "number" ? msg.pendingCashoutCount : 0,
          transactionsToday: typeof msg.transactionsToday === "number" ? msg.transactionsToday : 0,
        });
        setLastSyncAt(Date.now());
      }
      if (msg?.type === "stores:list" && msg?.requestId === storeRankingReqIdRef.current && !msg.error) {
        setStoreRanking(Array.isArray(msg.stores) ? msg.stores : []);
        setLoadingStoreRanking(false);
      }
    });

    (async () => {
      try {
        await window.api.wsConnect();
        /* Always fetch employees + presence for team block (visible to all) */
        employeesReq.current = true;
        window.api.wsSend({ type: "employees:list", requestId: rid() });
        window.api.wsSend({ type: "presence:list", requestId: rid() });
        if (canSeeEmployees) {
          window.api.wsSend({ type: "employees:birthdays-today", requestId: rid() });
        }
        if (canSeeRoles) {
          rolesReq.current = true;
          window.api.wsSend({ type: "roles:list", requestId: rid() });
        }
        window.api.wsSend({ type: "stats:get", requestId: rid() });
        requestIdRef.current = rid();
        window.api.wsSend({ type: "notification:list", requestId: requestIdRef.current, payload: {} });
        if (canManageHoliday) {
          pendingHolidayReqIdRef.current = rid();
          window.api.wsSend({ type: "holiday:list", requestId: pendingHolidayReqIdRef.current, payload: { status: "pending" } });
        }
        if (canViewSuggests) {
          pendingSuggestReqIdRef.current = rid();
          window.api.wsSend({ type: "suggest:list", requestId: pendingSuggestReqIdRef.current });
        }
        if (!canSeeRoles) setLoadingLists(false);
        if (canViewStores || canViewDrivers || canViewPendingCashout || canViewTransactions) {
          dashboardSummaryReqIdRef.current = rid();
          window.api.wsSend({ type: "dashboard:summary", requestId: dashboardSummaryReqIdRef.current });
        }
        if (canViewStores) {
          setLoadingStoreRanking(true);
          storeRankingReqIdRef.current = rid();
          window.api.wsSend({
            type: "stores:list",
            requestId: storeRankingReqIdRef.current,
            payload: { page: 1, pageSize: 10, sortBy: storeRankingSort, sortDir: "desc" },
          });
        }
      } catch {
        setLoadingLists(false);
        setLoadingActivity(false);
      }
    })();

    return () => {
      unsub?.();
      employeesReq.current = false;
      rolesReq.current = false;
      employeesReceived.current = false;
      rolesReceived.current = false;
    };
  }, [canSeeEmployees, canSeeRoles, canSeePresence, canManageHoliday, canViewSuggests, canSeeFinance, canViewDrivers, canViewStores, canViewPendingCashout, canViewTransactions]);

  useEffect(() => {
    onCurrentUserEmployee?.(currentUserEmployee ?? null);
  }, [currentUserEmployee, onCurrentUserEmployee]);

  const loading = loadingStats || loadingLists;

  // Calendar: displayed month and transition direction
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [calendarDirection, setCalendarDirection] = useState("next");
  const calendarDays = useMemo(() => {
    const y = calendarMonth.getFullYear();
    const m = calendarMonth.getMonth();
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    const startPad = first.getDay();
    const daysInMonth = last.getDate();
    const prevLast = new Date(y, m, 0).getDate();
    const totalCells = 6 * 7;
    const grid = [];
    const today = new Date();
    for (let i = 0; i < totalCells; i++) {
      const dayOfGrid = i - startPad + 1;
      let label;
      let isCurrentMonth = false;
      let isToday = false;
      if (dayOfGrid >= 1 && dayOfGrid <= daysInMonth) {
        label = String(dayOfGrid);
        isCurrentMonth = true;
        isToday = today.getFullYear() === y && today.getMonth() === m && today.getDate() === dayOfGrid;
      } else if (dayOfGrid < 1) {
        label = String(prevLast + dayOfGrid);
      } else {
        label = String(dayOfGrid - daysInMonth);
      }
      grid.push({ label, isCurrentMonth, isToday });
    }
    return grid;
  }, [calendarMonth]);

  // Next upcoming birthday (first after today) from employees with dob
  const revenueChartData = useMemo(() => {
    const points = Array.isArray(dailyRevenuePoints) ? dailyRevenuePoints : [];
    const labels = points.map((p) => {
      if (!p?.date) return "";
      const d = new Date(p.date);
      return Number.isNaN(d.getTime()) ? p.date : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    });
    return {
      labels,
      datasets: [
        {
          label: t("dashboard.dailyRevenueChartLabel"),
          data: points.map((p) => Number(p?.revenue) || 0),
          borderColor: "rgba(34, 197, 94, 0.9)",
          backgroundColor: "rgba(34, 197, 94, 0.15)",
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    };
  }, [dailyRevenuePoints, t]);

  useEffect(() => {
    revenueDaysRef.current = revenueDays;
  }, [revenueDays]);

  useEffect(() => {
    if (!canSeeFinance || !window.api?.wsSend) return;
    if (prevRevenueDaysRef.current === revenueDays) return;
    prevRevenueDaysRef.current = revenueDays;
    dailyRevenueReqIdRef.current = rid();
    window.api.wsSend({
      type: "finance:dailyRevenue",
      requestId: dailyRevenueReqIdRef.current,
      payload: { days: revenueDays },
    });
  }, [canSeeFinance, revenueDays]);

  const revenueChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${Number(ctx.raw || 0).toLocaleString()} IQD`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: "rgba(255,255,255,0.06)" },
          ticks: { color: "rgba(255,255,255,0.6)", maxRotation: 45 },
        },
        y: {
          grid: { color: "rgba(255,255,255,0.06)" },
          ticks: { color: "rgba(255,255,255,0.6)", callback: (v) => (typeof v === "number" ? v.toLocaleString() : v) },
        },
      },
    }),
    []
  );

  const upcomingBirthday = useMemo(() => {
    const list = Array.isArray(employees) ? employees : [];
    const today = new Date();
    const toKey = (d) => `${d.getMonth()}-${d.getDate()}`;
    const todayKey = toKey(today);
    const candidates = [];
    list.forEach((emp) => {
      const dob = emp?.dob;
      if (!dob || typeof dob !== "string") return;
      const parts = dob.trim().split("-");
      if (parts.length < 3) return;
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      if (Number.isNaN(month) || Number.isNaN(day)) return;
      const thisYear = new Date(today.getFullYear(), month, day);
      const nextOccurrence = thisYear >= today ? thisYear : new Date(today.getFullYear() + 1, month, day);
      const key = toKey(nextOccurrence);
      if (key === todayKey) return;
      candidates.push({ employee: emp, date: nextOccurrence });
    });
    candidates.sort((a, b) => a.date.getTime() - b.date.getTime());
    return candidates[0] ?? null;
  }, [employees]);

  return (
    <div className="dashboardPage">
      <header className="dashboardHeader">
        <div className="dashboardHeaderIcon">
          <LayoutDashboard size={24} />
        </div>
        <div className="dashboardHeaderText">
          <h1 className="dashboardTitle">{t("dashboard.title")}</h1>
          <p className="dashboardSubtitle">{t("dashboard.subtitle")}</p>
          {lastSyncAt != null && (
            <p className="dashboardLastSync">
              {t("dashboard.lastSynced").replace("{{time}}", activityTime(new Date(lastSyncAt), t))}
            </p>
          )}
        </div>
      </header>

      <main className="dashboardMain">
        {contentReady ? (
        <div className="dashboardContent">
          <div className="dashboardContentMain">
          {/* Welcome card: Welcome + tagline + illustration */}
          <section className="dashboardSection dashboardWelcome">
            <div className="dashboardWelcomeCard">
              <div className="dashboardWelcomeContent">
                <h2 className="dashboardWelcomeTitle">{t("dashboard.welcome")}, {userName}</h2>
                <p className="dashboardWelcomeTagline">
                  {t("dashboard.welcomeTagline")}
                </p>
              </div>
              <div className="dashboardWelcomeIllustration">
                <img
                  src={getAssetUrl("assets/svg/dashboard-ill.svg")}
                  alt=""
                  className="dashboardWelcomeIllustrationImg"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              </div>
            </div>
          </section>

          {/* KPI summary: stores, drivers, pending cashouts, transactions today */}
          {(canViewStores || canViewDrivers || canViewPendingCashout || canViewTransactions) && (
            <section className="dashboardSection dashboardKpiSummarySection">
              <h3 className="dashboardSectionTitle">{t("dashboard.kpiSummary")}</h3>
              <div className="dashboardKpiGrid dashboardKpiGrid--summary">
                {canViewStores && (
                  <div
                    className="dashboardKpiCard dashboardKpiCard--summary"
                    role="button"
                    tabIndex={0}
                    onClick={() => onNavigate?.("stores")}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onNavigate?.("stores")}
                  >
                    <div className="dashboardKpiIcon dashboardKpiIcon--stores">
                      <Building2 size={22} />
                    </div>
                    <div className="dashboardKpiContent">
                      <div className="dashboardKpiValue">
                        {kpiSummary == null ? "—" : (kpiSummary.storesCount ?? 0).toLocaleString()}
                      </div>
                      <div className="dashboardKpiLabel">{t("dashboard.storesCount")}</div>
                    </div>
                    <ChevronRight size={18} className="dashboardKpiChevron" />
                  </div>
                )}
                {canViewDrivers && (
                  <div
                    className="dashboardKpiCard dashboardKpiCard--summary"
                    role="button"
                    tabIndex={0}
                    onClick={() => onNavigate?.("drivers")}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onNavigate?.("drivers")}
                  >
                    <div className="dashboardKpiIcon dashboardKpiIcon--drivers">
                      <Truck size={22} />
                    </div>
                    <div className="dashboardKpiContent">
                      <div className="dashboardKpiValue">
                        {kpiSummary == null ? "—" : (kpiSummary.driversCount ?? 0).toLocaleString()}
                      </div>
                      <div className="dashboardKpiLabel">{t("dashboard.driversCount")}</div>
                    </div>
                    <ChevronRight size={18} className="dashboardKpiChevron" />
                  </div>
                )}
                {canViewPendingCashout && (
                  <div
                    className="dashboardKpiCard dashboardKpiCard--summary"
                    role="button"
                    tabIndex={0}
                    onClick={() => onNavigate?.("cashout:pending")}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onNavigate?.("cashout:pending")}
                  >
                    <div className="dashboardKpiIcon dashboardKpiIcon--pending">
                      <Wallet size={22} />
                    </div>
                    <div className="dashboardKpiContent">
                      <div className="dashboardKpiValue">
                        {kpiSummary == null ? "—" : (kpiSummary.pendingCashoutCount ?? 0).toLocaleString()}
                      </div>
                      <div className="dashboardKpiLabel">{t("dashboard.pendingCashouts")}</div>
                    </div>
                    <ChevronRight size={18} className="dashboardKpiChevron" />
                  </div>
                )}
                {canViewTransactions && (
                  <div
                    className="dashboardKpiCard dashboardKpiCard--summary"
                    role="button"
                    tabIndex={0}
                    onClick={() => onNavigate?.("transactions")}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onNavigate?.("transactions")}
                  >
                    <div className="dashboardKpiIcon dashboardKpiIcon--transactions">
                      <FileText size={22} />
                    </div>
                    <div className="dashboardKpiContent">
                      <div className="dashboardKpiValue">
                        {kpiSummary == null ? "—" : (kpiSummary.transactionsToday ?? 0).toLocaleString()}
                      </div>
                      <div className="dashboardKpiLabel">{t("dashboard.transactionsToday")}</div>
                    </div>
                    <ChevronRight size={18} className="dashboardKpiChevron" />
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Finance (merged: company + drivers) — scroll-in animated, lazy-load data when in view */}
          {(canSeeFinance || canViewDrivers) && (
            <SectionWithScrollAnimation
              className="dashboardSectionFinanceMerged"
              onVisible={() => {
                if (canSeeFinance && window.api?.wsSend) {
                  dailyRevenueReqIdRef.current = rid();
                  window.api.wsSend({
                    type: "finance:dailyRevenue",
                    requestId: dailyRevenueReqIdRef.current,
                    payload: { days: revenueDaysRef.current },
                  });
                }
                if (canViewDrivers && window.api?.wsSend) {
                  setLoadingTopDrivers(true);
                  driversStatsReqIdRef.current = rid();
                  window.api.wsSend({ type: "drivers:stats", requestId: driversStatsReqIdRef.current });
                }
              }}
            >
              <h3 className="dashboardSectionTitle">{t("dashboard.finance")}</h3>
              <div className="dashboardFinanceMergedInner">
                {canSeeFinance && (
                  <div className="dashboardFinanceCompany">
                    <div className="dashboardKpiGrid dashboardKpiGrid--financeSingle">
                      <div className="dashboardKpiCard dashboardKpiCard--static">
                        <div className="dashboardKpiIcon dashboardKpiIcon--finance">
                          <Wallet size={22} />
                        </div>
                        <div className="dashboardKpiContent">
                          <div className="dashboardKpiValue">
                            {loading ? "—" : (stats?.companyBalance ?? 0).toLocaleString()}
                          </div>
                          <div className="dashboardKpiLabel">{t("dashboard.liquidAssets")}</div>
                        </div>
                      </div>
                    </div>
                    <div className="dashboardRevenueChartWrap">
                      <div className="dashboardRevenueChartHeader">
                        <p className="dashboardRevenueChartTitle">{t("dashboard.dailyRevenue")}</p>
                        <div className="dashboardRevenueChartDays">
                          {[7, 30, 90].map((d) => (
                            <button
                              key={d}
                              type="button"
                              className={`dashboardRevenueChartDayBtn ${revenueDays === d ? "active" : ""}`}
                              onClick={() => setRevenueDays(d)}
                            >
                              {d}d
                            </button>
                          ))}
                        </div>
                      </div>
                      {dailyRevenuePoints.length === 0 ? (
                        <div className="dashboardRevenueChartEmpty">{t("dashboard.noRevenueData")}</div>
                      ) : (
                        <div className="dashboardRevenueChartInner">
                          <Line data={revenueChartData} options={revenueChartOptions} />
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {canViewDrivers && (
                  <div className="dashboardFinanceDriversStrip">
                    <div className="dashboardFinanceDriversStripHeader">
                      <Truck size={18} className="dashboardFinanceDriversStripIcon" />
                      <span>{t("dashboard.deliveryAndDrivers")}</span>
                    </div>
                    <div className="dashboardFinanceDriversStripGrid">
                      <div className="dashboardFinanceDriversCard">
                        <span className="dashboardFinanceDriversCardValue">
                          {driverStats == null ? "—" : (driverStats.totalMoneyInHand ?? 0).toLocaleString()}
                        </span>
                        <span className="dashboardFinanceDriversCardLabel">{t("dashboard.moneyInHand")}</span>
                      </div>
                      <div className="dashboardFinanceDriversCard">
                        <span className="dashboardFinanceDriversCardValue">
                          {driverStats == null ? "—" : (driverStats.totalEarnings ?? 0).toLocaleString()}
                        </span>
                        <span className="dashboardFinanceDriversCardLabel">{t("dashboard.totalEarnings")}</span>
                      </div>
                      <div className="dashboardFinanceDriversCard">
                        <span className="dashboardFinanceDriversCardValue">
                          {driverStats == null ? "—" : (driverStats.totalWithdrawal ?? 0).toLocaleString()}
                        </span>
                        <span className="dashboardFinanceDriversCardLabel">{t("dashboard.totalWithdrawal")}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </SectionWithScrollAnimation>
          )}

          {/* Quick actions — 1–3 per permission */}
          {(canSendHot || canRequestHoliday || canViewReports || canViewDrivers) && (
            <section className="dashboardSection">
              <h3 className="dashboardSectionTitle">{t("dashboard.quickActions")}</h3>
              <div className="dashboardQuickActions">
                {canSendHot && (
                  <button
                    type="button"
                    className="dashboardQuickAction dashboardQuickAction--hot"
                    onClick={() => onNavigate?.("hot:send")}
                  >
                    <Zap size={20} />
                    <span>{t("dashboard.sendAnnouncement")}</span>
                  </button>
                )}
                {canRequestHoliday && (
                  <button
                    type="button"
                    className="dashboardQuickAction dashboardQuickAction--holiday"
                    onClick={() => onNavigate?.("holidays:ask")}
                  >
                    <Calendar size={20} />
                    <span>{t("dashboard.requestHoliday")}</span>
                  </button>
                )}
                {canViewReports && (
                  <button
                    type="button"
                    className="dashboardQuickAction dashboardQuickAction--report"
                    onClick={() => onNavigate?.("reports:submit")}
                  >
                    <FileText size={20} />
                    <span>{t("dashboard.submitReport")}</span>
                  </button>
                )}
                <button
                  type="button"
                  className="dashboardQuickAction dashboardQuickAction--suggest"
                  onClick={() => onNavigate?.("suggests:new")}
                >
                  <MessageSquare size={20} />
                  <span>{t("dashboard.newSuggestion")}</span>
                </button>
                {canViewDrivers && (
                  <button
                    type="button"
                    className="dashboardQuickAction dashboardQuickAction--drivers"
                    onClick={() => onNavigate?.("drivers")}
                  >
                    <Truck size={20} />
                    <span>{t("dashboard.viewDrivers")}</span>
                  </button>
                )}
              </div>
            </section>
          )}

          {/* Pending approvals (for managers) */}
          {(canManageHoliday || canViewSuggests) && (
            <section className="dashboardSection dashboardSectionPendingApprovals">
              <h3 className="dashboardSectionTitle">{t("dashboard.pendingApprovals")}</h3>
              <div className="dashboardPendingApprovalsWrap">
                {canManageHoliday && (
                  <button
                    type="button"
                    className="dashboardPendingApprovalLink"
                    onClick={() => onNavigate?.("holidays:list")}
                  >
                    <Calendar size={18} />
                    <span>{t("dashboard.pendingHolidayRequests")}</span>
                    <span className="dashboardPendingApprovalCount">{pendingHolidayCount}</span>
                    <ChevronRight size={16} />
                  </button>
                )}
                {canViewSuggests && (
                  <button
                    type="button"
                    className="dashboardPendingApprovalLink"
                    onClick={() => onNavigate?.("suggests:list")}
                  >
                    <MessageSquare size={18} />
                    <span>{t("dashboard.suggestionsReceived")}</span>
                    <span className="dashboardPendingApprovalCount">{pendingSuggestCount}</span>
                    <ChevronRight size={16} />
                  </button>
                )}
              </div>
            </section>
          )}

          {/* Today — KPI cards (scroll-in animated), lazy-load when in view */}
          <SectionWithScrollAnimation
            className="dashboardSectionTeamSummary"
            onVisible={() => {
              if (window.api?.wsSend) window.api.wsSend({ type: "dashboard:todaySummary", requestId: rid() });
            }}
          >
            <h3 className="dashboardSectionTitle">{t("dashboard.today")}</h3>
            <div className="dashboardKpiGrid">
                <div
                  className={`dashboardKpiCard ${canViewReports ? "" : "dashboardKpiCard--static"}`}
                  {...(canViewReports
                    ? {
                        role: "button",
                        tabIndex: 0,
                        onClick: () => onNavigate?.("reports:list"),
                        onKeyDown: (e) =>
                          (e.key === "Enter" || e.key === " ") && onNavigate?.("reports:list"),
                      }
                    : {})}
                >
                  <div className="dashboardKpiIcon dashboardKpiIcon--report">
                    <FileText size={22} />
                  </div>
                  <div className="dashboardKpiContent">
                    <div className="dashboardKpiValue">{todaySummary?.reportsToday ?? "—"}</div>
                    <div className="dashboardKpiLabel">{t("dashboard.reportsSubmitted")}</div>
                  </div>
                  {canViewReports && <ChevronRight size={18} className="dashboardKpiChevron" />}
                </div>
                <div
                  className={`dashboardKpiCard ${canRequestHoliday ? "" : "dashboardKpiCard--static"}`}
                  {...(canRequestHoliday
                    ? {
                        role: "button",
                        tabIndex: 0,
                        onClick: () => onNavigate?.("holidays:list"),
                        onKeyDown: (e) =>
                          (e.key === "Enter" || e.key === " ") && onNavigate?.("holidays:list"),
                      }
                    : {})}
                >
                  <div className="dashboardKpiIcon dashboardKpiIcon--holiday">
                    <Calendar size={22} />
                  </div>
                  <div className="dashboardKpiContent">
                    <div className="dashboardKpiValue">{todaySummary?.holidayRequestsToday ?? "—"}</div>
                    <div className="dashboardKpiLabel">{t("dashboard.holidayRequests")}</div>
                  </div>
                  {canRequestHoliday && <ChevronRight size={18} className="dashboardKpiChevron" />}
                </div>
                <div
                  className={`dashboardKpiCard ${canViewSuggests ? "" : "dashboardKpiCard--static"}`}
                  {...(canViewSuggests
                    ? {
                        role: "button",
                        tabIndex: 0,
                        onClick: () => onNavigate?.("suggests:list"),
                        onKeyDown: (e) =>
                          (e.key === "Enter" || e.key === " ") && onNavigate?.("suggests:list"),
                      }
                    : {})}
                >
                  <div className="dashboardKpiIcon dashboardKpiIcon--suggest">
                    <MessageSquare size={22} />
                  </div>
                  <div className="dashboardKpiContent">
                    <div className="dashboardKpiValue">{todaySummary?.suggestionsToday ?? "—"}</div>
                    <div className="dashboardKpiLabel">{t("dashboard.suggestions")}</div>
                  </div>
                  {canViewSuggests && <ChevronRight size={18} className="dashboardKpiChevron" />}
                </div>
              </div>
            </SectionWithScrollAnimation>

          {/* Overview — KPI cards (scroll-in animated) */}
          <SectionWithScrollAnimation>
            <h3 className="dashboardSectionTitle">{t("dashboard.overview")}</h3>
            <div className="dashboardKpiGrid">
              {canSeeEmployees && (
                <div
                  className="dashboardKpiCard"
                  role="button"
                  tabIndex={0}
                  onClick={() => onNavigate?.("employees:list")}
                  onKeyDown={(e) =>
                    (e.key === "Enter" || e.key === " ") && onNavigate?.("employees:list")
                  }
                >
                  <div className="dashboardKpiIcon dashboardKpiIcon--users">
                    <Users size={22} />
                  </div>
                  <div className="dashboardKpiContent">
                    <div className="dashboardKpiValue">
                      {loading ? "—" : totalEmployees}
                    </div>
                    <div className="dashboardKpiLabel">{t("dashboard.totalEmployees")}</div>
                  </div>
                  <ChevronRight size={18} className="dashboardKpiChevron" />
                </div>
              )}

              {canSeeRoles && (
                <div
                  className="dashboardKpiCard"
                  role="button"
                  tabIndex={0}
                  onClick={() => onNavigate?.("roles:list")}
                  onKeyDown={(e) =>
                    (e.key === "Enter" || e.key === " ") && onNavigate?.("roles:list")
                  }
                >
                  <div className="dashboardKpiIcon dashboardKpiIcon--roles">
                    <Shield size={22} />
                  </div>
                  <div className="dashboardKpiContent">
                    <div className="dashboardKpiValue">
                      {loading ? "—" : totalRoles}
                    </div>
                    <div className="dashboardKpiLabel">{t("dashboard.totalRoles")}</div>
                  </div>
                  <ChevronRight size={18} className="dashboardKpiChevron" />
                </div>
              )}

              <div className="dashboardKpiCard dashboardKpiCard--static">
                <div className="dashboardKpiIcon dashboardKpiIcon--perms">
                  <Key size={22} />
                </div>
                <div className="dashboardKpiContent">
                  <div className="dashboardKpiValue">{permCount}</div>
                  <div className="dashboardKpiLabel">{t("dashboard.yourPermissions")}</div>
                </div>
              </div>
            </div>
          </SectionWithScrollAnimation>

          {/* Activity stream — unique design per type */}
          <section className="dashboardSection dashboardSectionActivity">
            <div className="dashboardSectionHead dashboardActivitySectionHead">
              <div className="dashboardActivitySectionTitleWrap">
                <h3 className="dashboardSectionTitle">{t("dashboard.activity")}</h3>
                <p className="dashboardActivitySectionSub">{t("dashboard.activitySub")}</p>
              </div>
              {!loadingActivity && (activityItems.length > 0 || hotOnly.length > 0) && (
                <button
                  type="button"
                  className="dashboardSectionLink dashboardActivityViewAll"
                  onClick={() => onNavigate?.("notifications")}
                >
                  {t("dashboard.viewAll")}
                  <ChevronRight size={16} />
                </button>
              )}
            </div>
            <div className="dashboardActivityWrap">
            {loadingActivity ? (
              <div className="dashboardActivityLoading">
                <p className="dashboardActivityLoadingText">{t("dashboard.loadingActivity")}</p>
                <div className="dashboardActivityLoadingDots" aria-hidden>
                  <span className="dashboardActivityLoadingDot" />
                  <span className="dashboardActivityLoadingDot" />
                  <span className="dashboardActivityLoadingDot" />
                </div>
              </div>
            ) : activityItems.length === 0 && hotOnly.length === 0 ? (
              <div className="dashboardActivityEmpty">
                <div className="dashboardActivityEmptyIconWrap">
                  <Bell size={40} className="dashboardActivityEmptyIcon" />
                </div>
                <p className="dashboardActivityEmptyTitle">{t("dashboard.noActivityYet")}</p>
                <p className="dashboardActivityEmptySub">{t("dashboard.noActivitySub")}</p>
                <button
                  type="button"
                  className="dashboardActivityEmptyBtn"
                  onClick={() => onNavigate?.("notifications")}
                >
                  {t("dashboard.openNotifications")}
                  <ChevronRight size={16} />
                </button>
              </div>
            ) : (
              <div className="dashboardActivity">
                {hotOnly.length > 1 && (
                  <div className="dashboardActivityHotCarousel">
                    <div className="dashboardActivityHotCarouselRow">
                    <button
                      type="button"
                      className="dashboardActivityHotCarouselBtn"
                      onClick={() => setHotCarouselIndex((i) => (i <= 0 ? hotOnly.length - 1 : i - 1))}
                      aria-label={t("dashboard.previousAnnouncement")}
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <div className="dashboardActivityHotCarouselContent">
                      {(() => {
                        const item = hotOnly[hotCarouselIndex];
                        if (!item) return null;
                        const timeStr = activityTime(item.createdAt, t);
                        const isNew = !item.createdAt ? false : (Date.now() - new Date(item.createdAt).getTime() < 3600000);
                        return (
                          <button
                            type="button"
                            className="dashboardActivityCard dashboardActivityCard--hot"
                            onClick={() => onNavigate?.("notifications")}
                          >
                            <div className="dashboardActivityCardInner">
                              <div className="dashboardActivityCardIconWrap dashboardActivityCardIconWrap--hot">
                                <Zap size={24} aria-hidden />
                              </div>
                              <div className="dashboardActivityCardBody">
                                <span className="dashboardActivityCardTime">{timeStr}{isNew && <span className="dashboardActivityCardNewBadge">{t("dashboard.newBadge")}</span>}</span>
                                <h4 className="dashboardActivityCardTitle">{item.title || "—"}</h4>
                                {item.message && <p className="dashboardActivityCardMessage">{item.message}</p>}
                              </div>
                            </div>
                            <ChevronRight size={18} className="dashboardActivityCardChevron" aria-hidden />
                          </button>
                        );
                      })()}
                    </div>
                    <button
                      type="button"
                      className="dashboardActivityHotCarouselBtn"
                      onClick={() => setHotCarouselIndex((i) => (i >= hotOnly.length - 1 ? 0 : i + 1))}
                      aria-label={t("dashboard.nextAnnouncement")}
                    >
                      <ChevronRight size={20} />
                    </button>
                    </div>
                    <div className="dashboardActivityHotCarouselDots">
                      <span className="dashboardActivityHotCarouselCounter">
                        {hotCarouselIndex + 1} of {hotOnly.length}
                      </span>
                    </div>
                  </div>
                )}
                {activityItems.map((item, index) => {
                  const type = item.kind === "hot" ? "hot" : (item.type || "info");
                  const title = item.title || "—";
                  const message = item.message || null;
                  const timeStr = activityTime(item.createdAt, t);
                  const isNew = !item.createdAt ? false : (Date.now() - new Date(item.createdAt).getTime() < 3600000);
                  const isUnread = item.kind === "notification" && item.read === false;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`dashboardActivityCard dashboardActivityCard--${type.replace(/_/g, "-")} ${isUnread ? "dashboardActivityCard--unread" : ""} ${isNew ? "dashboardActivityCard--new" : ""}`}
                      style={{ animationDelay: `${index * 0.04}s` }}
                      onClick={() => onNavigate?.("notifications")}
                    >
                      <div className="dashboardActivityCardInner">
                        {type === "birthday" && (
                          <>
                            <div className="dashboardActivityCardIconWrap dashboardActivityCardIconWrap--birthday">
                              <Cake size={24} />
                            </div>
                            <div className="dashboardActivityCardBody">
                              <span className="dashboardActivityCardTime">{timeStr}{isNew && <span className="dashboardActivityCardNewBadge">{t("dashboard.newBadge")}</span>}</span>
                              <h4 className="dashboardActivityCardTitle">{title}</h4>
                              {message && <p className="dashboardActivityCardMessage">{message}</p>}
                            </div>
                          </>
                        )}
                        {type === "hot" && (
                          <>
                            <div className="dashboardActivityCardIconWrap dashboardActivityCardIconWrap--hot">
                              <Zap size={24} aria-hidden />
                            </div>
                            <div className="dashboardActivityCardBody">
                              <span className="dashboardActivityCardTime">{timeStr}{isNew && <span className="dashboardActivityCardNewBadge">{t("dashboard.newBadge")}</span>}</span>
                              <h4 className="dashboardActivityCardTitle">{title}</h4>
                              {message && <p className="dashboardActivityCardMessage">{message}</p>}
                            </div>
                          </>
                        )}
                        {type === "holiday_request" && (
                          <>
                            <div className="dashboardActivityCardIconWrap dashboardActivityCardIconWrap--holiday">
                              <Calendar size={24} aria-hidden />
                            </div>
                            <div className="dashboardActivityCardBody">
                              <span className="dashboardActivityCardTime">{timeStr}{isNew && <span className="dashboardActivityCardNewBadge">{t("dashboard.newBadge")}</span>}</span>
                              <h4 className="dashboardActivityCardTitle">{title}</h4>
                              {message && <p className="dashboardActivityCardMessage">{message}</p>}
                            </div>
                          </>
                        )}
                        {type === "holiday_decision" && (
                          <>
                            <div className="dashboardActivityCardIconWrap dashboardActivityCardIconWrap--holiday-decision">
                              <Calendar size={24} aria-hidden />
                            </div>
                            <div className="dashboardActivityCardBody">
                              <span className="dashboardActivityCardTime">{timeStr}{isNew && <span className="dashboardActivityCardNewBadge">{t("dashboard.newBadge")}</span>}</span>
                              <h4 className="dashboardActivityCardTitle">{title}</h4>
                              {message && <p className="dashboardActivityCardMessage">{message}</p>}
                            </div>
                          </>
                        )}
                        {(type === "suggest_sent" || type === "suggest_received") && (
                          <>
                            <div className="dashboardActivityCardBubble dashboardActivityCardBubble--suggest">
                              <MessageSquare size={18} />
                            </div>
                            <div className="dashboardActivityCardBody">
                              <span className="dashboardActivityCardTime">{timeStr}{isNew && <span className="dashboardActivityCardNewBadge">{t("dashboard.newBadge")}</span>}</span>
                              <h4 className="dashboardActivityCardTitle">{title}</h4>
                              {message && <p className="dashboardActivityCardMessage">{message}</p>}
                            </div>
                          </>
                        )}
                        {(type === "report_new" || type === "report_sent") && (
                          <>
                            <div className="dashboardActivityCardDoc dashboardActivityCardDoc--report">
                              <FileText size={20} />
                            </div>
                            <div className="dashboardActivityCardBody">
                              <span className="dashboardActivityCardTime">{timeStr}{isNew && <span className="dashboardActivityCardNewBadge">{t("dashboard.newBadge")}</span>}</span>
                              <h4 className="dashboardActivityCardTitle">{title}</h4>
                              {message && <p className="dashboardActivityCardMessage">{message}</p>}
                            </div>
                          </>
                        )}
                        {type === "cashin_created" && (
                          <>
                            <div className="dashboardActivityCardIconWrap dashboardActivityCardIconWrap--cashin-created">
                              <Wallet size={22} />
                            </div>
                            <div className="dashboardActivityCardBody">
                              <span className="dashboardActivityCardTime">{timeStr}{isNew && <span className="dashboardActivityCardNewBadge">{t("dashboard.newBadge")}</span>}</span>
                              <h4 className="dashboardActivityCardTitle">{title}</h4>
                              {message && <p className="dashboardActivityCardMessage">{message}</p>}
                            </div>
                          </>
                        )}
                        {(type && type.startsWith("cashout_")) && (
                          <>
                            <div className="dashboardActivityCardIconWrap dashboardActivityCardIconWrap--cashout">
                              <Wallet size={22} />
                            </div>
                            <div className="dashboardActivityCardBody">
                              <span className="dashboardActivityCardTime">{timeStr}{isNew && <span className="dashboardActivityCardNewBadge">{t("dashboard.newBadge")}</span>}</span>
                              <h4 className="dashboardActivityCardTitle">{title}</h4>
                              {message && <p className="dashboardActivityCardMessage">{message}</p>}
                            </div>
                          </>
                        )}
                        {!["birthday", "hot", "holiday_request", "holiday_decision", "suggest_sent", "suggest_received", "report_new", "report_sent", "cashin_created"].includes(type) && !(type && type.startsWith("cashout_")) && (
                          <>
                            <div className="dashboardActivityCardMinimal">
                              <Bell size={16} />
                            </div>
                            <div className="dashboardActivityCardBody">
                              <span className="dashboardActivityCardTime">{timeStr}{isNew && <span className="dashboardActivityCardNewBadge">{t("dashboard.newBadge")}</span>}</span>
                              <h4 className="dashboardActivityCardTitle">{title}</h4>
                              {message && <p className="dashboardActivityCardMessage">{message}</p>}
                            </div>
                          </>
                        )}
                      </div>
                      <ChevronRight size={18} className="dashboardActivityCardChevron" aria-hidden />
                    </button>
                  );
                })}
              </div>
            )}
            </div>
          </section>

          {/* Recent Employees */}
          {canSeeEmployees && recentEmployees.length > 0 && (
            <section className="dashboardSection">
              <div className="dashboardSectionHead">
                <h3 className="dashboardSectionTitle">{t("dashboard.recentEmployees")}</h3>
                <button
                  type="button"
                  className="dashboardSectionLink"
                  onClick={() => onNavigate?.("employees:list")}
                >
                  {t("dashboard.viewAll")}
                  <ChevronRight size={16} />
                </button>
              </div>
              <div className="dashboardCard dashboardTableCard">
                <ul className="dashboardList">
                  {recentEmployees.map((emp) => (
                    <Tippy key={emp?._id} {...tippyViewUser}>
                      <li
                        className="dashboardListItem dashboardListItem--clickable"
                        onClick={() => onNavigate?.("employees:profile", emp)}
                        onKeyDown={(e) =>
                          (e.key === "Enter" || e.key === " ") &&
                          onNavigate?.("employees:profile", emp)
                        }
                        role="button"
                        tabIndex={0}
                      >
                        <div className="dashboardListPrimary">
                          <span className="dashboardListName">{emp?.name || "—"}</span>
                          <span className="dashboardListMeta">{emp?.jobTitle || "—"}</span>
                        </div>
                        <ChevronRight size={16} className="dashboardListChevron" />
                      </li>
                    </Tippy>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {/* By department */}
          {canSeeEmployees && departmentsCount.length > 0 && (
            <section className="dashboardSection">
              <div className="dashboardSectionHead">
                <h3 className="dashboardSectionTitle">{t("dashboard.byDepartment")}</h3>
                <button
                  type="button"
                  className="dashboardSectionLink"
                  onClick={() => onNavigate?.("employees:list")}
                >
                  {t("dashboard.viewAll")}
                  <ChevronRight size={16} />
                </button>
              </div>
              <div className="dashboardCard dashboardTableCard">
                <ul className="dashboardList dashboardList--compact">
                  {departmentsCount.map(([dept, count]) => (
                    <li key={dept} className="dashboardListItem dashboardListItem--static">
                      <Building2 size={16} className="dashboardListIcon" />
                      <div className="dashboardListPrimary">
                        <span className="dashboardListName">{dept}</span>
                        <span className="dashboardListMeta">{count !== 1 ? t("dashboard.employeeCountPlural").replace("{{count}}", count) : t("dashboard.employeeCount").replace("{{count}}", count)}</span>
                      </div>
                      <span className="dashboardListBadge">{count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {/* Top rated */}
          {canSeeEmployees && topRatedEmployees.length > 0 && (
            <section className="dashboardSection">
              <div className="dashboardSectionHead">
                <h3 className="dashboardSectionTitle">{t("dashboard.topRated")}</h3>
                <button
                  type="button"
                  className="dashboardSectionLink"
                  onClick={() => onNavigate?.("employees:list")}
                >
                  {t("dashboard.viewAll")}
                  <ChevronRight size={16} />
                </button>
              </div>
              <div className="dashboardCard dashboardTableCard">
                <ul className="dashboardList">
                  {topRatedEmployees.map((emp) => (
                    <Tippy key={emp?._id} {...tippyViewUser}>
                      <li
                        className="dashboardListItem dashboardListItem--clickable"
                        onClick={() => onNavigate?.("employees:profile", emp)}
                        onKeyDown={(e) =>
                          (e.key === "Enter" || e.key === " ") &&
                          onNavigate?.("employees:profile", emp)
                        }
                        role="button"
                        tabIndex={0}
                      >
                        <div className="dashboardListPrimary">
                          <span className="dashboardListName">{emp?.name || "—"}</span>
                          <span className="dashboardListMeta">{emp?.jobTitle || "—"}</span>
                        </div>
                        <span className="dashboardListRating">
                          <Star size={14} fill="currentColor" />
                          {Number(emp?.rating)}
                        </span>
                        <ChevronRight size={16} className="dashboardListChevron" />
                      </li>
                    </Tippy>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {/* Recent Roles */}
          {canSeeRoles && recentRoles.length > 0 && (
            <section className="dashboardSection">
              <div className="dashboardSectionHead">
                <h3 className="dashboardSectionTitle">{t("dashboard.recentRoles")}</h3>
                <button
                  type="button"
                  className="dashboardSectionLink"
                  onClick={() => onNavigate?.("roles:list")}
                >
                  {t("dashboard.viewAll")}
                  <ChevronRight size={16} />
                </button>
              </div>
              <div className="dashboardCard dashboardTableCard">
                <ul className="dashboardList">
                  {recentRoles.map((role) => (
                    <li
                      key={role?._id}
                      className="dashboardListItem dashboardListItem--clickable"
                      onClick={() => onNavigate?.("roles:edit", role)}
                      onKeyDown={(e) =>
                        (e.key === "Enter" || e.key === " ") &&
                        onNavigate?.("roles:edit", role)
                      }
                      role="button"
                      tabIndex={0}
                    >
                      <div className="dashboardListPrimary">
                        <span className="dashboardListName">{role?.name || "—"}</span>
                        <span className="dashboardListMeta">
                          {t("dashboard.priority")} {Number(role?.priority) ?? "—"} ·{" "}
                          {Number(role?.usersCount) ?? 0} {t("dashboard.usersCount")}
                        </span>
                      </div>
                      {role?.color && (
                        <span
                          className="dashboardRoleDot"
                          style={{ background: `#${String(role.color).replace(/^#/, "")}` }}
                          aria-hidden
                        />
                      )}
                      <ChevronRight size={16} className="dashboardListChevron" />
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {/* Empty state when no lists */}
          {!loading && canSeeEmployees && canSeeRoles && recentEmployees.length === 0 && recentRoles.length === 0 && (
            <section className="dashboardSection dashboardEmpty">
              <div className="dashboardEmptyIcon">
                <Briefcase size={40} />
              </div>
              <p className="dashboardEmptyText">{t("dashboard.noEmployeesOrRoles")}</p>
              <p className="dashboardEmptySub">{t("dashboard.noEmployeesOrRolesSub")}</p>
              <div className="dashboardEmptyActions">
                <button
                  type="button"
                  className="dashboardBtn dashboardBtn--primary"
                  onClick={() => onNavigate?.("employees:create")}
                >
                  {t("dashboard.addEmployee")}
                </button>
                <button
                  type="button"
                  className="dashboardBtn dashboardBtn--secondary"
                  onClick={() => onNavigate?.("roles:create")}
                >
                  {t("dashboard.createRole")}
                </button>
              </div>
            </section>
          )}

          </div>

          {/* Right column: Calendar, Birthdays, Team */}
          <div className="dashboardAsideColumn">
            {/* Calendar — dark mode */}
            <div className="dashboardCalendarBlock">
              <div className="dashboardCalendarHeader">
                <button
                  type="button"
                  className="dashboardCalendarNav"
                  onClick={() => {
                    setCalendarDirection("prev");
                    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
                  }}
                  aria-label={t("dashboard.previousMonth")}
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="dashboardCalendarTitle">
                  {calendarMonth.toLocaleDateString(undefined, { month: "short", year: "numeric" })}
                </span>
                <button
                  type="button"
                  className="dashboardCalendarNav"
                  onClick={() => {
                    setCalendarDirection("next");
                    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
                  }}
                  aria-label={t("dashboard.nextMonth")}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
              <div className="dashboardCalendarWeekdays">
                {["dashboard.weekdaySun", "dashboard.weekdayMon", "dashboard.weekdayTue", "dashboard.weekdayWed", "dashboard.weekdayThu", "dashboard.weekdayFri", "dashboard.weekdaySat"].map((key) => (
                  <span key={key} className="dashboardCalendarWeekday">{t(key)}</span>
                ))}
              </div>
              <div
                className={`dashboardCalendarGridWrap dashboardCalendarGridWrap--${calendarDirection}`}
                key={calendarMonth.getTime()}
              >
                <div className="dashboardCalendarGrid">
                  {calendarDays.map((cell, i) => (
                    <span
                      key={i}
                      className={`dashboardCalendarDay ${!cell.isCurrentMonth ? "dashboardCalendarDay--other" : ""} ${cell.isToday ? "dashboardCalendarDay--today" : ""}`}
                    >
                      {cell.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Birthday card: show loading until data ready, then today + upcoming */}
              <div className="dashboardBirthdaysBlock dashboardBirthdaysBlock--card">
                {loadingLists ? (
                  <div className="dashboardBirthdayLoading" aria-busy="true">
                    <Cake size={20} className="dashboardBirthdayLoadingIcon" aria-hidden />
                    <p className="dashboardBirthdayLoadingText">{t("dashboard.loadingBirthdays")}</p>
                  </div>
                ) : (
                <>
                  {birthdaysToday.length > 0 && (() => {
                    const emp = birthdaysToday[0];
                    const photoUrl = emp?.uploads?.employeePhotoUrl ?? emp?.uploads?.employeePhoto ?? null;
                    const hasPhoto = photoUrl && typeof photoUrl === "string";
                    const initial = (emp?.name || "—").charAt(0).toUpperCase();
                    const dob = emp?.dob;
                    const birthdayLabel = dob
                      ? new Date(dob).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
                      : "—";
                    return (
                      <div className="dashboardBirthdayHappy">
                        <div className="dashboardBirthdayHappyHeader">
                          <Cake size={18} className="dashboardBirthdayHappyHeaderIcon" aria-hidden />
                          <span>{t("dashboard.happyBirthday")}</span>
                        </div>
                        <div
                          className="dashboardBirthdayHappyPerson"
                          onClick={() => onNavigate?.("employees:profile", emp)}
                          onKeyDown={(e) =>
                            (e.key === "Enter" || e.key === " ") && onNavigate?.("employees:profile", emp)
                          }
                          role="button"
                          tabIndex={0}
                        >
                          <div className="dashboardBirthdayHappyAvatar">
                            <div className="dashboardBirthdayHappyAvatarInner">
                              {hasPhoto ? (
                                <img
                                  src={photoUrl}
                                  alt=""
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                    const fb = e.currentTarget.nextElementSibling;
                                    if (fb) fb.removeAttribute("aria-hidden");
                                  }}
                                />
                              ) : null}
                              <span className="dashboardBirthdayHappyInitial" aria-hidden={hasPhoto}>
                                {initial}
                              </span>
                            </div>
                          </div>
                          <span className="dashboardBirthdayHappyName">{emp?.name || "—"}</span>
                          <span className="dashboardBirthdayHappyDate">{birthdayLabel}</span>
                        </div>
                      </div>
                    );
                  })()}
                  <div className="dashboardBirthdayUpcoming">
                    <div className="dashboardBirthdayUpcomingHeader">{t("dashboard.upcomingBirthday")}</div>
                    {upcomingBirthday ? (
                      <div
                        className="dashboardBirthdayUpcomingPerson"
                        onClick={() => onNavigate?.("employees:profile", upcomingBirthday.employee)}
                        onKeyDown={(e) =>
                          (e.key === "Enter" || e.key === " ") &&
                          onNavigate?.("employees:profile", upcomingBirthday.employee)
                        }
                        role="button"
                        tabIndex={0}
                      >
                        <div className="dashboardBirthdayUpcomingAvatar">
                          {(() => {
                            const emp = upcomingBirthday.employee;
                            const photoUrl = emp?.uploads?.employeePhotoUrl ?? emp?.uploads?.employeePhoto ?? null;
                            const hasPhoto = photoUrl && typeof photoUrl === "string";
                            const initial = (emp?.name || "—").charAt(0).toUpperCase();
                            return hasPhoto ? (
                              <img
                                src={photoUrl}
                                alt=""
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                  const fb = e.currentTarget.nextElementSibling;
                                  if (fb) fb.removeAttribute("aria-hidden");
                                }}
                              />
                            ) : null;
                          })()}
                          <span
                            className="dashboardBirthdayUpcomingInitial"
                            aria-hidden={!!(upcomingBirthday.employee?.uploads?.employeePhotoUrl ?? upcomingBirthday.employee?.uploads?.employeePhoto)}
                          >
                            {(upcomingBirthday.employee?.name || "—").charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="dashboardBirthdayUpcomingInfo">
                          <span className="dashboardBirthdayUpcomingName">
                            {upcomingBirthday.employee?.name || "—"}
                          </span>
                          <span className="dashboardBirthdayUpcomingDate">
                            {upcomingBirthday.date.toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="dashboardBirthdayUpcomingEmpty">{t("dashboard.noUpcomingBirthdays")}</p>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="dashboardPresenceBlock">
              <div className="dashboardPresenceTitle">
                <User size={16} />
                <span>{t("dashboard.team")}</span>
              </div>
              <Tippy {...tippyViewUser}>
                <div
                  className="dashboardPresenceCurrent dashboardPresenceCurrent--clickable"
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    onNavigate?.(
                      "employees:profile",
                      currentUserEmployee ?? { viewMe: true }
                    )
                  }
                  onKeyDown={(e) =>
                    (e.key === "Enter" || e.key === " ") &&
                    onNavigate?.(
                      "employees:profile",
                      currentUserEmployee ?? { viewMe: true }
                    )
                  }
                >
                  <div className="dashboardPresenceAvatarWrap">
                    {currentUserPhotoUrl ? (
                      <img
                        src={currentUserPhotoUrl}
                        alt=""
                        className="dashboardPresenceAvatar"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          const fallback = e.currentTarget.nextElementSibling;
                          if (fallback) fallback.removeAttribute("aria-hidden");
                        }}
                      />
                    ) : null}
                    <span
                      className="dashboardPresenceAvatarInitial"
                      aria-hidden={!!currentUserPhotoUrl}
                    >
                      {(userName || "U").charAt(0).toUpperCase()}
                    </span>
                    <span className="dashboardPresenceDot dashboardPresenceDot--online dashboardPresenceDot--badge" aria-hidden />
                  </div>
                  <div className="dashboardPresenceCurrentText">
                    <span className="dashboardPresenceName">{userName}</span>
                    <span className="dashboardPresenceRole">{roleName}</span>
                  </div>
                  {currentUserRating != null && (
                    <Tippy content={t("dashboard.ratingLabel").replace("{{rating}}", String(currentUserRating))} animation="shift-away" placement="top" delay={[200, 0]}>
                      <span className="dashboardPresenceRating">
                        <Star size={12} className="dashboardPresenceStar" fill="currentColor" />
                        {currentUserRating}
                      </span>
                    </Tippy>
                  )}
                </div>
              </Tippy>
              <ul className="dashboardPresenceList">
                {presenceSortedEmployees
                  .filter((e) => String(e?._id) !== myId)
                  .map((emp) => {
                    const id = String(emp?._id ?? "");
                    const online = onlineUserIds.has(id);
                    const photoUrl = emp?.uploads?.employeePhotoUrl ?? emp?.uploads?.employeePhoto ?? null;
                    const hasPhoto = photoUrl && typeof photoUrl === "string";
                    const initial = (emp?.name || "—").charAt(0).toUpperCase();
                    return (
                      <Tippy key={emp?._id} {...tippyViewUser}>
                        <li
                          className="dashboardPresenceItem dashboardPresenceItem--clickable"
                          onClick={() => onNavigate?.("employees:profile", emp)}
                          onKeyDown={(e) =>
                            (e.key === "Enter" || e.key === " ") && onNavigate?.("employees:profile", emp)
                          }
                          role="button"
                          tabIndex={0}
                        >
                        <div className="dashboardPresenceAvatarWrap">
                          {hasPhoto ? (
                            <img
                              src={photoUrl}
                              alt=""
                              className="dashboardPresenceAvatar"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                                const fb = e.currentTarget.nextElementSibling;
                                if (fb) fb.removeAttribute("aria-hidden");
                              }}
                            />
                          ) : null}
                          <span
                            className="dashboardPresenceAvatarInitial"
                            aria-hidden={hasPhoto}
                          >
                            {initial}
                          </span>
                          <span
                            className={`dashboardPresenceDot dashboardPresenceDot--badge ${online ? "dashboardPresenceDot--online" : "dashboardPresenceDot--offline"}`}
                            aria-hidden
                          />
                        </div>
                        <div className="dashboardPresenceItemText">
                          <span className="dashboardPresenceName">{emp?.name || "—"}</span>
                          <span className="dashboardPresenceMeta">{emp?.roleId?.name ?? emp?.role?.name ?? emp?.jobTitle ?? "—"}</span>
                          {allUserViews[id]?.viewLabel ? (
                            <Tippy content={t("dashboard.viewingLabel").replace("{{label}}", allUserViews[id].viewLabel)} animation="shift-away" placement="top" delay={[200, 0]}>
                              <span className="dashboardPresencePage">
                                {allUserViews[id].viewLabel}
                              </span>
                            </Tippy>
                          ) : null}
                        </div>
                        {emp?.rating != null && Number(emp.rating) >= 0.5 && (
                          <Tippy content={t("dashboard.ratingLabel").replace("{{rating}}", String(Number(emp.rating)))} animation="shift-away" placement="top" delay={[200, 0]}>
                            <span className="dashboardPresenceRating">
                              <Star size={12} className="dashboardPresenceStar" fill="currentColor" />
                              {Number(emp.rating)}
                            </span>
                          </Tippy>
                        )}
                        </li>
                      </Tippy>
                    );
                  })}
              </ul>
              {presenceSortedEmployees.filter((e) => String(e?._id) !== myId).length === 0 && (
                <p className="dashboardPresenceEmpty">{t("dashboard.noOtherEmployees")}</p>
              )}
            </div>

            {/* Best delivery representatives — compact block below Team, tabs + show all inside card */}
            {canViewDrivers && (
              <div className="dashboardTopDriversBlock">
                <div className="dashboardTopDriversBlockCard">
                  <h3 className="dashboardTopDriversBlockTitle">{t("dashboard.topDrivers")}</h3>
                  <div className="dashboardTopDriversBlockToolbar">
                    <div className="dashboardTopDriversTabs">
                      <button
                        type="button"
                        className={`dashboardTopDriversTab ${topDriversMode === "earnings" ? "dashboardTopDriversTab--active" : ""}`}
                        onClick={() => {
                          if (topDriversMode === "earnings") return;
                          setTopDriversMode("earnings");
                          setLoadingTopDrivers(true);
                          driversStatsReqIdRef.current = rid();
                          window.api?.wsSend?.({ type: "drivers:stats", requestId: driversStatsReqIdRef.current });
                        }}
                        disabled={loadingTopDrivers}
                        aria-pressed={topDriversMode === "earnings"}
                      >
                        {t("dashboard.earnings")}
                      </button>
                      <button
                        type="button"
                        className={`dashboardTopDriversTab ${topDriversMode === "orders" ? "dashboardTopDriversTab--active" : ""}`}
                        onClick={() => {
                          if (topDriversMode === "orders") return;
                          setTopDriversMode("orders");
                          setLoadingTopDrivers(true);
                          driversStatsReqIdRef.current = rid();
                          window.api?.wsSend?.({ type: "drivers:stats", requestId: driversStatsReqIdRef.current });
                        }}
                        disabled={loadingTopDrivers}
                        aria-pressed={topDriversMode === "orders"}
                      >
                        {t("dashboard.orders")}
                      </button>
                    </div>
                    <button
                      type="button"
                      className="dashboardTopDriversShowAll"
                      onClick={() => onNavigate?.("drivers")}
                    >
                      {t("dashboard.showAllDrivers")}
                    </button>
                  </div>
                  <div className="dashboardTopDriversCard">
                    {loadingTopDrivers ? (
                      <ul className="dashboardTopDriversList" aria-busy="true" aria-label={t("common.loading")}>
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                          <li key={i} className="dashboardTopDriversItem dashboardTopDriversItem--skeleton">
                            <div className="dashboardTopDriversRow dashboardTopDriversRow--skeleton">
                              <div className="dashboardTopDriversAvatar dashboardTopDriversAvatar--skeleton" />
                              <div className="dashboardTopDriversInfo">
                                <span className="dashboardTopDriversSkeletonLine dashboardTopDriversSkeletonName" />
                                <span className="dashboardTopDriversSkeletonLine dashboardTopDriversSkeletonPhone" />
                              </div>
                              <span className="dashboardTopDriversBadge dashboardTopDriversBadge--skeleton" />
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (topDriversMode === "earnings" ? (driverStats?.topByEarnings?.length ?? 0) : (driverStats?.topByOrders?.length ?? 0)) === 0 ? (
                      <div className="dashboardTopDriversEmpty">{t("dashboard.noDriversYet")}</div>
                    ) : (
                      <ul className="dashboardTopDriversList dashboardTopDriversList--enter" aria-label={t("dashboard.topDrivers")}>
                        {(topDriversMode === "earnings"
                          ? (driverStats?.topByEarnings ?? [])
                          : (driverStats?.topByOrders ?? [])
                        ).map((d) => (
                          <li key={d.id || d.serial} className="dashboardTopDriversItem">
                            <button
                              type="button"
                              className="dashboardTopDriversRow"
                              onClick={() => onNavigate?.("drivers:profile", d)}
                              onContextMenu={
                                onOpenDriverContextMenu
                                  ? (event) => onOpenDriverContextMenu(event, d)
                                  : undefined
                              }
                            >
                              <div className="dashboardTopDriversAvatar">
                                <img
                                  src={getAssetUrl("assets/avatar-fallback.webp")}
                                  alt=""
                                  className="dashboardTopDriversAvatarImg"
                                />
                              </div>
                              <div className="dashboardTopDriversInfo">
                                <span className="dashboardTopDriversName">{d.name || "—"}</span>
                                <span className="dashboardTopDriversPhone">{d.phone || "—"}</span>
                              </div>
                              <AnimatedDriverBadge
                                value={topDriversMode === "earnings" ? (d.totalEarnings ?? 0) : (d.totalOrders ?? 0)}
                                driverKey={String(d.id ?? d.serial ?? d.phone ?? "")}
                                mode={topDriversMode}
                              />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Top stores — same layout as Top Drivers, below it */}
            {canViewStores && (
              <div className="dashboardTopDriversBlock">
                <div className="dashboardTopDriversBlockCard">
                  <h3 className="dashboardTopDriversBlockTitle">{t("dashboard.topStores")}</h3>
                  <div className="dashboardTopDriversBlockToolbar">
                    <div className="dashboardTopDriversTabs">
                      <button
                        type="button"
                        className={`dashboardTopDriversTab ${storeRankingSort === "totalEarning" ? "dashboardTopDriversTab--active" : ""}`}
                        onClick={() => {
                          if (storeRankingSort === "totalEarning") return;
                          setStoreRankingSort("totalEarning");
                          setLoadingStoreRanking(true);
                          storeRankingReqIdRef.current = rid();
                          window.api?.wsSend?.({
                            type: "stores:list",
                            requestId: storeRankingReqIdRef.current,
                            payload: { page: 1, pageSize: 10, sortBy: "totalEarning", sortDir: "desc" },
                          });
                        }}
                        disabled={loadingStoreRanking}
                        aria-pressed={storeRankingSort === "totalEarning"}
                      >
                        {t("dashboard.earnings")}
                      </button>
                      <button
                        type="button"
                        className={`dashboardTopDriversTab ${storeRankingSort === "balance" ? "dashboardTopDriversTab--active" : ""}`}
                        onClick={() => {
                          if (storeRankingSort === "balance") return;
                          setStoreRankingSort("balance");
                          setLoadingStoreRanking(true);
                          storeRankingReqIdRef.current = rid();
                          window.api?.wsSend?.({
                            type: "stores:list",
                            requestId: storeRankingReqIdRef.current,
                            payload: { page: 1, pageSize: 10, sortBy: "balance", sortDir: "desc" },
                          });
                        }}
                        disabled={loadingStoreRanking}
                        aria-pressed={storeRankingSort === "balance"}
                      >
                        {t("dashboard.orders")}
                      </button>
                    </div>
                    <button
                      type="button"
                      className="dashboardTopDriversShowAll"
                      onClick={() => onNavigate?.("stores")}
                    >
                      {t("dashboard.viewAllStores")}
                    </button>
                  </div>
                  <div className="dashboardTopDriversCard">
                    {loadingStoreRanking && storeRanking.length === 0 ? (
                      <ul className="dashboardTopDriversList" aria-busy="true" aria-label={t("common.loading")}>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                          <li key={i} className="dashboardTopDriversItem dashboardTopDriversItem--skeleton">
                            <div className="dashboardTopDriversRow dashboardTopDriversRow--skeleton">
                              <div className="dashboardTopDriversAvatar dashboardTopDriversAvatar--skeleton" />
                              <div className="dashboardTopDriversInfo">
                                <span className="dashboardTopDriversSkeletonLine dashboardTopDriversSkeletonName" />
                                <span className="dashboardTopDriversSkeletonLine dashboardTopDriversSkeletonPhone" />
                              </div>
                              <span className="dashboardTopDriversBadge dashboardTopDriversBadge--skeleton" />
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : storeRanking.length === 0 ? (
                      <div className="dashboardTopDriversEmpty">{t("dashboard.noStoresYet")}</div>
                    ) : (
                      <ul className="dashboardTopDriversList dashboardTopDriversList--enter" aria-label={t("dashboard.topStores")}>
                        {storeRanking.map((store, index) => {
                          const value = storeRankingSort === "balance"
                            ? (Number(store.balance) || 0)
                            : (Number(store.totalEarning) || 0);
                          const name = store.storeName || "—";
                          const subtitle = store.location || store.storeType || "—";
                          const storeKey = String(store.id ?? store._id ?? index);
                          const mode = storeRankingSort === "balance" ? "orders" : "earnings";
                          const imgSrc = store.storeImage
                            ? (/^(https?:)?\//.test(store.storeImage) ? store.storeImage : getAssetUrl(store.storeImage))
                            : getAssetUrl("assets/avatar-fallback.webp");
                          return (
                            <li key={store.id || store._id || index} className="dashboardTopDriversItem">
                              <button
                                type="button"
                                className="dashboardTopDriversRow"
                                onClick={() => onNavigate?.("stores:profile", store)}
                              >
                                <div className="dashboardTopDriversAvatar">
                                  <img
                                    src={imgSrc}
                                    alt=""
                                    className="dashboardTopDriversAvatarImg"
                                    onError={(e) => {
                                      const el = e.currentTarget;
                                      if (el.src !== getAssetUrl("assets/avatar-fallback.webp"))
                                        el.src = getAssetUrl("assets/avatar-fallback.webp");
                                    }}
                                  />
                                </div>
                                <div className="dashboardTopDriversInfo">
                                  <span className="dashboardTopDriversName">{name}</span>
                                  <span className="dashboardTopDriversPhone">{subtitle}</span>
                                </div>
                                <AnimatedStoreBadge
                                  value={value}
                                  storeKey={storeKey}
                                  mode={mode}
                                />
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        ) : (
          <div className="dashboardMainPlaceholder" aria-hidden>
            <LayoutDashboard size={22} />
            <span>{t("dashboard.loadingDashboard")}</span>
          </div>
        )}
      </main>
    </div>
  );
}

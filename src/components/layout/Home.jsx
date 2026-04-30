// Home.jsx (UPDATED)
import React, { useCallback, useEffect, useMemo, useRef, useState, startTransition } from "react";
import { createPortal } from "react-dom";
import Sidebar from "../SideBar";
import "../../styles/home.css";
import { useNotification } from "../NotificationProvider";
import { useLanguage } from "../../contexts/LanguageContext";

import Dashboard from "../../pages/Dashboard/Dashboard";
import CreateEmployee from "../pages/sub_page/Create_Employee";
import EmployeesList from "../pages/sub_page/Employee_List";
import EmployeeProfile from "../pages/sub_page/Employee_Profile";

import CreateRole from "../../pages/Roles/Create_Role";
import RolesList from "../../pages/Roles/Role_List";
import SettingsHome from "../../pages/Settings/Settings";
import AuditLogs from "../../pages/AuditLogs/Audit_Logs";
import HolidaysAsk from "../../pages/Holidays/Holidays_Ask";
import HolidayList from "../../pages/Holidays/Holiday_List";
import HolidayCalendar from "../../pages/Holidays/Holiday_Calendar";
import NotificationsPage from "../../pages/Notification/Notifications";
import HotSend from "../../pages/HotSend/Hot_Send";
import SubmitReport from "../pages/sub_page/Submit_Report";
import ReportsList from "../pages/sub_page/Reports_List";
import Transactions from "../../pages/Transactions/Transactions";
import DeviceManagement from "../../pages/Devies/Device_Management";
import ActionHeatmap from "../../pages/ActionHeatmap/Action_Heatmap";
import SystemPerformance from "../../pages/SystemPerformance/System_Performance";
import LoginAttempts from "../../pages/LoginAttempts/Login_Attempts";
import SuggestList from "../pages/sub_page/Suggest_List";
import NewSuggest from "../pages/sub_page/New_Suggest";
import Drivers from "../pages/sub_page/Drivers";
import DriverProfile from "../pages/sub_page/Driver_Profile";
import Stores from "../pages/sub_page/Stores";
import StoreProfile from "../pages/sub_page/Store_Profile";
import CashoutList from "../pages/sub_page/Cashout_List";
import PendingCashout from "../pages/sub_page/Pending_Cashout";
import Gaming from "../pages/sub_page/Gaming";
import Chat from "../../pages/Chat/Chat";
import Sync from "../pages/sub_page/Sync";
import Documents from "../../pages/Documents/Documents";
import Storage from "../../pages/Storage/Storage";
import Vaults from "../../pages/Vaults/Vaults";
import Recordings from "../../pages/Recordings/Recordings";
import DataEntry from "../pages/sub_page/DataEntry";
import EmployeeCashoutForm from "../cashout/EmployeeCashoutForm";
import DriverCashoutForm from "../cashout/DriverCashoutForm";
import StoreCashoutForm from "../cashout/StoreCashoutForm";
import OtherCashoutForm from "../cashout/OtherCashoutForm";
import DriverCashInForm from "../cashin/DriverCashInForm";
import OtherCashInForm from "../cashin/OtherCashInForm";
import WalletAdjustForm from "../wallet/WalletAdjustForm";
import DriverContextMenu from "../ui/DriverContextMenu";
import { hasPermission } from "../../helpers/permissions";
import { getAssetUrl } from "../../utils/publicUrl";
import "../../styles/pages/cashout/create_cashout.css";
import AIChatPanel from "../AIChatPanel";
import GlobalChatPanel from "../GlobalChatPanel";
import { Users, X, Wallet, ArrowDownCircle, HelpCircle, Megaphone } from "lucide-react";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";
import "tippy.js/animations/shift-away.css";
import {
  getDisabledSectionKeys,
  getSectionDefinition,
  getSectionKeyForPage,
  isPageDisabledBySections,
} from "../../config/sections";

const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export default function Home({ account, onActivePageChange, lostPermissionRouted, onHomeReady }) {
  const notify = useNotification();
  const { t, setServerTranslationsFromSettings } = useLanguage();
  const [activePage, setActivePage] = useState("dashboard");
  const initialHomeReadySentRef = useRef(false);

  const handleInitialHomeReady = useCallback(() => {
    if (initialHomeReadySentRef.current) return;
    initialHomeReadySentRef.current = true;
    onHomeReady?.();
  }, [onHomeReady]);

  const [editingEmployee, setEditingEmployee] = useState(null);
  const [editingRole, setEditingRole] = useState(null);
  const [profileEmployee, setProfileEmployee] = useState(null);
  const [profileDriver, setProfileDriver] = useState(null);
  const [profileStore, setProfileStore] = useState(null);
  const [currentUserEmployee, setCurrentUserEmployee] = useState(null);
  const [newHolidayModal, setNewHolidayModal] = useState(null);
  const [holidaysListPayload, setHolidaysListPayload] = useState({});
  const [hotModal, setHotModal] = useState(null);
  const [hotModalExiting, setHotModalExiting] = useState(false);
  const hotModalRef = useRef(null);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const unreadCountRequestIdRef = useRef(null);
  const [pendingCashoutCount, setPendingCashoutCount] = useState(0);
  const pendingCashoutCountRequestIdRef = useRef(null);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const chatUnreadCountRequestIdRef = useRef(null);
  const [chatNavigationIntent, setChatNavigationIntent] = useState(null);

  const perms = (() => {
    const p = account?.role?.permissions;
    if (Array.isArray(p)) return p;
    if (p != null && p !== "") return [String(p)];
    return [];
  })();
  const canViewReports = perms.includes("*") || perms.includes("reports.view");
  const canViewSuggests = perms.includes("*") || perms.includes("suggests.view");
  const canViewSuggestsRef = useRef(canViewSuggests);
  canViewSuggestsRef.current = canViewSuggests;
  const canBypassMaintenance = perms.includes("*") || perms.includes("maintenance.manage");
  const canLockAccount = perms.includes("*") || perms.includes("account.unlock");
  const canViewPendingCashout = perms.includes("*") || perms.includes("cashout.viewPending");
  const canOverrideDisabledSections = perms.includes("*") || perms.includes("sections.override");
  const canViewDrivers = hasPermission(account, "drivers.view");
  const canCreateDriverCashout = hasPermission(account, "cashout.create.driver");
  const canCreateDriverCashIn = hasPermission(account, "cashin.create");

  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [securityAlertModal, setSecurityAlertModal] = useState(null);
  const [securityAlertExiting, setSecurityAlertExiting] = useState(false);
  const securityAlertExitTimerRef = useRef(null);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const maintenanceRequestIdRef = useRef(null);
  const analyticsFeatureSentRef = useRef({});
  const [showIdleModal, setShowIdleModal] = useState(false);
  const [idleModalExiting, setIdleModalExiting] = useState(false);
  const idleTimerRef = useRef(null);
  const idleExitTimerRef = useRef(null);
  const [viewers, setViewers] = useState([]);
  const [allUserViews, setAllUserViews] = useState({}); // userId -> { page, contextId, userName }
  const [viewersOpen, setViewersOpen] = useState(false);
  const [viewersPanelExiting, setViewersPanelExiting] = useState(false);

  const closeViewersPanel = useCallback(() => {
    setViewersOpen(false);
    setViewersPanelExiting(true);
  }, []);

  useEffect(() => {
    if (!viewersPanelExiting) return;
    const t = setTimeout(() => setViewersPanelExiting(false), 220);
    return () => clearTimeout(t);
  }, [viewersPanelExiting]);
  const [aiAssistantEnabled, setAiAssistantEnabled] = useState(true);
  const [appSettings, setAppSettings] = useState(null);
  const [disabledSectionModal, setDisabledSectionModal] = useState(null);
  const [disabledSectionModalExiting, setDisabledSectionModalExiting] = useState(false);
  const [createCashoutModal, setCreateCashoutModal] = useState(null);
  const [createCashoutModalExiting, setCreateCashoutModalExiting] = useState(false);
  const createCashoutModalRef = useRef(null);
  const [cashInModal, setCashInModal] = useState(null);
  const [cashInModalExiting, setCashInModalExiting] = useState(false);
  const cashInModalRef = useRef(null);
  const [walletAdjustModal, setWalletAdjustModal] = useState(null);
  const [walletAdjustModalExiting, setWalletAdjustModalExiting] = useState(false);
  const walletAdjustModalRef = useRef(null);
  const [driverContextMenu, setDriverContextMenu] = useState({
    open: false,
    x: 0,
    y: 0,
    driver: null,
  });
  const [helpOpen, setHelpOpen] = useState(false);
  const [globalChatOpen, setGlobalChatOpen] = useState(false);
  const [helpPanelExiting, setHelpPanelExiting] = useState(false);
  const [impersonationBusy, setImpersonationBusy] = useState(false);
  const settingsRequestIdRef = useRef(null);
  const activePageRef = useRef(activePage);
  const appFocusedRef = useRef(typeof document !== "undefined" ? document.hasFocus() : true);
  const disabledSectionModalTimerRef = useRef(null);
  const chatRingtoneRef = useRef(null);

  const IDLE_MS = 15 * 60 * 1000; // 15 min
  const impersonation = account?.impersonation?.active ? account.impersonation : null;
  const impersonationStartedLabel = useMemo(() => {
    if (!impersonation?.startedAt) return null;
    const d = new Date(impersonation.startedAt);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  }, [impersonation?.startedAt]);

  const playChatRingtone = useCallback(() => {
    if (!chatRingtoneRef.current) {
      chatRingtoneRef.current = new Audio(getAssetUrl("assets/sounds/chat-notification.mp3"));
      chatRingtoneRef.current.preload = "auto";
      chatRingtoneRef.current.volume = 0.55;
    }
    try {
      chatRingtoneRef.current.currentTime = 0;
      chatRingtoneRef.current.play().catch(() => {});
    } catch {
      // ignore playback restrictions/errors
    }
  }, []);

  useEffect(() => {
    if (!helpPanelExiting) return;
    const t = setTimeout(() => setHelpPanelExiting(false), 220);
    return () => clearTimeout(t);
  }, [helpPanelExiting]);

  useEffect(() => {
    if (activePage === "chat") setGlobalChatOpen(false);
  }, [activePage]);

  useEffect(() => {
    onActivePageChange?.(activePage);
  }, [activePage, onActivePageChange]);

  useEffect(() => {
    activePageRef.current = activePage;
  }, [activePage]);

  useEffect(() => {
    function syncFocusState() {
      if (typeof document === "undefined") return;
      const focused = document.visibilityState === "visible" && document.hasFocus();
      appFocusedRef.current = focused;
    }

    syncFocusState();
    window.addEventListener("focus", syncFocusState);
    window.addEventListener("blur", syncFocusState);
    document.addEventListener("visibilitychange", syncFocusState);

    return () => {
      window.removeEventListener("focus", syncFocusState);
      window.removeEventListener("blur", syncFocusState);
      document.removeEventListener("visibilitychange", syncFocusState);
    };
  }, []);

  useEffect(() => {
    if (!account || !window.api?.wsSend) return;
    const requestId = rid();
    const unsub = window.api.onWsMessage?.((msg) => {
      if (msg?.type === "translations:get:result" && msg?.requestId === requestId && msg?.ok && msg?.translations) {
        setServerTranslationsFromSettings(msg.translations);
      }
    });
    window.api.wsConnect?.().then(() => {
      window.api.wsSend?.({ type: "translations:get", requestId });
    });
    return () => unsub?.();
  }, [account, setServerTranslationsFromSettings]);

  useEffect(() => {
    if (lostPermissionRouted) setActivePage("dashboard");
  }, [lostPermissionRouted]);

  const showSectionDisabledModal = useCallback((pageId) => {
    const sectionKey = getSectionKeyForPage(pageId);
    const section = getSectionDefinition(sectionKey);
    setDisabledSectionModal({
      pageId,
      title: section ? t(section.titleKey) : t("settings.sections"),
    });
    setDisabledSectionModalExiting(false);
  }, [t]);

  const closeDisabledSectionModal = useCallback(() => {
    setDisabledSectionModalExiting(true);
    if (disabledSectionModalTimerRef.current) clearTimeout(disabledSectionModalTimerRef.current);
    disabledSectionModalTimerRef.current = setTimeout(() => {
      setDisabledSectionModal(null);
      setDisabledSectionModalExiting(false);
      disabledSectionModalTimerRef.current = null;
    }, 280);
  }, []);

  useEffect(() => {
    return () => {
      if (disabledSectionModalTimerRef.current) clearTimeout(disabledSectionModalTimerRef.current);
    };
  }, []);

  const disabledSectionKeys = useMemo(() => getDisabledSectionKeys(appSettings), [appSettings]);

  useEffect(() => {
    if (canOverrideDisabledSections) return;
    if (!activePage || activePage === "dashboard") return;
    if (!isPageDisabledBySections(appSettings, activePage)) return;
    showSectionDisabledModal(activePage);
    startTransition(() => setActivePage("dashboard"));
  }, [activePage, appSettings, canOverrideDisabledSections, showSectionDisabledModal]);

  function refetchUnreadCount() {
    if (!window.api?.wsSend) return;
    const reqId = rid();
    unreadCountRequestIdRef.current = reqId;
    window.api.wsSend({
      type: "notification:unread-count",
      requestId: reqId,
      payload: {},
    });
  }

  function refetchPendingCashoutCount() {
    if (!window.api?.wsSend || !canViewPendingCashout) return;
    const reqId = rid();
    pendingCashoutCountRequestIdRef.current = reqId;
    window.api.wsSend({
      type: "cashout:pending-count",
      requestId: reqId,
    });
  }

  function refetchChatUnreadCount() {
    if (!window.api?.wsSend) return;
    const reqId = rid();
    chatUnreadCountRequestIdRef.current = reqId;
    window.api.wsSend({
      type: "chat:unread-count",
      requestId: reqId,
    });
  }
  const canViewProfile = perms.includes("*") || perms.includes("employees.view") || perms.includes("users.view");
  const canManageHolidays = perms.includes("*") || perms.includes("holiday.manage");

  useEffect(() => {
    const api = window.api;
    if (!api?.onWsMessage || !canManageHolidays) return;
    const unsub = api.onWsMessage((msg) => {
      if (msg?.type === "holiday:request_created") {
        setNewHolidayModal({
          holidayId: msg.holidayId,
          userName: msg.userName || "A colleague",
          userEmail: msg.userEmail,
          startDate: msg.startDate,
          endDate: msg.endDate,
          days: msg.days,
          reason: msg.reason,
        });
        const title = "New holiday request";
        const message = `${msg.userName || "A colleague"} is asking for holiday.`;
        api.wsSend?.({
          type: "notification:create",
          requestId: Math.random().toString(36).slice(2) + Date.now().toString(36),
          payload: { type: "holiday_request", title, message },
        });
      }
    });
    return () => unsub?.();
  }, [canManageHolidays]);

  useEffect(() => {
    if (!hotModalExiting || !hotModalRef.current) return;
    const el = hotModalRef.current;
    const onEnd = () => {
      setHotModal(null);
      setHotModalExiting(false);
    };
    el.addEventListener("animationend", onEnd, { once: true });
    return () => el.removeEventListener("animationend", onEnd);
  }, [hotModalExiting]);

  useEffect(() => {
    if (!createCashoutModalExiting || !createCashoutModalRef.current) return;
    const el = createCashoutModalRef.current;
    const onEnd = () => {
      setCreateCashoutModal(null);
      setCreateCashoutModalExiting(false);
    };
    el.addEventListener("animationend", onEnd, { once: true });
    return () => el.removeEventListener("animationend", onEnd);
  }, [createCashoutModalExiting]);

  useEffect(() => {
    if (!cashInModalExiting || !cashInModalRef.current) return;
    const el = cashInModalRef.current;
    const onEnd = () => {
      setCashInModal(null);
      setCashInModalExiting(false);
    };
    el.addEventListener("animationend", onEnd, { once: true });
    return () => el.removeEventListener("animationend", onEnd);
  }, [cashInModalExiting]);

  useEffect(() => {
    if (!walletAdjustModalExiting || !walletAdjustModalRef.current) return;
    const el = walletAdjustModalRef.current;
    const onEnd = () => {
      setWalletAdjustModal(null);
      setWalletAdjustModalExiting(false);
    };
    el.addEventListener("animationend", onEnd, { once: true });
    return () => el.removeEventListener("animationend", onEnd);
  }, [walletAdjustModalExiting]);

  useEffect(() => {
    const api = window.api;
    if (!api?.onWsMessage || !api?.wsSend) return;

    const maybeSystemNotify = (title, body) => {
      if (window.api?.desktopNotify) {
        window.api.desktopNotify(title, body).catch(() => {});
        return;
      }
      if (typeof Notification === "undefined") return;
      if (Notification.permission === "granted") {
        try {
          new Notification(title, { body, tag: "chat-message" });
        } catch (_) {}
        return;
      }
      if (Notification.permission === "default") {
        Notification.requestPermission().then((perm) => {
          if (perm === "granted") {
            try {
              new Notification(title, { body, tag: "chat-message" });
            } catch (_) {}
          }
        });
      }
    };

    const unsub = api.onWsMessage((msg) => {
      if (msg?.type === "notification:unread-count" && msg?.requestId === unreadCountRequestIdRef.current) {
        const n = typeof msg.count === "number" ? msg.count : 0;
        setUnreadNotificationCount(n >= 0 ? n : 0);
      }
      if (msg?.type === "notification:read:result" && msg?.ok && typeof msg?.unreadCount === "number") {
        setUnreadNotificationCount(msg.unreadCount >= 0 ? msg.unreadCount : 0);
      }
      if (msg?.type === "cashout:pending-count" && msg?.requestId === pendingCashoutCountRequestIdRef.current) {
        const n = typeof msg.count === "number" ? msg.count : 0;
        setPendingCashoutCount(n >= 0 ? n : 0);
      }
      if (msg?.type === "chat:unread-count" && (!msg?.requestId || msg?.requestId === chatUnreadCountRequestIdRef.current)) {
        const n = typeof msg.count === "number" ? msg.count : 0;
        setChatUnreadCount(n >= 0 ? n : 0);
      }
      if (msg?.type === "cashout:approve:result" && msg?.ok && canViewPendingCashout) {
        refetchPendingCashoutCount();
      }
      if (msg?.type === "cashout:rejectPending:result" && msg?.ok && canViewPendingCashout) {
        refetchPendingCashoutCount();
      }
      if (msg?.type === "cashout:create:result" && msg?.ok) {
        refetchUnreadCount();
        if (canViewPendingCashout) refetchPendingCashoutCount();
      }
      if (msg?.type === "cashout:pendingInvalidated" && canViewPendingCashout) {
        refetchPendingCashoutCount();
      }
      if (msg?.type === "notification:new" && msg?.notification) {
        const n = msg.notification;
        refetchUnreadCount();
        if (n.type === "cashin_created") return;
        const title = n.title || "Notification";
        const body = n.message ? `${n.title ? `${n.title}: ` : ""}${n.message}` : (n.title || "New notification");
        notify?.success?.(body, title);
      }
      if (msg?.type === "arqam:credit:low-balance-alert") {
        notify?.warning?.(
          msg?.message || `Credit balance is low (${msg?.creditBalance ?? 0}).`,
          msg?.title || "Arqam credit alert"
        );
      }
      if (msg?.type === "chat:message:new" && msg?.message) {
        const senderId = String(msg.message?.sender?._id ?? "");
        const isOwnMessage = senderId && String(account?.id ?? account?._id ?? "") === senderId;
        if (!isOwnMessage) {
          const conversationTitle = msg?.conversation?.title || "Chat";
          const previewText = msg?.message?.removed ? "Removed Message" : (msg?.message?.text || "New message");
          if (activePageRef.current !== "chat") {
            playChatRingtone();
          }
          if (!appFocusedRef.current || activePageRef.current !== "chat") {
            if (!msg?.message?.mentioned) {
              notify?.info?.(previewText, `New message - ${conversationTitle}`);
            }
          }
          if (!appFocusedRef.current) {
            if (!msg?.message?.mentioned) {
              maybeSystemNotify(`New message - ${conversationTitle}`, previewText);
            }
          }
        }
        refetchChatUnreadCount();
      }
      if (msg?.type === "chat:mention" && msg?.message) {
        const conversationTitle = msg?.conversation?.title || "Chat";
        const previewText = msg?.message?.removed ? "Removed Message" : (msg?.message?.text || "You were mentioned");
        notify?.warning?.(`@ ${previewText}`, `Mention - ${conversationTitle}`);
        if (!appFocusedRef.current) {
          maybeSystemNotify(`Mention - ${conversationTitle}`, previewText);
        }
        refetchChatUnreadCount();
      }
      if (
        msg?.type === "chat:conversation:left" ||
        msg?.type === "chat:message:removed" ||
        msg?.type === "chat:conversation:new" ||
        msg?.type === "chat:conversation:updated"
      ) {
        refetchChatUnreadCount();
      }
      if (msg?.type === "cashout:newRequest") {
        const from = msg.userName ? `${msg.userName}: ` : "";
        notify?.success?.(`${from}${msg.title || "New cashout request"}`, "New cashout request");
      }
      if (msg?.type === "cashout:requestDecided" || msg?.type === "cashout:cashed" || msg?.type === "cashout:rejected") {
        refetchUnreadCount();
      }
      if (msg?.type === "maintenance:get:result" && msg?.requestId === maintenanceRequestIdRef.current) {
        const enabled = msg.enabled === true;
        setMaintenanceEnabled(enabled);
        if (enabled && !canBypassMaintenance) setShowMaintenanceModal(true);
      }
      if (msg?.type === "maintenance:changed") {
        const enabled = msg.enabled === true;
        setMaintenanceEnabled(enabled);
        if (enabled && !canBypassMaintenance) setShowMaintenanceModal(true);
      }
      if (msg?.type === "settings:get:result" && msg?.requestId === settingsRequestIdRef.current && msg?.ok) {
        const nextSettings = msg.settings || {};
        setAppSettings(nextSettings);
        setAiAssistantEnabled(nextSettings?.features?.aiAssistantEnabled !== false);
      }
      if (msg?.type === "settings:changed") {
        if (msg?.settings) {
          setAppSettings(msg.settings);
          setAiAssistantEnabled(msg.settings?.features?.aiAssistantEnabled !== false);
        } else {
          settingsRequestIdRef.current = rid();
          api.wsSend?.({ type: "settings:get", requestId: settingsRequestIdRef.current });
        }
      }
      if (msg?.type === "report:new" && canViewReports) {
        notify?.success?.(msg.message ? `${msg.title}: ${msg.message}` : msg.title, msg.title);
        refetchUnreadCount();
      }
      if (msg?.type === "suggest:new" && canViewSuggestsRef.current) {
        notify?.success?.(msg.message ? `${msg.title}: ${msg.message}` : msg.title, msg.title);
        refetchUnreadCount();
      }
      if (msg?.type === "hot:deliver") {
        showHotItem({ title: msg.title, message: msg.message, deliveryType: msg.deliveryType, hotId: msg.hotId });
        api.wsSend?.({
          type: "notification:create",
          requestId: rid(),
          payload: { type: "hot", title: msg.title || "Notification", message: msg.message || null },
        });
        setTimeout(refetchUnreadCount, 400);
      }
      if (msg?.type === "hot:pending" && Array.isArray(msg.notifications) && msg.notifications.length > 0) {
        const count = msg.notifications.length;
        const summaryTitle = "Notifications";
        const summaryBody =
          count === 1
            ? "You have 1 unread notification."
            : `You have ${count} unread notifications.`;

        // For offline backlog, show one summary only (no hot modal / popup per item).
        notify?.success?.(summaryBody, summaryTitle);
        if (typeof Notification !== "undefined" && Notification.permission !== "denied") {
          if (Notification.permission === "granted") {
            try {
              new Notification(summaryTitle, { body: summaryBody, tag: "hot-pending-summary" });
            } catch (_) {}
          } else {
            Notification.requestPermission().then((p) => {
              if (p === "granted") {
                try {
                  new Notification(summaryTitle, { body: summaryBody, tag: "hot-pending-summary" });
                } catch (_) {}
              }
            });
          }
        }
        setTimeout(refetchUnreadCount, 400);
      }
      if (msg?.type === "security:loginOutsideRegion" && msg?.userId) {
        setSecurityAlertModal({
          userId: msg.userId,
          userName: msg.userName ?? "A user",
          workEmail: msg.workEmail ?? "",
          countryCode: msg.countryCode ?? "",
        });
      }
    });
    (async () => {
      try {
        await api.wsConnect();
        maintenanceRequestIdRef.current = rid();
        api.wsSend?.({ type: "maintenance:get", requestId: maintenanceRequestIdRef.current });
        settingsRequestIdRef.current = rid();
        api.wsSend?.({ type: "settings:get", requestId: settingsRequestIdRef.current });
        api.wsSend?.({ type: "hot:pending", requestId: rid() });
        refetchUnreadCount();
        refetchPendingCashoutCount();
        refetchChatUnreadCount();
      } catch (_) {}
    })();
    return () => unsub?.();
  }, [canViewReports, canViewSuggests, notify, canBypassMaintenance, canViewPendingCashout, account?.id, account?._id, playChatRingtone]);

  // Track feature usage for Action Heatmap (throttle per feature)
  useEffect(() => {
    if (!activePage || !window.api?.wsSend) return;
    const now = Date.now();
    const last = analyticsFeatureSentRef.current[activePage] || 0;
    if (now - last < 30000) return; // 30s per feature
    analyticsFeatureSentRef.current[activePage] = now;
    window.api.wsSend({ type: "analytics:feature", requestId: rid(), payload: { feature: activePage } });
  }, [activePage]);

  const routeLabels = useMemo(() => {
    const map = {
      dashboard: ["Home", "Dashboard"],
      chat: ["Home", "Chat"],
      "employees:list": ["Home", "Employees", "List"],
      "employees:create": ["Home", "Employees", "Create"],
      "employees:edit": ["Home", "Employees", "Edit"],
      "employees:profile": ["Home", "Employees", "Profile"],
      "roles:list": ["Home", "Roles", "List"],
      "roles:create": ["Home", "Roles", "Create"],
      "roles:edit": ["Home", "Roles", "Edit"],
      "settings:home": ["Home", "Settings"],
      "audit:list": ["Home", "Security & Audit", "Audit Logs"],
      loginAttempts: ["Home", "Security & Audit", "Login Attempts"],
      "holidays:ask": ["Home", "Holidays", "Request"],
      "holidays:list": ["Home", "Holidays", "List"],
      "holidays:calendar": ["Home", "Holidays", "Calendar"],
      notifications: ["Home", "Notifications"],
      "hot:send": ["Home", "Tools", "Hot notification"],
      "reports:submit": ["Home", "Reports", "Submit"],
      "reports:list": ["Home", "Reports", "List"],
      transactions: ["Home", "Transactions"],
      drivers: ["Home", "Drivers"],
      "drivers:profile": ["Home", "Drivers", "Profile"],
      stores: ["Home", "Stores"],
      "stores:profile": ["Home", "Stores", "Profile"],
      devices: ["Home", "Tools", "Device Management"],
      heatmap: ["Home", "Analytics", "Action Heatmap"],
      performance: ["Home", "Analytics", "System Performance"],
      "suggests:list": ["Home", "Suggests", "List"],
      "suggests:new": ["Home", "Suggests", "New"],
      "cashout:list": ["Home", "Cashout", "List"],
      "cashout:pending": ["Home", "Cashout", "Pending Cashout"],
      sync: ["Home", "Data", "Sync"],
      "dataentry:list": ["Home", "Data Entry", "List"],
      "dataentry:create": ["Home", "Data Entry", "Create"],
      documents: ["Home", "Documents"],
      storage: ["Home", "Storage"],
      vaults: ["Home", "Vaults"],
      recordings: ["Home", "Recordings"],
    };
    return map[activePage] || ["Home", activePage || "-"];
  }, [activePage]);

  const contextualHelp = useMemo(() => {
    const defaults = {
      title: routeLabels[routeLabels.length - 1] || "Page help",
      summary: "Use the left navigation to move between features. Data updates in real time.",
      tips: [
        "Hover action icons to preview what each action does.",
        "Most list pages support search and sorting from headers.",
        "Use Esc to quickly close dialogs and side panels.",
      ],
      actions: [],
    };

    const map = {
      dashboard: {
        title: "Dashboard",
        summary: "Monitor activity and jump into drivers, stores, and alerts quickly.",
        tips: [
          "Use summary cards as quick links into detailed pages.",
          "Right-click driver entries to open fast actions.",
          "Watch the viewers button to see who is on this page.",
        ],
        actions: [{ label: "Open Drivers", page: "drivers" }],
      },
      chat: {
        title: "Team Chat",
        summary: "Use direct or group chats for fast operational communication.",
        tips: [
          "Create direct chats for one-on-one communication.",
          "Use groups for teams and leave groups when no longer needed.",
          "Removed messages stay visible as 'Removed Message' for timeline clarity.",
        ],
        actions: [{ label: "Open Notifications", page: "notifications" }],
      },
      "employees:list": {
        title: "Employees",
        summary: "Manage employee accounts, profile access, and account controls.",
        tips: [
          "Use lock/unlock to control account access immediately.",
          "Use View as to impersonate another employee for troubleshooting.",
          "Click a row to open the employee profile.",
        ],
        actions: [{ label: "Create Employee", page: "employees:create" }],
      },
      drivers: {
        title: "Drivers",
        summary: "Browse drivers and open contextual actions from anywhere in the app.",
        tips: [
          "Right-click a driver to open cash in, cash out, or profile actions.",
          "Use filters to narrow by status and activity.",
          "Open profile pages for detailed history.",
        ],
        actions: [{ label: "Open Pending Cashout", page: "cashout:pending" }],
      },
      devices: {
        title: "Device Management",
        summary: "Track sessions and location snapshots per device.",
        tips: [
          "Use All devices view to inspect sessions across your team.",
          "Open Location history to review IP and country movement.",
          "Use Sign out to revoke suspicious sessions immediately.",
        ],
        actions: [{ label: "Open Login Attempts", page: "loginAttempts" }],
      },
      "settings:home": {
        title: "Settings",
        summary: "Control system behavior, security options, and feature toggles.",
        tips: [
          "Security changes can affect login flow immediately.",
          "Settings updates are broadcast to connected clients in real time.",
          "Review role permissions before enabling sensitive features.",
        ],
        actions: [{ label: "Open Audit Logs", page: "audit:list" }],
      },
      transactions: {
        title: "Transactions",
        summary: "Review financial activity and follow up on pending operations.",
        tips: [
          "Use search and filters to isolate unusual entries quickly.",
          "Jump to pending cashout for approvals or rejections.",
          "Use notification counts to prioritize fresh requests.",
        ],
        actions: [{ label: "Open Cashout List", page: "cashout:list" }],
      },
    };

    return map[activePage] || defaults;
  }, [activePage, routeLabels]);

  // Screen idle tracking: after 15 min inactive, show "Stay logged in" modal
  useEffect(() => {
    function resetIdle() {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => setShowIdleModal(true), IDLE_MS);
    }
    resetIdle();
    window.addEventListener("mousemove", resetIdle);
    window.addEventListener("keydown", resetIdle);
    window.addEventListener("click", resetIdle);
    return () => {
      window.removeEventListener("mousemove", resetIdle);
      window.removeEventListener("keydown", resetIdle);
      window.removeEventListener("click", resetIdle);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (idleExitTimerRef.current) clearTimeout(idleExitTimerRef.current);
      if (securityAlertExitTimerRef.current) clearTimeout(securityAlertExitTimerRef.current);
    };
  }, []);

  // Send current view to server for live collaboration indicators
  useEffect(() => {
    if (!window.api?.wsSend || !account) return;
    const page = activePage || "dashboard";
    const contextId =
      activePage === "employees:profile" && profileEmployee?._id ? String(profileEmployee._id) : null;
    window.api.wsSend({ type: "view:update", requestId: rid(), payload: { page, contextId } });
  }, [activePage, profileEmployee?._id, account]);

  // Listen for viewers:update and show who is viewing current page/context (exclude self)
  useEffect(() => {
    if (!window.api?.onWsMessage || !account) return;
    const unsub = window.api.onWsMessage((msg) => {
      if (msg?.type !== "viewers:update" || !Array.isArray(msg.views)) return;
      const page = activePage || "dashboard";
      const contextId =
        activePage === "employees:profile" && profileEmployee?._id ? String(profileEmployee._id) : null;
      const myId = String(account?.id ?? account?._id ?? "");
      const list = msg.views.filter(
        (v) =>
          v.page === page &&
          (contextId == null ? v.contextId == null : v.contextId === contextId) &&
          v.userId !== myId
      );
      setViewers(list);
      const map = {};
      msg.views.forEach((v) => {
        map[v.userId] = {
          page: v.page,
          contextId: v.contextId,
          userName: v.userName,
          photoUrl: v.photoUrl,
          viewLabel: getViewLabel(v.page),
        };
      });
      setAllUserViews(map);
    });
    return () => unsub?.();
  }, [activePage, profileEmployee?._id, account]);

  const SECURITY_ALERT_EXIT_MS = 220;

  const closeSecurityAlert = useCallback((afterClose) => {
    if (securityAlertExiting) return;
    setSecurityAlertExiting(true);
    if (securityAlertExitTimerRef.current) clearTimeout(securityAlertExitTimerRef.current);
    securityAlertExitTimerRef.current = setTimeout(() => {
      setSecurityAlertModal(null);
      setSecurityAlertExiting(false);
      securityAlertExitTimerRef.current = null;
      afterClose?.();
    }, SECURITY_ALERT_EXIT_MS);
  }, [securityAlertExiting]);

  const handleSecurityLockAccount = useCallback(() => {
    const modal = securityAlertModal;
    if (!modal?.userId || !window.api?.wsSend) {
      closeSecurityAlert();
      return;
    }
    const reqId = rid();
    let settled = false;
    let resolveWait;
    const wait = new Promise((r) => {
      resolveWait = r;
    });
    const resolveOnce = (res) => {
      if (settled) return;
      settled = true;
      resolveWait(res);
    };
    const unsub = window.api.onWsMessage((msg) => {
      if (msg?.requestId === reqId && msg?.type === "account:lock:result") {
        resolveOnce(msg);
      }
    });
    setTimeout(() => resolveOnce({ ok: false, error: "timeout" }), 8000);
    window.api.wsSend({ type: "account:lock", requestId: reqId, payload: { employeeId: modal.userId } });
    wait.then((res) => {
      unsub?.();
      if (res?.ok) notify?.success?.("Account locked. User has been signed out.", "Security");
      else if (!res?.ok) notify?.error?.(res?.error || "Failed to lock account", "Security");
      closeSecurityAlert();
    });
  }, [securityAlertModal, closeSecurityAlert, notify]);

  

  function getViewLabel(page) {
    const map = {
      dashboard: "Dashboard",
      "employees:list": "Employees / List",
      "employees:create": "Employees / Create",
      "employees:edit": "Employees / Edit",
      "employees:profile": "Employees / Profile",
      "roles:list": "Roles / List",
      "roles:create": "Roles / Create",
      "roles:edit": "Roles / Edit",
      "settings:home": "Settings",
      "audit:list": "Audit Logs",
      loginAttempts: "Login Attempts",
      "holidays:ask": "Holidays / Request",
      "holidays:list": "Holidays / List",
      "holidays:calendar": "Holidays / Calendar",
      notifications: "Notifications",
      "hot:send": "Hot notification",
      "reports:submit": "Reports / Submit",
      "reports:list": "Reports / List",
      transactions: "Transactions",
      drivers: "Drivers",
      "drivers:profile": "Drivers / Profile",
      stores: "Stores",
      "stores:profile": "Stores / Profile",
      devices: "Device Management",
      heatmap: "Action Heatmap",
      performance: "System Performance",
      "suggests:list": "Suggests / List",
      "suggests:new": "Suggests / New",
      "cashout:list": "Cashout / List",
      "cashout:pending": "Cashout / Pending Cashout",
      sync: "Data / Sync",
      "dataentry:list": "Data Entry / List",
      "dataentry:create": "Data Entry / Create",
      documents: "Documents",
      storage: "Storage",
      vaults: "Vaults",
      recordings: "Recordings",
    };
    return map[page] || page || "—";
  }

  function showHotItem(item) {
    const title = item?.title || "Notification";
    const body = item?.message || "";
    if (typeof Notification !== "undefined" && Notification.permission !== "denied") {
      if (Notification.permission === "granted") {
        try {
          new Notification(title, { body, tag: item?.hotId ? String(item.hotId) : undefined });
        } catch (_) {}
      } else {
        Notification.requestPermission().then((p) => {
          if (p === "granted") try { new Notification(title, { body }); } catch (_) {}
        });
      }
    }
    if (item?.deliveryType === "modal") {
      setHotModal({ title, message: body });
    } else {
      notify?.success?.(body ? `${title}: ${body}` : title, title);
    }
  }

  const closeHelpPanel = useCallback(() => {
    if (!helpOpen) return;
    setHelpOpen(false);
    setHelpPanelExiting(true);
  }, [helpOpen]);

  const toggleHelpPanel = useCallback(() => {
    if (helpOpen) {
      closeHelpPanel();
      return;
    }
    setHelpPanelExiting(false);
    setHelpOpen(true);
  }, [helpOpen, closeHelpPanel]);

  const handleStopImpersonation = useCallback(async () => {
    if (!window.api?.authImpersonateStop || impersonationBusy) return;
    setImpersonationBusy(true);
    try {
      const out = await window.api.authImpersonateStop();
      if (!out?.ok) {
        notify?.error?.(out?.error || "Failed to stop impersonation", "Impersonation");
        return;
      }
      notify?.success?.("Returned to your admin account.", "Impersonation");
      startTransition(() => setActivePage("dashboard"));
    } catch {
      notify?.error?.("Failed to stop impersonation", "Impersonation");
    } finally {
      setImpersonationBusy(false);
    }
  }, [impersonationBusy, notify]);

  useEffect(() => {
    if (!helpOpen && !helpPanelExiting) return;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        closeHelpPanel();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [helpOpen, helpPanelExiting, closeHelpPanel]);

  const closeDriverContextMenu = useCallback(() => {
    setDriverContextMenu((prev) => (prev.open ? { ...prev, open: false } : prev));
  }, []);

  const openDriverContextMenu = useCallback((event, driver) => {
    if (!driver) return;
    event?.preventDefault?.();
    event?.stopPropagation?.();

    const x = typeof event?.clientX === "number" ? event.clientX : 0;
    const y = typeof event?.clientY === "number" ? event.clientY : 0;
    setDriverContextMenu({
      open: true,
      x,
      y,
      driver,
    });
  }, []);

  function handleDriverContextAction(action, driver) {
    if (!driver || !action) return;
    closeDriverContextMenu();

    if (action === "profile") {
      if (!canViewDrivers) {
        notify?.warning?.("You do not have permission to view driver profiles.", "Permission denied");
        return;
      }
      onNavigate("drivers:profile", driver);
      return;
    }

    if (action === "cashin") {
      if (!canCreateDriverCashIn) {
        notify?.warning?.("You do not have permission to create driver cash in.", "Permission denied");
        return;
      }
      setCashInModal({ type: "driver", initialDriver: driver });
      return;
    }

    if (action === "cashout") {
      if (!canCreateDriverCashout) {
        notify?.warning?.("You do not have permission to create driver cashout.", "Permission denied");
        return;
      }
      setCreateCashoutModal({ category: "driver", initialDriver: driver });
    }
  }

  if (!account) return null;

  function onNavigate(page, payload) {
    closeDriverContextMenu();
    if (helpOpen) closeHelpPanel();

    if (!canOverrideDisabledSections && page && isPageDisabledBySections(appSettings, page)) {
      showSectionDisabledModal(page);
      startTransition(() => setActivePage("dashboard"));
      return;
    }

    if (page === "employees:profile") {
      if (!canViewProfile) {
        notify?.error?.("You don't have permission to view employee profiles.", "Permission denied");
        return;
      }
      if (payload?.viewMe && account) {
        const myId = String(account?.id ?? account?._id ?? "");
        const useEmployee =
          currentUserEmployee && String(currentUserEmployee._id) === myId
            ? currentUserEmployee
            : null;
        setProfileEmployee(
          useEmployee ?? {
            _id: account.id ?? account._id,
            name: account.name ?? account.email,
            email: account.email,
            role: account.role,
            roleId: account.role,
            ...account,
          }
        );
      } else {
        setProfileEmployee(payload || null);
      }
      startTransition(() => setActivePage("employees:profile"));
      return;
    }
    if (page === "drivers:profile") {
      setProfileDriver(payload || null);
      startTransition(() => setActivePage("drivers:profile"));
      return;
    }
    if (page === "stores:profile") {
      setProfileStore(payload || null);
      startTransition(() => setActivePage("stores:profile"));
      return;
    }
    if (page === "employees:create") setEditingEmployee(null);
    if (page === "employees:edit") setEditingEmployee(payload || null);

    if (page === "roles:create") setEditingRole(null);
    if (page === "roles:edit") setEditingRole(payload || null);

    if (page === "holidays:list") setHolidaysListPayload(payload || {});
    else setHolidaysListPayload({});

    if (page === "chat") setChatNavigationIntent(payload || null);
    else setChatNavigationIntent(null);

    startTransition(() => setActivePage(page));
  }

  const IDLE_MODAL_EXIT_MS = 220;

  function closeIdleModal(callback) {
    if (idleModalExiting) return;
    setIdleModalExiting(true);
    if (idleExitTimerRef.current) clearTimeout(idleExitTimerRef.current);
    idleExitTimerRef.current = setTimeout(() => {
      setShowIdleModal(false);
      setIdleModalExiting(false);
      idleExitTimerRef.current = null;
      callback?.();
    }, IDLE_MODAL_EXIT_MS);
  }

  function stayLoggedIn() {
    // Reconnect WebSocket in case it dropped during sleep/suspend
    window.api?.wsConnect?.().catch(() => {});
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => setShowIdleModal(true), IDLE_MS);
    closeIdleModal(() => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => setShowIdleModal(true), IDLE_MS);
    });
  }

  return (
    <div className="main">
      {showMaintenanceModal && (
        <div className="maintenanceModal-backdrop" role="dialog" aria-modal="true" aria-labelledby="maintenanceModal-title">
          <div className="maintenanceModal">
            <h2 className="maintenanceModal-title" id="maintenanceModal-title">System under maintenance</h2>
            <p className="maintenanceModal-message">The system is currently under maintenance. Please try again later.</p>
            <button type="button" className="maintenanceModal-logout" onClick={() => window.api?.authLogout?.()}>
              Log out
            </button>
          </div>
        </div>
      )}
      {disabledSectionModal && (
        <div
          className={`lostPermissionModal-backdrop ${disabledSectionModalExiting ? "lostPermissionModal-backdrop--exiting" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="disabled-section-modal-title"
        >
          <div className={`lostPermissionModal ${disabledSectionModalExiting ? "lostPermissionModal--exiting" : ""}`}>
            <img
              src={getAssetUrl("assets/svg/blocked-ill.svg")}
              alt=""
              className="lostPermissionModal-illustration"
              aria-hidden
            />
            <h2 className="lostPermissionModal-title" id="disabled-section-modal-title">
              {t("settings.sectionDisabledModalTitle")}
            </h2>
            <p className="lostPermissionModal-message">
              {t("settings.sectionDisabledModalMessage").replace("{{section}}", disabledSectionModal.title)}
            </p>
            <button
              type="button"
              className="lostPermissionModal-dismiss"
              onClick={closeDisabledSectionModal}
            >
              {t("common.dismiss")}
            </button>
          </div>
        </div>
      )}
      {(showIdleModal || idleModalExiting) && (
        <div
          className={`idleModal-backdrop ${idleModalExiting ? "idleModal-backdrop--exiting" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="idleModal-title"
        >
          <div className={`idleModal ${idleModalExiting ? "idleModal--exiting" : ""}`}>
            <img src="/assets/svg/idle-ill.svg" alt="" className="idleModal-illustration" />
            <h2 className="idleModal-title" id="idleModal-title">You&apos;ve been idle</h2>
            <p className="idleModal-message">Stay logged in?</p>
            <div className="idleModal-actions">
              <button type="button" className="idleModal-btn idleModal-btn--primary" onClick={stayLoggedIn}>
                Stay logged in
              </button>
              <button
                type="button"
                className="idleModal-btn idleModal-btn--ghost"
                onClick={() => closeIdleModal(() => window.api?.authLogout?.())}
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
      {(securityAlertModal || securityAlertExiting) &&
        createPortal(
          <div
            className={`securityAlert-backdrop ${securityAlertExiting ? "securityAlert-backdrop--exiting" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="securityAlert-title"
          >
            <div className={`securityAlert-modal ${securityAlertExiting ? "securityAlert-modal--exiting" : ""}`}>
              {securityAlertModal && (
                <>
                  <h2 className="securityAlert-title" id="securityAlert-title">
                    Login from outside allowed region
                  </h2>
                  <p className="securityAlert-message">
                    <strong>{securityAlertModal.userName}</strong>
                    {securityAlertModal.workEmail ? ` (${securityAlertModal.workEmail})` : ""} logged in from
                    country code <strong>{securityAlertModal.countryCode || "—"}</strong>.
                  </p>
                  <p className="securityAlert-hint">
                    You can lock this account and sign them out, or dismiss.
                  </p>
                  <div className="securityAlert-actions">
                    {canLockAccount && (
                      <button
                        type="button"
                        className="securityAlert-btn securityAlert-btn--primary"
                        onClick={handleSecurityLockAccount}
                      >
                        Lock account & sign out
                      </button>
                    )}
                    <button
                      type="button"
                      className="securityAlert-btn securityAlert-btn--ghost"
                      onClick={() => closeSecurityAlert()}
                    >
                      Dismiss
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>,
          document.body
        )}
      <Sidebar
        account={account}
        activePage={activePage}
        onNavigate={onNavigate}
        disabledSectionKeys={disabledSectionKeys}
        canOverrideDisabledSections={canOverrideDisabledSections}
        unreadNotificationCount={unreadNotificationCount}
        pendingCashoutCount={pendingCashoutCount}
        chatUnreadCount={chatUnreadCount}
        onOpenCreateCashoutModal={(category) => setCreateCashoutModal({ category })}
        onOpenCashInModal={(type) => setCashInModal({ type })}
        onOpenWalletAdjustModal={(operation, targetType) => setWalletAdjustModal({ operation, targetType })}
      />

      <div className="content">
        <nav className="contentRouteBar" aria-label="Breadcrumb">
          <div className="contentRouteBarMain">
            {routeLabels.map((label, i) => (
              <span key={i} className="contentRouteSegment">
                {i > 0 && <span className="contentRouteSep" aria-hidden>/</span>}
                <span className={i === routeLabels.length - 1 ? "contentRouteCurrent" : undefined}>{label}</span>
              </span>
            ))}
          </div>
          <div className="contentRouteBarActions">
            {activePage !== "chat" && (
              <button
                type="button"
                className="contentHelpBtn contentHelpBtn--globalChat"
                onClick={() => setGlobalChatOpen(true)}
              >
                <Megaphone size={16} aria-hidden />
                <span>Global chat</span>
              </button>
            )}
            <Tippy content={helpOpen ? "Close help" : "Open contextual help"} animation="shift-away" placement="left" delay={[200, 0]}>
              <button
                type="button"
                className={`contentHelpBtn ${helpOpen ? "active" : ""}`}
                onClick={toggleHelpPanel}
                aria-label={helpOpen ? "Close contextual help" : "Open contextual help"}
                aria-expanded={helpOpen}
              >
                <HelpCircle size={16} aria-hidden />
                <span>Help</span>
              </button>
            </Tippy>
          </div>
        </nav>
        {impersonation && (
          <div className="appImpersonationBanner" role="status" aria-live="polite">
            <div className="appImpersonationText">
              <strong>Admin impersonation mode:</strong>{" "}
              Viewing as <strong>{account?.name || account?.email || "selected user"}</strong>
              {impersonation?.actor?.name ? ` (started by ${impersonation.actor.name})` : ""}
              {impersonationStartedLabel ? ` on ${impersonationStartedLabel}` : ""}.
            </div>
            <button
              type="button"
              className="appImpersonationStopBtn"
              disabled={impersonationBusy}
              onClick={handleStopImpersonation}
            >
              {impersonationBusy ? "Stopping..." : "Stop impersonation"}
            </button>
          </div>
        )}
        {viewers.length > 0 && (
          <>
            <Tippy
              content={viewers.length === 1 ? "1 person viewing this page" : `${viewers.length} people viewing this page`}
              animation="shift-away"
              placement="left"
              delay={[200, 0]}
            >
              <button
              type="button"
              className="viewersFab"
              onClick={() => {
                if (viewersOpen) closeViewersPanel();
                else setViewersOpen(true);
              }}
              aria-label={viewersOpen ? "Close viewers" : "Show who is viewing this page"}
              aria-expanded={viewersOpen}
            >
              <span className="viewersFabCount">{viewers.length}</span>
              <Users size={18} aria-hidden />
            </button>
            </Tippy>
            {(viewersOpen || viewersPanelExiting) && (
              <div
                className={`viewersPanelBackdrop ${viewersPanelExiting ? "viewersPanelBackdrop--exiting" : ""}`}
                role="presentation"
                onClick={closeViewersPanel}
              >
                <div
                  className={`viewersPanel ${viewersPanelExiting ? "viewersPanel--exiting" : ""}`}
                  onClick={(e) => e.stopPropagation()}
                  role="dialog"
                  aria-label="Who is viewing this page"
                >
                  <div className="viewersPanelTitle">Viewing this page</div>
                  <div className="viewersPanelList">
                    {viewers.slice(0, 3).map((v) => (
                      <div key={v.userId} className="viewersPanelUser">
                        <div className="viewersPanelAvatar">
                          {v.photoUrl ? (
                            <img src={v.photoUrl} alt="" onError={(e) => { e.target.style.display = "none"; e.target.nextElementSibling?.classList.remove("viewersPanelInitial--hide"); }} />
                          ) : null}
                          <span className={`viewersPanelInitial ${v.photoUrl ? "viewersPanelInitial--hide" : ""}`} aria-hidden={!!v.photoUrl}>
                            {(v.userName || "?").charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="viewersPanelName">{v.userName || "Someone"}</span>
                      </div>
                    ))}
                    {viewers.length > 3 && (
                      <div className="viewersPanelMore">
                        {viewers.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        {activePage === "dashboard" && (
          <Dashboard
            account={account}
            activePage={activePage}
            onNavigate={onNavigate}
            onCurrentUserEmployee={setCurrentUserEmployee}
            allUserViews={allUserViews}
            onOpenDriverContextMenu={openDriverContextMenu}
            onInitialLoadComplete={handleInitialHomeReady}
          />
        )}

        {activePage === "chat" && (
          <Chat
            account={account}
            navigationIntent={chatNavigationIntent}
            onConsumeIntent={() => setChatNavigationIntent(null)}
            onNavigate={onNavigate}
          />
        )}

        {activePage === "recordings" && <Recordings account={account} onNavigate={onNavigate} />}

        {activePage === "notifications" && (
          <NotificationsPage account={account} onUnreadChange={refetchUnreadCount} onOpen={refetchUnreadCount} />
        )}

        {activePage === "employees:list" && (
          <EmployeesList
            account={account}
            onNavigate={onNavigate}
            onCurrentUserEmployee={setCurrentUserEmployee}
          />
        )}

        {activePage === "employees:create" && (
          <CreateEmployee
            account={account}
            editingEmployee={null}
            onNavigate={onNavigate}
          />
        )}

        {activePage === "employees:edit" && (
          <CreateEmployee
            account={account}
            editingEmployee={editingEmployee}
            onNavigate={onNavigate}
          />
        )}

        {activePage === "employees:profile" && (
          <EmployeeProfile
            employee={profileEmployee}
            account={account}
            onNavigate={onNavigate}
          />
        )}

        {activePage === "roles:create" && (
          <CreateRole
            account={account}
            editingRole={null}
            onNavigate={onNavigate}
          />
        )}

        {activePage === "roles:list" && (
          <RolesList
            account={account}
            onNavigate={onNavigate}
          />
        )}

        {activePage === "roles:edit" && (
          <CreateRole
            account={account}
            editingRole={editingRole}
            onNavigate={onNavigate}
          />
        )}

        {activePage === "settings:home" && (
          <SettingsHome
            account={account}
            onNavigate={onNavigate}
          />
        )}

        {activePage === "audit:list" && (
          <AuditLogs account={account} />
        )}

        {activePage === "holidays:ask" && (
          <HolidaysAsk account={account} onNavigate={onNavigate} />
        )}

        {activePage === "holidays:calendar" && (
          <HolidayCalendar account={account} />
        )}

        {activePage === "holidays:list" && (
          <HolidayList
            account={account}
            onNavigate={onNavigate}
            highlightHolidayId={holidaysListPayload.highlightHolidayId}
          />
        )}

        {activePage === "hot:send" && (
          <HotSend account={account} />
        )}

        {activePage === "reports:submit" && (
          <SubmitReport account={account} onReportSent={refetchUnreadCount} />
        )}

        {activePage === "reports:list" && (
          <ReportsList account={account} />
        )}

        {activePage === "transactions" && (
          <Transactions account={account} />
        )}

        {activePage === "devices" && (
          <DeviceManagement account={account} />
        )}

        {activePage === "heatmap" && (
          <ActionHeatmap account={account} />
        )}

        {activePage === "performance" && (
          <SystemPerformance account={account} />
        )}

        {activePage === "loginAttempts" && (
          <LoginAttempts account={account} />
        )}

        {activePage === "suggests:list" && (
          <SuggestList account={account} />
        )}

        {activePage === "suggests:new" && (
          <NewSuggest account={account} onUnreadChange={refetchUnreadCount} />
        )}

        {activePage === "drivers" && (
          <Drivers account={account} onNavigate={onNavigate} onOpenDriverContextMenu={openDriverContextMenu} />
        )}

        {activePage === "sync" && (
          <Sync account={account} />
        )}

        {activePage === "dataentry:list" && (
          <DataEntry account={account} defaultMode="view" />
        )}

        {activePage === "dataentry:create" && (
          <DataEntry account={account} defaultMode="create" />
        )}

        {activePage === "documents" && (
          <Documents account={account} />
        )}

        {activePage === "storage" && (
          <Storage account={account} />
        )}

        {activePage === "vaults" && (
          <Vaults account={account} />
        )}

        {activePage === "drivers:profile" && (
          <DriverProfile
            driver={profileDriver}
            account={account}
            onNavigate={onNavigate}
          />
        )}

        {activePage === "stores" && (
          <Stores account={account} onNavigate={onNavigate} />
        )}

        {activePage === "stores:profile" && (
          <StoreProfile
            store={profileStore}
            account={account}
            onNavigate={onNavigate}
          />
        )}

        {activePage === "cashout:list" && (
          <CashoutList account={account} />
        )}

        {activePage === "cashout:pending" && (
          <PendingCashout
            account={account}
            onOpenCashoutModal={(category, options) => setCreateCashoutModal({ category, ...options })}
          />
        )}

        {activePage === "gaming" && (
          <div className="contentScroll">
            <Gaming account={account} onNavigate={onNavigate} />
          </div>
        )}

        {(helpOpen || helpPanelExiting) && (
          <>
            <button
              type="button"
              className={`contextHelpOverlay ${helpPanelExiting ? "contextHelpOverlay--exiting" : ""}`}
              aria-label="Close contextual help panel"
              onClick={closeHelpPanel}
            />
            <aside
              className={`contextHelpPanel ${helpPanelExiting ? "contextHelpPanel--exiting" : ""}`}
              aria-label="Contextual help"
            >
              <header className="contextHelpPanelHeader">
                <div>
                  <p className="contextHelpPanelEyebrow">Contextual Help</p>
                  <h2 className="contextHelpPanelTitle">{contextualHelp.title}</h2>
                </div>
                <button type="button" className="contextHelpPanelClose" onClick={closeHelpPanel} aria-label="Close help panel">
                  <X size={16} />
                </button>
              </header>
              <p className="contextHelpPanelSummary">{contextualHelp.summary}</p>
              <ul className="contextHelpList">
                {(contextualHelp.tips || []).map((tip, idx) => (
                  <li key={`${activePage}-tip-${idx}`} className="contextHelpListItem">{tip}</li>
                ))}
              </ul>
              {Array.isArray(contextualHelp.actions) && contextualHelp.actions.length > 0 && (
                <div className="contextHelpActions">
                  {contextualHelp.actions.map((action) => (
                    <button
                      key={`${activePage}-${action.page}-${action.label}`}
                      type="button"
                      className="contextHelpActionBtn"
                      onClick={() => {
                        closeHelpPanel();
                        onNavigate(action.page);
                      }}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </aside>
          </>
        )}
      </div>

      {createCashoutModal && createPortal(
        <div
          ref={createCashoutModalRef}
          className={`createCashoutModalBackdrop ${createCashoutModalExiting ? "createCashoutModalBackdrop--exiting" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="createCashoutModalTitle"
          onClick={() => setCreateCashoutModalExiting(true)}
        >
          <div
            className={`createCashoutModal ${createCashoutModalExiting ? "createCashoutModal--exiting" : ""}`}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="createCashoutModalHeader">
              <h2 id="createCashoutModalTitle" className="createCashoutModalTitle">
                <Wallet size={20} aria-hidden />
                Create Cashout — {createCashoutModal.category ? createCashoutModal.category.charAt(0).toUpperCase() + createCashoutModal.category.slice(1) : "Create Cashout"}
              </h2>
              <button
                type="button"
                className="createCashoutModalClose"
                onClick={() => setCreateCashoutModalExiting(true)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </header>
            <div className="createCashoutModalBody">
              {createCashoutModal.category === "employee" && (
                <EmployeeCashoutForm
                  account={account}
                  onClose={() => setCreateCashoutModalExiting(true)}
                />
              )}
              {createCashoutModal.category === "driver" && (
                <DriverCashoutForm
                  account={account}
                  onClose={() => setCreateCashoutModalExiting(true)}
                  initialDriver={createCashoutModal.initialDriver}
                />
              )}
              {createCashoutModal.category === "store" && (
                <StoreCashoutForm
                  account={account}
                  onClose={() => setCreateCashoutModalExiting(true)}
                />
              )}
              {createCashoutModal.category === "other" && (
                <OtherCashoutForm
                  account={account}
                  onClose={() => setCreateCashoutModalExiting(true)}
                  initialData={createCashoutModal.initialData}
                  requestId={createCashoutModal.requestId}
                />
              )}
              {createCashoutModal.category !== "employee" && createCashoutModal.category !== "driver" && createCashoutModal.category !== "store" && createCashoutModal.category !== "other" && (
                <div className="createCashoutModalEmpty">Content for this type coming soon.</div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {cashInModal && createPortal(
        <div
          ref={cashInModalRef}
          className={`createCashoutModalBackdrop ${cashInModalExiting ? "createCashoutModalBackdrop--exiting" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="cashInModalTitle"
          onClick={() => setCashInModalExiting(true)}
        >
          <div
            className={`createCashoutModal ${cashInModalExiting ? "createCashoutModal--exiting" : ""}`}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="createCashoutModalHeader">
              <h2 id="cashInModalTitle" className="createCashoutModalTitle">
                <ArrowDownCircle size={20} aria-hidden />
                Cash In — {cashInModal.type === "driver" ? "Driver" : "Other"}
              </h2>
              <button
                type="button"
                className="createCashoutModalClose"
                onClick={() => setCashInModalExiting(true)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </header>
            <div className="createCashoutModalBody">
              {cashInModal.type === "driver" && (
                <DriverCashInForm
                  account={account}
                  onClose={() => setCashInModalExiting(true)}
                  initialDriver={cashInModal.initialDriver}
                />
              )}
              {cashInModal.type === "other" && (
                <OtherCashInForm
                  account={account}
                  onClose={() => setCashInModalExiting(true)}
                />
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {walletAdjustModal && createPortal(
        <div
          ref={walletAdjustModalRef}
          className={`createCashoutModalBackdrop ${walletAdjustModalExiting ? "createCashoutModalBackdrop--exiting" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="walletAdjustModalTitle"
          onClick={() => setWalletAdjustModalExiting(true)}
        >
          <div
            className={`createCashoutModal ${walletAdjustModalExiting ? "createCashoutModal--exiting" : ""}`}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="createCashoutModalHeader">
              <h2 id="walletAdjustModalTitle" className="createCashoutModalTitle">
                <Wallet size={20} aria-hidden />
                {walletAdjustModal.operation === "add" ? t("sidebar.addMoney") : t("sidebar.deductMoney")} — {walletAdjustModal.targetType === "driver" ? t("sidebar.driver") : t("sidebar.store")}
              </h2>
              <button
                type="button"
                className="createCashoutModalClose"
                onClick={() => setWalletAdjustModalExiting(true)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </header>
            <div className="createCashoutModalBody">
              <WalletAdjustForm
                account={account}
                onClose={() => setWalletAdjustModalExiting(true)}
                targetType={walletAdjustModal.targetType}
                operation={walletAdjustModal.operation}
              />
            </div>
          </div>
        </div>,
        document.body
      )}

      <DriverContextMenu
        menu={driverContextMenu}
        onClose={closeDriverContextMenu}
        onAction={handleDriverContextAction}
        canViewProfile={canViewDrivers}
        canCashIn={canCreateDriverCashIn}
        canCashOut={canCreateDriverCashout}
      />

      {activePage !== "chat" && (
        <GlobalChatPanel
          account={account}
          open={globalChatOpen}
          onOpen={() => setGlobalChatOpen(true)}
          onClose={() => setGlobalChatOpen(false)}
        />
      )}

      {aiAssistantEnabled && <AIChatPanel account={account} />}

      {hotModal && (
        <div
          ref={hotModalRef}
          className={`hotModal-backdrop ${hotModalExiting ? "hotModal-backdrop--exiting" : ""}`}
          onClick={() => setHotModalExiting(true)}
          role="presentation"
        >
          <div
            className={`hotModal ${hotModalExiting ? "hotModal--exiting" : ""}`}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="hotModal-title"
          >
            <h2 className="hotModal-title" id="hotModal-title">{hotModal.title}</h2>
            {hotModal.message && <p className="hotModal-message">{hotModal.message}</p>}
            <button type="button" className="hotModal-dismiss" onClick={() => setHotModalExiting(true)}>OK</button>
          </div>
        </div>
      )}

      {newHolidayModal && (
        <div
          className="newHolidayModal-backdrop"
          onClick={() => setNewHolidayModal(null)}
          role="presentation"
        >
          <div
            className="newHolidayModal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="newHolidayModal-title"
          >
            <h3 className="newHolidayModal-title" id="newHolidayModal-title">
              New holiday request
            </h3>
            <p className="newHolidayModal-message">
              <strong>{newHolidayModal.userName}</strong> is asking for holiday.
              For more information{" "}
              <button
                type="button"
                className="newHolidayModal-link"
                onClick={() => {
                  onNavigate("holidays:list", { highlightHolidayId: newHolidayModal.holidayId });
                  setNewHolidayModal(null);
                }}
              >
                click here
              </button>
              .
            </p>
            <div className="newHolidayModal-actions">
              <button
                type="button"
                className="newHolidayModal-btn newHolidayModal-btn--primary"
                onClick={() => {
                  onNavigate("holidays:list", { highlightHolidayId: newHolidayModal.holidayId });
                  setNewHolidayModal(null);
                }}
              >
                View request
              </button>
              <button
                type="button"
                className="newHolidayModal-btn newHolidayModal-btn--ghost"
                onClick={() => setNewHolidayModal(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

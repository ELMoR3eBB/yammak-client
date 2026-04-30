import React, { useCallback, useEffect, useRef, useState, lazy, Suspense } from "react";
import { NotificationProvider, useNotification } from "./components/NotificationProvider";
import { LanguageProvider, useLanguage } from "./contexts/LanguageContext";
import HolidayStatusModal from "./components/modals/HolidayStatusModal";
import AppLoader from "./components/AppLoader";
import { getAssetUrl } from "./utils/publicUrl";
import { applyAppTheme, applyThemeFromSettings, getStoredTheme } from "./utils/theme";

// Lazy-load pages
const Login = lazy(() => import("./components/pages/Login"));
const Home = lazy(() => import("./components/layout/Home"));

// Stable fallback for Suspense so the loader always shows while chunks load (avoids white screen)
const SUSPENSE_FALLBACK = (
  <div className="appLoader-overlay" aria-hidden="true">
    <AppLoader />
  </div>
);

class AppErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    console.error("[App] ErrorBoundary:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="appLoader-overlay" style={{ background: "#09090b", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "12px", padding: "24px" }}>
          <p style={{ margin: 0, fontSize: "16px" }}>Something went wrong</p>
          <button type="button" onClick={() => this.setState({ hasError: false })} style={{ padding: "8px 16px", cursor: "pointer" }}>Try again</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const HOME_LOAD_MIN_MS = 1200; // Keep loader visible at least this long after Home mounts (avoids flash; welcome shows only after hide)
const HOME_LOADER_EXIT_MS = 320; // Fade-out duration when hiding the loader
const HOME_LOADER_MAX_MS = 8000; // Force-hide overlay if still visible (prevents stuck loader)

const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const LOGIN_EXIT_MS = 380;
const LOST_PERMISSION_MODAL_EXIT_MS = 280;
const NO_CONNECTION_MODAL_EXIT_MS = 280;
/** Only show "Connection lost" after disconnected this long (avoids modal on window unfocus / brief drops). */
const NO_CONNECTION_MODAL_DELAY_MS = 2500;
const UPDATE_MODAL_EXIT_MS = 220;

/** Set to false for normal updater behavior. While true: modal shows on app open with mock data for layout/CSS editing. */
const FORCE_UPDATE_MODAL_EDIT_PREVIEW = false;

/** Mock updater payload used only when FORCE_UPDATE_MODAL_EDIT_PREVIEW is true. Toggle `phase` to `available` | `downloading` | `downloaded` | `error` while styling. */
const EDIT_PREVIEW_UPDATER_STATE = {
  phase: "downloading",
  policyRequired: false,
  required: false,
  currentVersion: "0.1.5",
  targetVersion: "1.0.0",
  progress: 52,
  etaSeconds: 48,
  message: null,
  error: null,
};

/** Backend sends allowedPages; fallback only if backend did not (e.g. old API). */
const PAGE_REQUIRED_PERMISSIONS_FALLBACK = {
  dashboard: [],
  chat: [],
  notifications: [],
  "roles:list": ["roles.view", "roles.create"],
  "roles:create": ["roles.create"],
  "roles:edit": ["roles.view", "roles.edit"],
  "employees:list": ["employees.view", "employees.create"],
  "employees:create": ["employees.create"],
  "employees:edit": ["employees.view", "employees.edit"],
  "employees:profile": ["employees.view", "employees.create"],
  "settings:home": [],
  "audit:list": ["audit.view"],
  "holidays:ask": ["holiday.request"],
  "holidays:list": ["holiday.manage"],
  "reports:submit": ["reports.view"],
  "reports:list": ["reports.view"],
  devices: ["devices.view"],
  heatmap: ["analytics.heatmap"],
  performance: ["audit.view"],
  loginAttempts: ["audit.view"],
  "suggests:list": ["suggests.view"],
  "suggests:new": ["suggest.create"],
  "hot:send": ["hot.send"],
  drivers: ["drivers.view"],
  "drivers:profile": ["drivers.view"],
  sync: ["sync.request"],
  "dataentry:list": ["dataentry.view", "dataentry.create", "dataentry.manage"],
  "dataentry:create": ["dataentry.create", "dataentry.manage"],
  "cashout:list": ["cashout.request", "cashout.viewAll", "cashout.manage", "transactions.view", "transactions.reject"],
  "cashout:pending": ["cashout.viewPending", "transactions.reject"],
  transactions: ["transactions.view", "transactions.reject", "cashout.viewAll", "cashout.manage"],
  documents: ["documents.create", "documents.use"],
  recordings: ["calls.recordings"],
  vaults: [],
};

function canAccessPage(user, pageId) {
  if (!pageId || pageId === "dashboard" || pageId === "notifications") return true;
  if (Array.isArray(user?.allowedPages)) return user.allowedPages.includes(pageId);
  const perms = user?.role?.permissions || [];
  if (perms.includes("*")) return true;
  const required = PAGE_REQUIRED_PERMISSIONS_FALLBACK[pageId];
  if (!required || required.length === 0) return true;
  return required.some((p) => perms.includes(p));
}

function AppContent() {
  const [page, setPage] = useState("login"); // login | home
  const [account, setAccount] = useState(null);
  const [loginExiting, setLoginExiting] = useState(false);
  const [lostPermissionModalOpen, setLostPermissionModalOpen] = useState(false);
  const [lostPermissionModalExiting, setLostPermissionModalExiting] = useState(false);
  const [wsDisconnected, setWsDisconnected] = useState(false);
  const [noConnectionModalExiting, setNoConnectionModalExiting] = useState(false);
  const [updaterState, setUpdaterState] = useState(null);
  const [updateModalDismissed, setUpdateModalDismissed] = useState(false);
  const [updateModalExiting, setUpdateModalExiting] = useState(false);
  const [updateActionBusy, setUpdateActionBusy] = useState(false);
  const [editPreviewDismissed, setEditPreviewDismissed] = useState(false);
  const updateCheckRequestedRef = useRef(false);
  const wsDisconnectedRef = useRef(false);
  const currentPageRef = useRef("dashboard");
  const [holidayStatus, setHolidayStatus] = useState({ open: false, status: null, payload: null });
  const holidayQueueRef = useRef([]);
  const holidayReadReqRef = useRef(null);
  const holidayModalOpenRef = useRef(false);
  const transitionToHomeRef = useRef(null);
  const [homeLoaderHidden, setHomeLoaderHidden] = useState(false);
  const [homeLoaderExiting, setHomeLoaderExiting] = useState(false);
  const homeLoaderTimeoutRef = useRef(null);
  const homeLoaderExitTimeoutRef = useRef(null);
  const showHomeLoaderOverlayRef = useRef(true);
  const pendingWelcomeBackRef = useRef(null);
  const themeRequestIdRef = useRef(null);
  const [homeViewKey, setHomeViewKey] = useState("home-anon");
  const lastPrincipalKeyRef = useRef("");

  const notify = useNotification();
  const { setLanguage } = useLanguage();

  useEffect(() => {
    // Apply persisted theme immediately before any server sync.
    applyAppTheme(getStoredTheme());
  }, []);

  const requestTheme = useCallback(async () => {
    if (!window.api?.wsSend || !window.api?.wsConnect) return;
    try {
      await window.api.wsConnect();
      const requestId = rid();
      themeRequestIdRef.current = requestId;
      await window.api.wsSend({ type: "settings:theme:get", requestId });
    } catch {
      // Keep local persisted theme on failure.
    }
  }, []);

  const transitionToHome = useCallback((user) => {
    transitionToHomeRef.current = user;
    setHomeLoaderHidden(false);
    setLoginExiting(true);
    setTimeout(() => {
      setAccount(transitionToHomeRef.current ?? null);
      const nextLang = transitionToHomeRef.current?.preferences?.language;
      if (nextLang === "en" || nextLang === "ar") setLanguage(nextLang);
      setPage("home");
      setLoginExiting(false);
      window.api?.focusWindow?.();
    }, LOGIN_EXIT_MS);
  }, [setLanguage]);

  const onHomeReady = useCallback(() => {
    if (homeLoaderTimeoutRef.current) clearTimeout(homeLoaderTimeoutRef.current);
    if (homeLoaderExitTimeoutRef.current) clearTimeout(homeLoaderExitTimeoutRef.current);
    homeLoaderTimeoutRef.current = setTimeout(() => {
      homeLoaderTimeoutRef.current = null;
      setHomeLoaderExiting(true);
      homeLoaderExitTimeoutRef.current = setTimeout(() => {
        homeLoaderExitTimeoutRef.current = null;
        setHomeLoaderHidden(true);
        setHomeLoaderExiting(false);
      }, HOME_LOADER_EXIT_MS);
    }, HOME_LOAD_MIN_MS);
  }, []);

  useEffect(() => {
    if (page === "login") setHomeLoaderHidden(false);
  }, [page]);

  useEffect(() => {
    return () => {
      if (homeLoaderTimeoutRef.current) clearTimeout(homeLoaderTimeoutRef.current);
      if (homeLoaderExitTimeoutRef.current) clearTimeout(homeLoaderExitTimeoutRef.current);
    };
  }, []);

  const showHomeLoaderOverlay = !homeLoaderHidden || homeLoaderExiting;

  // Safety: force-hide overlay after HOME_LOADER_MAX_MS so loader never gets stuck
  const homeLoaderSafetyRef = useRef(null);
  useEffect(() => {
    if (page !== "home" || !showHomeLoaderOverlay) return;
    homeLoaderSafetyRef.current = setTimeout(() => {
      homeLoaderSafetyRef.current = null;
      setHomeLoaderExiting(true);
      setTimeout(() => {
        setHomeLoaderHidden(true);
        setHomeLoaderExiting(false);
      }, HOME_LOADER_EXIT_MS);
    }, HOME_LOADER_MAX_MS);
    return () => {
      if (homeLoaderSafetyRef.current) {
        clearTimeout(homeLoaderSafetyRef.current);
        homeLoaderSafetyRef.current = null;
      }
    };
  }, [page, showHomeLoaderOverlay]);

  useEffect(() => {
    showHomeLoaderOverlayRef.current = showHomeLoaderOverlay;
  }, [showHomeLoaderOverlay]);

  useEffect(() => {
    if (showHomeLoaderOverlay) return;
    const pending = pendingWelcomeBackRef.current;
    if (!pending) return;
    pendingWelcomeBackRef.current = null;
    notify.welcome(pending.message, pending.title);
    if (window.api?.wsSend) window.api.wsSend({ type: "holiday:notifications", requestId: rid() });
  }, [showHomeLoaderOverlay, notify]);

  const closeLostPermissionModal = useCallback(() => {
    setLostPermissionModalExiting(true);
    setTimeout(() => {
      setLostPermissionModalOpen(false);
      setLostPermissionModalExiting(false);
    }, LOST_PERMISSION_MODAL_EXIT_MS);
  }, []);

  const showNextHolidayNotification = useCallback(() => {
    const api = window.api;
    if (holidayQueueRef.current.length === 0) return;
    const next = holidayQueueRef.current.shift();
    const payload = {
      startDate: next.holiday?.startDate,
      endDate: next.holiday?.endDate,
      days: next.holiday?.days,
      reason: next.holiday?.reason,
      decidedByName: next.decidedByName,
      denialReason: next.denialReason,
    };
    holidayModalOpenRef.current = true;
    setHolidayStatus({ open: true, status: next.status, payload });
    if (api?.wsSend && next._id) {
      holidayReadReqRef.current = rid();
      api.wsSend({ type: "holiday:notifications:read", requestId: holidayReadReqRef.current, payload: { ids: [next._id] } });
    }
  }, []);

  const closeHolidayStatusModal = useCallback(() => {
    holidayModalOpenRef.current = false;
    setHolidayStatus((prev) => ({ ...prev, open: false }));
    setTimeout(() => {
      setHolidayStatus((prev) => (prev.open ? prev : { open: false, status: null, payload: null }));
      showNextHolidayNotification();
    }, 200);
  }, [showNextHolidayNotification]);

  useEffect(() => {
    const api = window.api;

    // If not running inside Electron, stay on login
    if (!api) return;

    // Listen for bootstrap result
    api.onAuthBootstrap((result) => {
      if (result?.status === "OK") {
        transitionToHome(result.user || null);
      } else {
        setAccount(null);
        setPage("login");
      }
    });

    api.onAccountUpdated((user) => {
      setAccount(user || null);
    });

    // Listen for login (e.g. from main process after auth:login)
    api.onLoggedIn((user) => {
      transitionToHome(user || null);
      requestTheme();
    });

    // Listen for logout — resize to login window then show login
    api.onLoggedOut(() => {
      setAccount(null);
      setPage("login");
      api.setWindowMode?.("LOGIN");
    });

    // Trigger bootstrap (in case event already fired)
    api.authBootstrap().then((result) => {
      if (result?.status === "OK") {
        transitionToHome(result.user || null);
        requestTheme();
      } else {
        setAccount(null);
        setPage("login");
      }
    });
  }, [transitionToHome, requestTheme]);

  useEffect(() => {
    wsDisconnectedRef.current = wsDisconnected;
  }, [wsDisconnected]);

  useEffect(() => {
    const api = window.api;
    if (!api?.onUpdaterState || !api?.updaterGetState) return;
    const unsub = api.onUpdaterState((state) => {
      if (!state || typeof state !== "object") return;
      setUpdaterState(state);
      const phase = String(state.phase || "");
      if (phase === "available" || phase === "downloading" || phase === "downloaded" || phase === "error") {
        setUpdateModalDismissed(false);
      }
    });
    api.updaterGetState().then((state) => {
      if (state && typeof state === "object") setUpdaterState(state);
    }).catch(() => {});
    return () => unsub?.();
  }, []);

  useEffect(() => {
    if (page === "login") {
      updateCheckRequestedRef.current = false;
      setUpdateModalDismissed(false);
    }
  }, [page]);

  useEffect(() => {
    if (FORCE_UPDATE_MODAL_EDIT_PREVIEW) return;
    const api = window.api;
    if (!api?.updaterCheck || page !== "home" || showHomeLoaderOverlay) return;
    if (updateCheckRequestedRef.current) return;
    updateCheckRequestedRef.current = true;
    api.updaterCheck().catch(() => {});
  }, [page, showHomeLoaderOverlay]);

  const closeOptionalUpdateModal = useCallback(() => {
    if (FORCE_UPDATE_MODAL_EDIT_PREVIEW) {
      setEditPreviewDismissed(true);
      return;
    }
    setUpdateModalExiting(true);
    setTimeout(() => {
      setUpdateModalDismissed(true);
      setUpdateModalExiting(false);
    }, UPDATE_MODAL_EXIT_MS);
  }, []);

  const startUpdateDownload = useCallback(async () => {
    if (FORCE_UPDATE_MODAL_EDIT_PREVIEW) return;
    if (!window.api?.updaterDownload) return;
    setUpdateActionBusy(true);
    try {
      await window.api.updaterDownload();
    } finally {
      setUpdateActionBusy(false);
    }
  }, []);

  const restartForUpdate = useCallback(async () => {
    if (FORCE_UPDATE_MODAL_EDIT_PREVIEW) return;
    if (!window.api?.updaterRestartNow) return;
    setUpdateActionBusy(true);
    try {
      await window.api.updaterRestartNow();
    } finally {
      setUpdateActionBusy(false);
    }
  }, []);

  const effectiveUpdaterState = FORCE_UPDATE_MODAL_EDIT_PREVIEW
    ? EDIT_PREVIEW_UPDATER_STATE
    : updaterState;
  const updaterPhase = String(effectiveUpdaterState?.phase || "");
  const updateRequired = !!effectiveUpdaterState?.required;
  const updateProgress = Number.isFinite(Number(effectiveUpdaterState?.progress))
    ? Math.max(0, Math.min(100, Number(effectiveUpdaterState?.progress)))
    : 0;
  const updateEtaSeconds = Number.isFinite(Number(effectiveUpdaterState?.etaSeconds))
    ? Math.max(0, Number(effectiveUpdaterState?.etaSeconds))
    : null;
  const estimatedLabel = updateEtaSeconds == null
    ? "Estimating time..."
    : (updateEtaSeconds <= 0
      ? "Finishing..."
      : `Estimated time: ${Math.ceil(updateEtaSeconds / 60)} min left`);
  const isUpdating = updaterPhase === "downloading";
  const isDownloaded = updaterPhase === "downloaded";
  const modalTitle = isUpdating
    ? "Updating in Background"
    : (updateRequired ? "Update Required" : "Update Available");
  const modalText = isUpdating
    ? "Your new version is being downloaded. Please keep the app open while we finalize the update."
    : (effectiveUpdaterState?.message || "A new version of the app is available. To continue enjoying new features and security fixes, please update now.");
  const showUpdateModal =
    (FORCE_UPDATE_MODAL_EDIT_PREVIEW && !editPreviewDismissed) ||
    (page === "home" &&
      !showHomeLoaderOverlay &&
      (updaterPhase === "available" || updaterPhase === "downloading" || updaterPhase === "downloaded" || updaterPhase === "error") &&
      (updateRequired || !updateModalDismissed));

  useEffect(() => {
    const principalKey = account
      ? [
          String(account.id || account._id || ""),
          account?.impersonation?.active ? "imp" : "self",
          String(account?.impersonation?.actor?.id || ""),
          String(account?.impersonation?.startedAt || ""),
        ].join("|")
      : "home-anon";
    if (lastPrincipalKeyRef.current && lastPrincipalKeyRef.current !== principalKey) {
      setHomeViewKey(`home-${principalKey}`);
    } else if (!lastPrincipalKeyRef.current) {
      setHomeViewKey(`home-${principalKey}`);
    }
    lastPrincipalKeyRef.current = principalKey;
  }, [account]);

  const noConnectionDelayRef = useRef(null);

  // After sleep/suspend, WebSocket may be dead; reconnect when user returns to the app
  useEffect(() => {
    const api = window.api;
    if (!api?.wsConnect || typeof document === "undefined") return;
    const onVisible = () => {
      if (document.visibilityState !== "visible" || page !== "home") return;
      api.wsConnect().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [page]);

  useEffect(() => {
    const api = window.api;
    if (!api?.onWsDisconnected || !api?.onWsConnected) return;
    const unsubDisconnected = api.onWsDisconnected(() => {
      if (noConnectionDelayRef.current) return;
      noConnectionDelayRef.current = setTimeout(() => {
        noConnectionDelayRef.current = null;
        setWsDisconnected(true);
      }, NO_CONNECTION_MODAL_DELAY_MS);
    });
    const unsubConnected = api.onWsConnected(() => {
      if (noConnectionDelayRef.current) {
        clearTimeout(noConnectionDelayRef.current);
        noConnectionDelayRef.current = null;
      }
      if (wsDisconnectedRef.current) {
        setNoConnectionModalExiting(true);
        requestAnimationFrame(() => {
          setTimeout(() => {
            setWsDisconnected(false);
            setNoConnectionModalExiting(false);
          }, NO_CONNECTION_MODAL_EXIT_MS);
        });
      } else {
        setWsDisconnected(false);
      }
    });
    return () => {
      if (noConnectionDelayRef.current) clearTimeout(noConnectionDelayRef.current);
      unsubDisconnected?.();
      unsubConnected?.();
    };
  }, []);

  useEffect(() => {
    const api = window.api;

    const REQUIRED_PERMISSION = "presence.notify";

    const hasPermission = (user, perm) => {
      const perms = user?.role?.permissions || [];
      return perms.includes("*") || perms.includes(perm);
    };

    const unsubscribe = api.onWsMessage((msg) => {
      if (msg?.type === "settings:theme:get:result" && msg?.requestId === themeRequestIdRef.current && msg?.ok) {
        applyThemeFromSettings({ appearance: msg.appearance || {} });
        return;
      }
      if (msg?.type === "theme:changed") {
        // Don't override a user-level theme override.
        const userTheme = account?.preferences?.theme;
        const canUserTheme = (account?.role?.permissions || []).includes("*") || (account?.role?.permissions || []).includes("settings.user.appearance");
        if (!canUserTheme || !userTheme) applyAppTheme(msg.theme);
        return;
      }
      // 1) Welcome back — always defer to pending; only show when loader is hidden (effect below)
      if (msg?.type === "notify" && msg?.event === "welcome_back") {
        pendingWelcomeBackRef.current = { message: msg.message, title: "Hello there!" };
        return;
      }

      // 2) Holiday status (real-time approve/deny) — show modal
      if (msg?.type === "holiday:status") {
        holidayModalOpenRef.current = true;
        setHolidayStatus({
          open: true,
          status: msg.status,
          payload: {
            startDate: msg.startDate,
            endDate: msg.endDate,
            days: msg.days,
            reason: msg.reason,
            decidedByName: msg.decidedByName,
            denialReason: msg.denialReason,
          },
        });
        return;
      }

      // 3) Pending holiday notifications (on connect) — queue and show first if modal not open
      if (msg?.type === "holiday:notifications" && Array.isArray(msg.notifications) && msg.notifications.length > 0) {
        holidayQueueRef.current = [...(holidayQueueRef.current || []), ...msg.notifications];
        if (!holidayModalOpenRef.current) showNextHolidayNotification();
        return;
      }

      // 4) Role permissions updated or profile updated — refresh account so UI has latest
      if (msg?.type === "account:roleUpdated" || msg?.type === "account:refresh") {
        // During active impersonation, ignore generic account refresh pushes to avoid
        // swapping back to actor context unless impersonation is explicitly stopped.
        if (account?.impersonation?.active && msg?.type === "account:refresh") return;
        api.authMe?.().then((res) => {
          if (!res?.user) return;
          const newUser = res.user;
          const currentPage = currentPageRef.current;
          setAccount(newUser);
          // Apply user language override (if any) after account refresh.
          if (newUser?.preferences?.language === "en" || newUser?.preferences?.language === "ar") {
            setLanguage(newUser.preferences.language);
          }
          if (msg?.type === "account:roleUpdated" && !canAccessPage(newUser, currentPage) && currentPage && currentPage !== "dashboard") {
            setLostPermissionModalOpen(true);
            if (api?.wsSend) {
              api.wsSend({
                type: "notification:create",
                requestId: rid(),
                payload: {
                  type: "permission_lost",
                  title: "Redirected due to permission change",
                  message: "You were redirected to the dashboard because you no longer have permission to view the page you were on.",
                },
              });
            }
          }
        });
        return;
      }

      // 5) Session revoked (force logout this device, or all devices when reason is account_locked)
      if (msg?.type === "session:revoked") {
        if (msg.deviceId != null) {
          api.getDeviceId?.().then((currentId) => {
            if (currentId && String(msg.deviceId) === String(currentId)) {
              api.authLogout?.();
            }
          });
        } else {
          api.authLogout?.();
        }
        return;
      }

      // 6) Presence online/offline (permission-gated)
      if (msg?.type === "presence:user") {
        if (!hasPermission(account, REQUIRED_PERMISSION)) return;

        // optional: ignore self
        if (String(msg.user._id) === String(account.id)) return;

        const fullName =
          `${msg.user?.firstName ?? ""} ${msg.user?.lastName ?? ""}`.trim() ||
          msg.user?.name ||
          "User";

        const body =
          msg.event === "online"
            ? `${fullName} is online`
            : `${fullName} is offline`;
        
            
        new Notification("Presence", { body });

        notify.online("Employee " + (msg.event === "online" ? "Connected" : "Disconnected"), body);
      }
    });

    return () => unsubscribe?.();
  }, [account, holidayStatus.open, setLanguage, showNextHolidayNotification]);

  useEffect(() => {
    if (page !== "home") return;
    requestTheme();
  }, [page, requestTheme]);

  return (
    <AppErrorBoundary>
      <Suspense fallback={SUSPENSE_FALLBACK}>
        {page === "login" ? (
        <Login
          exiting={loginExiting}
          onLoggedIn={transitionToHome}
        />
      ) : (
        <>
          {showHomeLoaderOverlay && (
            <div className={`appLoader-overlay ${homeLoaderExiting ? "appLoader-overlay--exiting" : ""}`} aria-hidden="true">
              <AppLoader />
            </div>
          )}
          <div className="app-home-enter">
            <Home
              key={homeViewKey}
              account={account}
              onActivePageChange={(p) => { currentPageRef.current = p; }}
              lostPermissionRouted={lostPermissionModalOpen}
              onHomeReady={onHomeReady}
            />
          </div>
        </>
      )}
      {holidayStatus.open && (
        <HolidayStatusModal
          open={holidayStatus.open}
          status={holidayStatus.status}
          payload={holidayStatus.payload}
          onClose={closeHolidayStatusModal}
        />
      )}
      {lostPermissionModalOpen && (
        <div
          className={`lostPermissionModal-backdrop ${lostPermissionModalExiting ? "lostPermissionModal-backdrop--exiting" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="lost-permission-modal-title"
        >
          <div className={`lostPermissionModal ${lostPermissionModalExiting ? "lostPermissionModal--exiting" : ""}`} onClick={(e) => e.stopPropagation()}>
            <img
              src={getAssetUrl("assets/svg/blocked-ill.svg")}
              alt=""
              className="lostPermissionModal-illustration"
              aria-hidden
            />
            <h2 className="lostPermissionModal-title" id="lost-permission-modal-title">
              Redirected due to permission change
            </h2>
            <p className="lostPermissionModal-message">
              You have been redirected to the dashboard because you no longer have permission to view the page you were on. This has been recorded in your notifications.
            </p>
            <button
              type="button"
              className="lostPermissionModal-dismiss"
              onClick={closeLostPermissionModal}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      {page === "home" && (wsDisconnected || noConnectionModalExiting) && (
        <div
          className={`noConnectionModal-backdrop ${noConnectionModalExiting ? "noConnectionModal-backdrop--exiting" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="no-connection-modal-title"
          aria-describedby="no-connection-modal-desc"
        >
          <div className={`noConnectionModal ${noConnectionModalExiting ? "noConnectionModal--exiting" : ""}`} onClick={(e) => e.stopPropagation()}>
            <img
              src={getAssetUrl("assets/svg/noconnection-ill.svg")}
              alt=""
              className="noConnectionModal-illustration"
              aria-hidden
            />
            <h2 className="noConnectionModal-title" id="no-connection-modal-title">
              Connection lost
            </h2>
            <p className="noConnectionModal-message" id="no-connection-modal-desc">
              The connection to the server was lost. Reconnecting automatically… This window will close when the connection is restored.
            </p>
            <div className="noConnectionModal-spinner" aria-hidden />
          </div>
        </div>
      )}
      {showUpdateModal && (
        <div
          className={`appUpdateModal-backdrop ${updateModalExiting ? "appUpdateModal-backdrop--exiting" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="app-update-modal-title"
        >
          <div className={`appUpdateModal ${updateModalExiting ? "appUpdateModal--exiting" : ""}`} onClick={(e) => e.stopPropagation()}>
            <img
              src={getAssetUrl("assets/undraw/update.svg")}
              alt=""
              className={`appUpdateModal-illustration ${isUpdating ? "is-updating" : ""} ${updateRequired ? "is-required" : ""}`}
              aria-hidden
            />
            <h2 className="appUpdateModal-title" id="app-update-modal-title">
              {modalTitle}
            </h2>
            <p className="appUpdateModal-message">{modalText}</p>

            {(isUpdating || isDownloaded) && (
              <div className="appUpdateModal-progressWrap">
                <div className="appUpdateModal-progressHeader">
                  <span>Downloading assets...</span>
                  <span>{Math.round(updateProgress)}%</span>
                </div>
                <div className="appUpdateModal-progressBar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(updateProgress)}>
                  <span style={{ width: `${updateProgress}%` }} />
                </div>
                <div className="appUpdateModal-progressText">
                  {isDownloaded
                    ? "Update downloaded. Restart now to apply."
                    : (
                      <>
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="var(--st-accent, #d97706)"
                          strokeWidth="2"
                          aria-hidden
                        >
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        {`${estimatedLabel} - ${Math.round(updateProgress)}% complete`}
                      </>
                    )}
                </div>
              </div>
            )}

            {updaterPhase === "error" && (
              <p className="appUpdateModal-error">
                {String(effectiveUpdaterState?.error || "Update failed. Please try again.")}
              </p>
            )}

            <div className="appUpdateModal-actions">
              {isDownloaded ? (
                <button type="button" className="appUpdateModal-primary" onClick={restartForUpdate} disabled={updateActionBusy}>
                  Restart now
                </button>
              ) : (
                <button type="button" className="appUpdateModal-primary" onClick={startUpdateDownload} disabled={updateActionBusy || updaterPhase === "downloading"}>
                  {isUpdating ? "Downloading..." : "Update now"}
                </button>
              )}
              {!updateRequired && !isUpdating && !isDownloaded && (
                <button type="button" className="appUpdateModal-secondary" onClick={closeOptionalUpdateModal} disabled={updateActionBusy}>
                  Later
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      </Suspense>
    </AppErrorBoundary>
  );
}

export default function App() {
  return (
    <NotificationProvider>
      <LanguageProvider>
        <AppContent />
      </LanguageProvider>
    </NotificationProvider>
  );
}

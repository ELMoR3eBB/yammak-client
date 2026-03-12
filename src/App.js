import React, { useCallback, useEffect, useRef, useState, lazy, Suspense } from "react";
import { NotificationProvider, useNotification } from "./components/NotificationProvider";
import { LanguageProvider } from "./contexts/LanguageContext";
import HolidayStatusModal from "./components/modals/HolidayStatusModal";
import AppLoader from "./components/AppLoader";
import { getAssetUrl } from "./utils/publicUrl";

// Lazy-load pages
const Login = lazy(() => import("./components/pages/Login"));
const Home = lazy(() => import("./components/pages/Home"));

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
  "settings:home": ["settings.*"],
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
  "cashout:list": ["cashout.request", "cashout.viewAll", "cashout.manage", "transactions.view", "transactions.reject"],
  "cashout:pending": ["cashout.viewPending", "transactions.reject"],
  transactions: ["transactions.view", "transactions.reject", "cashout.viewAll", "cashout.manage"],
  documents: ["documents.create", "documents.use"],
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

  const notify = useNotification();

  const transitionToHome = useCallback((user) => {
    transitionToHomeRef.current = user;
    setHomeLoaderHidden(false);
    setLoginExiting(true);
    setTimeout(() => {
      setAccount(transitionToHomeRef.current ?? null);
      setPage("home");
      setLoginExiting(false);
      window.api?.focusWindow?.();
    }, LOGIN_EXIT_MS);
  }, []);

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
      } else {
        setAccount(null);
        setPage("login");
      }
    });
  }, [transitionToHome]);

  useEffect(() => {
    wsDisconnectedRef.current = wsDisconnected;
  }, [wsDisconnected]);

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
        api.authMe?.().then((res) => {
          if (!res?.user) return;
          const newUser = res.user;
          const currentPage = currentPageRef.current;
          setAccount(newUser);
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
  }, [account, holidayStatus.open, showNextHolidayNotification]);

  return (
    <AppErrorBoundary>
      <LanguageProvider>
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
        </Suspense>
      </LanguageProvider>
    </AppErrorBoundary>
  );
}

export default function App() {
  return (
    <NotificationProvider>
      <AppContent />
    </NotificationProvider>
  );
}

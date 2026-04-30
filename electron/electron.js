const { app, BrowserWindow, ipcMain, dialog, screen, session, shell, Notification, clipboard, nativeImage } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const axios = require("axios");
const WebSocket = require("ws");
const FormData = require("form-data");
const keytar = require("keytar");
const { machineIdSync } = require("node-machine-id");
const { autoUpdater } = require("electron-updater");
const semver = require("semver");

// Load .env from project root so API_BASE is set (no extra dependency)
try {
  const envPath = path.join(__dirname, "..", ".env");
  if (fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
    }
  }
} catch (_) {}

let win = null;
let account = null;
let bootResult = null;

// WS client + caches
let wsClient = null;
let rolesCache = [];
let wsIntentionalClose = false;
let reconnectTimer = null;
let wsKeepAliveTimer = null;
let wsPongTimeoutTimer = null;

// WS request waiters (requestId -> resolve)
const wsPending = new Map();
const WS_PING_INTERVAL_MS = 20000;
const WS_PONG_TIMEOUT_MS = 12000;

const API_BASE = process.env.API_BASE || "https://accounts.yammak.shop";
const UPDATES_FEED_URL = `${API_BASE.replace(/\/$/, "")}/updates/desktop`;
const API_BASE_CLEAN = API_BASE.replace(/\/$/, "");

// keytar + file storage
const SERVICE = "yammak";
const AUTH_FILE = "auth.json";
const REFRESH_KEY = "refreshToken";

// window sizes
const LOGIN_SIZE = { width: 420, height: 560 };
const APP_SIZE = { width: 1360, height: 768 };

function logError(scope, error) {
  console.error(`[${scope}]`, error?.response?.data || error?.message || error);
}

function isInvalidTokenError(error) {
  const status = error?.response?.status;
  const msg = String(error?.response?.data?.error || error?.message || "").toLowerCase();
  return status === 401 || msg.includes("invalid token") || msg.includes("jwt expired");
}

function isDev() {
  return !app.isPackaged;
}

function getStartUrl() {
  // In dev we must load the React dev server (never the API domain).
  // Allow overriding via ELECTRON_START_URL (used by npm script).
  if (isDev()) {
    const fromEnv = String(process.env.ELECTRON_START_URL || "").trim();
    if (fromEnv) return fromEnv;
    return "http://localhost:3000";
  }
  return `file://${path.join(__dirname, "../build/index.html")}`;
}

// ---------- Auto update ----------
let updatePolicy = { required: false, minVersion: null, message: null };
let updateChecking = false;
let updateDownloaded = false;
let updateInfoLatest = null;
let updateState = {
  phase: "idle", // idle | checking | available | downloading | downloaded | not_available | error
  required: false,
  policyRequired: false,
  currentVersion: app.getVersion(),
  targetVersion: null,
  progress: 0,
  etaSeconds: null,
  message: null,
  error: null,
};

function isVersionLowerThan(current, target) {
  const c = semver.coerce(String(current || ""));
  const t = semver.coerce(String(target || ""));
  if (!c || !t) return false;
  return semver.lt(c, t);
}

function computeMustUpdate(policy, targetVersion = null) {
  if (!policy?.required) return false;
  const current = app.getVersion();
  if (policy.minVersion) return isBelowMinVersion(current, policy.minVersion);
  if (targetVersion) return isVersionLowerThan(current, targetVersion);
  // If backend marks required but provides no version hints, stay strict.
  return true;
}

function publishUpdaterState(patch = {}) {
  const policyMessage =
    typeof updatePolicy?.message === "string" && updatePolicy.message.trim()
      ? updatePolicy.message.trim()
      : null;
  updateState = {
    ...updateState,
    ...patch,
    policyRequired: !!updatePolicy?.required,
    required: computeMustUpdate(updatePolicy, patch?.targetVersion ?? updateState?.targetVersion ?? null),
    currentVersion: app.getVersion(),
    message: patch?.message !== undefined ? patch.message : (updateState.message ?? policyMessage),
  };
  if (win && !win.isDestroyed()) {
    win.webContents.send("updater:state", updateState);
  }
}

async function fetchUpdatePolicy() {
  try {
    const res = await axios.get(`${API_BASE_CLEAN}/api/updates/desktop`, { timeout: 8000 });
    if (!res?.data?.ok) return updatePolicy;
    updatePolicy = {
      required: !!res.data.required,
      minVersion: typeof res.data.minVersion === "string" ? res.data.minVersion.trim() : null,
      message: typeof res.data.message === "string" ? res.data.message : null,
    };
    return updatePolicy;
  } catch {
    return updatePolicy;
  }
}

function isBelowMinVersion(current, minVersion) {
  if (!minVersion) return false;
  const c = semver.coerce(String(current || ""));
  const m = semver.coerce(String(minVersion || ""));
  if (!c || !m) return false;
  return semver.lt(c, m);
}

async function ensureUpdaterConfigured() {
  if (isDev()) return;
  autoUpdater.setFeedURL({ provider: "generic", url: UPDATES_FEED_URL });
  // Download only when the user clicks "Update now".
  autoUpdater.autoDownload = false;
  // Apply explicitly from "Restart now" (not silently on any quit).
  autoUpdater.autoInstallOnAppQuit = false;
}

async function checkForUpdatesWithPolicy({ silent = false } = {}) {
  if (isDev()) return;
  if (updateChecking) return;
  updateChecking = true;
  try {
    await ensureUpdaterConfigured();
    await fetchUpdatePolicy();
    publishUpdaterState({
      phase: "checking",
      error: null,
      progress: 0,
      targetVersion: null,
      message: null,
    });
    await autoUpdater.checkForUpdates();
  } catch (err) {
    if (!silent) {
      publishUpdaterState({
        phase: "error",
        error: String(err?.message || err || "Update check failed"),
      });
    }
  } finally {
    updateChecking = false;
  }
}

function wireAutoUpdaterEvents() {
  if (isDev()) return;
  autoUpdater.on("checking-for-update", () => {
    publishUpdaterState({
      phase: "checking",
      error: null,
      progress: 0,
      targetVersion: null,
    });
  });

  autoUpdater.on("update-available", (info) => {
    updateInfoLatest = info || null;
    updateDownloaded = false;
    publishUpdaterState({
      phase: "available",
      targetVersion: info?.version ? String(info.version) : null,
      progress: 0,
      error: null,
      message: updatePolicy?.message || null,
    });
  });

  autoUpdater.on("update-not-available", () => {
    updateInfoLatest = null;
    updateDownloaded = false;
    publishUpdaterState({
      phase: "not_available",
      targetVersion: null,
      progress: 0,
      error: null,
    });
  });

  autoUpdater.on("download-progress", (progressObj) => {
    const pct = Number(progressObj?.percent);
    const total = Number(progressObj?.total);
    const transferred = Number(progressObj?.transferred);
    const bps = Number(progressObj?.bytesPerSecond);
    const etaSeconds =
      Number.isFinite(total) &&
      Number.isFinite(transferred) &&
      Number.isFinite(bps) &&
      bps > 0 &&
      total >= transferred
        ? Math.ceil((total - transferred) / bps)
        : null;
    publishUpdaterState({
      phase: "downloading",
      progress: Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0,
      etaSeconds: Number.isFinite(etaSeconds) ? etaSeconds : null,
      error: null,
    });
  });

  autoUpdater.on("update-downloaded", async (info) => {
    updateDownloaded = true;
    updateInfoLatest = info || updateInfoLatest;
    publishUpdaterState({
      phase: "downloaded",
      progress: 100,
      etaSeconds: 0,
      targetVersion:
        info?.version ? String(info.version) : (updateInfoLatest?.version ? String(updateInfoLatest.version) : null),
      error: null,
    });
  });

  autoUpdater.on("error", async (err) => {
    publishUpdaterState({
      phase: "error",
      error: String(err?.message || err || "Updater error"),
    });
  });
}

function getAuthFilePath() {
  return path.join(app.getPath("userData"), AUTH_FILE);
}

function getDeviceId() {
  return machineIdSync(true);
}

function getDeviceName() {
  return os.hostname();
}

function getIconPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "icon.ico")
    : path.join(__dirname, "..", "buildResources", "icon.ico");
}

// ---------- Local auth storage ----------
async function readLocalAuth() {
  const fp = getAuthFilePath();
  let accessToken = null;
  let deviceId = null;
  let deviceName = null;

  if (fs.existsSync(fp)) {
    try {
      const raw = fs.readFileSync(fp, "utf8");
      const data = JSON.parse(raw);
      accessToken = data.accessToken || null;
      deviceId = data.deviceId || null;
      deviceName = data.deviceName || null;
    } catch (error) {
      logError("readLocalAuth", error);
    }
  }

  const refreshToken = await keytar.getPassword(SERVICE, REFRESH_KEY);
  return { accessToken, refreshToken, deviceId, deviceName };
}

async function writeLocalAuth({ accessToken, refreshToken, deviceId, deviceName }) {
  const fp = getAuthFilePath();

  fs.writeFileSync(
    fp,
    JSON.stringify({ accessToken, deviceId, deviceName }, null, 2),
    "utf8"
  );

  if (refreshToken) {
    await keytar.setPassword(SERVICE, REFRESH_KEY, refreshToken);
  }
}

async function clearLocalAuth() {
  const fp = getAuthFilePath();

  if (fs.existsSync(fp)) {
    fs.unlinkSync(fp);
  }

  await keytar.deletePassword(SERVICE, REFRESH_KEY);
}

// ---------- API helpers ----------
async function apiMe(accessToken) {
  const res = await axios.get(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  return res.data;
}

async function apiRefresh(refreshToken, deviceName) {
  const res = await axios.post(`${API_BASE}/auth/refresh`, {
    refreshToken,
    deviceName
  });
  return res.data;
}

async function apiImpersonateStart(accessToken, targetEmployeeId) {
  const res = await axios.post(
    `${API_BASE}/auth/impersonate/start`,
    { targetEmployeeId },
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return res.data;
}

async function apiImpersonateStop(accessToken) {
  const res = await axios.post(
    `${API_BASE}/auth/impersonate/stop`,
    {},
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return res.data;
}

async function applyAccessTokenAndAccount({ accessToken, user }) {
  const local = await readLocalAuth();

  await writeLocalAuth({
    accessToken,
    refreshToken: local.refreshToken || null,
    deviceId: local.deviceId || getDeviceId(),
    deviceName: local.deviceName || getDeviceName()
  });

  account = user || null;

  closeWs();

  try {
    await ensureWsConnected();
  } catch (error) {
    logError("applyAccessTokenAndAccount:ensureWsConnected", error);
  }

  if (win && !win.isDestroyed()) {
    win.webContents.send("account:updated", account);
  }

  return { ok: true, user: account };
}

// ---------- Bootstrap flow ----------
async function bootstrapAuth() {
  const deviceId = getDeviceId();
  const deviceName = getDeviceName();
  const local = await readLocalAuth();

  if (!local.deviceId || local.deviceId !== deviceId) {
    await writeLocalAuth({
      accessToken: local.accessToken || null,
      refreshToken: local.refreshToken || null,
      deviceId,
      deviceName
    });
  }

  if (!local.refreshToken) {
    account = null;
    return { status: "NEED_LOGIN", deviceId, deviceName };
  }

  try {
    const refreshed = await apiRefresh(local.refreshToken, deviceName);

    await writeLocalAuth({
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      deviceId,
      deviceName
    });

    let user;

    try {
      const meRes = await apiMe(refreshed.accessToken);
      user = meRes?.user ?? refreshed.user;
    } catch (error) {
      logError("bootstrapAuth:apiMe", error);
      user = refreshed.user;
    }

    if (user && (!user.role || !Array.isArray(user.role?.permissions))) {
      try {
        const meAgain = await apiMe(refreshed.accessToken);
        if (meAgain?.user?.role) {
          user = meAgain.user;
        }
      } catch (error) {
        logError("bootstrapAuth:apiMe:retry", error);
      }
    }

    account = user;

    const result = await ensureRoleAndReturn(account, deviceId, deviceName);
    account = result.status === "OK" ? result.user : null;
    return result;
  } catch (error) {
    logError("bootstrapAuth", error);
    await clearLocalAuth();
    account = null;
    return { status: "NEED_LOGIN", deviceId, deviceName };
  }
}

function hasUsableRole(user) {
  return Boolean(user?.role && Array.isArray(user?.role?.permissions));
}

async function ensureRoleAndReturn(currentAccount, deviceId, deviceName) {
  if (hasUsableRole(currentAccount)) {
    return { status: "OK", user: currentAccount, deviceId, deviceName };
  }

  try {
    const auth = await readLocalAuth();
    let accessToken = auth.accessToken || null;
    let refreshToken = auth.refreshToken || null;
    const persistedDeviceId = auth.deviceId || deviceId || getDeviceId();
    const persistedDeviceName = auth.deviceName || deviceName || getDeviceName();

    const tryMe = async () => {
      if (!accessToken) return null;

      try {
        const me = await apiMe(accessToken);
        return me?.user || null;
      } catch (error) {
        logError("ensureRoleAndReturn:tryMe", error);
        return null;
      }
    };

    let meUser = await tryMe();
    if (hasUsableRole(meUser)) {
      return { status: "OK", user: meUser, deviceId, deviceName };
    }

    const stopRes = accessToken
      ? await apiImpersonateStop(accessToken).catch((error) => {
          logError("ensureRoleAndReturn:apiImpersonateStop", error);
          return null;
        })
      : null;

    if (stopRes?.accessToken) {
      accessToken = stopRes.accessToken;

      await writeLocalAuth({
        accessToken,
        refreshToken,
        deviceId: persistedDeviceId,
        deviceName: persistedDeviceName
      });

      if (hasUsableRole(stopRes.user)) {
        return { status: "OK", user: stopRes.user, deviceId, deviceName };
      }

      meUser = await tryMe();
      if (hasUsableRole(meUser)) {
        return { status: "OK", user: meUser, deviceId, deviceName };
      }
    }

    if (refreshToken) {
      const refreshed = await apiRefresh(refreshToken, persistedDeviceName).catch((error) => {
        logError("ensureRoleAndReturn:apiRefresh", error);
        return null;
      });

      if (refreshed?.accessToken) {
        accessToken = refreshed.accessToken;
        refreshToken = refreshed.refreshToken || refreshToken;

        await writeLocalAuth({
          accessToken,
          refreshToken,
          deviceId: persistedDeviceId,
          deviceName: persistedDeviceName
        });

        if (hasUsableRole(refreshed.user)) {
          return { status: "OK", user: refreshed.user, deviceId, deviceName };
        }

        meUser = await tryMe();
        if (hasUsableRole(meUser)) {
          return { status: "OK", user: meUser, deviceId, deviceName };
        }
      }
    }
  } catch (error) {
    logError("ensureRoleAndReturn", error);
  }

  await clearLocalAuth();
  return { status: "NEED_LOGIN", user: null, deviceId, deviceName };
}

// ---------- Window helpers ----------
function setWindowToWorkArea() {
  if (!win || win.isDestroyed()) return;

  const primary = screen.getPrimaryDisplay();
  const work = primary.workArea;

  win.setResizable(true);
  win.setBounds({
    x: work.x,
    y: work.y,
    width: work.width,
    height: work.height
  });
  win.setResizable(false);
}

function setWindowMode(mode) {
  if (!win || win.isDestroyed()) return;

  if (mode === "APP") {
    win.setMinimumSize(APP_SIZE.width, APP_SIZE.height);
    setWindowToWorkArea();
  } else {
    win.setResizable(false);
    win.setMinimumSize(LOGIN_SIZE.width, LOGIN_SIZE.height);
    win.setBounds({
      width: LOGIN_SIZE.width,
      height: LOGIN_SIZE.height
    });
    win.center();
  }

  win.webContents.send("window:mode", { mode });
}

function createWindow({ mode }) {
  const initial = mode === "APP" ? APP_SIZE : LOGIN_SIZE;

  win = new BrowserWindow({
    width: initial.width,
    height: initial.height,
    minWidth: initial.width,
    minHeight: initial.height,
    resizable: false,
    backgroundColor: "#09090b",
    icon: getIconPath(),
    transparent: false,
    frame: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      backgroundThrottling: false,
      nodeIntegration: false
    }
  });

  // Block developer tools/reload shortcuts in production hard.
  // This prevents end users from opening DevTools with common key combos.
  if (!isDev()) {
    win.webContents.on("before-input-event", (event, input) => {
      const key = String(input?.key || "").toLowerCase();
      const ctrlOrCmd = !!input?.control || !!input?.meta;
      const shift = !!input?.shift;
      const blockedReload =
        key === "f5" ||
        (ctrlOrCmd && key === "r") ||
        (ctrlOrCmd && shift && key === "r");
      const blockedDevtools =
        key === "f12" ||
        (ctrlOrCmd && shift && key === "i") ||
        (ctrlOrCmd && shift && key === "j") ||
        (ctrlOrCmd && shift && key === "c");

      if (blockedReload || blockedDevtools) {
        event.preventDefault();
      }
    });

    // Extra guard if anything attempts to open DevTools programmatically.
    win.webContents.on("devtools-opened", () => {
      try {
        win.webContents.closeDevTools();
      } catch {
        // ignore
      }
    });
  }

  win.loadURL(getStartUrl());

  win.webContents.once("did-finish-load", () => {
    if (!win || win.isDestroyed()) return;

    win.webContents.send("window:mode", { mode });

    if (bootResult) {
      win.webContents.send("auth:bootstrap:result", bootResult);
    }
    win.webContents.send("updater:state", updateState);

    if (mode === "APP") {
      setWindowToWorkArea();
    }

    win.show();
  });
}

// ---------- WS ----------
function getWsUrl(accessToken) {
  const base = API_BASE.replace(/^https/, "wss");
  return `${base}/ws?token=${encodeURIComponent(accessToken)}`;
}

function forwardToRenderer(msg) {
  if (win && !win.isDestroyed()) {
    win.webContents.send("ws:message", msg);
  }
}

function emitWsDisconnected() {
  if (win && !win.isDestroyed()) {
    win.webContents.send("ws:disconnected");
  }
}

function emitWsConnected() {
  if (win && !win.isDestroyed()) {
    win.webContents.send("ws:connected");
  }
}

function rid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function stopWsKeepAlive() {
  if (wsKeepAliveTimer) {
    clearInterval(wsKeepAliveTimer);
    wsKeepAliveTimer = null;
  }
  if (wsPongTimeoutTimer) {
    clearTimeout(wsPongTimeoutTimer);
    wsPongTimeoutTimer = null;
  }
}

function startWsKeepAlive(socket) {
  stopWsKeepAlive();
  wsKeepAliveTimer = setInterval(() => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    try {
      socket.ping();
      if (wsPongTimeoutTimer) clearTimeout(wsPongTimeoutTimer);
      wsPongTimeoutTimer = setTimeout(() => {
        wsPongTimeoutTimer = null;
        try {
          socket.terminate();
        } catch (_) {}
      }, WS_PONG_TIMEOUT_MS);
    } catch (error) {
      logError("ws:keepalive:ping", error);
    }
  }, WS_PING_INTERVAL_MS);
}

function ensureWsConnected() {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        const local = await readLocalAuth();

        if (!local.accessToken) {
          reject(new Error("No access token"));
          return;
        }

        if (wsClient && wsClient.readyState === WebSocket.OPEN) {
          resolve();
          return;
        }

        if (wsClient) {
          try {
            wsClient.close();
          } catch (error) {
            logError("ensureWsConnected:closeExisting", error);
          }
          wsClient = null;
        }

        const socket = new WebSocket(getWsUrl(local.accessToken));
        wsClient = socket;
        let disconnectHandled = false;

        const onOpen = () => {
          cleanup();
          startWsKeepAlive(socket);
          emitWsConnected();

          if (reconnectTimer) {
            clearInterval(reconnectTimer);
            reconnectTimer = null;
          }

          try {
            socket.send(JSON.stringify({ type: "roles:subscribe", requestId: "init_roles" }));
          } catch (error) {
            logError("ensureWsConnected:rolesSubscribe", error);
          }

          resolve();
        };

        const onError = (error) => {
          stopWsKeepAlive();
          if (wsClient === socket) {
            wsClient = null;
          }
          if (!disconnectHandled) {
            disconnectHandled = true;
            emitWsDisconnected();
            scheduleReconnect();
          }
          cleanup();
          reject(error || new Error("WebSocket connection failed"));
        };

        const onClose = () => {
          const wasIntentional = wsIntentionalClose;
          stopWsKeepAlive();

          if (wsClient === socket) {
            wsClient = null;
          }

          if (wasIntentional) {
            wsIntentionalClose = false;
            return;
          }

          if (!disconnectHandled) {
            disconnectHandled = true;
            emitWsDisconnected();
            scheduleReconnect();
          }
        };

        const cleanup = () => {
          socket.removeListener("open", onOpen);
          socket.removeListener("error", onError);
          socket.removeListener("close", onClose);
        };

        socket.once("open", onOpen);
        socket.once("error", onError);
        socket.on("close", onClose);
        socket.on("pong", () => {
          if (wsPongTimeoutTimer) {
            clearTimeout(wsPongTimeoutTimer);
            wsPongTimeoutTimer = null;
          }
        });

        socket.on("message", (data) => {
          let msg;

          try {
            msg = JSON.parse(String(data));
          } catch {
            return;
          }

          if (msg.type === "roles:list" && Array.isArray(msg.roles)) {
            rolesCache = msg.roles;
          }

          if (msg.requestId && wsPending.has(msg.requestId)) {
            const resolvePending = wsPending.get(msg.requestId);
            wsPending.delete(msg.requestId);

            try {
              resolvePending(msg);
            } catch (error) {
              logError("ensureWsConnected:resolvePending", error);
            }
          }

          forwardToRenderer(msg);
        });
      } catch (error) {
        reject(error);
      }
    })();
  });
}

function scheduleReconnect() {
  if (reconnectTimer) return;

  reconnectTimer = setInterval(async () => {
    try {
      const local = await readLocalAuth();

      if (!local.accessToken) {
        clearInterval(reconnectTimer);
        reconnectTimer = null;
        return;
      }

      await ensureWsConnected();
    } catch (error) {
      logError("scheduleReconnect", error);
    }
  }, 4000);
}

function wsSend(obj) {
  if (!wsClient || wsClient.readyState !== WebSocket.OPEN) {
    throw new Error("ws not connected");
  }

  wsClient.send(JSON.stringify(obj));
}

async function wsRequest(type, payload, timeoutMs = 8000) {
  await ensureWsConnected();

  const requestId = rid();

  const pendingPromise = new Promise((resolve) => {
    wsPending.set(requestId, resolve);

    setTimeout(() => {
      if (wsPending.has(requestId)) {
        wsPending.delete(requestId);
        resolve({
          ok: false,
          error: "timeout",
          type: `${type}:result`,
          requestId
        });
      }
    }, timeoutMs);
  });

  wsSend({ type, requestId, payload });
  return pendingPromise;
}

function closeWs() {
  wsIntentionalClose = true;
  stopWsKeepAlive();

  if (wsClient) {
    try {
      wsClient.close();
    } catch (error) {
      logError("closeWs", error);
    }
    wsClient = null;
  }

  if (reconnectTimer) {
    clearInterval(reconnectTimer);
    reconnectTimer = null;
  }

  rolesCache = [];
  wsPending.clear();
}

// ---------- App lifecycle ----------
app.whenReady().then(async () => {
  if (!isDev() && process.platform === "win32") {
    // Ensure Windows toasts are attributed to app identity in production.
    app.setAppUserModelId("com.yammak.client");
  }
  try {
    session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => {
      callback(permission === "geolocation");
    });
  } catch (error) {
    logError("setPermissionRequestHandler", error);
  }

  wireAutoUpdaterEvents();

  bootResult = await bootstrapAuth();
  const startMode = bootResult.status === "OK" ? "APP" : "LOGIN";

  createWindow({ mode: startMode });

  if (bootResult.status === "OK") {
    try {
      await ensureWsConnected();
    } catch (error) {
      logError("appReady:ensureWsConnected", error);
    }
  }

  // Periodic refresh of update state; UI-triggered checks handle immediate prompts.
  setInterval(() => { checkForUpdatesWithPolicy({ silent: true }); }, 30 * 60 * 1000);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// ---------- IPC ----------
ipcMain.handle("auth:bootstrap", async () => {
  const result = await bootstrapAuth();

  if (win && !win.isDestroyed()) {
    setWindowMode(result.status === "OK" ? "APP" : "LOGIN");
  }

  if (result.status === "OK") {
    try {
      await ensureWsConnected();
    } catch (error) {
      logError("ipc:auth:bootstrap:ensureWsConnected", error);
    }
  }

  return result;
});

ipcMain.handle("auth:login", async (event, { email, password, geo }) => {
  const deviceId = getDeviceId();
  const deviceName = getDeviceName();

  let countryCode = "";

  try {
    const geo = await axios.get("https://ipapi.co/json/", { timeout: 3000 });
    if (geo.data?.country_code) {
      countryCode = String(geo.data.country_code);
    }
  } catch (error) {
    logError("auth:login:geo", error);
  }

  let res;

  try {
    res = await axios.post(`${API_BASE}/auth/login`, {
      email,
      password,
      deviceId,
      deviceName,
      countryCode: countryCode || undefined,
      geo:
        geo && typeof geo === "object"
          ? {
              latitude: Number(geo.latitude),
              longitude: Number(geo.longitude),
              altitude: geo.altitude != null ? Number(geo.altitude) : null,
            }
          : undefined,
    });
  } catch (error) {
    if (error.response?.status === 423 && error.response?.data?.error === "account_locked") {
      throw new Error("account_locked");
    }

    const msg = error.response?.data?.error || error.message || "Login failed";
    throw new Error(typeof msg === "string" ? msg : "Login failed");
  }

  await writeLocalAuth({
    accessToken: res.data.accessToken,
    refreshToken: res.data.refreshToken,
    deviceId,
    deviceName
  });

  account = res.data.user;

  if (win && !win.isDestroyed()) {
    setWindowMode("APP");
  }

  try {
    await ensureWsConnected();
  } catch (error) {
    logError("auth:login:ensureWsConnected", error);
  }

  if (win && !win.isDestroyed()) {
    win.webContents.send("auth:loggedIn", account);
  }

  return res.data;
});

ipcMain.handle("auth:logout", async () => {
  const local = await readLocalAuth();

  if (local.refreshToken) {
    try {
      await axios.post(`${API_BASE}/auth/logout`, { refreshToken: local.refreshToken });
    } catch (error) {
      logError("auth:logout:apiLogout", error);
    }
  }

  if (wsClient && wsClient.readyState === WebSocket.OPEN) {
    try {
      wsClient.send(JSON.stringify({ type: "presence:leave" }));
    } catch (error) {
      logError("auth:logout:presenceLeave", error);
    }
  }

  await clearLocalAuth();
  account = null;
  closeWs();

  if (win && !win.isDestroyed()) {
    setWindowMode("LOGIN");
    win.webContents.send("auth:loggedOut", { ok: true });
  }

  return { ok: true };
});

ipcMain.handle("account:get", async () => account);
ipcMain.handle("auth:getDeviceId", () => getDeviceId());

ipcMain.handle("stats:get", async () => {
  try {
    const msg = await wsRequest("stats:get", {});

    if (!msg || msg.ok === false) {
      return { error: msg?.error || "Failed to load stats" };
    }

    return {
      totalEmployees: typeof msg.totalEmployees === "number" ? msg.totalEmployees : null
    };
  } catch (error) {
    logError("stats:get", error);
    return { error: "Failed to load stats" };
  }
});

ipcMain.handle("ws:connect", async () => {
  try {
    await ensureWsConnected();
    return { ok: true };
  } catch (error) {
    emitWsDisconnected();
    return { ok: false, error: error?.message || "connect_failed" };
  }
});

ipcMain.handle("ws:send", async (event, msg) => {
  try {
    await ensureWsConnected();
    wsSend(msg);
    return { ok: true };
  } catch (error) {
    emitWsDisconnected();
    scheduleReconnect();
    return { ok: false, error: error?.message || "send_failed" };
  }
});

ipcMain.handle("roles:getCache", async () => ({ roles: rolesCache }));

ipcMain.handle("window:setMode", async (event, { mode }) => {
  if (!win || win.isDestroyed()) {
    return { ok: false };
  }

  setWindowMode(mode === "APP" ? "APP" : "LOGIN");
  return { ok: true };
});

ipcMain.handle("window:focus", async () => {
  if (win && !win.isDestroyed()) {
    win.show();
    win.focus();
  }

  return { ok: true };
});

ipcMain.handle("desktop:notify", async (event, payload = {}) => {
  try {
    const title = typeof payload?.title === "string" && payload.title.trim() ? payload.title.trim() : "Yammak";
    const body = typeof payload?.body === "string" ? payload.body.trim() : "";

    if (!Notification?.isSupported?.()) {
      return { ok: false, error: "unsupported" };
    }

    const n = new Notification({
      title,
      body,
      silent: false,
      urgency: "normal",
      icon: getIconPath(),
    });

    n.show();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error?.message || "notify_failed" };
  }
});

ipcMain.handle("updater:getState", async () => {
  if (isDev()) return { ...updateState, phase: "idle" };
  try {
    await ensureUpdaterConfigured();
    await fetchUpdatePolicy();
    publishUpdaterState({});
  } catch {
    // keep last state
  }
  return updateState;
});

ipcMain.handle("updater:check", async () => {
  if (isDev()) return { ok: true, state: updateState };
  await checkForUpdatesWithPolicy({ silent: false });
  return { ok: true, state: updateState };
});

ipcMain.handle("updater:download", async () => {
  if (isDev()) return { ok: false, error: "dev_mode" };
  try {
    await ensureUpdaterConfigured();
    await fetchUpdatePolicy();
    if (updateDownloaded || updateState.phase === "downloaded") {
      return { ok: true, state: updateState };
    }
    publishUpdaterState({
      phase: "downloading",
      progress: Math.max(0, Number(updateState.progress || 0)),
      error: null,
    });
    await autoUpdater.downloadUpdate();
    return { ok: true, state: updateState };
  } catch (error) {
    publishUpdaterState({
      phase: "error",
      error: String(error?.message || error || "download_failed"),
    });
    return { ok: false, error: error?.message || "download_failed", state: updateState };
  }
});

ipcMain.handle("updater:restartNow", async () => {
  if (isDev()) return { ok: false, error: "dev_mode" };
  try {
    // Apply update silently and relaunch app after install.
    autoUpdater.quitAndInstall(false, true);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error?.message || "restart_failed" };
  }
});

ipcMain.handle("clipboard:copyImage", async (event, payload = {}) => {
  try {
    const input = String(payload?.url || "").trim();
    if (!input) return { ok: false, error: "invalid_url" };

    let img = null;
    if (input.startsWith("data:image/")) {
      img = nativeImage.createFromDataURL(input);
    } else {
      const res = await axios.get(input, { responseType: "arraybuffer", timeout: 12000 });
      const buf = Buffer.from(res.data);
      img = nativeImage.createFromBuffer(buf);
    }

    if (!img || img.isEmpty()) return { ok: false, error: "invalid_image" };
    clipboard.writeImage(img);
    return { ok: true };
  } catch (error) {
    logError("clipboard:copyImage", error);
    return { ok: false, error: error?.message || "copy_failed" };
  }
});

ipcMain.handle("shell:openExternal", async (event, url) => {
  if (typeof url !== "string" || !url.trim()) return { ok: false, error: "invalid" };
  const u = url.trim();
  if (!/^tel:/i.test(u)) return { ok: false, error: "unsupported" };
  try {
    await shell.openExternal(u);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || "open_failed" };
  }
});

ipcMain.handle("app:quit", () => {
  app.quit();
});

ipcMain.handle("auth:me", async () => {
  const local = await readLocalAuth();

  if (!local.accessToken) {
    return { error: "Not authenticated" };
  }

  try {
    const me = await apiMe(local.accessToken);

    const ensured = await ensureRoleAndReturn(
      me?.user || null,
      local.deviceId || getDeviceId(),
      local.deviceName || getDeviceName()
    );

    if (ensured.status !== "OK" || !ensured.user) {
      account = null;
      return { error: "Not authenticated" };
    }

    account = ensured.user;

    if (win && !win.isDestroyed()) {
      win.webContents.send("account:updated", account);
    }

    return { user: account };
  } catch (error) {
    logError("auth:me", error);
    return { error: "Failed to load account" };
  }
});

ipcMain.handle("auth:impersonateStart", async (event, { targetEmployeeId }) => {
  if (!targetEmployeeId) {
    return { ok: false, error: "targetEmployeeId required" };
  }

  const local = await readLocalAuth();

  if (!local.accessToken) {
    return { ok: false, error: "Not authenticated" };
  }

  try {
    const out = await apiImpersonateStart(local.accessToken, String(targetEmployeeId));

    if (!out?.accessToken || !out?.user) {
      return { ok: false, error: "Invalid impersonation response" };
    }

    const ensured = await ensureRoleAndReturn(
      out.user,
      local.deviceId || getDeviceId(),
      local.deviceName || getDeviceName()
    );
    if (ensured.status !== "OK" || !ensured.user) {
      return { ok: false, error: "Failed to resolve impersonated account permissions" };
    }

    await applyAccessTokenAndAccount({
      accessToken: out.accessToken,
      user: ensured.user
    });

    return {
      ok: true,
      user: ensured.user,
      impersonation: out.impersonation || ensured.user?.impersonation || null
    };
  } catch (error) {
    const msg =
      error?.response?.data?.error || error?.message || "Failed to start impersonation";
    return { ok: false, error: msg };
  }
});

ipcMain.handle("auth:impersonateStop", async () => {
  const local = await readLocalAuth();

  if (!local.accessToken) {
    return { ok: false, error: "Not authenticated" };
  }

  try {
    const out = await apiImpersonateStop(local.accessToken);

    if (!out?.accessToken || !out?.user) {
      return { ok: false, error: "Invalid impersonation response" };
    }

    const ensured = await ensureRoleAndReturn(
      out.user,
      local.deviceId || getDeviceId(),
      local.deviceName || getDeviceName()
    );
    if (ensured.status !== "OK" || !ensured.user) {
      return { ok: false, error: "Failed to resolve account after impersonation stop" };
    }

    await applyAccessTokenAndAccount({
      accessToken: out.accessToken,
      user: ensured.user
    });

    return { ok: true, user: ensured.user };
  } catch (error) {
    const msg =
      error?.response?.data?.error || error?.message || "Failed to stop impersonation";
    return { ok: false, error: msg };
  }
});

ipcMain.handle("dialog:pickImage", async () => {
  const res = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] }]
  });

  if (res.canceled || !res.filePaths?.[0]) {
    return { ok: false };
  }

  return { ok: true, path: res.filePaths[0] };
});

ipcMain.handle("dialog:pickImages", async () => {
  const res = await dialog.showOpenDialog({
    properties: ["openFile", "multiSelections"],
    filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] }]
  });

  if (res.canceled || !res.filePaths?.length) {
    return { ok: false };
  }

  return { ok: true, paths: res.filePaths.slice(0, 8) };
});

ipcMain.handle("files:toDataUrl", async (event, filePath) => {
  try {
    const buf = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();

    const mime =
      ext === ".png"
        ? "image/png"
        : ext === ".jpg" || ext === ".jpeg"
          ? "image/jpeg"
          : ext === ".webp"
            ? "image/webp"
            : "application/octet-stream";

    const b64 = buf.toString("base64");
    return { ok: true, dataUrl: `data:${mime};base64,${b64}` };
  } catch (error) {
    logError("files:toDataUrl", error);
    return { ok: false, error: "read_failed" };
  }
});

ipcMain.handle("uploads:employees", async (event, files) => {
  const local = await readLocalAuth();
  let accessToken = local.accessToken;

  if (!accessToken && local.refreshToken) {
    const refreshed = await apiRefresh(local.refreshToken, getDeviceName());

    await writeLocalAuth({
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      deviceId: local.deviceId || getDeviceId(),
      deviceName: local.deviceName || getDeviceName()
    });

    accessToken = refreshed.accessToken;
  }

  if (!accessToken) {
    return { ok: false, error: "Not authenticated" };
  }

  const fd = new FormData();

  if (files?.employeePhotoPath) {
    fd.append("employeePhoto", fs.createReadStream(files.employeePhotoPath));
  }
  if (files?.nationalIdFrontPath) {
    fd.append("nationalIdFront", fs.createReadStream(files.nationalIdFrontPath));
  }
  if (files?.nationalIdBackPath) {
    fd.append("nationalIdBack", fs.createReadStream(files.nationalIdBackPath));
  }
  if (files?.housingCardFrontPath) {
    fd.append("housingCardFront", fs.createReadStream(files.housingCardFrontPath));
  }
  if (files?.housingCardBackPath) {
    fd.append("housingCardBack", fs.createReadStream(files.housingCardBackPath));
  }

  try {
    const res = await axios.post(`${API_BASE}/uploads/employees`, fd, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...fd.getHeaders()
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });

    return res.data;
  } catch (error) {
    // Token may have expired while app is open; refresh and retry once.
    if (isInvalidTokenError(error) && local.refreshToken) {
      try {
        const refreshed = await apiRefresh(local.refreshToken, getDeviceName());
        await writeLocalAuth({
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken,
          deviceId: local.deviceId || getDeviceId(),
          deviceName: local.deviceName || getDeviceName()
        });
        const retry = await axios.post(`${API_BASE}/uploads/employees`, fd, {
          headers: {
            Authorization: `Bearer ${refreshed.accessToken}`,
            ...fd.getHeaders()
          },
          maxBodyLength: Infinity,
          maxContentLength: Infinity
        });
        return retry.data;
      } catch (retryErr) {
        logError("uploads:employees:retry", retryErr);
      }
    }
    logError("uploads:employees", error);
    const msg = error?.response?.data?.error || "Upload failed";
    return { ok: false, error: msg };
  }
});

ipcMain.handle("uploads:chatImage", async (event, { filePath }) => {
  const accessToken = await getDocumentsAuth();
  if (!accessToken) return { ok: false, error: "Not authenticated" };
  if (!filePath || !fs.existsSync(filePath)) return { ok: false, error: "Image required" };

  const fd = new FormData();
  fd.append("image", fs.createReadStream(filePath), path.basename(filePath));
  try {
    const res = await axios.post(`${API_BASE}/uploads/chat-image`, fd, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...fd.getHeaders()
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });
    return res.data;
  } catch (error) {
    logError("uploads:chatImage", error);
    const status = error?.response?.status;
    const data = error?.response?.data;
    const msg =
      data?.error ||
      data?.message ||
      (typeof data === "string" ? data : null) ||
      error?.message ||
      "Upload failed";
    return { ok: false, error: String(msg), status, details: data };
  }
});

ipcMain.handle("uploads:chatImageFromBuffer", async (event, { arrayBuffer, fileName }) => {
  const accessToken = await getDocumentsAuth();
  if (!accessToken) return { ok: false, error: "Not authenticated" };
  if (!arrayBuffer || !(arrayBuffer instanceof ArrayBuffer)) return { ok: false, error: "Image required" };

  const ext = path.extname(String(fileName || "")).toLowerCase() || ".png";
  const tmpPath = path.join(os.tmpdir(), `chat-image-${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`);
  try {
    fs.writeFileSync(tmpPath, Buffer.from(arrayBuffer));
    const fd = new FormData();
    fd.append("image", fs.createReadStream(tmpPath), fileName || `image${ext}`);
    const res = await axios.post(`${API_BASE}/uploads/chat-image`, fd, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...fd.getHeaders()
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });
    return res.data;
  } catch (error) {
    logError("uploads:chatImageFromBuffer", error);
    const status = error?.response?.status;
    const data = error?.response?.data;
    const msg =
      data?.error ||
      data?.message ||
      (typeof data === "string" ? data : null) ||
      error?.message ||
      "Upload failed";
    return { ok: false, error: String(msg), status, details: data };
  } finally {
    try { fs.unlinkSync(tmpPath); } catch {}
  }
});

// ---------- Documents (PDF) API ----------
async function getDocumentsAuth() {
  const local = await readLocalAuth();
  let accessToken = local.accessToken;

  if (!accessToken && local.refreshToken) {
    const refreshed = await apiRefresh(local.refreshToken, getDeviceName());

    await writeLocalAuth({
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      deviceId: local.deviceId || getDeviceId(),
      deviceName: local.deviceName || getDeviceName()
    });

    accessToken = refreshed.accessToken;
  }

  if (!accessToken) {
    return null;
  }

  try {
    await apiMe(accessToken);
    return accessToken;
  } catch (error) {
    logError("getDocumentsAuth:apiMe", error);

    if (!local.refreshToken) {
      return null;
    }

    const refreshed = await apiRefresh(local.refreshToken, getDeviceName());

    await writeLocalAuth({
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      deviceId: local.deviceId || getDeviceId(),
      deviceName: local.deviceName || getDeviceName()
    });

    return refreshed.accessToken;
  }
}

ipcMain.handle("dialog:pickPdf", async () => {
  const res = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "PDF", extensions: ["pdf"] }]
  });

  if (res.canceled || !res.filePaths?.[0]) {
    return { ok: false };
  }

  return { ok: true, path: res.filePaths[0] };
});

ipcMain.handle("documents:list", async () => {
  const accessToken = await getDocumentsAuth();

  if (!accessToken) {
    return { ok: false, error: "Not authenticated" };
  }

  try {
    const res = await axios.get(`${API_BASE}/api/documents`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    return { ok: true, documents: res.data.documents || [] };
  } catch (error) {
    if (isInvalidTokenError(error)) {
      const local = await readLocalAuth();
      if (local.refreshToken) {
        try {
          const refreshed = await apiRefresh(local.refreshToken, getDeviceName());
          await writeLocalAuth({
            accessToken: refreshed.accessToken,
            refreshToken: refreshed.refreshToken,
            deviceId: local.deviceId || getDeviceId(),
            deviceName: local.deviceName || getDeviceName()
          });
          const retry = await axios.get(`${API_BASE}/api/documents`, {
            headers: { Authorization: `Bearer ${refreshed.accessToken}` }
          });
          return { ok: true, documents: retry.data.documents || [] };
        } catch (retryErr) {
          logError("documents:list:retry", retryErr);
        }
      }
    }
    logError("documents:list", error);

    const msg =
      error?.response?.data?.error ||
      (error?.response?.status === 403 ? "forbidden" : "Failed to load documents");

    return { ok: false, error: msg };
  }
});

ipcMain.handle("documents:upload", async (event, { title, filePath }) => {
  const accessToken = await getDocumentsAuth();

  if (!accessToken) {
    return { ok: false, error: "Not authenticated" };
  }

  if (!filePath || !fs.existsSync(filePath)) {
    return { ok: false, error: "File required" };
  }

  const fd = new FormData();
  fd.append("file", fs.createReadStream(filePath), path.basename(filePath));
  fd.append("title", title || path.basename(filePath, ".pdf") || "Untitled");

  try {
    const res = await axios.post(`${API_BASE}/api/documents`, fd, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...fd.getHeaders()
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });

    return res.data;
  } catch (error) {
    if (isInvalidTokenError(error)) {
      const local = await readLocalAuth();
      if (local.refreshToken) {
        try {
          const refreshed = await apiRefresh(local.refreshToken, getDeviceName());
          await writeLocalAuth({
            accessToken: refreshed.accessToken,
            refreshToken: refreshed.refreshToken,
            deviceId: local.deviceId || getDeviceId(),
            deviceName: local.deviceName || getDeviceName()
          });
          const retry = await axios.post(`${API_BASE}/api/documents`, fd, {
            headers: {
              Authorization: `Bearer ${refreshed.accessToken}`,
              ...fd.getHeaders()
            },
            maxBodyLength: Infinity,
            maxContentLength: Infinity
          });
          return retry.data;
        } catch (retryErr) {
          logError("documents:upload:retry", retryErr);
        }
      }
    }
    logError("documents:upload", error);
    const msg = error?.response?.data?.error || "Upload failed";
    return { ok: false, error: msg };
  }
});

ipcMain.handle("documents:uploadFromBuffer", async (event, { title, arrayBuffer, fileName }) => {
  const accessToken = await getDocumentsAuth();

  if (!accessToken) {
    return { ok: false, error: "Not authenticated" };
  }

  if (!arrayBuffer || !(arrayBuffer instanceof ArrayBuffer)) {
    return { ok: false, error: "File required" };
  }

  const tmpPath = path.join(
    os.tmpdir(),
    `doc-${Date.now()}-${fileName || "document.pdf"}`
  );

  try {
    fs.writeFileSync(tmpPath, Buffer.from(arrayBuffer));

    const fd = new FormData();
    fd.append("file", fs.createReadStream(tmpPath), fileName || "document.pdf");
    fd.append(
      "title",
      title || (fileName ? path.basename(fileName, ".pdf") : "Untitled") || "Untitled"
    );

    try {
      const res = await axios.post(`${API_BASE}/api/documents`, fd, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...fd.getHeaders()
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      });
      return res.data;
    } catch (error) {
      if (isInvalidTokenError(error)) {
        const local = await readLocalAuth();
        if (local.refreshToken) {
          try {
            const refreshed = await apiRefresh(local.refreshToken, getDeviceName());
            await writeLocalAuth({
              accessToken: refreshed.accessToken,
              refreshToken: refreshed.refreshToken,
              deviceId: local.deviceId || getDeviceId(),
              deviceName: local.deviceName || getDeviceName()
            });
            const retry = await axios.post(`${API_BASE}/api/documents`, fd, {
              headers: {
                Authorization: `Bearer ${refreshed.accessToken}`,
                ...fd.getHeaders()
              },
              maxBodyLength: Infinity,
              maxContentLength: Infinity
            });
            return retry.data;
          } catch (retryErr) {
            logError("documents:uploadFromBuffer:retry", retryErr);
          }
        }
      }
      throw error;
    }
  } catch (error) {
    logError("documents:uploadFromBuffer", error);
    const msg = error?.response?.data?.error || "Upload failed";
    return { ok: false, error: msg };
  } finally {
    try {
      fs.unlinkSync(tmpPath);
    } catch {}
  }
});

ipcMain.handle("documents:getFile", async (event, id) => {
  const accessToken = await getDocumentsAuth();

  if (!accessToken) {
    return { ok: false, error: "Not authenticated" };
  }

  try {
    const res = await axios.get(`${API_BASE}/api/documents/${id}/file`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      responseType: "arraybuffer"
    });

    const base64 = Buffer.from(res.data).toString("base64");
    return { ok: true, dataUrl: `data:application/pdf;base64,${base64}` };
  } catch (error) {
    logError("documents:getFile", error);
    return {
      ok: false,
      error: error?.response?.status === 404 ? "not_found" : "Failed to load file"
    };
  }
});

ipcMain.handle("documents:update", async (event, { id, title, filePath }) => {
  const accessToken = await getDocumentsAuth();

  if (!accessToken) {
    return { ok: false, error: "Not authenticated" };
  }

  const fd = new FormData();

  if (title !== undefined) {
    fd.append("title", title);
  }

  if (filePath && fs.existsSync(filePath)) {
    fd.append("file", fs.createReadStream(filePath), path.basename(filePath));
  }

  try {
    const res = await axios.patch(`${API_BASE}/api/documents/${id}`, fd, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...fd.getHeaders()
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });

    return res.data;
  } catch (error) {
    logError("documents:update", error);
    const msg = error?.response?.data?.error || "Update failed";
    return { ok: false, error: msg };
  }
});

ipcMain.handle("documents:printCount", async (event, id) => {
  const accessToken = await getDocumentsAuth();

  if (!accessToken) {
    return { ok: false, error: "Not authenticated" };
  }

  try {
    const res = await axios.post(
      `${API_BASE}/api/documents/${id}/print`,
      {},
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    return { ok: true, printCount: res.data.printCount };
  } catch (error) {
    logError("documents:printCount", error);
    return {
      ok: false,
      error: error?.response?.status === 404 ? "not_found" : "Failed"
    };
  }
});

ipcMain.handle("documents:delete", async (event, id) => {
  const accessToken = await getDocumentsAuth();

  if (!accessToken) {
    return { ok: false, error: "Not authenticated" };
  }

  try {
    await axios.delete(`${API_BASE}/api/documents/${id}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    return { ok: true };
  } catch (error) {
    logError("documents:delete", error);
    const msg = error?.response?.data?.error || "Delete failed";
    return { ok: false, error: msg };
  }
});

// ---------- Storage ----------
ipcMain.handle("storage:list", async () => {
  const accessToken = await getDocumentsAuth();

  if (!accessToken) {
    return { ok: false, error: "Not authenticated" };
  }

  try {
    const res = await axios.get(`${API_BASE}/api/storage`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    return { ok: true, items: res.data.items || [] };
  } catch (error) {
    logError("storage:list", error);

    const msg =
      error?.response?.data?.error ||
      (error?.response?.status === 403 ? "forbidden" : "Failed to load storage");

    return { ok: false, error: msg };
  }
});

ipcMain.handle("storage:dailySummary", async (event, days) => {
  const accessToken = await getDocumentsAuth();

  if (!accessToken) {
    return { ok: false, error: "Not authenticated" };
  }

  try {
    const res = await axios.get(
      `${API_BASE}/api/storage/daily-summary${days != null ? `?days=${days}` : ""}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    return { ok: true, days: res.data.days || [] };
  } catch (error) {
    logError("storage:dailySummary", error);

    const msg =
      error?.response?.data?.error ||
      (error?.response?.status === 403 ? "forbidden" : "Failed to load summary");

    return { ok: false, error: msg, days: [] };
  }
});

ipcMain.handle("storage:create", async (event, { name, quantity }) => {
  const accessToken = await getDocumentsAuth();

  if (!accessToken) {
    return { ok: false, error: "Not authenticated" };
  }

  try {
    const res = await axios.post(
      `${API_BASE}/api/storage`,
      { name, quantity },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        }
      }
    );

    return res.data;
  } catch (error) {
    logError("storage:create", error);
    const msg = error?.response?.data?.error || "Failed to create item";
    return { ok: false, error: msg };
  }
});

ipcMain.handle("storage:adjust", async (event, { id, type, amount }) => {
  const accessToken = await getDocumentsAuth();

  if (!accessToken) {
    return { ok: false, error: "Not authenticated" };
  }

  try {
    const res = await axios.patch(
      `${API_BASE}/api/storage/${id}`,
      { type, amount },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        }
      }
    );

    return res.data;
  } catch (error) {
    logError("storage:adjust", error);
    const msg = error?.response?.data?.error || "Failed to adjust";
    return { ok: false, error: msg };
  }
});

ipcMain.handle("storage:delete", async (event, id) => {
  const accessToken = await getDocumentsAuth();

  if (!accessToken) {
    return { ok: false, error: "Not authenticated" };
  }

  try {
    await axios.delete(`${API_BASE}/api/storage/${id}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    return { ok: true };
  } catch (error) {
    logError("storage:delete", error);
    const msg = error?.response?.data?.error || "Delete failed";
    return { ok: false, error: msg };
  }
});

// ---------- Call recordings (FreePBX CDR) API — permission: calls.recordings ----------
ipcMain.handle("vaults:list", async () => {
  const accessToken = await getDocumentsAuth();

  if (!accessToken) {
    return { ok: false, error: "Not authenticated" };
  }

  try {
    const res = await axios.get(`${API_BASE}/api/vaults`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    return {
      ok: true,
      items: res.data.items || [],
      categories: res.data.categories || []
    };
  } catch (error) {
    logError("vaults:list", error);
    const msg = error?.response?.data?.error || "Failed to load vault";
    return { ok: false, error: msg, items: [], categories: [] };
  }
});

ipcMain.handle("vaults:createCategory", async (event, { name, color }) => {
  const accessToken = await getDocumentsAuth();

  if (!accessToken) {
    return { ok: false, error: "Not authenticated" };
  }

  try {
    const res = await axios.post(
      `${API_BASE}/api/vaults/categories`,
      { name, color },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        }
      }
    );

    return res.data;
  } catch (error) {
    logError("vaults:createCategory", error);
    const msg = error?.response?.data?.error || "Failed to create category";
    return { ok: false, error: msg };
  }
});

ipcMain.handle("vaults:create", async (event, payload) => {
  const accessToken = await getDocumentsAuth();

  if (!accessToken) {
    return { ok: false, error: "Not authenticated" };
  }

  try {
    const res = await axios.post(`${API_BASE}/api/vaults`, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      }
    });

    return res.data;
  } catch (error) {
    logError("vaults:create", error);
    const msg = error?.response?.data?.error || "Failed to create vault item";
    return { ok: false, error: msg };
  }
});

ipcMain.handle("vaults:update", async (event, { id, ...payload }) => {
  const accessToken = await getDocumentsAuth();

  if (!accessToken) {
    return { ok: false, error: "Not authenticated" };
  }

  if (!id) {
    return { ok: false, error: "Vault item id is required" };
  }

  try {
    const res = await axios.patch(`${API_BASE}/api/vaults/${id}`, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      }
    });

    return res.data;
  } catch (error) {
    logError("vaults:update", error);
    const msg = error?.response?.data?.error || "Failed to update vault item";
    return { ok: false, error: msg };
  }
});

ipcMain.handle("vaults:delete", async (event, id) => {
  const accessToken = await getDocumentsAuth();

  if (!accessToken) {
    return { ok: false, error: "Not authenticated" };
  }

  if (!id) {
    return { ok: false, error: "Vault item id is required" };
  }

  try {
    await axios.delete(`${API_BASE}/api/vaults/${id}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    return { ok: true };
  } catch (error) {
    logError("vaults:delete", error);
    const msg = error?.response?.data?.error || "Failed to delete vault item";
    return { ok: false, error: msg };
  }
});

ipcMain.handle("vaults:reorder", async (event, itemIds) => {
  const accessToken = await getDocumentsAuth();

  if (!accessToken) {
    return { ok: false, error: "Not authenticated" };
  }

  try {
    const res = await axios.patch(
      `${API_BASE}/api/vaults/reorder`,
      { itemIds: Array.isArray(itemIds) ? itemIds : [] },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        }
      }
    );

    return res.data;
  } catch (error) {
    logError("vaults:reorder", error);
    const msg = error?.response?.data?.error || "Failed to reorder vault items";
    return { ok: false, error: msg };
  }
});

ipcMain.handle("calls:list", async (event, params = {}) => {
  const accessToken = await getDocumentsAuth();

  if (!accessToken) {
    return { ok: false, error: "Not authenticated" };
  }

  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.hasRecording !== undefined) {
    q.set("hasRecording", params.hasRecording ? "true" : "false");
  }
  if (params.src) q.set("src", String(params.src));
  if (params.dst) q.set("dst", String(params.dst));
  if (params.direction) q.set("direction", String(params.direction));
  if (params.disposition) q.set("disposition", String(params.disposition));
  if (params.from) q.set("from", String(params.from));
  if (params.to) q.set("to", String(params.to));
  if (params.fromEmployeeIds) q.set("fromEmployeeIds", String(params.fromEmployeeIds));

  const qs = q.toString();
  const url = `${API_BASE}/api/calls${qs ? `?${qs}` : ""}`;

  try {
    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    return {
      ok: true,
      items: res.data.items || [],
      page: res.data.page ?? 1,
      limit: res.data.limit ?? 50,
      total: res.data.total ?? 0,
      pages: res.data.pages ?? 1,
      scanCapped: Boolean(res.data.scanCapped),
      scanned: res.data.scanned
    };
  } catch (error) {
    logError("calls:list", error);

    const msg =
      error?.response?.data?.error ||
      (error?.response?.status === 403 ? "forbidden" : "Failed to load calls");

    return { ok: false, error: msg };
  }
});

ipcMain.handle("calls:analytics", async (event, params = {}) => {
  const accessToken = await getDocumentsAuth();

  if (!accessToken) {
    return { ok: false, error: "Not authenticated" };
  }

  const q = new URLSearchParams();
  if (params.from) q.set("from", String(params.from));
  if (params.to) q.set("to", String(params.to));
  if (params.hasRecording !== undefined) {
    q.set("hasRecording", params.hasRecording ? "true" : "false");
  }

  const qs = q.toString();
  const url = `${API_BASE}/api/calls/analytics${qs ? `?${qs}` : ""}`;

  try {
    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    return { ok: true, data: res.data };
  } catch (error) {
    logError("calls:analytics", error);
    const msg =
      error?.response?.data?.error ||
      (error?.response?.status === 403 ? "forbidden" : "Failed to load analytics");
    return { ok: false, error: msg };
  }
});

ipcMain.handle("calls:getAudio", async (event, uniqueid) => {
  const accessToken = await getDocumentsAuth();

  if (!accessToken) {
    return { ok: false, error: "Not authenticated" };
  }

  if (!uniqueid || typeof uniqueid !== "string") {
    return { ok: false, error: "uniqueid required" };
  }

  try {
    const res = await axios.get(`${API_BASE}/api/calls/${encodeURIComponent(uniqueid)}/audio`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      responseType: "arraybuffer",
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    const ct = res.headers["content-type"] || "audio/wav";
    const base64 = Buffer.from(res.data).toString("base64");
    return { ok: true, dataUrl: `data:${ct};base64,${base64}` };
  } catch (error) {
    logError("calls:getAudio", error);
    return {
      ok: false,
      error: error?.response?.status === 404 ? "not_found" : "Failed to load audio"
    };
  }
});

ipcMain.handle("calls:delete", async (event, uniqueid) => {
  const accessToken = await getDocumentsAuth();

  if (!accessToken) {
    return { ok: false, error: "Not authenticated" };
  }

  if (!uniqueid || typeof uniqueid !== "string") {
    return { ok: false, error: "uniqueid required" };
  }

  try {
    const res = await axios.delete(`${API_BASE}/api/calls/${encodeURIComponent(uniqueid)}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    return {
      ok: true,
      uniqueid: res.data?.uniqueid ?? uniqueid,
      deletedFromSource: Boolean(res.data?.deletedFromSource),
      deletedFile: Boolean(res.data?.deletedFile),
    };
  } catch (error) {
    logError("calls:delete", error);
    return {
      ok: false,
      error:
        error?.response?.data?.error ||
        (error?.response?.status === 404 ? "not_found" : "Failed to delete recording")
    };
  }
});

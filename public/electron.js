const { app, BrowserWindow, ipcMain, dialog, screen } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const axios = require("axios");
const WebSocket = require("ws");
const FormData = require("form-data");
const keytar = require("keytar");
const { machineIdSync } = require("node-machine-id");

let win = null;
let account = null;
let bootResult = null;

// WS client + caches
let wsClient = null;
let rolesCache = [];
let wsIntentionalClose = false;
let reconnectTimer = null;

// WS request waiters (requestId -> resolve)
const wsPending = new Map();

const API_BASE = process.env.API_BASE || "http://217.76.50.221:3000";

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

function isDev() {
  return !app.isPackaged;
}

function getStartUrl() {
  return isDev()
    ? "http://localhost:3000"
    : `file://${path.join(__dirname, "../build/index.html")}`;
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

  win.loadURL(getStartUrl());

  win.webContents.once("did-finish-load", () => {
    if (!win || win.isDestroyed()) return;

    win.webContents.send("window:mode", { mode });

    if (bootResult) {
      win.webContents.send("auth:bootstrap:result", bootResult);
    }

    if (mode === "APP") {
      setWindowToWorkArea();
    }

    win.show();
  });
}

// ---------- WS ----------
function getWsUrl(accessToken) {
  const base = API_BASE.replace(/^http/, "ws");
  return `${base}/ws?token=${encodeURIComponent(accessToken)}`;
}

function forwardToRenderer(msg) {
  if (win && !win.isDestroyed()) {
    win.webContents.send("ws:message", msg);
  }
}

function rid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
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

        const onOpen = () => {
          cleanup();

          if (reconnectTimer) {
            clearInterval(reconnectTimer);
            reconnectTimer = null;

            if (win && !win.isDestroyed()) {
              win.webContents.send("ws:connected");
            }
          }

          try {
            socket.send(JSON.stringify({ type: "roles:subscribe", requestId: "init_roles" }));
          } catch (error) {
            logError("ensureWsConnected:rolesSubscribe", error);
          }

          resolve();
        };

        const onError = (error) => {
          cleanup();
          reject(error || new Error("WebSocket connection failed"));
        };

        const onClose = () => {
          const wasIntentional = wsIntentionalClose;

          if (wsClient === socket) {
            wsClient = null;
          }

          if (wasIntentional) {
            wsIntentionalClose = false;
            return;
          }

          if (win && !win.isDestroyed()) {
            win.webContents.send("ws:disconnected");
          }

          scheduleReconnect();
        };

        const cleanup = () => {
          socket.removeListener("open", onOpen);
          socket.removeListener("error", onError);
          socket.removeListener("close", onClose);
        };

        socket.once("open", onOpen);
        socket.once("error", onError);
        socket.on("close", onClose);

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

ipcMain.handle("auth:login", async (event, { email, password }) => {
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
      countryCode: countryCode || undefined
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
  await ensureWsConnected();
  return { ok: true };
});

ipcMain.handle("ws:send", async (event, msg) => {
  await ensureWsConnected();
  wsSend(msg);
  return { ok: true };
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

    await applyAccessTokenAndAccount({
      accessToken: out.accessToken,
      user: out.user
    });

    return {
      ok: true,
      user: out.user,
      impersonation: out.impersonation || out.user?.impersonation || null
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

    await applyAccessTokenAndAccount({
      accessToken: out.accessToken,
      user: out.user
    });

    return { ok: true, user: out.user };
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
    logError("uploads:employees", error);
    const msg = error?.response?.data?.error || "Upload failed";
    return { ok: false, error: msg };
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
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  // Auth
  authBootstrap: () => ipcRenderer.invoke("auth:bootstrap"),
  authLogin: (email, password) => ipcRenderer.invoke("auth:login", { email, password }),
  authLogout: () => ipcRenderer.invoke("auth:logout"),
  authImpersonateStart: (targetEmployeeId) => ipcRenderer.invoke("auth:impersonateStart", { targetEmployeeId }),
  authImpersonateStop: () => ipcRenderer.invoke("auth:impersonateStop"),
  accountGet: () => ipcRenderer.invoke("account:get"),

  onAuthBootstrap: (cb) => ipcRenderer.on("auth:bootstrap:result", (_, data) => cb(data)),
  onLoggedIn: (cb) => ipcRenderer.on("auth:loggedIn", (_, user) => cb(user)),
  onLoggedOut: (cb) => ipcRenderer.on("auth:loggedOut", (_, data) => cb(data)),

  // Stats (now WS-backed in main)
  getStats: () => ipcRenderer.invoke("stats:get"),

  // WS bridge
  wsConnect: () => ipcRenderer.invoke("ws:connect"),
  wsSend: (msg) => ipcRenderer.invoke("ws:send", msg),

  getRolesCache: () => ipcRenderer.invoke("roles:getCache"),

  onWsMessage: (cb) => {
    const handler = (_, msg) => cb(msg);
    ipcRenderer.on("ws:message", handler);
    return () => ipcRenderer.removeListener("ws:message", handler);
  },

  onWsDisconnected: (cb) => {
    const handler = () => cb();
    ipcRenderer.on("ws:disconnected", handler);
    return () => ipcRenderer.removeListener("ws:disconnected", handler);
  },
  onWsConnected: (cb) => {
    const handler = () => cb();
    ipcRenderer.on("ws:connected", handler);
    return () => ipcRenderer.removeListener("ws:connected", handler);
  },

  authMe: () => ipcRenderer.invoke("auth:me"),
  getDeviceId: () => ipcRenderer.invoke("auth:getDeviceId"),

  onAccountUpdated: (cb) => ipcRenderer.on("account:updated", (_, user) => cb(user)),

  pickImage: () => ipcRenderer.invoke("dialog:pickImage"),
  fileToDataUrl: (filePath) => ipcRenderer.invoke("files:toDataUrl", filePath),
  uploadEmployeeFiles: (files) => ipcRenderer.invoke("uploads:employees", files),

  pickPdf: () => ipcRenderer.invoke("dialog:pickPdf"),
  documentsList: () => ipcRenderer.invoke("documents:list"),
  documentsUpload: (opts) => ipcRenderer.invoke("documents:upload", opts),
  documentsUploadFromBuffer: (opts) => ipcRenderer.invoke("documents:uploadFromBuffer", opts),
  documentsGetFile: (id) => ipcRenderer.invoke("documents:getFile", id),
  documentsUpdate: (opts) => ipcRenderer.invoke("documents:update", opts),
  documentsPrintCount: (id) => ipcRenderer.invoke("documents:printCount", id),
  documentsDelete: (id) => ipcRenderer.invoke("documents:delete", id),

  storageList: () => ipcRenderer.invoke("storage:list"),
  storageDailySummary: (days) => ipcRenderer.invoke("storage:dailySummary", days),
  storageCreate: (opts) => ipcRenderer.invoke("storage:create", opts),
  storageAdjust: (opts) => ipcRenderer.invoke("storage:adjust", opts),
  storageDelete: (id) => ipcRenderer.invoke("storage:delete", id),

  focusWindow: () => ipcRenderer.invoke("window:focus"),
  setWindowMode: (mode) => ipcRenderer.invoke("window:setMode", { mode }),
  exitApp: () => ipcRenderer.invoke("app:quit"),
});

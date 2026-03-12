// Device_Management.jsx — list sessions and force logout (own + all users when permission)
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Smartphone, LogOut, Users, Monitor, MapPin, Clock3, X } from "lucide-react";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";
import "tippy.js/animations/shift-away.css";
import { useNotification } from "../../NotificationProvider";
import { getAssetUrl } from "../../../utils/publicUrl";
import Skeleton from "../../ui/Skeleton";
import "../../../styles/pages/devices/devices.css";

const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function formatLastSeen(dateStr) {
  if (!dateStr) return "Never";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Unknown";
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays} day(s) ago`;
  return d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

function formatLocationLabel(locationOrDevice) {
  if (!locationOrDevice) return "Location unavailable";
  const city = locationOrDevice.city ?? locationOrDevice.lastCity;
  const country = locationOrDevice.country ?? locationOrDevice.lastCountry ?? locationOrDevice.countryCode ?? locationOrDevice.lastCountryCode;
  const parts = [city, country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Location unavailable";
}

function formatLocationTime(value) {
  if (!value) return "Unknown time";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Unknown time";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function DeviceManagement({ account }) {
  const HISTORY_MODAL_EXIT_MS = 240;
  const notify = useNotification();
  const perms = account?.role?.permissions || [];
  const canViewAllDevices = Array.isArray(perms) && (perms.includes("*") || perms.includes("devices.view"));

  const [viewMode, setViewMode] = useState(canViewAllDevices ? "all" : "mine"); // "mine" | "all"
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState(null);
  const [confirmRevoke, setConfirmRevoke] = useState(null);
  const [historyModal, setHistoryModal] = useState(null);
  const [historyModalExiting, setHistoryModalExiting] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const listReqRef = useRef(null);
  const revokeReqRef = useRef(null);
  const historyReqRef = useRef(null);
  const revokedDeviceIdRef = useRef(null);
  const currentDeviceIdRef = useRef(null);
  const allUsersRef = useRef(false);
  const historyModalExitTimerRef = useRef(null);

  const fetchList = useCallback((allUsers = false, silent = false) => {
    if (!window.api?.wsSend) return;
    if (!silent) setLoading(true);
    listReqRef.current = rid();
    allUsersRef.current = allUsers;
    window.api.wsSend({
      type: "device:list",
      requestId: listReqRef.current,
      payload: allUsers ? { allUsers: true } : {},
    });
  }, []);

  useEffect(() => {
    window.api?.getDeviceId?.().then((id) => {
      currentDeviceIdRef.current = id;
    });
  }, []);

  useEffect(() => {
    if (!window.api?.onWsMessage) return;
    const unsub = window.api.onWsMessage((msg) => {
      if (msg?.type === "device:list:result" && msg?.requestId === listReqRef.current) {
        setLoading(false);
        setDevices(Array.isArray(msg.devices) ? msg.devices : []);
      }
      if (msg?.type === "device:revoke:result" && msg?.requestId === revokeReqRef.current) {
        const wasCurrent = currentDeviceIdRef.current && revokedDeviceIdRef.current &&
          String(revokedDeviceIdRef.current) === String(currentDeviceIdRef.current);
        setRevokingId(null);
        setConfirmRevoke(null);
        if (msg.ok) {
          notify?.success?.("Session ended. The device will be signed out.", "Device");
          fetchList(allUsersRef.current);
          if (wasCurrent) window.api?.authLogout?.();
        } else {
          notify?.error?.(msg.error || "Failed to end session", "Device");
        }
      }
      if (msg?.type === "device:locationHistory:result" && msg?.requestId === historyReqRef.current) {
        setHistoryLoading(false);
        if (!msg?.ok) {
          setHistoryItems([]);
          notify?.error?.(msg?.error || "Failed to load location history", "Location history");
          return;
        }
        setHistoryItems(Array.isArray(msg.history) ? msg.history : []);
      }
      if (msg?.type === "presence:user" || msg?.type === "presence:list") {
        fetchList(allUsersRef.current, true);
      }
    });
    return () => unsub?.();
  }, [notify, fetchList]);

  useEffect(() => {
    return () => {
      if (historyModalExitTimerRef.current) {
        clearTimeout(historyModalExitTimerRef.current);
        historyModalExitTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    fetchList(viewMode === "all");
  }, [viewMode, fetchList]);

  function openRevokeConfirm(device) {
    setConfirmRevoke(device);
  }

  const closeConfirm = useCallback(() => {
    setConfirmRevoke(null);
  }, []);

  const closeHistoryModal = useCallback(() => {
    if ((!historyModal && !historyModalExiting) || historyModalExiting) return;
    setHistoryModalExiting(true);
    if (historyModalExitTimerRef.current) clearTimeout(historyModalExitTimerRef.current);
    historyModalExitTimerRef.current = setTimeout(() => {
      setHistoryModal(null);
      setHistoryItems([]);
      setHistoryLoading(false);
      setHistoryModalExiting(false);
      historyReqRef.current = null;
      historyModalExitTimerRef.current = null;
    }, HISTORY_MODAL_EXIT_MS);
  }, [historyModal, historyModalExiting]);

  useEffect(() => {
    if (!confirmRevoke && !historyModal && !historyModalExiting) return;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (confirmRevoke) closeConfirm();
      if (historyModal || historyModalExiting) closeHistoryModal();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirmRevoke, historyModal, historyModalExiting, closeConfirm, closeHistoryModal]);

  function doRevoke() {
    if (!confirmRevoke || !window.api?.wsSend) return;
    const deviceId = confirmRevoke.deviceId;
    const employeeId = confirmRevoke.employeeId != null ? String(confirmRevoke.employeeId) : null;
    revokeReqRef.current = rid();
    revokedDeviceIdRef.current = deviceId;
    setRevokingId(deviceId);
    window.api.wsSend({
      type: "device:revoke",
      requestId: revokeReqRef.current,
      payload: { deviceId, ...(employeeId ? { employeeId } : {}) },
    });
  }

  function openHistory(device) {
    if (!device?.deviceId || !window.api?.wsSend) return;
    if (historyModalExitTimerRef.current) {
      clearTimeout(historyModalExitTimerRef.current);
      historyModalExitTimerRef.current = null;
    }
    setHistoryModalExiting(false);
    setHistoryModal(device);
    setHistoryItems([]);
    setHistoryLoading(true);
    historyReqRef.current = rid();
    window.api.wsSend({
      type: "device:locationHistory",
      requestId: historyReqRef.current,
      payload: {
        deviceId: device.deviceId,
        ...(device.employeeId ? { employeeId: String(device.employeeId) } : {}),
        limit: 40,
      },
    });
  }

  const isCurrentDevice = (device) =>
    (currentDeviceIdRef.current && String(device.deviceId) === String(currentDeviceIdRef.current)) || device.isCurrent;

  const isAllView = viewMode === "all" && canViewAllDevices;

  if (!account) return null;

  return (
    <div className="devicesPage">
      <header className="devicesHeader">
        <div className="devicesHeaderIcon">
          <Monitor size={24} aria-hidden />
        </div>
        <div className="devicesHeaderText">
          <h1 className="devicesTitle">Device Management</h1>
          <p className="devicesSubtitle">
            {canViewAllDevices
              ? "View and sign out devices for yourself or any team member. Connected devices are signed out immediately; others will be signed out when they next open the app."
              : "View devices where you’re signed in and end sessions remotely."}
          </p>
        </div>
        {canViewAllDevices && (
          <div className="devicesViewToggle">
            <button
              type="button"
              className={`devicesViewToggleBtn ${viewMode === "mine" ? "active" : ""}`}
              onClick={() => setViewMode("mine")}
            >
              <Monitor size={16} />
              <span>My devices</span>
            </button>
            <button
              type="button"
              className={`devicesViewToggleBtn ${viewMode === "all" ? "active" : ""}`}
              onClick={() => setViewMode("all")}
            >
              <Users size={16} />
              <span>All devices</span>
            </button>
          </div>
        )}
      </header>

      <main className="devicesMain">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.ul
              key="devices-loading"
              className={`devicesList ${isAllView ? "devicesList--all" : ""} devicesList--skeleton`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              aria-busy="true"
            >
              {Array.from({ length: 6 }, (_, i) => (
                <li key={`sk-${i}`} className="devicesCard devicesCard--skeleton">
                  <div className="devicesCardLeft">
                    <div className="devicesCardIcon">
                      <Skeleton style={{ width: 44, height: 44, borderRadius: 12 }} />
                    </div>
                    <div className="devicesCardBody">
                      {isAllView && (
                        <div className="devicesCardUser">
                          <Skeleton style={{ width: 140, height: 14, borderRadius: 6 }} />
                          <Skeleton style={{ width: 180, height: 12, borderRadius: 6, marginTop: 6 }} />
                        </div>
                      )}
                      <div className="devicesCardHead">
                        <Skeleton style={{ width: "50%", height: 16, borderRadius: 6 }} />
                        <span className="devicesCardBadges">
                          <Skeleton style={{ width: 72, height: 20, borderRadius: 999 }} />
                          <Skeleton style={{ width: 80, height: 20, borderRadius: 999 }} />
                        </span>
                      </div>
                      <div className="devicesCardMetaRow">
                        <Skeleton style={{ width: 100, height: 12, borderRadius: 6 }} />
                        <Skeleton style={{ width: 90, height: 12, borderRadius: 6 }} />
                      </div>
                      <div className="devicesCardLocationRow">
                        <Skeleton style={{ width: 120, height: 12, borderRadius: 6 }} />
                        <Skeleton style={{ width: 90, height: 20, borderRadius: 999 }} />
                      </div>
                    </div>
                  </div>
                  <div className="devicesCardActions">
                    <Skeleton style={{ width: 88, height: 36, borderRadius: 8 }} />
                    <Skeleton style={{ width: 96, height: 36, borderRadius: 8 }} />
                  </div>
                </li>
              ))}
            </motion.ul>
          ) : devices.length === 0 ? (
            <motion.div
              key="devices-empty"
              className="devicesEmpty"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            >
              <img src={getAssetUrl("assets/svg/nodata-ill.svg")} alt="" className="devicesEmptyIllustration" />
              <p>{isAllView ? "No devices found for any user" : "No devices found"}</p>
            </motion.div>
          ) : (
            <motion.ul
              key={`devices-list-${viewMode}`}
              className={`devicesList ${isAllView ? "devicesList--all" : ""}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            >
              {devices.map((device, index) => {
                const current = isCurrentDevice(device);
                const revoked = !!device.revokedAt;
                return (
                  <motion.li
                    key={isAllView ? `${device.employeeId}-${device.deviceId}` : device.deviceId}
                    className={`devicesCard ${revoked ? "devicesCard--revoked" : ""}`}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: index * 0.05,
                      duration: 0.32,
                      ease: [0.4, 0, 0.2, 1],
                    }}
                  >
                  <div className="devicesCardLeft">
                    <div className="devicesCardIcon">
                      {device.deviceType === "mobile" ? (
                        <Smartphone size={20} aria-hidden />
                      ) : (
                        <Monitor size={20} aria-hidden />
                      )}
                    </div>
                    <div className="devicesCardBody">
                      {isAllView && (device.employeeName || device.workEmail) && (
                        <div className="devicesCardUser">
                          <span className="devicesCardUserName">{device.employeeName || "—"}</span>
                          {device.workEmail && <span className="devicesCardUserEmail">{device.workEmail}</span>}
                        </div>
                      )}
                      <div className="devicesCardHead">
                        <span className="devicesCardName">{device.deviceName || "Unknown device"}</span>
                        <span className="devicesCardBadges">
                          {current && <span className="devicesBadge devicesBadge--current">This device</span>}
                          {current || device.connected ? (
                            <span className="devicesBadge devicesBadge--connected">Connected</span>
                          ) : revoked ? (
                            <span className="devicesBadge devicesBadge--revoked">Signed out</span>
                          ) : (
                            <span className="devicesBadge devicesBadge--offline">Not connected</span>
                          )}
                        </span>
                      </div>
                      <div className="devicesCardMetaRow">
                        <span className="devicesCardMeta">
                          {current || device.connected ? (
                            <span className="devicesMetaActive">Active now</span>
                          ) : (
                            <>Last active {formatLastSeen(device.lastSeenAt)}</>
                          )}
                        </span>
                        {device.createdAt && (
                          <>
                            <span className="devicesCardMetaSep">·</span>
                            <span className="devicesCardMeta">Added {new Date(device.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}</span>
                          </>
                        )}
                      </div>
                      <div className="devicesCardLocationRow">
                        <span className="devicesCardLocation">
                          <MapPin size={12} aria-hidden />
                          <span>{formatLocationLabel({ city: device.lastCity, country: device.lastCountry, countryCode: device.lastCountryCode })}</span>
                        </span>
                        {device.lastIp && (
                          <span className="devicesLocationIp">{device.lastIp}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="devicesCardActions">
                    <Tippy content="View device location history" animation="shift-away" placement="top" delay={[200, 0]}>
                      <button
                        type="button"
                        className="devicesBtn devicesBtnHistory"
                        onClick={() => openHistory(device)}
                        disabled={historyLoading && historyModal?.deviceId === device.deviceId}
                      >
                        {historyLoading && historyModal?.deviceId === device.deviceId ? (
                          <span className="devicesBtnSpinner" aria-hidden />
                        ) : (
                          <Clock3 size={16} />
                        )}
                        <span>History</span>
                      </button>
                    </Tippy>
                    {!revoked && (
                      <Tippy
                        content={current || device.connected ? "Sign out this device" : "Sign out when they next open the app"}
                        animation="shift-away"
                        placement="top"
                        delay={[200, 0]}
                      >
                        <button
                          type="button"
                          className="devicesBtn devicesBtnLogout"
                          disabled={revokingId === device.deviceId}
                          onClick={() => openRevokeConfirm(device)}
                        >
                          {revokingId === device.deviceId ? (
                            <span className="devicesBtnSpinner" aria-hidden />
                          ) : (
                            <LogOut size={16} />
                          )}
                          <span>{current || device.connected ? "Sign out" : "Sign out later"}</span>
                        </button>
                      </Tippy>
                    )}
                  </div>
                </motion.li>
              );
            })}
          </motion.ul>
          )}
        </AnimatePresence>
      </main>

      {confirmRevoke && (
        <div
          className="devicesModalBackdrop"
          onClick={closeConfirm}
          role="presentation"
        >
          <div
            className="devicesModal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="devices-modal-title"
          >
            <h2 className="devicesModalTitle" id="devices-modal-title">
              End session?
            </h2>
            <p className="devicesModalMessage">
              {confirmRevoke.isCurrent || isCurrentDevice(confirmRevoke)
                ? "You will be signed out on this device. You can sign in again anytime."
                : confirmRevoke.connected
                  ? `Sign out "${confirmRevoke.deviceName || "Unknown device"}"${confirmRevoke.employeeName ? ` for ${confirmRevoke.employeeName}` : ""}? They will be signed out immediately.`
                  : confirmRevoke.employeeName
                    ? `Sign out "${confirmRevoke.deviceName || "Unknown device"}" for ${confirmRevoke.employeeName}? They will be signed out when they next open the app.`
                    : `"${confirmRevoke.deviceName || "Unknown device"}" will be signed out. They will need to sign in again.`}
            </p>
            <div className="devicesModalActions">
              <button type="button" className="devicesModalBtn devicesModalBtn--ghost" onClick={closeConfirm}>
                Cancel
              </button>
              <button
                type="button"
                className="devicesModalBtn devicesModalBtn--danger"
                disabled={revokingId === confirmRevoke.deviceId}
                onClick={doRevoke}
              >
                {revokingId === confirmRevoke.deviceId ? "Ending…" : "End session"}
              </button>
            </div>
          </div>
        </div>
      )}

      {(historyModal || historyModalExiting) && typeof document !== "undefined" && createPortal(
        <div
          className={`devicesHistoryBackdrop ${historyModalExiting ? "devicesHistoryBackdrop--exiting" : ""}`}
          role="presentation"
          onClick={closeHistoryModal}
        >
          <div
            className={`devicesHistoryModal ${historyModalExiting ? "devicesHistoryModal--exiting" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="devices-history-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="devicesHistoryHeader">
              <div className="devicesHistoryHeaderText">
                <h2 id="devices-history-title" className="devicesHistoryTitle">Location history</h2>
                <p className="devicesHistorySubtitle">
                  {historyModal?.deviceName || "Unknown device"}
                  {historyModal?.employeeName ? ` • ${historyModal.employeeName}` : ""}
                </p>
              </div>
              <button type="button" className="devicesHistoryClose" onClick={closeHistoryModal} aria-label="Close">
                <X size={16} />
              </button>
            </header>
            <div className="devicesHistoryBody">
              {historyLoading ? (
                <div className="devicesHistoryLoading">
                  <span className="devicesBtnSpinner" aria-hidden />
                  <span>Loading history...</span>
                </div>
              ) : historyItems.length === 0 ? (
                <p className="devicesHistoryEmpty">No location snapshots available for this device yet.</p>
              ) : (
                <ol className="devicesHistoryTimeline">
                  {historyItems.map((entry, idx) => (
                    <li key={`${entry?.at || "na"}-${entry?.ip || "none"}-${idx}`} className="devicesHistoryItem">
                      <div className="devicesHistoryPoint" aria-hidden />
                      <div className="devicesHistoryContent">
                        <p className="devicesHistoryWhen">{formatLocationTime(entry?.at)}</p>
                        <p className="devicesHistoryWhere">{formatLocationLabel(entry)}</p>
                        <p className="devicesHistoryMeta">
                          <span>IP: {entry?.ip || "Unknown"}</span>
                          {entry?.source ? <span>Source: {entry.source}</span> : null}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

import React from "react";
import { createPortal } from "react-dom";

export default function DeviceRevokeModal({
  device,
  isExiting,
  isCurrentDevice,
  revokingId,
  onClose,
  onConfirm,
}) {
  if ((!device && !isExiting) || typeof document === "undefined") return null;

  const current = device?.isCurrent || (device ? isCurrentDevice(device) : false);
  const message = current
    ? "You will be signed out on this device. You can sign in again anytime."
    : device?.connected
      ? `Sign out "${device.deviceName || "Unknown device"}"${device.employeeName ? ` for ${device.employeeName}` : ""}? They will be signed out immediately.`
      : device?.employeeName
        ? `Sign out "${device.deviceName || "Unknown device"}" for ${device.employeeName}? They will be signed out when they next open the app.`
        : `"${device.deviceName || "Unknown device"}" will be signed out. They will need to sign in again.`;

  return createPortal(
    <div
      className={`devicesModalBackdrop ${isExiting ? "devicesModalBackdrop--exiting" : ""}`}
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`devicesModal ${isExiting ? "devicesModal--exiting" : ""}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="devices-modal-title"
      >
        <h2 className="devicesModalTitle" id="devices-modal-title">
          End session?
        </h2>
        <p className="devicesModalMessage">{message}</p>
        <div className="devicesModalActions">
          <button type="button" className="devicesModalBtn devicesModalBtn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="devicesModalBtn devicesModalBtn--danger"
            disabled={revokingId === device.deviceId}
            onClick={onConfirm}
          >
            {revokingId === device.deviceId ? "Ending..." : "End session"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

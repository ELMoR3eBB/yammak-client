import React from "react";
import { createPortal } from "react-dom";
import { ExternalLink, X } from "lucide-react";
import Tippy from "@tippyjs/react";

export default function DeviceHistoryModal({
  device,
  isExiting,
  historyItems,
  historyLoading,
  onClose,
  formatLocationTime,
  formatLocationLabel,
  getLocationSourceLabel,
  hasCoordinates,
  buildGoogleMapsLink,
  isGeoBasedSource,
}) {
  if ((!device && !isExiting) || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`devicesHistoryBackdrop ${isExiting ? "devicesHistoryBackdrop--exiting" : ""}`}
      role="presentation"
      onClick={onClose}
    >
      <div
        className={`devicesHistoryModal ${isExiting ? "devicesHistoryModal--exiting" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="devices-history-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="devicesHistoryHeader">
          <div className="devicesHistoryHeaderText">
            <h2 id="devices-history-title" className="devicesHistoryTitle">Location history</h2>
            <p className="devicesHistorySubtitle">
              {device?.deviceName || "Unknown device"}
              {device?.employeeName ? ` - ${device.employeeName}` : ""}
            </p>
          </div>
          <button type="button" className="devicesHistoryClose" onClick={onClose} aria-label="Close">
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
                      {entry?.source ? <span>Source: {getLocationSourceLabel(entry.source)}</span> : null}
                      {hasCoordinates(entry) ? <span>Lat/Lng: {Number(entry.latitude).toFixed(6)}, {Number(entry.longitude).toFixed(6)}</span> : null}
                      {Number.isFinite(Number(entry?.altitude)) ? <span>Altitude: {Number(entry.altitude).toFixed(1)} m</span> : null}
                    </p>
                    {hasCoordinates(entry) && (
                      <Tippy content="Open this snapshot in Google Maps" animation="shift-away" placement="top" delay={[200, 0]}>
                        <button
                          type="button"
                          className="devicesHistoryMapsBtn"
                          onClick={() => {
                            const url = buildGoogleMapsLink(entry);
                            if (!url) return;
                            window.open(url, "_blank", "noopener,noreferrer");
                          }}
                        >
                          <ExternalLink size={14} />
                          <span>{isGeoBasedSource(entry?.source) ? "View in Google Maps" : "View approximate in Google Maps"}</span>
                        </button>
                      </Tippy>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

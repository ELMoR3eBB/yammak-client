// Action_Heatmap.jsx — most-used features per user
import React, { useCallback, useEffect, useRef, useState } from "react";
import { BarChart3, RefreshCw, User } from "lucide-react";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";
import "tippy.js/animations/shift-away.css";
import { useNotification } from "../../NotificationProvider";
import { getAssetUrl } from "../../../utils/publicUrl";
import "../../../styles/pages/devices/devices.css";

const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const FEATURE_LABELS = {
  dashboard: "Dashboard",
  "employees:list": "Employees list",
  "employees:create": "Create employee",
  "employees:edit": "Edit employee",
  "employees:profile": "Employee profile",
  "roles:list": "Roles list",
  "roles:create": "Create role",
  "roles:edit": "Edit role",
  "reports:submit": "Submit report",
  "reports:list": "Reports list",
  "notifications": "Notifications",
  "settings:home": "Settings",
  "audit:list": "Audit Logs",
  "hot:send": "Hot notification",
  "devices": "Device Management",
  "heatmap": "Heatmap",
  "performance": "System Performance",
  "loginAttempts": "Login Attempts",
  "holidays:ask": "Holidays (ask)",
  "holidays:list": "Holidays list",
  "suggests:new": "New suggest",
  "suggests:list": "Suggest list",
  "cashout:list": "Cashout list",
  drivers: "Drivers",
  "drivers:profile": "Driver profile",
  sync: "Data sync",
};

function featureLabel(feature) {
  return FEATURE_LABELS[feature] || feature;
}

export default function ActionHeatmap({ account }) {
  const notify = useNotification();
  const [heatmap, setHeatmap] = useState([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const reqIdRef = useRef(null);
  const initialLoadRef = useRef(true);
  const [heatmapVersion, setHeatmapVersion] = useState(0);

  const fetchHeatmap = useCallback(() => {
    if (!window.api?.wsSend) return;
    if (initialLoadRef.current) {
      setLoading(true);
      initialLoadRef.current = false;
    }
    reqIdRef.current = rid();
    window.api.wsSend({
      type: "analytics:heatmap",
      requestId: reqIdRef.current,
      payload: { days },
    });
  }, [days]);

  useEffect(() => {
    if (!window.api?.onWsMessage) return;
    const unsub = window.api.onWsMessage((msg) => {
      if (msg?.type === "analytics:heatmap:result" && msg?.requestId === reqIdRef.current) {
        setLoading(false);
        if (msg.error) {
          notify?.error?.(msg.error || "Failed to load heatmap", "Action Heatmap");
          setHeatmap([]);
          initialLoadRef.current = true;
        } else {
          setHeatmap(Array.isArray(msg.heatmap) ? msg.heatmap : []);
          setHeatmapVersion((v) => v + 1);
        }
      }
    });
    return () => unsub?.();
  }, [notify]);

  useEffect(() => {
    fetchHeatmap();
  }, [fetchHeatmap]);

  if (!account) return null;

  return (
    <div className="devicesPage devicesPage--full">
      <header className="devicesHeader">
        <div className="devicesHeaderIcon">
          <BarChart3 size={24} />
        </div>
        <div className="devicesHeaderText">
          <h1 className="devicesTitle">Action Heatmap</h1>
          <p className="devicesSubtitle">
            Most-used features per user. Data is based on page and feature usage over the selected period.
          </p>
        </div>
      </header>

      <main className="devicesMain">
        <div className="heatmapToolbar">
          <span className="heatmapToolbarLabel">Period</span>
          <div className="heatmapPeriodGroup">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                className={`heatmapPeriodBtn ${days === d ? "active" : ""}`}
                onClick={() => setDays(d)}
                disabled={loading}
              >
                {d === 7 ? "7 days" : d === 30 ? "30 days" : "90 days"}
              </button>
            ))}
          </div>
          <Tippy content="Refresh" animation="shift-away" placement="bottom" delay={[200, 0]}>
            <button
              type="button"
              className="heatmapRefresh"
              onClick={fetchHeatmap}
              disabled={loading}
            >
            <RefreshCw size={16} className={loading ? "heatmapRefreshIconSpin" : ""} />
            <span>{loading ? "Loading…" : "Refresh"}</span>
          </button>
          </Tippy>
        </div>

        {loading ? (
          <div className="devicesLoading">
            <div className="devicesSpinner" aria-hidden />
            <p>Loading heatmap…</p>
          </div>
        ) : heatmap.length === 0 ? (
          <div className="devicesEmpty">
            <img src={getAssetUrl("assets/svg/nodata-ill.svg")} alt="" className="devicesEmptyIllustration" />
            <p>No usage data yet. Use the app to see feature usage here.</p>
          </div>
        ) : (
          <ul className="heatmapList">
            {heatmap.map((row, cardIndex) => {
              const isYou =
                String(account?.id ?? account?._id ?? "") === String(row.userId);
              const maxCount = Math.max(...(row.features || []).map((f) => f.count || 0), 1);
              const barIndexOffset = heatmap
                .slice(0, cardIndex)
                .reduce((acc, r) => acc + (r.features?.length || 0), 0);
              return (
                <li
                  key={row.userId}
                  className="heatmapCard"
                  style={{ animationDelay: `${cardIndex * 0.06}s` }}
                >
                  <div className="heatmapCardHeader">
                    <User size={16} className="heatmapUserIcon" />
                    <span className="heatmapUserName">
                      {row.userName || "—"}
                      {isYou && <span className="heatmapBadgeYou">You</span>}
                    </span>
                    {row.total != null && (
                      <span className="heatmapTotal">{row.total} actions</span>
                    )}
                  </div>
                  <ul className="heatmapFeatures">
                    {(row.features || []).map((f, fi) => {
                      const percent = Math.round(((f.count || 0) / maxCount) * 100);
                      const barIndex = barIndexOffset + fi;
                      return (
                        <li
                          key={`${row.userId}-${f.feature}-${heatmapVersion}`}
                          className="heatmapFeatureRow"
                          style={{ animationDelay: `${fi * 0.03}s` }}
                        >
                          <span className="heatmapFeatureName">{featureLabel(f.feature)}</span>
                          <div className="heatmapFeatureBarWrap">
                            <div
                              className="heatmapFeatureBarOuter"
                              style={{ width: `${percent}%` }}
                            >
                              <div
                                className="heatmapFeatureBar"
                                style={{ animationDelay: `${barIndex * 0.1}s` }}
                              />
                            </div>
                          </div>
                          <span className="heatmapFeatureCount">{f.count}</span>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}

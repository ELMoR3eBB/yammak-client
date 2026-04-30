// Action_Heatmap.jsx — most-used features per user
import React, { useCallback, useEffect, useRef, useState } from "react";
import { BarChart3, RefreshCw, User } from "lucide-react";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";
import "tippy.js/animations/shift-away.css";
import { useNotification } from "../../components/NotificationProvider";
import { useLanguage } from "../../contexts/LanguageContext";
import { getAssetUrl } from "../../utils/publicUrl";
import "../../styles/pages/devices/devices.css";

const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const FEATURE_LABELS = {
  dashboard: "heatmap.feature.dashboard",
  "employees:list": "heatmap.feature.employeesList",
  "employees:create": "heatmap.feature.createEmployee",
  "employees:edit": "heatmap.feature.editEmployee",
  "employees:profile": "heatmap.feature.employeeProfile",
  "roles:list": "heatmap.feature.rolesList",
  "roles:create": "heatmap.feature.createRole",
  "roles:edit": "heatmap.feature.editRole",
  "reports:submit": "heatmap.feature.submitReport",
  "reports:list": "heatmap.feature.reportsList",
  "notifications": "heatmap.feature.notifications",
  "settings:home": "heatmap.feature.settings",
  "audit:list": "heatmap.feature.auditLogs",
  "hot:send": "heatmap.feature.hotNotification",
  "devices": "heatmap.feature.deviceManagement",
  "heatmap": "heatmap.feature.heatmap",
  "performance": "heatmap.feature.systemPerformance",
  "loginAttempts": "heatmap.feature.loginAttempts",
  "holidays:ask": "heatmap.feature.holidaysAsk",
  "holidays:list": "heatmap.feature.holidaysList",
  "suggests:new": "heatmap.feature.newSuggest",
  "suggests:list": "heatmap.feature.suggestList",
  "cashout:list": "heatmap.feature.cashoutList",
  drivers: "heatmap.feature.drivers",
  "drivers:profile": "heatmap.feature.driverProfile",
  sync: "heatmap.feature.dataSync",
};

function featureLabel(feature, tr) {
  const key = FEATURE_LABELS[feature];
  return key ? tr(key, feature) : feature;
}

export default function ActionHeatmap({ account }) {
  const notify = useNotification();
  const { t } = useLanguage();
  const tr = useCallback((key, fallback) => {
    const v = t(key);
    return v === key ? fallback : v;
  }, [t]);
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
          notify?.error?.(msg.error || tr("heatmap.failed", "Failed to load heatmap"), tr("heatmap.title", "Action Heatmap"));
          setHeatmap([]);
          initialLoadRef.current = true;
        } else {
          setHeatmap(Array.isArray(msg.heatmap) ? msg.heatmap : []);
          setHeatmapVersion((v) => v + 1);
        }
      }
    });
    return () => unsub?.();
  }, [notify, tr]);

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
          <h1 className="devicesTitle">{tr("heatmap.title", "Action Heatmap")}</h1>
          <p className="devicesSubtitle">
            {tr("heatmap.subtitle", "Most-used features per user. Data is based on page and feature usage over the selected period.")}
          </p>
        </div>
      </header>

      <main className="devicesMain">
        <div className="heatmapToolbar">
          <span className="heatmapToolbarLabel">{tr("heatmap.period", "Period")}</span>
          <div className="heatmapPeriodGroup">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                className={`heatmapPeriodBtn ${days === d ? "active" : ""}`}
                onClick={() => setDays(d)}
                disabled={loading}
              >
                {d === 7 ? tr("heatmap.days7", "7 days") : d === 30 ? tr("heatmap.days30", "30 days") : tr("heatmap.days90", "90 days")}
              </button>
            ))}
          </div>
          <Tippy content={tr("heatmap.refresh", "Refresh")} animation="shift-away" placement="bottom" delay={[200, 0]}>
            <button
              type="button"
              className="heatmapRefresh"
              onClick={fetchHeatmap}
              disabled={loading}
            >
            <RefreshCw size={16} className={loading ? "heatmapRefreshIconSpin" : ""} />
            <span>{loading ? tr("common.loading", "Loading…") : tr("heatmap.refresh", "Refresh")}</span>
          </button>
          </Tippy>
        </div>

        {loading ? (
          <div className="devicesLoading">
            <div className="devicesSpinner" aria-hidden />
            <p>{tr("heatmap.loading", "Loading heatmap…")}</p>
          </div>
        ) : heatmap.length === 0 ? (
          <div className="devicesEmpty">
            <img src={getAssetUrl("assets/svg/nodata-ill.svg")} alt="" className="devicesEmptyIllustration" />
            <p>{tr("heatmap.empty", "No usage data yet. Use the app to see feature usage here.")}</p>
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
                      {isYou && <span className="heatmapBadgeYou">{tr("heatmap.you", "You")}</span>}
                    </span>
                    {row.total != null && (
                      <span className="heatmapTotal">{tr("heatmap.totalActions", "{{count}} actions").replace("{{count}}", String(row.total))}</span>
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
                          <span className="heatmapFeatureName">{featureLabel(f.feature, tr)}</span>
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

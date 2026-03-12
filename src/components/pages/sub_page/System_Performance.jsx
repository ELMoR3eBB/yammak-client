// System_Performance.jsx — memory, API response time, MongoDB stats
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Activity, RefreshCw, Database, Cpu, Clock } from "lucide-react";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";
import "tippy.js/animations/shift-away.css";
import { useNotification } from "../../NotificationProvider";
import { getAssetUrl } from "../../../utils/publicUrl";
import "../../../styles/pages/devices/devices.css";

const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export default function SystemPerformance({ account }) {
  const notify = useNotification();
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const reqIdRef = useRef(null);

  const fetchMetrics = useCallback(() => {
    if (!window.api?.wsSend) return;
    setLoading(true);
    reqIdRef.current = rid();
    window.api.wsSend({
      type: "metrics:performance",
      requestId: reqIdRef.current,
      payload: {},
    });
  }, []);

  useEffect(() => {
    if (!window.api?.onWsMessage) return;
    const unsub = window.api.onWsMessage((msg) => {
      if (msg?.type === "metrics:performance:result" && msg?.requestId === reqIdRef.current) {
        setLoading(false);
        if (msg.error) {
          notify?.error?.(msg.error === "forbidden" ? "Permission denied" : msg.error, "System Performance");
          setMetrics(null);
        } else {
          setMetrics({
            memory: msg.memory,
            apiResponseTime: msg.apiResponseTime,
            mongo: msg.mongo,
          });
        }
      }
    });
    return () => unsub?.();
  }, [notify]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const perms = account?.role?.permissions || [];
  const canView = perms.includes("*") || perms.includes("audit.view");

  if (!account) return null;

  if (!canView) {
    return (
      <div className="devicesPage devicesPage--full">
        <header className="devicesHeader">
          <div className="devicesHeaderIcon">
            <Activity size={24} />
          </div>
          <div className="devicesHeaderText">
            <h1 className="devicesTitle">System Performance</h1>
            <p className="devicesSubtitle">You don&apos;t have permission to view system metrics.</p>
          </div>
        </header>
      </div>
    );
  }

  return (
    <div className="devicesPage devicesPage--full">
      <header className="devicesHeader">
        <div className="devicesHeaderIcon">
          <Activity size={24} />
        </div>
        <div className="devicesHeaderText">
          <h1 className="devicesTitle">System Performance</h1>
          <p className="devicesSubtitle">
            Memory usage, API response times, and MongoDB database stats. Refreshes on demand.
          </p>
        </div>
      </header>

      <main className="devicesMain">
        <Tippy content="Refresh metrics" animation="shift-away" placement="bottom" delay={[200, 0]}>
          <button
            type="button"
            className="perfRefresh"
            onClick={fetchMetrics}
            disabled={loading}
          >
          <RefreshCw size={16} className={loading ? "perfRefreshIconSpin" : ""} />
          <span>{loading ? "Loading…" : "Refresh"}</span>
        </button>
        </Tippy>

        {loading && !metrics ? (
          <div className="devicesLoading">
            <div className="devicesSpinner" aria-hidden />
            <p>Loading metrics…</p>
          </div>
        ) : !loading && !metrics ? (
          <div className="devicesEmpty">
            <img src={getAssetUrl("assets/svg/nodata-ill.svg")} alt="" className="devicesEmptyIllustration" />
            <p>No metrics available or permission denied.</p>
          </div>
        ) : metrics ? (
          <>
            <section className="perfSection perfSection--animate">
              <h2 className="perfSectionTitle">
                <span className="perfSectionIcon perfSectionIcon--memory">
                  <Cpu size={18} />
                </span>
                Memory usage (Node.js process)
              </h2>
              <div className="perfGrid">
                <div className="perfCard" style={{ animationDelay: "0s" }}>
                  <p className="perfCardTitle">RSS</p>
                  <p className="perfCardValue">
                    {metrics.memory?.rssMb != null ? `${metrics.memory.rssMb} MB` : "—"}
                  </p>
                  <p className="perfCardSub">Resident set size</p>
                </div>
                <div className="perfCard" style={{ animationDelay: "0.05s" }}>
                  <p className="perfCardTitle">Heap used</p>
                  <p className="perfCardValue">
                    {metrics.memory?.heapUsedMb != null ? `${metrics.memory.heapUsedMb} MB` : "—"}
                  </p>
                  <p className="perfCardSub">V8 heap used</p>
                </div>
                <div className="perfCard" style={{ animationDelay: "0.1s" }}>
                  <p className="perfCardTitle">Heap total</p>
                  <p className="perfCardValue">
                    {metrics.memory?.heapTotalMb != null ? `${metrics.memory.heapTotalMb} MB` : "—"}
                  </p>
                  <p className="perfCardSub">V8 heap total</p>
                </div>
                {metrics.memory?.externalMb != null && metrics.memory.externalMb > 0 && (
                  <div className="perfCard" style={{ animationDelay: "0.15s" }}>
                    <p className="perfCardTitle">External</p>
                    <p className="perfCardValue">{metrics.memory.externalMb} MB</p>
                    <p className="perfCardSub">C++ objects</p>
                  </div>
                )}
              </div>
            </section>

            <section className="perfSection perfSection--animate">
              <h2 className="perfSectionTitle">
                <span className="perfSectionIcon perfSectionIcon--api">
                  <Clock size={18} />
                </span>
                API response time (HTTP)
              </h2>
              <div className="perfGrid">
                <div className="perfCard" style={{ animationDelay: "0s" }}>
                  <p className="perfCardTitle">Average</p>
                  <p className="perfCardValue">
                    {metrics.apiResponseTime?.avgMs != null
                      ? `${metrics.apiResponseTime.avgMs} ms`
                      : "—"}
                  </p>
                  <p className="perfCardSub">
                    {metrics.apiResponseTime?.count != null
                      ? `Last ${metrics.apiResponseTime.count} requests`
                      : "No data yet"}
                  </p>
                </div>
                <div className="perfCard" style={{ animationDelay: "0.05s" }}>
                  <p className="perfCardTitle">Min</p>
                  <p className="perfCardValue">
                    {metrics.apiResponseTime?.minMs != null
                      ? `${metrics.apiResponseTime.minMs} ms`
                      : "—"}
                  </p>
                </div>
                <div className="perfCard" style={{ animationDelay: "0.1s" }}>
                  <p className="perfCardTitle">Max</p>
                  <p className="perfCardValue">
                    {metrics.apiResponseTime?.maxMs != null
                      ? `${metrics.apiResponseTime.maxMs} ms`
                      : "—"}
                  </p>
                </div>
              </div>
            </section>

            <section className="perfSection perfSection--animate">
              <h2 className="perfSectionTitle">
                <span className="perfSectionIcon perfSectionIcon--mongo">
                  <Database size={18} />
                </span>
                MongoDB
              </h2>
              {metrics.mongo?.error ? (
                <p className="perfCardSub" style={{ color: "var(--dv-danger)" }}>
                  {metrics.mongo.error}
                </p>
              ) : (
                <div className="perfGrid">
                  <div className="perfCard" style={{ animationDelay: "0s" }}>
                    <p className="perfCardTitle">Collections</p>
                    <p className="perfCardValue">
                      {metrics.mongo?.collections != null ? metrics.mongo.collections : "—"}
                    </p>
                  </div>
                  <div className="perfCard" style={{ animationDelay: "0.05s" }}>
                    <p className="perfCardTitle">Data size</p>
                    <p className="perfCardValue">
                      {metrics.mongo?.dataSizeMb != null ? `${metrics.mongo.dataSizeMb} MB` : "—"}
                    </p>
                  </div>
                  <div className="perfCard" style={{ animationDelay: "0.1s" }}>
                    <p className="perfCardTitle">Storage size</p>
                    <p className="perfCardValue">
                      {metrics.mongo?.storageSizeMb != null
                        ? `${metrics.mongo.storageSizeMb} MB`
                        : "—"}
                    </p>
                  </div>
                  <div className="perfCard" style={{ animationDelay: "0.15s" }}>
                    <p className="perfCardTitle">Index size</p>
                    <p className="perfCardValue">
                      {metrics.mongo?.indexSizeMb != null ? `${metrics.mongo.indexSizeMb} MB` : "—"}
                    </p>
                  </div>
                  <div className="perfCard" style={{ animationDelay: "0.2s" }}>
                    <p className="perfCardTitle">Indexes</p>
                    <p className="perfCardValue">
                      {metrics.mongo?.indexes != null ? metrics.mongo.indexes : "—"}
                    </p>
                  </div>
                </div>
              )}
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}

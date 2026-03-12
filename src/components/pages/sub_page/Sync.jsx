import React, { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, Store, Truck } from "lucide-react";
import { useNotification } from "../../NotificationProvider";
import "../../../styles/pages/sync/sync.css";

const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export default function Sync({ account }) {
  const notify = useNotification();
  const [syncingDrivers, setSyncingDrivers] = useState(false);
  const [syncingStores, setSyncingStores] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const driversRequestIdRef = useRef(null);
  const storesRequestIdRef = useRef(null);

  const canSync = account?.role?.permissions?.includes?.("*") || account?.role?.permissions?.includes?.("sync.request");

  const runDriversSync = useCallback(() => {
    if (!canSync || !window.api?.wsSend || syncingDrivers) return;
    setSyncingDrivers(true);
    setLastResult(null);
    driversRequestIdRef.current = rid();
    window.api.wsSend({
      type: "sync:drivers:request",
      requestId: driversRequestIdRef.current,
    });
  }, [canSync, syncingDrivers]);

  const runStoresSync = useCallback(() => {
    if (!canSync || !window.api?.wsSend || syncingStores) return;
    setSyncingStores(true);
    setLastResult(null);
    storesRequestIdRef.current = rid();
    window.api.wsSend({
      type: "sync:stores:request",
      requestId: storesRequestIdRef.current,
    });
  }, [canSync, syncingStores]);

  useEffect(() => {
    if (!window.api?.onWsMessage) return;
    const unsub = window.api.onWsMessage((msg) => {
      if (msg?.type === "sync:drivers:result" && msg?.requestId === driversRequestIdRef.current) {
        setSyncingDrivers(false);
        setLastResult(msg);
        if (msg.ok) notify?.success?.(`Drivers synced: ${msg.count ?? 0} drivers.`, "Sync");
        else notify?.error?.(msg.error || "Sync failed", "Sync");
      }
      if (msg?.type === "sync:stores:result" && msg?.requestId === storesRequestIdRef.current) {
        setSyncingStores(false);
        setLastResult(msg);
        if (msg.ok) notify?.success?.(`Stores synced: ${msg.count ?? 0} stores.`, "Sync");
        else notify?.error?.(msg.error || "Sync failed", "Sync");
      }
    });
    return () => unsub?.();
  }, [notify]);

  if (!canSync) {
    return (
      <div className="syncPage syncPage--enter">
        <header className="syncHeader">
          <div className="syncHeaderIcon">
            <RefreshCw size={24} />
          </div>
          <div className="syncHeaderText">
            <h1 className="syncTitle">Data sync</h1>
            <p className="syncSubtitle">You don't have permission to trigger data sync.</p>
          </div>
        </header>
      </div>
    );
  }

  return (
    <div className="syncPage syncPage--enter">
      <header className="syncHeader">
        <div className="syncHeaderIcon">
          <RefreshCw size={24} />
        </div>
        <div className="syncHeaderText">
          <h1 className="syncTitle">Data sync</h1>
          <p className="syncSubtitle">
            Manual sync does not change the automatic schedule (11:55 AM & 11:55 PM).
          </p>
        </div>
      </header>

      <main className="syncMain">
        <div className="syncContent">
          <section className="syncSection">
            <div className="syncCard">
              <div className="syncCardHeader">
                <span className="syncCardIcon">
                  <Truck size={20} />
                </span>
                <div className="syncCardTitleWrap">
                  <h2 className="syncCardTitle">Drivers</h2>
                  <p className="syncCardDesc">Sync drivers from the external API into the app.</p>
                </div>
              </div>
              <div className="syncCardActions">
                <button type="button" className="syncCardBtn" onClick={runDriversSync} disabled={syncingDrivers}>
                  {syncingDrivers ? (
                    <>
                      <RefreshCw size={16} className="syncCardBtnIcon spinning" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw size={16} className="syncCardBtnIcon" />
                      Sync now
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="syncCard">
              <div className="syncCardHeader">
                <span className="syncCardIcon">
                  <Store size={20} />
                </span>
                <div className="syncCardTitleWrap">
                  <h2 className="syncCardTitle">Stores</h2>
                  <p className="syncCardDesc">Sync stores from the external API into the app.</p>
                </div>
              </div>
              <div className="syncCardActions">
                <button type="button" className="syncCardBtn" onClick={runStoresSync} disabled={syncingStores}>
                  {syncingStores ? (
                    <>
                      <RefreshCw size={16} className="syncCardBtnIcon spinning" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw size={16} className="syncCardBtnIcon" />
                      Sync now
                    </>
                  )}
                </button>
              </div>
            </div>

            {lastResult && (
              <div className={`syncResult ${lastResult.ok ? "syncResult--success" : "syncResult--error"}`}>
                {lastResult.ok ? `Synced ${lastResult.count ?? 0} records.` : (lastResult.error || "Sync failed")}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

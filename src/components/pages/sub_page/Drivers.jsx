// Drivers — list drivers in DataTable; search, sort, pagination (15 per page)
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Truck, ChevronLeft, ChevronRight, Wallet, RefreshCw } from "lucide-react";
import DataTable from "../../ui/DataTable";
import SearchInput from "../../ui/SearchInput";
import PaginatorSelect from "../../ui/PaginatorSelect";
import { useNotification } from "../../NotificationProvider";
import { useAnimatedNumber } from "../../../hooks/useAnimatedNumber";
import { getAssetUrl } from "../../../utils/publicUrl";
import "../../../styles/pages/audit/audit_logs.css";
import "../../../styles/pages/drivers/drivers.css";
import "../../../styles/ui/paginator_select.css";

const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

function formatNum(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return Number(n).toLocaleString();
}

function formatRelativeDate(isoString) {
  if (!isoString) return "—";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "—";
  const now = new Date();
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays < 0) return "—";
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week(s) ago`;
  if (diffDays < 90) return `${Math.floor(diffDays / 30)} month(s) ago`;
  return `${Math.floor(diffDays / 90)} mo+ ago`;
}

const buildPageModel = (page, totalPages) => {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  if (page <= 3) return [1, 2, 3, 4, "…", totalPages];
  if (page >= totalPages - 2) return [1, "…", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  return [1, "…", page - 1, page, page + 1, "…", totalPages];
};

const columns = [
  { key: "serial", label: "#", sortable: false, width: "0.4fr" },
  { key: "id", label: "ID", sortable: true, width: "0.8fr" },
  { key: "name", label: "NAME", sortable: true, width: "1.4fr" },
  { key: "cashInHands", label: "CASH IN HAND", sortable: true, width: "1.1fr", align: "right" },
  { key: "totalEarnings", label: "TOTAL EARNINGS", sortable: true, width: "1.1fr", align: "right" },
  { key: "balance", label: "BALANCE", sortable: true, width: "1fr", align: "right" },
  { key: "totalWithdrawal", label: "TOTAL WITHDRAWAL", sortable: true, width: "1.1fr", align: "right" },
  { key: "lastCashinAt", label: "LAST CASH-IN", sortable: false, width: "1fr" },
];

export default function Drivers({ account, onNavigate, onOpenDriverContextMenu }) {
  const notify = useNotification();
  const [drivers, setDrivers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState({ key: "name", dir: "asc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [driverStats, setDriverStats] = useState(null);
  const [repairing, setRepairing] = useState(false);
  const [repairConfirmOpen, setRepairConfirmOpen] = useState(false);
  const [repairBrokenCount, setRepairBrokenCount] = useState(0);
  const requestIdRef = useRef(null);
  const statsReqIdRef = useRef(null);
  const repairRequestIdRef = useRef(null);
  const previewRequestIdRef = useRef(null);
  const listParamsRef = useRef({ sortKey: "name", sortDir: "asc", page: 1, pageSize: 15, query: "" });

  const sortKey = sort.key;
  const sortDir = sort.dir;
  listParamsRef.current = { sortKey, sortDir, page, pageSize, query };

  const perms = account?.role?.permissions || [];
  const canView = perms.includes("*") || perms.includes("drivers.view");
  const canRepairDrivers = perms.includes("*") || perms.includes("sync.request");

  // One-time: WS subscription + stats request (list is fetched by the effect below)
  useEffect(() => {
    if (!window.api) {
      setLoading(false);
      return;
    }

    const unsub = window.api.onWsMessage((msg) => {
      if (msg?.type === "drivers:list" && msg?.requestId === requestIdRef.current) {
        setDrivers(Array.isArray(msg.drivers) ? msg.drivers : []);
        setTotal(typeof msg.total === "number" ? msg.total : 0);
        setLoading(false);
      }
      if (msg?.type === "drivers:stats" && msg?.requestId === statsReqIdRef.current && !msg?.error) {
        setDriverStats({
          totalMoneyInHand: typeof msg.totalMoneyInHand === "number" ? msg.totalMoneyInHand : 0,
          totalEarnings: typeof msg.totalEarnings === "number" ? msg.totalEarnings : 0,
          totalWithdrawal: typeof msg.totalWithdrawal === "number" ? msg.totalWithdrawal : 0,
        });
      }
      if (msg?.type === "drivers:repair:preview" && msg?.requestId === previewRequestIdRef.current) {
        const count = typeof msg.brokenCount === "number" ? msg.brokenCount : 0;
        setRepairBrokenCount(count);
        setRepairConfirmOpen(true);
      }
      if (msg?.type === "drivers:repair:result" && msg?.requestId === repairRequestIdRef.current) {
        setRepairing(false);
        if (msg.ok) {
          const n = msg.repaired ?? 0;
          notify?.success?.(n > 0 ? `Repaired ${n} driver(s).` : "No broken drivers to repair.", "Repair drivers");
          if (n > 0 && window.api?.wsSend) {
            const params = listParamsRef.current;
            setLoading(true);
            requestIdRef.current = rid();
            window.api.wsSend({
              type: "drivers:list",
              requestId: requestIdRef.current,
              payload: {
                sortBy: params.sortKey,
                sortDir: params.sortDir,
                page: params.page,
                pageSize: params.pageSize,
                query: (params.query || "").trim() || undefined,
              },
            });
            statsReqIdRef.current = rid();
            window.api.wsSend({ type: "drivers:stats", requestId: statsReqIdRef.current });
          }
        } else {
          notify?.error?.(msg.error || "Repair failed", "Repair drivers");
        }
      }
      if (msg?.type === "drivers:invalidate" && window.api?.wsSend) {
        const params = listParamsRef.current;
        setLoading(true);
        requestIdRef.current = rid();
        window.api.wsSend({
          type: "drivers:list",
          requestId: requestIdRef.current,
          payload: {
            sortBy: params.sortKey,
            sortDir: params.sortDir,
            page: params.page,
            pageSize: params.pageSize,
            query: (params.query || "").trim() || undefined,
          },
        });
        statsReqIdRef.current = rid();
        window.api.wsSend({ type: "drivers:stats", requestId: statsReqIdRef.current });
      }
    });

    let cancelled = false;
    (async () => {
      try {
        await window.api.wsConnect();
        if (!cancelled && canView && window.api.wsSend) {
          statsReqIdRef.current = rid();
          window.api.wsSend({ type: "drivers:stats", requestId: statsReqIdRef.current });
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [canView]);

  // Fetch list on mount and when sort, page, pageSize or query change
  useEffect(() => {
    if (!window.api?.wsSend) return;
    setLoading(true);
    requestIdRef.current = rid();
    window.api.wsSend({
      type: "drivers:list",
      requestId: requestIdRef.current,
      payload: {
        sortBy: sortKey,
        sortDir,
        page,
        pageSize,
        query: query.trim() || undefined,
      },
    });
  }, [sortKey, sortDir, page, pageSize, query]);

  const toggleSort = useCallback((key) => {
    if (!key) return;
    setPage(1);
    setSort((prev) => {
      if (prev.key === key) {
        return { ...prev, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      return { key, dir: "asc" };
    });
  }, []);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize]
  );

  useEffect(() => setPage((p) => clamp(p, 1, totalPages)), [totalPages]);
  useEffect(() => setPage(1), [query]);

  const pageItems = useMemo(() => {
    return drivers.map((d) => ({
      ...d,
      id: d.id != null ? String(d.id) : (d._id ? String(d._id).slice(-8) : "—"),
    }));
  }, [drivers]);

  const pageModel = useMemo(() => buildPageModel(page, totalPages), [page, totalPages]);

  const animatedMoney = useAnimatedNumber(driverStats?.totalMoneyInHand ?? 0, "money", 900);
  const animatedEarnings = useAnimatedNumber(driverStats?.totalEarnings ?? 0, "earnings", 900);
  const animatedWithdrawal = useAnimatedNumber(driverStats?.totalWithdrawal ?? 0, "withdrawal", 900);

  if (!canView) {
    return (
      <div className="auditLogsPage driversPage driversPage--enter">
        <header className="auditLogsHeader">
          <div className="auditLogsHeaderIcon">
            <Truck size={24} />
          </div>
          <div className="auditLogsHeaderText">
            <h1 className="auditLogsTitle">Drivers</h1>
            <p className="auditLogsSubtitle">You don&apos;t have permission to view drivers.</p>
          </div>
        </header>
      </div>
    );
  }

  const isInitialLoad = loading && drivers.length === 0 && total === 0;
  const hasData = total > 0;

  return (
    <div className="auditLogsPage driversPage driversPage--enter">
      <header className="auditLogsHeader">
        <div className="auditLogsHeaderIcon">
          <Truck size={24} />
        </div>
        <div className="auditLogsHeaderText">
          <h1 className="auditLogsTitle">Drivers</h1>
          <p className="auditLogsSubtitle">Driver list with earnings, balance, and orders</p>
        </div>
      </header>

      <main className="auditLogsMain">
        <div className="auditLogsContent">
          <section className="auditLogsSection">
            {canView && (
              <div className="driversKpiRow">
                <div className="driversKpiCard">
                  <div className="driversKpiIcon">
                    <Truck size={20} />
                  </div>
                  <div className="driversKpiContent">
                    <span className="driversKpiValue">
                      {driverStats == null ? "—" : formatNum(animatedMoney)}
                    </span>
                    <span className="driversKpiLabel">Total money in hand</span>
                  </div>
                </div>
                <div className="driversKpiCard">
                  <div className="driversKpiIcon">
                    <Wallet size={20} />
                  </div>
                  <div className="driversKpiContent">
                    <span className="driversKpiValue">
                      {driverStats == null ? "—" : formatNum(animatedEarnings)}
                    </span>
                    <span className="driversKpiLabel">Total earnings</span>
                  </div>
                </div>
                <div className="driversKpiCard">
                  <div className="driversKpiIcon">
                    <Wallet size={20} />
                  </div>
                  <div className="driversKpiContent">
                    <span className="driversKpiValue">
                      {driverStats == null ? "—" : formatNum(animatedWithdrawal)}
                    </span>
                    <span className="driversKpiLabel">Total withdrawal</span>
                  </div>
                </div>
              </div>
            )}
            {isInitialLoad ? (
              <div className="driversEmpty">
                <div className="driversSpinner" aria-hidden />
                <p>Loading drivers…</p>
              </div>
            ) : (
              <>
                <div className="driversToolbar">
                  <SearchInput
                    value={query}
                    onChange={(v) => {
                      setQuery(v);
                      setPage(1);
                    }}
                    fields={["name", "phone", "ID"]}
                    size="md"
                    width={400}
                  />
                  {canRepairDrivers && (
                    <button
                      type="button"
                      className="driversRepairBtn"
                      onClick={() => {
                        if (!window.api?.wsSend || repairing) return;
                        previewRequestIdRef.current = rid();
                        window.api.wsSend({
                          type: "drivers:repair:preview",
                          requestId: previewRequestIdRef.current,
                        });
                      }}
                      disabled={repairing}
                    >
                      <RefreshCw size={16} className={repairing ? "driversRepairBtnSpinner" : ""} />
                      {repairing ? "Repairing…" : "Repair drivers"}
                    </button>
                  )}
                  <AnimatePresence>
                    {repairConfirmOpen && (
                      <motion.div
                        key="repair-modal"
                        className="driversRepairModalOverlay"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="repair-modal-title"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={() => setRepairConfirmOpen(false)}
                      >
                        <motion.div
                          className="driversRepairModal"
                          initial={{ scale: 0.95, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.95, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <h2 id="repair-modal-title" className="driversRepairModalTitle">
                            {repairBrokenCount > 0
                              ? `Repair ${repairBrokenCount} broken driver${repairBrokenCount === 1 ? "" : "s"}?`
                              : "No broken drivers"}
                          </h2>
                          <p className="driversRepairModalText">
                            {repairBrokenCount > 0
                              ? "Broken drivers have empty name/phone or zero stats. Repair will re-fetch data from the API."
                              : "There are no broken drivers to repair."}
                          </p>
                          <div className="driversRepairModalActions">
                            <button
                              type="button"
                              className="driversRepairModalBtn driversRepairModalBtnCancel"
                              onClick={() => setRepairConfirmOpen(false)}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              className="driversRepairModalBtn driversRepairModalBtnConfirm"
                              onClick={() => {
                                setRepairConfirmOpen(false);
                                if (!window.api?.wsSend) return;
                                setRepairing(true);
                                repairRequestIdRef.current = rid();
                                window.api.wsSend({
                                  type: "drivers:repair",
                                  requestId: repairRequestIdRef.current,
                                });
                              }}
                              disabled={repairing}
                            >
                              {repairBrokenCount > 0 ? "Repair" : "Run anyway"}
                            </button>
                          </div>
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {!hasData && !loading ? (
                  <div className="driversEmpty">
                    <img
                      src={getAssetUrl("assets/svg/nodata-ill.svg")}
                      alt=""
                      className="driversEmptyIll"
                    />
                    <p>No drivers found</p>
                  </div>
                ) : (
                  <div className="auditLogsTableWrap">
                    <DataTable
                      columns={columns}
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={toggleSort}
                      loading={loading}
                      emptyText="No drivers."
                      rows={pageItems}
                      disableVirtualization
                      onRowClick={onNavigate ? (row) => onNavigate("drivers:profile", row) : undefined}
                      onRowContextMenu={
                        onOpenDriverContextMenu
                          ? (event, row) => onOpenDriverContextMenu(event, row)
                          : undefined
                      }
                      renderRow={(row) => (
                        <>
                          <div className="td">
                            <div className="cell cell--muted">{row.serial ?? "—"}</div>
                          </div>
                          <div className="td">
                            <div className="cell cell--muted">{row.id || "—"}</div>
                          </div>
                          <div className="td">
                            <div className="driverListNameCell">
                              <div className="cell strong">{row.name || "—"}</div>
                              <div className="cell driverListPhone">{row.phone || "—"}</div>
                            </div>
                          </div>
                          <div className="td">
                            <div className="cell driversNum">{formatNum(row.cashInHands)}</div>
                          </div>
                          <div className="td">
                            <div className="cell driversNum">{formatNum(row.totalEarnings)}</div>
                          </div>
                          <div className="td">
                            <div className="cell driversNum">{formatNum(row.balance)}</div>
                          </div>
                          <div className="td">
                            <div className="cell driversNum">{formatNum(row.totalWithdrawal)}</div>
                          </div>
                          <div className="td">
                            <div className="cell cell--muted">{formatRelativeDate(row.lastCashinAt)}</div>
                          </div>
                        </>
                      )}
                      footer={
                        <div className="driversFooter">
                          <div className="driversFooterLeft">
                            <div className="driversPerPage">
                              <PaginatorSelect
                                label="Rows"
                                value={pageSize}
                                onChange={(v) => {
                                  setPageSize(v);
                                  setPage(1);
                                }}
                                options={[15, 30, 50].map((n) => ({
                                  value: n,
                                  label: `${n} / page`,
                                }))}
                                openAbove
                              />
                            </div>
                          </div>
                          <div className="driversFooterMid">
                            <button
                              type="button"
                              className="driversPagerBtn"
                              disabled={page <= 1}
                              onClick={() => setPage((p) => p - 1)}
                            >
                              <ChevronLeft size={16} />
                              Previous
                            </button>
                            <div className="driversPages">
                              {pageModel.map((p, idx) =>
                                p === "…" ? (
                                  <span key={`dots-${idx}`} className="driversPagesDots">
                                    …
                                  </span>
                                ) : (
                                  <button
                                    key={p}
                                    type="button"
                                    className={`driversPageBtn ${p === page ? "active" : ""}`}
                                    onClick={() => setPage(p)}
                                  >
                                    {p}
                                  </button>
                                )
                              )}
                            </div>
                            <button
                              type="button"
                              className="driversPagerBtn"
                              disabled={page >= totalPages}
                              onClick={() => setPage((p) => p + 1)}
                            >
                              Next
                              <ChevronRight size={16} />
                            </button>
                          </div>
                          <div className="driversFooterRight">
                            <span className="driversMuted">
                              {total === 0
                                ? "0 results"
                                : `Showing ${(page - 1) * pageSize + 1}–${Math.min(
                                    page * pageSize,
                                    total
                                  )} of ${total}`}
                            </span>
                          </div>
                        </div>
                      }
                    />
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

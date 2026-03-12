import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Store, ChevronLeft, ChevronRight } from "lucide-react";
import DataTable from "../../ui/DataTable";
import SearchInput from "../../ui/SearchInput";
import PaginatorSelect from "../../ui/PaginatorSelect";
import { getAssetUrl } from "../../../utils/publicUrl";
import "../../../styles/pages/audit/audit_logs.css";
import "../../../styles/pages/drivers/drivers.css";
import "../../../styles/ui/paginator_select.css";

const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

function formatNum(n) {
  if (n == null || Number.isNaN(Number(n))) return "-";
  return Number(n).toLocaleString();
}

const buildPageModel = (page, totalPages) => {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  if (page <= 3) return [1, 2, 3, 4, "...", totalPages];
  if (page >= totalPages - 2) return [1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  return [1, "...", page - 1, page, page + 1, "...", totalPages];
};

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

const columns = [
  { key: "serial", label: "#", sortable: false, width: "0.4fr" },
  { key: "id", label: "ID", sortable: true, width: "0.8fr" },
  { key: "storeName", label: "STORE", sortable: true, width: "1.6fr" },
  { key: "totalEarning", label: "TOTAL EARNING", sortable: true, width: "1.1fr", align: "right" },
  { key: "balance", label: "BALANCE", sortable: true, width: "1fr", align: "right" },
  { key: "totalWithdrawn", label: "TOTAL WITHDRAWN", sortable: true, width: "1.1fr", align: "right" },
  { key: "lastCashoutAt", label: "LAST CASHOUT", sortable: false, width: "1fr" },
];

export default function Stores({ account, onNavigate }) {
  const [stores, setStores] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState({ key: "storeName", dir: "asc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const requestIdRef = useRef(null);

  const sortKey = sort.key;
  const sortDir = sort.dir;
  const perms = account?.role?.permissions || [];
  const canView = perms.includes("*") || perms.includes("stores.view");

  // One-time: WS subscription (list is fetched by the effect below)
  useEffect(() => {
    if (!window.api) {
      setLoading(false);
      return;
    }

    const unsub = window.api.onWsMessage((msg) => {
      if (msg?.type === "stores:list" && msg?.requestId === requestIdRef.current) {
        setStores(Array.isArray(msg.stores) ? msg.stores : []);
        setTotal(typeof msg.total === "number" ? msg.total : 0);
        setLoading(false);
      }
    });

    let cancelled = false;
    (async () => {
      try {
        await window.api.wsConnect();
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
      type: "stores:list",
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
    return stores.map((s) => ({
      ...s,
      id: s.id != null ? String(s.id) : (s._id ? String(s._id).slice(-8) : "—"),
    }));
  }, [stores]);

  const pageModel = useMemo(() => buildPageModel(page, totalPages), [page, totalPages]);

  if (!canView) {
    return (
      <div className="auditLogsPage driversPage driversPage--enter">
        <header className="auditLogsHeader">
          <div className="auditLogsHeaderIcon">
            <Store size={24} />
          </div>
          <div className="auditLogsHeaderText">
            <h1 className="auditLogsTitle">Stores</h1>
            <p className="auditLogsSubtitle">You don't have permission to view stores.</p>
          </div>
        </header>
      </div>
    );
  }

  const isInitialLoad = loading && stores.length === 0 && total === 0;
  const hasData = total > 0;

  return (
    <div className="auditLogsPage driversPage driversPage--enter">
      <header className="auditLogsHeader">
        <div className="auditLogsHeaderIcon">
          <Store size={24} />
        </div>
        <div className="auditLogsHeaderText">
          <h1 className="auditLogsTitle">Stores</h1>
          <p className="auditLogsSubtitle">Store list with earnings, balance, and withdrawal</p>
        </div>
      </header>

      <main className="auditLogsMain">
        <div className="auditLogsContent">
          <section className="auditLogsSection">
            {isInitialLoad ? (
              <div className="driversEmpty">
                <div className="driversSpinner" aria-hidden />
                <p>Loading stores...</p>
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
                    fields={["store", "owner", "phone", "ID"]}
                    size="md"
                    width={400}
                  />
                </div>

                {!hasData && !loading ? (
                  <div className="driversEmpty">
                    <img
                      src={getAssetUrl("assets/svg/nodata-ill.svg")}
                      alt=""
                      className="driversEmptyIll"
                    />
                    <p>No stores found</p>
                  </div>
                ) : (
                  <div className="auditLogsTableWrap">
                    <DataTable
                      columns={columns}
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={toggleSort}
                      loading={loading}
                      emptyText="No stores."
                      rows={pageItems}
                      disableVirtualization
                      onRowClick={onNavigate ? (row) => onNavigate("stores:profile", row) : undefined}
                      renderRow={(row) => (
                        <>
                          <div className="td">
                            <div className="cell cell--muted">{row.serial ?? "-"}</div>
                          </div>
                          <div className="td">
                            <div className="cell cell--muted">{row.id || "-"}</div>
                          </div>
                          <div className="td">
                            <div className="driverListNameCell">
                              <div className="cell strong">{row.storeName || "-"}</div>
                              <div className="cell driverListPhone">{row.storePhone || row.ownerPhone || "-"}</div>
                            </div>
                          </div>
                          <div className="td">
                            <div className="cell driversNum">{formatNum(row.totalEarning)}</div>
                          </div>
                          <div className="td">
                            <div className="cell driversNum">{formatNum(row.balance)}</div>
                          </div>
                          <div className="td">
                            <div className="cell driversNum">{formatNum(row.totalWithdrawn)}</div>
                          </div>
                          <div className="td">
                            <div className="cell cell--muted">{formatRelativeDate(row.lastCashoutAt)}</div>
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
                                p === "..." ? (
                                  <span key={`dots-${idx}`} className="driversPagesDots">
                                    ...
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
                                : `Showing ${(page - 1) * pageSize + 1}-${Math.min(
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

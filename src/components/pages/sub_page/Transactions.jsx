// Transactions — dedicated page: DataTable of all successful (approved) cashouts; 15 per page, paginator, scroll outside table
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, X, ChevronLeft, ChevronRight } from "lucide-react";
import DataTable from "../../ui/DataTable";
import PaginatorSelect from "../../ui/PaginatorSelect";
import SearchInput from "../../ui/SearchInput";
import "../../../styles/pages/audit/audit_logs.css";
import "../../../styles/pages/cashout/cashout.css";

function buildPageModel(page, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  if (page <= 3) return [1, 2, 3, 4, "…", totalPages];
  if (page >= totalPages - 2) return [1, "…", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  return [1, "…", page - 1, page, page + 1, "…", totalPages];
}

const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

/** Date only, no time (DD/MM/YYYY) */
function formatDateOnly(d) {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatAmount(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return Number(n).toLocaleString();
}

function typeLabel(row) {
  if (row?._transactionKind === "cashin") {
    return row.type === "driver" ? "Driver" : "Other";
  }
  const t = (row?.type && String(row.type).trim()) || (row?.category === "employee" ? "employee" : "other");
  const v = (t || "").toLowerCase();
  if (v === "employee") return "Employee";
  if (v === "driver") return "Driver";
  if (v === "store") return "Store";
  if (v === "other") return "Other";
  return t || "—";
}

const COLUMNS = [
  { key: "id", label: "ID", sortable: false, width: "0.7fr" },
  { key: "type", label: "TYPE", sortable: true, width: "1fr" },
  { key: "userName", label: "NAME", sortable: true, width: "1.5fr" },
  { key: "date", label: "DATE", sortable: true, width: "1.1fr" },
  { key: "netAmount", label: "NET AMOUNT", sortable: true, width: "1.2fr", align: "right" },
];

export default function Transactions({ account }) {
  const [cashouts, setCashouts] = useState([]);
  const [cashins, setCashins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState({ key: "date", dir: "desc" });
  const [query, setQuery] = useState("");
  const [transactionFilter, setTransactionFilter] = useState("all"); // "all" | "cashin" | "cashout"
  const [detailRow, setDetailRow] = useState(null);
  const [detailExiting, setDetailExiting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const requestIdCashoutRef = useRef(null);
  const requestIdCashinRef = useRef(null);
  const receivedRef = useRef({ cashout: false, cashin: false });
  const detailBackdropRef = useRef(null);

  const closeDetail = useCallback(() => {
    setDetailExiting(true);
  }, []);

  useEffect(() => {
    if (!detailExiting || !detailBackdropRef.current) return;
    const el = detailBackdropRef.current;
    const onEnd = (e) => {
      if (e.target !== el || e.animationName !== "transactionsDetailBackdropOut") return;
      setDetailRow(null);
      setDetailExiting(false);
    };
    const fallback = setTimeout(() => {
      setDetailRow(null);
      setDetailExiting(false);
    }, 450);
    el.addEventListener("animationend", onEnd, { once: true });
    return () => {
      clearTimeout(fallback);
      el.removeEventListener("animationend", onEnd);
    };
  }, [detailExiting]);

  const fetchList = useCallback(() => {
    if (!window.api?.wsSend) return;
    setLoading(true);
    receivedRef.current = { cashout: false, cashin: false };
    requestIdCashoutRef.current = rid();
    requestIdCashinRef.current = rid();
    window.api.wsSend({ type: "cashout:list", requestId: requestIdCashoutRef.current });
    window.api.wsSend({ type: "cashin:list", requestId: requestIdCashinRef.current });
  }, []);

  const setLoadingFalseWhenBothReceived = useCallback(() => {
    if (receivedRef.current.cashout && receivedRef.current.cashin) {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!window.api) {
      setLoading(false);
      return;
    }
    const unsub = window.api.onWsMessage((msg) => {
      if (msg?.type === "cashout:list" && msg?.requestId === requestIdCashoutRef.current) {
        const list = (Array.isArray(msg.cashouts) ? msg.cashouts : []).map((row) => ({
          ...row,
          userName: row.userName ?? row.driverName ?? row.storeName ?? "",
        }));
        setCashouts(list);
        receivedRef.current.cashout = true;
        setLoadingFalseWhenBothReceived();
      }
      if (msg?.type === "cashin:list" && msg?.requestId === requestIdCashinRef.current) {
        setCashins(Array.isArray(msg.cashins) ? msg.cashins : []);
        receivedRef.current.cashin = true;
        setLoadingFalseWhenBothReceived();
      }
      if (msg?.type === "cashout:create:result" && msg?.ok) {
        fetchList();
      }
      if (msg?.type === "cashin:create:result" && msg?.ok) {
        fetchList();
      }
    });
    (async () => {
      try {
        await window.api.wsConnect();
        fetchList();
      } catch {
        setLoading(false);
      }
    })();
    return () => unsub?.();
  }, [fetchList, setLoadingFalseWhenBothReceived]);

  /** Only actual transactions (employee/driver/store/other), not cashout requests. */
  const successfulCashouts = useMemo(() => {
    return cashouts.filter(
      (row) =>
        (row.status || "").toLowerCase() === "approved" &&
        (row.category || "").toLowerCase() !== "request"
    );
  }, [cashouts]);

  /** Normalize cashins to same row shape as cashouts for the table. IDs cin-1, cin-2, ... */
  const normalizedCashins = useMemo(() => {
    return cashins.map((c, idx) => ({
      _reportId: `cin-${idx + 1}`,
      _transactionKind: "cashin",
      type: c.type,
      userName: c.type === "driver" ? (c.driverName || "") : (c.source || ""),
      driverName: c.driverName || "",
      source: c.source || "",
      paymentDate: c.cashinDate,
      createdAt: c.createdAt,
      amount: c.amount,
      netAmount: c.amount,
      note: c.note || "",
    }));
  }, [cashins]);

  /** Merged list: cashouts (with _transactionKind implied) + cashins. Assign cout-1, cout-2, ... to cashouts. */
  const allTransactions = useMemo(() => {
    const out = successfulCashouts.map((r, idx) => ({
      ...r,
      _transactionKind: r._transactionKind || "cashout",
      _reportId: r.cashoutId || `cout-${idx + 1}`,
    }));
    return [...out, ...normalizedCashins];
  }, [successfulCashouts, normalizedCashins]);

  const sortKey = sort.key;
  const sortDir = sort.dir;
  /** Filter by type (all / cashin / cashout) then sort. */
  const filteredByKind = useMemo(() => {
    let list = allTransactions;
    if (transactionFilter === "cashout") {
      list = list.filter((r) => (r._transactionKind || "cashout") === "cashout");
    } else if (transactionFilter === "cashin") {
      list = list.filter((r) => r._transactionKind === "cashin");
    }
    return list;
  }, [allTransactions, transactionFilter]);

  const sortedCashouts = useMemo(() => {
    const list = [...filteredByKind];
    const mult = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      switch (sortKey) {
        case "date": {
          const da = a.paymentDate || a.createdAt;
          const db = b.paymentDate || b.createdAt;
          const ta = da ? new Date(da).getTime() : 0;
          const tb = db ? new Date(db).getTime() : 0;
          return mult * (ta - tb);
        }
        case "type":
          return mult * (a.type || "").localeCompare(b.type || "");
        case "userName":
          return mult * ((a.userName || a.driverName || a.storeName || "").localeCompare(b.userName || b.driverName || b.storeName || ""));
        case "netAmount":
          return mult * (((Number(a.netAmount) ?? Number(a.amount)) || 0) - ((Number(b.netAmount) ?? Number(b.amount)) || 0));
        default:
          return 0;
      }
    });
    return list;
  }, [filteredByKind, sortKey, sortDir]);

  const filteredCashouts = useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    let list = sortedCashouts;
    if (q) {
      const parts = q.split(/\s+/).filter(Boolean);
      list = list.filter((row) => {
        const hay = [
          row.userName,
          row.driverName,
          row.type,
          typeLabel(row),
          formatDateOnly(row.paymentDate || row.createdAt),
          formatAmount(row.netAmount ?? row.amount),
        ]
          .map((x) => String(x || "").toLowerCase())
          .join(" ");
        return parts.every((part) => hay.includes(part));
      });
    }
    return list;
  }, [sortedCashouts, query]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredCashouts.length / pageSize)),
    [filteredCashouts.length, pageSize]
  );

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredCashouts.slice(start, start + pageSize);
  }, [filteredCashouts, page, pageSize]);

  const pageModel = useMemo(() => buildPageModel(page, totalPages), [page, totalPages]);

  const toggleSort = useCallback((key) => {
    setSort((prev) => ({
      key,
      dir: prev.key === key ? (prev.dir === "asc" ? "desc" : "asc") : "desc",
    }));
  }, []);

  const perms = account?.role?.permissions || [];
  const canView =
    perms.includes("*") ||
    perms.includes("transactions.view") ||
    perms.includes("transactions.reject") ||
    perms.includes("cashout.viewAll") ||
    perms.includes("cashout.manage");

  if (!canView) {
    return (
      <div className="auditLogsPage cashoutListPage">
        <header className="auditLogsHeader">
          <div className="auditLogsHeaderIcon">
            <BarChart3 size={24} />
          </div>
          <div className="auditLogsHeaderText">
            <h1 className="auditLogsTitle">Transactions</h1>
            <p className="auditLogsSubtitle">You don&apos;t have permission to view transactions.</p>
          </div>
        </header>
      </div>
    );
  }

  return (
    <div className="auditLogsPage cashoutListPage transactionsPage">
      <header className="auditLogsHeader">
        <div className="auditLogsHeaderIcon">
          <BarChart3 size={24} />
        </div>
        <div className="auditLogsHeaderText">
          <h1 className="auditLogsTitle">Transactions</h1>
          <p className="auditLogsSubtitle">All successful cashouts and cash ins.</p>
        </div>
      </header>

      <main className="auditLogsMain">
        <div className="auditLogsContent">
          <section className="auditLogsSection">
            <div className="auditLogsToolbar cashoutToolbar transactionsToolbar">
              <SearchInput
                value={query}
                onChange={setQuery}
                placeholder="Search by type, name, date, amount…"
                size="md"
                width={320}
              />
              <PaginatorSelect
                label=""
                value={transactionFilter}
                onChange={(v) => {
                  setTransactionFilter(v);
                  setPage(1);
                }}
                options={[
                  { value: "all", label: "All" },
                  { value: "cashout", label: "Cash outs" },
                  { value: "cashin", label: "Cash ins" },
                ]}
              />
            </div>

            <div className="auditLogsTableWrap">
              <DataTable
                columns={COLUMNS}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                loading={loading}
                emptyText="No transactions."
                rows={paginatedRows}
                displayScrollbar={false}
                getRowId={(r) => r._reportId}
                rowIdPrefix=""
                onRowClick={(row) => {
                  setDetailExiting(false);
                  setDetailRow(row);
                }}
                footer={
                  <div className="transactionsFooter">
                    <div className="transactionsFooterLeft">
                      <div className="transactionsPerPage">
                        <PaginatorSelect
                          label="Rows"
                          value={pageSize}
                          onChange={(v) => {
                            setPageSize(v);
                            setPage(1);
                          }}
                          options={[15, 30, 45].map((n) => ({
                            value: n,
                            label: `${n} / page`,
                          }))}
                          openAbove
                        />
                      </div>
                    </div>
                    <div className="transactionsFooterMid">
                      <button
                        type="button"
                        className="transactionsPagerBtn"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => p - 1)}
                      >
                        <ChevronLeft size={16} />
                        Previous
                      </button>
                      <div className="transactionsPages">
                        {pageModel.map((p, idx) =>
                          p === "…" ? (
                            <span key={`dots-${idx}`} className="transactionsPagesDots">
                              …
                            </span>
                          ) : (
                            <button
                              key={p}
                              type="button"
                              className={`transactionsPageBtn ${p === page ? "active" : ""}`}
                              onClick={() => setPage(p)}
                            >
                              {p}
                            </button>
                          )
                        )}
                      </div>
                      <button
                        type="button"
                        className="transactionsPagerBtn"
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        Next
                        <ChevronRight size={16} />
                      </button>
                    </div>
                    <div className="transactionsFooterRight">
                      <span className="transactionsMuted">
                        {filteredCashouts.length === 0
                          ? "0 results"
                          : `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filteredCashouts.length)} of ${filteredCashouts.length}`}
                      </span>
                    </div>
                  </div>
                }
                renderRow={(row) => (
                  <>
                    <div className="td">
                      <div className="cell cell--muted">{row._reportId || "—"}</div>
                    </div>
                    <div className="td">
                      <div className="cell">{typeLabel(row)}</div>
                    </div>
                    <div className="td">
                      <div className="cell strong">{(row.userName || row.driverName || row.storeName || "").trim() || "—"}</div>
                    </div>
                    <div className="td">
                      <div className="cell cell--muted">{formatDateOnly(row.paymentDate || row.createdAt)}</div>
                    </div>
                    <div className="td">
                      <div className="cell">{formatAmount(row.netAmount ?? row.amount)}</div>
                    </div>
                  </>
                )}
              />
            </div>
          </section>
        </div>
      </main>

      {detailRow && (
        <div
          ref={detailBackdropRef}
          className={`transactionsDetailBackdrop ${detailExiting ? "transactionsDetailBackdrop--exiting" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="transactionsDetailTitle"
          onClick={detailExiting ? undefined : closeDetail}
        >
          <div className={`transactionsDetailModal ${detailExiting ? "transactionsDetailModal--exiting" : ""}`} onClick={(e) => e.stopPropagation()}>
            <div className="transactionsDetailHeader">
              <h2 id="transactionsDetailTitle" className="transactionsDetailTitle">
                Transaction {detailRow._reportId}
              </h2>
              <button
                type="button"
                className="transactionsDetailClose"
                onClick={detailExiting ? undefined : closeDetail}
                aria-label="Close"
                disabled={detailExiting}
              >
                <X size={20} />
              </button>
            </div>
            <div className="transactionsDetailBody">
              {detailRow._transactionKind === "cashin" ? (
                <>
                  <div className="transactionsDetailRow">
                    <span className="transactionsDetailLabel">{detailRow.type === "driver" ? "Driver" : "Source"}</span>
                    <span className="transactionsDetailValue">{(detailRow.userName || detailRow.driverName || detailRow.source || "").trim() || "—"}</span>
                  </div>
                  <div className="transactionsDetailRow transactionsDetailRow--total">
                    <span className="transactionsDetailLabel">Amount</span>
                    <span className="transactionsDetailValue">{formatAmount(detailRow.amount ?? detailRow.netAmount)}</span>
                  </div>
                  <div className="transactionsDetailRow">
                    <span className="transactionsDetailLabel">Date</span>
                    <span className="transactionsDetailValue">{formatDateOnly(detailRow.paymentDate || detailRow.createdAt)}</span>
                  </div>
                  <div className="transactionsDetailRow">
                    <span className="transactionsDetailLabel">Note</span>
                    <span className="transactionsDetailValue transactionsDetailNote">{detailRow.note || "—"}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="transactionsDetailRow">
                    <span className="transactionsDetailLabel">{detailRow.type === "store" ? "Store" : "Name"}</span>
                    <span className="transactionsDetailValue">{(detailRow.userName || detailRow.driverName || detailRow.storeName || "").trim() || "—"}</span>
                  </div>
                  <div className="transactionsDetailRow">
                    <span className="transactionsDetailLabel">Extra charge</span>
                    <span className="transactionsDetailValue">{formatAmount(detailRow.extraCharge ?? 0)}</span>
                  </div>
                  <div className="transactionsDetailRow">
                    <span className="transactionsDetailLabel">Violations</span>
                    <span className="transactionsDetailValue">{formatAmount(Number(detailRow.violations) || 0)}</span>
                  </div>
                  <div className="transactionsDetailRow">
                    <span className="transactionsDetailLabel">Debts</span>
                    <span className="transactionsDetailValue">{formatAmount(detailRow.debts ?? 0)}</span>
                  </div>
                  <div className="transactionsDetailRow transactionsDetailRow--total">
                    <span className="transactionsDetailLabel">Total amount</span>
                    <span className="transactionsDetailValue">{formatAmount(detailRow.totalAmount ?? detailRow.amount)}</span>
                  </div>
                  <div className="transactionsDetailRow">
                    <span className="transactionsDetailLabel">Note</span>
                    <span className="transactionsDetailValue transactionsDetailNote">{detailRow.note || "—"}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

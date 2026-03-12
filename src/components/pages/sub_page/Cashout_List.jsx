// Cashout_List — list cashouts; permissions: cashout.request (own + request), cashout.viewAll (all read-only), cashout.manage (all + approve/deny)
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Wallet, PlusCircle, Check, X, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import DataTable from "../../ui/DataTable";
import SearchInput from "../../ui/SearchInput";
import PaginatorSelect from "../../ui/PaginatorSelect";
import "../../../styles/pages/cashout/cashout.css";
import "../../../styles/ui/paginator_select.css";

const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const MODAL_EXIT_DURATION_MS = 220;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

const buildPageModel = (page, totalPages) => {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  if (page <= 3) return [1, 2, 3, 4, "…", totalPages];
  if (page >= totalPages - 2) return [1, "…", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  return [1, "…", page - 1, page, page + 1, "…", totalPages];
};

/** Status cell with fade-out (old) then fade-in (new) bounce animation when status changes. */
function StatusCell({ rowId, status }) {
  const [displayStatus, setDisplayStatus] = useState(status);
  const [phase, setPhase] = useState("idle");
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => {
    if (status !== displayStatus && phase === "idle") setPhase("exiting");
  }, [status, displayStatus, phase]);

  const handleAnimationEnd = useCallback(() => {
    if (phaseRef.current === "exiting") {
      setDisplayStatus(status);
      setPhase("entering");
    } else if (phaseRef.current === "entering") {
      setPhase("idle");
    }
  }, [status]);

  const label = (displayStatus || "pending").charAt(0).toUpperCase() + (displayStatus || "pending").slice(1);
  const animClass = phase === "exiting" ? "cashoutStatusBadge--exit" : phase === "entering" ? "cashoutStatusBadge--enter" : "";

  return (
    <span
      className={`cashoutStatusBadge cashoutStatusBadge--${displayStatus || "pending"} ${animClass}`.trim()}
      onAnimationEnd={handleAnimationEnd}
    >
      {label}
    </span>
  );
}

/** Date as DD/MM/YYYY, time as hours:minutes AM/PM (no seconds) */
function formatDate(d) {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const h = date.getHours();
  const hours12 = h % 12 || 12;
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = h < 12 ? "AM" : "PM";
  return `${day}/${month}/${year} ${hours12}:${minutes} ${ampm}`;
}

function formatAmount(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return Number(n).toLocaleString();
}

/** Format digits-only string with thousand commas for display */
function formatPriceDisplay(digitsStr) {
  if (!digitsStr) return "";
  const cleaned = String(digitsStr).replace(/\D/g, "");
  if (!cleaned) return "";
  return Number(cleaned).toLocaleString();
}

/** Today's date as YYYY-MM-DD for display */
function todayDateStr() {
  const d = new Date();
  return d.toLocaleDateString("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" });
}

const BASE_COLUMNS = [
  { key: "createdAt", label: "DATE", sortable: true, width: "1.2fr" },
  { key: "userName", label: "USER", sortable: true, width: "0.96fr" },
  { key: "title", label: "TITLE", sortable: true, width: "1fr" },
  { key: "amount", label: "AMOUNT", sortable: true, width: "1fr", align: "right" },
  { key: "status", label: "STATUS", sortable: true, width: "1fr" },
];

export default function CashoutList({ account }) {
  const [cashouts, setCashouts] = useState([]);
  const [canManage, setCanManage] = useState(false);
  const [canReject, setCanReject] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState({ key: "createdAt", dir: "desc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalClosing, setModalClosing] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalAmount, setModalAmount] = useState("");
  const [modalNote, setModalNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [denyTarget, setDenyTarget] = useState(null);
  const [denyNote, setDenyNote] = useState("");
  const [denyModalClosing, setDenyModalClosing] = useState(false);
  const [query, setQuery] = useState("");
  const requestIdRef = useRef(null);
  const createReqIdRef = useRef(null);
  const approveReqIdRef = useRef(null);
  const denyReqIdRef = useRef(null);
  const resetFormOnCloseRef = useRef(false);

  const perms = account?.role?.permissions || [];
  const canRequest = perms.includes("*") || perms.includes("cashout.request");

  const fetchList = useCallback(() => {
    if (!window.api?.wsSend) return;
    setLoading(true);
    requestIdRef.current = rid();
    window.api.wsSend({ type: "cashout:list", requestId: requestIdRef.current });
  }, []);

  function closeRequestModal(resetForm = false) {
    resetFormOnCloseRef.current = resetForm;
    setModalClosing(true);
  }

  function closeDenyModal() {
    setDenyModalClosing(true);
  }

  useEffect(() => {
    if (!denyModalClosing) return;
    const id = setTimeout(() => {
      setDenyTarget(null);
      setDenyNote("");
      setDenyModalClosing(false);
    }, MODAL_EXIT_DURATION_MS);
    return () => clearTimeout(id);
  }, [denyModalClosing]);

  useEffect(() => {
    if (!modalClosing) return;
    const id = setTimeout(() => {
      setModalOpen(false);
      setModalClosing(false);
      if (resetFormOnCloseRef.current) {
        setModalTitle("");
        setModalAmount("");
        setModalNote("");
      }
      resetFormOnCloseRef.current = false;
    }, MODAL_EXIT_DURATION_MS);
    return () => clearTimeout(id);
  }, [modalClosing, fetchList]);

  useEffect(() => {
    if (!window.api) {
      setLoading(false);
      return;
    }
    const unsub = window.api.onWsMessage((msg) => {
      if (msg?.type === "cashout:list" && msg?.requestId === requestIdRef.current) {
        setCashouts(Array.isArray(msg.cashouts) ? msg.cashouts : []);
        setCanManage(!!msg.canManage);
        setCanReject(!!msg.canReject);
        setLoading(false);
      }
      if (msg?.type === "cashout:create:result" && msg?.requestId === createReqIdRef.current) {
        setSubmitting(false);
        if (msg.ok) {
          if (msg.cashout) {
            setCashouts((prev) => {
              const id = msg.cashout.id != null ? String(msg.cashout.id) : null;
              if (id && prev.some((c) => String(c.id) === id)) return prev;
              return [{ ...msg.cashout, category: "request" }, ...prev];
            });
          }
          closeRequestModal(true);
        }
      }
      if (msg?.type === "cashout:approve:result" && msg?.requestId === approveReqIdRef.current) {
        if (msg.ok && msg.cashoutId && msg.status) {
          setCashouts((prev) =>
            prev.map((c) => (String(c.id) === String(msg.cashoutId) ? { ...c, status: msg.status } : c))
          );
        }
      }
      if (msg?.type === "cashout:deny:result" && msg?.requestId === denyReqIdRef.current) {
        if (msg.ok) {
          closeDenyModal();
          if (msg.cashoutId && msg.status) {
            setCashouts((prev) =>
              prev.map((c) => (String(c.id) === String(msg.cashoutId) ? { ...c, status: msg.status } : c))
            );
          }
        }
      }
      if (msg?.type === "cashout:newRequest" && msg?.cashoutId) {
        setCashouts((prev) => {
          const newRow = {
            id: msg.cashoutId,
            cashoutId: msg.cashoutId,
            title: msg.title ?? "",
            amount: msg.amount ?? 0,
            userName: msg.userName ?? "—",
            status: "pending",
            createdAt: new Date(),
            category: "request",
          };
          if (prev.some((c) => String(c.id) === String(msg.cashoutId))) return prev;
          return [newRow, ...prev];
        });
      }
      if (msg?.type === "cashout:requestDecided" && msg?.cashoutId) {
        const newStatus = msg.status === "approved" ? "approved" : msg.status === "denied" ? "denied" : (msg.status || "approved");
        setCashouts((prev) =>
          prev.map((c) => (String(c.id) === String(msg.cashoutId) ? { ...c, status: newStatus } : c))
        );
      }
      if (msg?.type === "cashout:cashed" && msg?.cashoutId) {
        setCashouts((prev) =>
          prev.map((c) => (String(c.id) === String(msg.cashoutId) ? { ...c, status: "cashed" } : c))
        );
      }
      if (msg?.type === "cashout:rejected" && msg?.cashoutId) {
        setCashouts((prev) =>
          prev.map((c) => (String(c.id) === String(msg.cashoutId) ? { ...c, status: "rejected" } : c))
        );
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
  }, [fetchList]);

  /** Only cashout requests (from Request cashout flow), not direct transactions. */
  const requestCashouts = useMemo(() => {
    return cashouts.filter((row) => (row.category || "request").toLowerCase() === "request");
  }, [cashouts]);

  const sortKey = sort.key;
  const sortDir = sort.dir;
  const columns = useMemo(() => {
    if (!canManage && !canReject) return BASE_COLUMNS;
    return [
      ...BASE_COLUMNS,
      { key: "actions", label: "ACTIONS", align: "center", sortable: false, width: "1.2fr" },
    ];
  }, [canManage, canReject]);

  const toggleSort = useCallback((key) => {
    setPage(1);
    setSort((prev) => ({
      key,
      dir: prev.key === key ? (prev.dir === "asc" ? "desc" : "asc") : "desc",
    }));
  }, []);

  const sortedCashouts = useMemo(() => {
    const list = [...requestCashouts];
    const mult = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      switch (sortKey) {
        case "createdAt": {
          const ta = new Date(a.createdAt).getTime();
          const tb = new Date(b.createdAt).getTime();
          return mult * (ta - tb);
        }
        case "userName":
          return mult * (a.userName || "").localeCompare(b.userName || "");
        case "amount":
          return mult * ((Number(a.amount) || 0) - (Number(b.amount) || 0));
        case "status":
          return mult * (a.status || "").localeCompare(b.status || "");
        default:
          return 0;
      }
    });
    return list;
  }, [requestCashouts, sortKey, sortDir]);

  const filteredCashouts = useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    if (!q) return sortedCashouts;
    const parts = q.split(/\s+/).filter(Boolean);
    return sortedCashouts.filter((row) => {
      const hay = [
        row.userName,
        row.status,
        formatAmount(row.amount),
        formatDate(row.createdAt),
      ]
        .map((x) => String(x || "").toLowerCase())
        .join(" ");
      return parts.every((part) => hay.includes(part));
    });
  }, [sortedCashouts, query]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredCashouts.length / pageSize)),
    [filteredCashouts.length, pageSize]
  );
  useEffect(() => setPage((p) => clamp(p, 1, totalPages)), [totalPages]);
  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredCashouts.slice(start, start + pageSize);
  }, [filteredCashouts, page, pageSize]);
  const pageModel = useMemo(() => buildPageModel(page, totalPages), [page, totalPages]);

  const handleRequestSubmit = useCallback(() => {
    const title = modalTitle.trim();
    if (!title) return;
    const amount = Number(String(modalAmount).replace(/\D/g, "")) || 0;
    if (amount < 0) return;
    if (!window.api?.wsSend) return;
    setSubmitting(true);
    createReqIdRef.current = rid();
    window.api.wsSend({
      type: "cashout:create",
      requestId: createReqIdRef.current,
      payload: { title, amount, note: modalNote.trim() || undefined },
    });
  }, [modalTitle, modalAmount, modalNote]);

  const handlePriceChange = useCallback((e) => {
    const raw = e.target.value.replace(/\D/g, "");
    setModalAmount(raw);
  }, []);

  const handleApprove = useCallback((cashoutId) => {
    if (!window.api?.wsSend || !cashoutId) return;
    approveReqIdRef.current = rid();
    window.api.wsSend({
      type: "cashout:approve",
      requestId: approveReqIdRef.current,
      payload: { cashoutId },
    });
  }, []);

  const handleDeny = useCallback((cashoutId, note) => {
    if (!window.api?.wsSend || !cashoutId) return;
    denyReqIdRef.current = rid();
    window.api.wsSend({
      type: "cashout:deny",
      requestId: denyReqIdRef.current,
      payload: { cashoutId, note: note || undefined },
    });
  }, []);

  const showCashoutList =
    canRequest ||
    perms.includes("cashout.viewAll") ||
    perms.includes("cashout.manage") ||
    perms.includes("transactions.view") ||
    perms.includes("transactions.reject");
  if (!showCashoutList) {
    return (
      <div className="auditLogsPage cashoutListPage cashoutListPage--enter">
        <header className="auditLogsHeader">
          <div className="auditLogsHeaderIcon">
            <Wallet size={24} />
          </div>
          <div className="auditLogsHeaderText">
            <h1 className="auditLogsTitle">Cashout List</h1>
            <p className="auditLogsSubtitle">You don&apos;t have permission to view cashouts.</p>
          </div>
        </header>
      </div>
    );
  }

  return (
    <div className="auditLogsPage cashoutListPage cashoutListPage--enter cashoutListPage--scrollable">
      <header className="auditLogsHeader">
        <div className="auditLogsHeaderIcon">
          <Wallet size={24} />
        </div>
        <div className="auditLogsHeaderText">
          <h1 className="auditLogsTitle">Cashout List</h1>
          <p className="auditLogsSubtitle">
            {canManage || canReject
              ? "View all cashouts and approve or deny pending requests."
              : canRequest
                ? "Your cashout requests."
                : "View all cashout requests (read-only)."}
          </p>
        </div>
      </header>

      <main className="auditLogsMain">
        <div className="auditLogsContent">
          <section className="auditLogsSection">
            <div className="auditLogsToolbar cashoutToolbar">
              <SearchInput
                value={query}
                onChange={(v) => {
                  setQuery(v);
                  setPage(1);
                }}
                placeholder="Search by user, amount, status, date…"
                size="md"
                width={320}
              />
              {canRequest && (
                <button
                  type="button"
                  className="cashoutRequestBtn"
                  onClick={() => setModalOpen(true)}
                >
                  <PlusCircle size={18} />
                  Request cashout
                </button>
              )}
            </div>

            <div className="auditLogsTableWrap">
              <DataTable
                columns={columns}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                loading={loading}
                emptyText="No cashout requests."
                rows={pageItems}
                displayScrollbar={false}
                renderRow={(row) => (
                  <>
                    <div className="td">
                      <div className="cell cell--muted">{formatDate(row.createdAt)}</div>
                    </div>
                    <div className="td">
                      <div className="cell strong">{row.userName || "—"}</div>
                    </div>
                    <div className="td">
                      <div className="cell">{row.title || "—"}</div>
                    </div>
                    <div className="td">
                      <div className="cell">{formatAmount(row.amount)}</div>
                    </div>
                    <div className="td td-status">
                      <StatusCell rowId={row.id} status={row.status} />
                    </div>
                    {(canManage || canReject) && (
                      <div className="td td-actions">
                        {row.status === "pending" ? (
                          <div className="cashoutRowActions">
                            {canManage && (
                              <button
                                type="button"
                                className="cashoutRowBtn cashoutRowBtn--approve"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleApprove(row.id);
                                }}
                              >
                                <Check size={14} strokeWidth={2.2} />
                                Approve
                              </button>
                            )}
                            {canReject && (
                              <button
                                type="button"
                                className="cashoutRowBtn cashoutRowBtn--deny"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDenyTarget({ id: row.id, userName: row.userName });
                                }}
                              >
                                <X size={14} strokeWidth={2.2} />
                                Deny
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="cell cell--muted cashoutDecidedPlaceholder">—</span>
                        )}
                      </div>
                    )}
                  </>
                )}
                footer={
                  <div className="cashoutListFooter">
                    <div className="cashoutListFooterLeft">
                      <div className="cashoutListPerPage">
                        <PaginatorSelect
                          label="Rows"
                          value={pageSize}
                          onChange={(v) => {
                            setPageSize(v);
                            setPage(1);
                          }}
                          options={[15, 30, 45].map((n) => ({ value: n, label: `${n} / page` }))}
                          openAbove
                        />
                      </div>
                    </div>
                    <div className="cashoutListFooterMid">
                      <button
                        type="button"
                        className="cashoutListPagerBtn"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => p - 1)}
                      >
                        <ChevronLeft size={16} />
                        Previous
                      </button>
                      <div className="cashoutListPages">
                        {pageModel.map((p, idx) =>
                          p === "…" ? (
                            <span key={`dots-${idx}`} className="cashoutListPagesDots">
                              …
                            </span>
                          ) : (
                            <button
                              key={p}
                              type="button"
                              className={`cashoutListPageBtn ${p === page ? "active" : ""}`}
                              onClick={() => setPage(p)}
                            >
                              {p}
                            </button>
                          )
                        )}
                      </div>
                      <button
                        type="button"
                        className="cashoutListPagerBtn"
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        Next
                        <ChevronRight size={16} />
                      </button>
                    </div>
                    <div className="cashoutListFooterRight">
                      <span className="cashoutListMuted">
                        {filteredCashouts.length === 0
                          ? "0 results"
                          : `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filteredCashouts.length)} of ${filteredCashouts.length}`}
                      </span>
                    </div>
                  </div>
                }
              />
            </div>
          </section>
        </div>
      </main>

      {/* Request cashout modal — portaled to body so it covers the entire app */}
      {(modalOpen || modalClosing) &&
        typeof document !== "undefined" &&
        document.body &&
        createPortal(
          <div
            className={`cashoutModalBackdrop cashoutModalBackdrop--fullApp ${modalClosing ? "cashoutModalBackdrop--exit" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cashoutModalTitle"
            onClick={modalClosing ? undefined : () => !submitting && closeRequestModal()}
          >
            <div
              className={`cashoutModal cashoutModal--request ${modalClosing ? "cashoutModal--exit" : ""}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="cashoutModalForm">
                <header className="cashoutModalHeader">
                  <h2 id="cashoutModalTitle" className="cashoutModalTitle">
                    <span className="cashoutModalTitleIcon" aria-hidden><Wallet size={20} /></span>
                    Request cashout
                  </h2>
                  <button
                    type="button"
                    className="cashoutModalClose"
                    onClick={() => !submitting && closeRequestModal()}
                    disabled={submitting || modalClosing}
                    aria-label="Close"
                  >
                    <X size={20} />
                  </button>
                </header>
                <div className="cashoutModalBody">
                  <div className="cashoutModalRow cashoutModalRow--two">
                    <div className="cashoutModalField">
                      <label htmlFor="cashout-modal-title">Title</label>
                      <input
                        id="cashout-modal-title"
                        type="text"
                        value={modalTitle}
                        onChange={(e) => setModalTitle(e.target.value)}
                        placeholder="e.g. Rent / Internet / Maintenance …"
                        disabled={submitting}
                      />
                    </div>
                    <div className="cashoutModalField">
                      <label htmlFor="cashout-modal-amount">Payment amount</label>
                      <input
                        id="cashout-modal-amount"
                        type="text"
                        inputMode="numeric"
                        value={formatPriceDisplay(modalAmount)}
                        onChange={handlePriceChange}
                        placeholder="e.g. 150,000"
                        disabled={submitting}
                      />
                    </div>
                  </div>
                  <div className="cashoutModalRow">
                    <div className="cashoutModalField cashoutModalField--date">
                      <label htmlFor="cashout-modal-date">Payment date</label>
                      <div className="cashoutModalDateWrap">
                        <input
                          id="cashout-modal-date"
                          type="text"
                          value={todayDateStr()}
                          readOnly
                          tabIndex={-1}
                          className="cashoutModalInput--readOnly"
                          aria-readonly="true"
                        />
                        <span className="cashoutModalDateIcon" aria-hidden>
                          <Calendar size={18} />
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="cashoutModalRow">
                    <div className="cashoutModalField">
                      <label htmlFor="cashout-modal-note">Details / Note</label>
                      <textarea
                        id="cashout-modal-note"
                        value={modalNote}
                        onChange={(e) => setModalNote(e.target.value)}
                        placeholder="Write details here …"
                        disabled={submitting}
                        rows={4}
                        className="cashoutModalTextarea"
                      />
                    </div>
                  </div>
                </div>
                <p className="cashoutModalNote">
                  Your cashout request will be sent to an administrator to either approve or deny it.
                </p>
                <div className="cashoutModalActions">
                <button
                  type="button"
                  className="cashoutModalBtn cashoutModalBtn--secondary"
                  onClick={() => !submitting && closeRequestModal()}
                  disabled={submitting || modalClosing}
                >
                  Cancel
                </button>
                  <button
                    type="button"
                    className="cashoutModalBtn cashoutModalBtn--primary"
                    onClick={handleRequestSubmit}
                    disabled={submitting || modalClosing || !modalTitle.trim()}
                  >
                    {submitting ? "Submitting…" : "Confirm"}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Deny confirmation modal */}
      {(denyTarget || denyModalClosing) && (
        <div
          className={`cashoutModalBackdrop ${denyModalClosing ? "cashoutModalBackdrop--exit" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="cashoutDenyTitle"
          onClick={denyModalClosing ? undefined : closeDenyModal}
        >
          <div
            className={`cashoutModal ${denyModalClosing ? "cashoutModal--exit" : ""}`}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="cashoutDenyTitle" className="cashoutModalTitle">Deny cashout</h2>
            <p className="cashoutDenyText">
              Deny cashout request for <strong>{denyTarget?.userName || "this user"}</strong>?
            </p>
            <div className="cashoutModalField">
              <label htmlFor="cashout-deny-note">Reason (optional)</label>
              <input
                id="cashout-deny-note"
                type="text"
                value={denyNote}
                onChange={(e) => setDenyNote(e.target.value)}
                placeholder="Optional reason"
              />
            </div>
            <div className="cashoutModalActions">
              <button
                type="button"
                className="cashoutModalBtn cashoutModalBtn--secondary"
                onClick={closeDenyModal}
                disabled={denyModalClosing}
              >
                Cancel
              </button>
              <button
                type="button"
                className="cashoutModalBtn cashoutModalBtn--deny"
                onClick={() => {
                  handleDeny(denyTarget.id, denyNote.trim() || undefined);
                  closeDenyModal();
                }}
                disabled={denyModalClosing}
              >
                Deny
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

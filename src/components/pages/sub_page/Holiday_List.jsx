import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import DataTable from "../../ui/DataTable";
import SearchInput from "../../ui/SearchInput";
import PaginatorSelect from "../../ui/PaginatorSelect";
import ConfirmDeleteModal from "../../modals/ConfirmDeleteModal";
import { useNotification } from "../../NotificationProvider";
import "../../../styles/ui/paginator_select.css";
import "../../../styles/pages/holidays/holidays.css";

const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function formatDate(d) {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { dateStyle: "medium" });
}

const STATUS_OPTIONS = [
  { value: "", label: "Any status" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "denied", label: "Denied" },
];

/** Status cell with fade-out (old) then fade-in (new) bounce animation when status changes (same as Cashout_List). */
function HolidayStatusCell({ rowId, status }) {
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

  const label =
    displayStatus === "approved" ? "Approved" : displayStatus === "denied" ? "Denied" : "Pending";
  const animClass =
    phase === "exiting"
      ? "holidaysStatusBadge--exit"
      : phase === "entering"
        ? "holidaysStatusBadge--enter"
        : "";

  return (
    <span
      className={`holidaysStatusBadge holidaysStatusBadge--${displayStatus || "pending"} ${animClass}`.trim()}
      onAnimationEnd={handleAnimationEnd}
    >
      {label}
    </span>
  );
}

const columns = [
  { key: "user", label: "USER", sortable: true, width: "1.4fr" },
  { key: "startDate", label: "START", sortable: true, width: "1fr" },
  { key: "endDate", label: "END", sortable: true, width: "1fr" },
  { key: "days", label: "DAYS", sortable: true, width: "0.7fr" },
  { key: "reason", label: "REASON", sortable: false, width: "1.6fr" },
  { key: "status", label: "STATUS", sortable: true, width: "1fr" },
  { key: "actions", label: "ACTIONS", sortable: false, width: "1.2fr" },
];

export default function HolidayList({ account, onNavigate, highlightHolidayId }) {
  const notify = useNotification();
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sort, setSort] = useState({ key: "createdAt", dir: "desc" });
  const sortKey = sort.key;
  const sortDir = sort.dir;
  const [approveTarget, setApproveTarget] = useState(null);
  const [denyTarget, setDenyTarget] = useState(null);
  const [denyReason, setDenyReason] = useState("");
  const [actioningId, setActioningId] = useState(null);
  const [highlightedId, setHighlightedId] = useState(null);
  const pendingRef = useRef({});
  const tableWrapRef = useRef(null);

  const perms = account?.role?.permissions || [];
  const canManage = perms.includes("*") || perms.includes("holiday.manage");

  const fetchList = useCallback(() => {
    if (!window.api?.wsSend) return;
    const reqId = rid();
    pendingRef.current[reqId] = true;
    setLoading(true);
    window.api.wsSend({ type: "holiday:list", requestId: reqId, payload: {} });
  }, []);

  useEffect(() => {
    if (!window.api) {
      setLoading(false);
      return;
    }
    const unsub = window.api.onWsMessage((msg) => {
      if (msg?.type === "holiday:list" && pendingRef.current[msg.requestId]) {
        delete pendingRef.current[msg.requestId];
        setHolidays(Array.isArray(msg.holidays) ? msg.holidays : []);
        setLoading(false);
      }
      if (msg?.type === "holiday:approve:result") {
        setActioningId(null);
        setApproveTarget(null);
        if (msg.ok && msg.holidayId != null) {
          setHolidays((prev) =>
            prev.map((h) =>
              String(h._id) !== String(msg.holidayId)
                ? h
                : {
                    ...h,
                    status: msg.status ?? "approved",
                    decidedByName: msg.decidedByName ?? h.decidedByName,
                    decidedAt: msg.decidedAt ?? h.decidedAt,
                  }
            )
          );
        } else if (!msg?.ok) {
          notify?.error?.(msg.error || "Failed to approve", "Holiday");
        }
      }
      if (msg?.type === "holiday:deny:result") {
        setActioningId(null);
        setDenyTarget(null);
        setDenyReason("");
        if (msg.ok && msg.holidayId != null) {
          setHolidays((prev) =>
            prev.map((h) =>
              String(h._id) !== String(msg.holidayId)
                ? h
                : {
                    ...h,
                    status: msg.status ?? "denied",
                    decidedByName: msg.decidedByName ?? h.decidedByName,
                    decidedAt: msg.decidedAt ?? h.decidedAt,
                    denialReason: msg.denialReason !== undefined ? msg.denialReason : h.denialReason,
                  }
            )
          );
        } else if (!msg?.ok) {
          notify?.error?.(msg.error || "Failed to deny", "Holiday");
        }
      }
      if (msg?.type === "holiday:status" || msg?.type === "holiday:request_decided") {
        const id = msg.holidayId;
        if (!id) return;
        setHolidays((prev) => {
          const next = prev.map((h) => {
            if (String(h._id) !== String(id)) return h;
            return {
              ...h,
              status: msg.status ?? h.status,
              decidedByName: msg.decidedByName ?? h.decidedByName,
              decidedAt: msg.decidedAt ?? h.decidedAt,
              denialReason: msg.denialReason !== undefined ? msg.denialReason : h.denialReason,
            };
          });
          return next;
        });
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
  }, [fetchList, notify]);

  const toggleSort = useCallback((key) => {
    setSort((prev) => {
      if (prev.key === key) {
        return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      return { key, dir: "desc" };
    });
  }, []);

  const filteredAndSorted = useMemo(() => {
    let list = [...holidays];
    if (filterStatus) list = list.filter((h) => h.status === filterStatus);
    const q = (query || "").trim().toLowerCase();
    if (q) {
      list = list.filter(
        (h) =>
          (h.userName || "").toLowerCase().includes(q) ||
          (h.userEmail || "").toLowerCase().includes(q) ||
          (h.reason || "").toLowerCase().includes(q) ||
          (h.startDate && String(h.startDate).toLowerCase().includes(q)) ||
          (h.endDate && String(h.endDate).toLowerCase().includes(q))
      );
    }
    const mult = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      let va = a[sortKey];
      let vb = b[sortKey];
      if (sortKey === "startDate" || sortKey === "endDate" || sortKey === "createdAt") {
        va = new Date(va).getTime();
        vb = new Date(vb).getTime();
        return mult * (va - vb);
      }
      if (sortKey === "user") {
        va = (a.userName || "").toLowerCase();
        vb = (b.userName || "").toLowerCase();
        return mult * (va < vb ? -1 : va > vb ? 1 : 0);
      }
      if (sortKey === "status") {
        const order = { pending: 0, approved: 1, denied: 2 };
        return mult * ((order[va] ?? 3) - (order[vb] ?? 3));
      }
      if (sortKey === "days") return mult * ((Number(a.days) || 0) - (Number(b.days) || 0));
      return 0;
    });
    return list;
  }, [holidays, filterStatus, query, sortKey, sortDir]);

  const handleApproveClick = useCallback((h) => setApproveTarget(h), []);
  const handleApproveConfirm = useCallback(() => {
    if (!approveTarget || !window.api?.wsSend || actioningId) return;
    setActioningId(approveTarget._id);
    window.api.wsSend({
      type: "holiday:approve",
      requestId: rid(),
      payload: { holidayId: approveTarget._id },
    });
  }, [approveTarget, actioningId]);

  const handleDenyClick = useCallback((h) => {
    setDenyTarget(h);
    setDenyReason("");
  }, []);

  const handleDenySubmit = useCallback(() => {
    if (!denyTarget || !window.api?.wsSend || actioningId) return;
    setActioningId(denyTarget._id);
    window.api.wsSend({
      type: "holiday:deny",
      requestId: rid(),
      payload: { holidayId: denyTarget._id, denialReason: denyReason.trim() || undefined },
    });
  }, [denyTarget, denyReason, actioningId]);

  useEffect(() => {
    if (!highlightHolidayId || loading || !filteredAndSorted.length) return;
    const id = String(highlightHolidayId);
    const exists = filteredAndSorted.some((h) => String(h._id) === id);
    if (!exists) return;
    setHighlightedId(id);
    const el = document.getElementById(`holiday-row-${id}`);
    if (el) {
      el.classList.add("holiday-row--highlighted");
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
      const t = setTimeout(() => {
        el.classList.remove("holiday-row--highlighted");
        setHighlightedId(null);
      }, 3500);
      return () => {
        clearTimeout(t);
        el.classList.remove("holiday-row--highlighted");
      };
    }
  }, [highlightHolidayId, loading, filteredAndSorted]);

  if (!canManage) {
    return (
      <div className="holidaysPage">
        <header className="holidaysHeader">
          <div className="holidaysHeaderIcon">
            <CalendarDays size={24} />
          </div>
          <div className="holidaysHeaderText">
            <h1 className="holidaysTitle">Holiday list</h1>
            <p className="holidaysSubtitle">You don&apos;t have permission to view or manage holiday requests.</p>
          </div>
        </header>
      </div>
    );
  }

  const approveMessage = approveTarget
    ? `Approve this holiday request for ${approveTarget.userName || "this employee"}?\n${formatDate(approveTarget.startDate)} – ${formatDate(approveTarget.endDate)} (${approveTarget.days} day${approveTarget.days !== 1 ? "s" : ""}).`
    : "";

  return (
    <div className="holidaysPage">
      <header className="holidaysHeader">
        <div className="holidaysHeaderIcon">
          <CalendarDays size={24} />
        </div>
        <div className="holidaysHeaderText">
          <h1 className="holidaysTitle">Holiday list</h1>
          <p className="holidaysSubtitle">Review and approve or deny holiday requests from your team</p>
        </div>
      </header>

      <main className="holidaysMain">
        <div className="holidaysContent">
          <section className="holidaysSection holidaysSection--full">
            <div className="holidaysToolbar">
              <div className="holidaysToolbarFilters">
                <SearchInput
                  value={query}
                  onChange={setQuery}
                  placeholder="Search by user, reason, dates..."
                  size="md"
                  width={320}
                />
                <span className="holidaysToolbarSpacer" aria-hidden="true" />
                <PaginatorSelect
                  label="Status"
                  value={filterStatus}
                  onChange={(v) => setFilterStatus(String(v ?? ""))}
                  options={STATUS_OPTIONS}
                  className="holidaysFilterSelect"
                />
              </div>
            </div>

            <div className="holidaysTableWrap" ref={tableWrapRef}>
              <DataTable
                columns={columns}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                loading={loading}
                emptyText="No holiday requests."
                rows={filteredAndSorted}
                getRowId={(r) => r._id}
                renderRow={(h) => {
                  const isHighlighted = highlightedId && String(h._id) === highlightedId;
                  return (
                    <>
                      <div className="td">
                        <div className="cell strong">{h.userName || "—"}</div>
                        {h.userEmail && <div className="cell muted small">{h.userEmail}</div>}
                      </div>
                      <div className="td"><div className="cell">{formatDate(h.startDate)}</div></div>
                      <div className="td"><div className="cell">{formatDate(h.endDate)}</div></div>
                      <div className="td"><div className="cell">{h.days}</div></div>
                      <div className="td"><div className="cell cell--muted">{h.reason || "—"}</div></div>
                      <div className="td td-status">
                        <HolidayStatusCell rowId={h._id} status={h.status} />
                      </div>
                      <div className="td td-actions">
                        {h.status === "pending" ? (
                          <div className="holidaysRowActions">
                            <button
                              type="button"
                              className="holidaysRowBtn holidaysRowBtn--approve"
                              onClick={() => handleApproveClick(h)}
                              disabled={actioningId != null}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="holidaysRowBtn holidaysRowBtn--deny"
                              onClick={() => handleDenyClick(h)}
                              disabled={actioningId != null}
                            >
                              Deny
                            </button>
                          </div>
                        ) : (
                          <span className="cell muted small holidaysDecidedBy">
                            {h.decidedByName ? `By ${h.decidedByName}` : "—"}
                          </span>
                        )}
                      </div>
                    </>
                  );
                }}
              />
            </div>
          </section>
        </div>
      </main>

      <ConfirmDeleteModal
        open={!!approveTarget}
        title="Approve holiday request"
        message={approveMessage}
        confirmText="Approve"
        cancelText="Cancel"
        loading={actioningId === approveTarget?._id}
        danger={false}
        iconVariant="success"
        onClose={() => setApproveTarget(null)}
        onConfirm={handleApproveConfirm}
      />

      {denyTarget && (
        <div className="holidayDenyModal-backdrop" onClick={() => !actioningId && setDenyTarget(null)} role="presentation">
          <div className="holidayDenyModal" onClick={(e) => e.stopPropagation()} role="dialog">
            <h3 className="holidayDenyModal-title">Deny holiday request</h3>
            <p className="holidayDenyModal-desc holidayDenyModal-desc--confirm">
              Are you sure you want to deny this request?
            </p>
            <p className="holidayDenyModal-desc">
              Optional: add a reason to share with {denyTarget.userName || "the employee"}.
            </p>
            <textarea
              className="holidayDenyModal-input"
              value={denyReason}
              onChange={(e) => setDenyReason(e.target.value)}
              placeholder="Reason for denial (optional)"
              rows={3}
              disabled={!!actioningId}
            />
            <div className="holidayDenyModal-actions">
              <button
                type="button"
                className="holidaysRowBtn holidaysRowBtn--ghost"
                onClick={() => setDenyTarget(null)}
                disabled={!!actioningId}
              >
                Cancel
              </button>
              <button
                type="button"
                className="holidaysRowBtn holidaysRowBtn--deny"
                onClick={handleDenySubmit}
                disabled={!!actioningId}
              >
                {actioningId === denyTarget._id ? "Denying…" : "Confirm deny"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
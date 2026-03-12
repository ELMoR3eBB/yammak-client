import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, PlusCircle } from "lucide-react";
import DataTable from "../../ui/DataTable";
import SearchInput from "../../ui/SearchInput";
import PaginatorSelect from "../../ui/PaginatorSelect";
import HolidayRequestModal from "../../modals/HolidayRequestModal";
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

function formatDateTime(d) {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

const STATUS_OPTIONS = [
  { value: "", label: "Any status" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "denied", label: "Denied" },
];

const columns = [
  { key: "createdAt", label: "SUBMIT DATE", sortable: true, width: "1.6fr" },
  { key: "days", label: "DAYS", sortable: true, width: "0.7fr" },
  { key: "reason", label: "REASON", sortable: false, width: "2.2fr" },
  { key: "status", label: "STATUS", sortable: true, width: "0.9fr" },
];

export default function HolidaysAsk({ account, onNavigate }) {
  const notify = useNotification();
  const [modalOpen, setModalOpen] = useState(false);
  const [lastHoliday, setLastHoliday] = useState(null);
  const [loadingLast, setLoadingLast] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sortKey, setSortKey] = useState("createdAt");
  const [sortDir, setSortDir] = useState("desc");
  const lastReqRef = useRef(null);
  const listReqRef = useRef(null);

  const perms = account?.role?.permissions || [];
  const canRequest = perms.includes("*") || perms.includes("holiday.request");

  const fetchLast = useCallback(() => {
    if (!window.api?.wsSend) return;
    lastReqRef.current = rid();
    setLoadingLast(true);
    window.api.wsSend({ type: "holiday:last", requestId: lastReqRef.current });
  }, []);

  const fetchList = useCallback(() => {
    if (!window.api?.wsSend) return;
    const reqId = rid();
    listReqRef.current = reqId;
    setLoading(true);
    window.api.wsSend({ type: "holiday:list", requestId: reqId, payload: {} });
  }, []);

  useEffect(() => {
    if (!window.api) return;
    const unsub = window.api.onWsMessage((msg) => {
      if (msg?.type === "holiday:last" && msg?.requestId === lastReqRef.current) {
        setLastHoliday(msg.last ?? null);
        setLoadingLast(false);
      }
      if (msg?.type === "holiday:list" && msg?.requestId === listReqRef.current) {
        setHolidays(Array.isArray(msg.holidays) ? msg.holidays : []);
        setLoading(false);
      }
      if (msg?.type === "holiday:create:result") {
        setSubmitting(false);
        if (msg.ok) {
          setModalOpen(false);
          fetchList();
          notify?.success?.("Holiday request submitted.", "Request sent");
        } else {
          notify?.error?.(msg.error || "Request failed", "Holiday request");
        }
      }
    });
    return () => unsub?.();
  }, [notify, fetchList]);

  useEffect(() => {
    if (canRequest) fetchList();
  }, [canRequest, fetchList]);

  useEffect(() => {
    if (modalOpen) fetchLast();
  }, [modalOpen, fetchLast]);

  const toggleSort = useCallback((key) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return key;
      }
      setSortDir("desc");
      return key;
    });
  }, []);

  const filteredAndSorted = useMemo(() => {
    let list = [...holidays];
    if (filterStatus) list = list.filter((h) => h.status === filterStatus);
    const q = (query || "").trim().toLowerCase();
    if (q) {
      list = list.filter(
        (h) =>
          (h.reason || "").toLowerCase().includes(q) ||
          (h.startDate && String(h.startDate).toLowerCase().includes(q)) ||
          (h.endDate && String(h.endDate).toLowerCase().includes(q))
      );
    }
    const mult = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      if (sortKey === "createdAt") {
        const ta = new Date(a.createdAt).getTime();
        const tb = new Date(b.createdAt).getTime();
        return mult * (ta - tb);
      }
      if (sortKey === "days") return mult * ((Number(a.days) || 0) - (Number(b.days) || 0));
      if (sortKey === "status") {
        const order = { pending: 0, approved: 1, denied: 2 };
        return mult * ((order[a.status] ?? 3) - (order[b.status] ?? 3));
      }
      return 0;
    });
    return list;
  }, [holidays, filterStatus, query, sortKey, sortDir]);

  const handleSubmit = useCallback((data) => {
    if (!window.api?.wsSend) return;
    setSubmitting(true);
    window.api.wsSend({
      type: "holiday:create",
      requestId: rid(),
      payload: {
        reason: data.reason,
        startDate: data.startDate,
        endDate: data.endDate,
      },
    });
  }, []);

  if (!canRequest) {
    return (
      <div className="holidaysPage">
        <header className="holidaysHeader">
          <div className="holidaysHeaderIcon">
            <CalendarDays size={24} />
          </div>
          <div className="holidaysHeaderText">
            <h1 className="holidaysTitle">Holidays</h1>
            <p className="holidaysSubtitle">You don&apos;t have permission to request holidays.</p>
          </div>
        </header>
      </div>
    );
  }

  return (
    <div className="holidaysPage">
      <header className="holidaysHeader">
        <div className="holidaysHeaderIcon">
          <CalendarDays size={24} />
        </div>
        <div className="holidaysHeaderText">
          <h1 className="holidaysTitle">Holidays</h1>
          <p className="holidaysSubtitle">Request time off and view your holiday history</p>
        </div>
      </header>

      <main className="holidaysMain">
        <div className="holidaysContent">
          <section className="holidaysSection holidaysSection--full">
            <div className="holidaysToolbar">
              <div className="holidaysToolbarFilters">
                <button
                  type="button"
                  className="holidaysAskBtn"
                  onClick={() => setModalOpen(true)}
                >
                  <PlusCircle size={20} />
                  Ask for holiday
                </button>
                <span className="holidaysToolbarSpacer" aria-hidden="true" />
                <SearchInput
                  value={query}
                  onChange={setQuery}
                  placeholder="Search by reason, dates..."
                  size="md"
                  width={280}
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

            <div className="holidaysTableWrap">
              <DataTable
                columns={columns}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                loading={loading}
                emptyText="No holiday requests. Click &quot;Ask for holiday&quot; to submit one."
                rows={filteredAndSorted}
                renderRow={(h) => (
                  <>
                    <div className="td">
                      <div className="cell">{formatDateTime(h.createdAt)}</div>
                    </div>
                    <div className="td">
                      <div className="cell">{h.days}</div>
                    </div>
                    <div className="td">
                      <div className="cell cell--muted">{h.reason || "—"}</div>
                    </div>
                    <div className="td td-status">
                      <span className={`holidaysStatusBadge holidaysStatusBadge--${h.status}`}>
                        {h.status === "approved" ? "Accepted" : h.status === "denied" ? "Denied" : "Pending"}
                      </span>
                    </div>
                  </>
                )}
              />
            </div>
          </section>
        </div>
      </main>

      <HolidayRequestModal
        open={modalOpen}
        lastHoliday={lastHoliday}
        loadingLast={loadingLast}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitting={submitting}
      />
    </div>
  );
}

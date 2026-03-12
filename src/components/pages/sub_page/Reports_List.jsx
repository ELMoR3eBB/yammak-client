// Reports_List.jsx — list anonymous reports (permission: reports.view); layout like Suggest list (DataTable + toolbar + detail modal)
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Inbox, FileText } from "lucide-react";
import DataTable from "../../ui/DataTable";
import DateRangePicker from "../../ui/DateRangePicker";
import "../../../styles/ui/date_range_picker.css";
import "../../../styles/pages/audit/audit_logs.css";
import "../../../styles/pages/reports/reports_list.css";

const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const CATEGORY_LABELS = {
  feedback: "Feedback",
  concern: "Concern",
  incident: "Incident",
  suggestion: "Suggestion",
  other: "Other",
};

function formatDate(d) {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "medium",
  });
}

const columns = [
  { key: "createdAt", label: "DATE & TIME", sortable: true, width: "1.4fr" },
  { key: "category", label: "CATEGORY", sortable: true, width: "1fr" },
  { key: "title", label: "TITLE", sortable: true, width: "1.6fr" },
  { key: "message", label: "MESSAGE", sortable: false, width: "2fr" },
];

const LIST_TIMEOUT_MS = 8000;

export default function ReportsList({ account }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [sort, setSort] = useState({ key: "createdAt", dir: "desc" });
  const sortKey = sort.key;
  const sortDir = sort.dir;
  const [detailReport, setDetailReport] = useState(null);
  const [detailExiting, setDetailExiting] = useState(false);
  const requestIdRef = useRef(null);
  const timeoutRef = useRef(null);

  const perms = account?.role?.permissions || [];
  const canView = perms.includes("*") || perms.includes("reports.view");

  const fetchList = useCallback(() => {
    if (!window.api?.wsSend) {
      setLoading(false);
      setLoadError(true);
      return;
    }
    setLoading(true);
    setLoadError(false);
    requestIdRef.current = rid();
    window.api.wsSend({
      type: "report:list",
      requestId: requestIdRef.current,
      payload: {},
    });
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (requestIdRef.current) {
        setReports([]);
        setLoadError(true);
      }
      setLoading(false);
      timeoutRef.current = null;
    }, LIST_TIMEOUT_MS);
  }, []);

  useEffect(() => {
    if (!window.api) {
      setLoading(false);
      setLoadError(true);
      return;
    }

    const unsub = window.api.onWsMessage((msg) => {
      if (msg?.type === "report:list" && msg?.requestId === requestIdRef.current) {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        setReports(Array.isArray(msg.reports) ? msg.reports : []);
        setLoadError(false);
        setLoading(false);
      }
    });

    (async () => {
      try {
        await window.api.wsConnect();
        fetchList();
      } catch {
        setLoading(false);
        setLoadError(true);
      }
    })();

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      unsub?.();
    };
  }, [fetchList]);

  const toggleSort = useCallback((key) => {
    setSort((prev) => {
      if (prev.key === key) {
        return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      return { key, dir: "desc" };
    });
  }, []);

  const filteredReports = useMemo(() => {
    let list = [...reports];
    if (filterDateFrom) {
      const from = new Date(filterDateFrom);
      from.setHours(0, 0, 0, 0);
      list = list.filter((r) => new Date(r.createdAt) >= from);
    }
    if (filterDateTo) {
      const to = new Date(filterDateTo);
      to.setHours(23, 59, 59, 999);
      list = list.filter((r) => new Date(r.createdAt) <= to);
    }
    return list;
  }, [reports, filterDateFrom, filterDateTo]);

  const sortedReports = useMemo(() => {
    const list = [...filteredReports];
    const mult = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      switch (sortKey) {
        case "createdAt": {
          const ta = new Date(a.createdAt).getTime();
          const tb = new Date(b.createdAt).getTime();
          return mult * (ta - tb);
        }
        case "category":
          return mult * (a.category || "").localeCompare(b.category || "");
        case "title":
          return mult * (a.title || "").localeCompare(b.title || "");
        default:
          return 0;
      }
    });
    return list;
  }, [filteredReports, sortKey, sortDir]);

  const openDetail = (row) => {
    setDetailReport(row);
    setDetailExiting(false);
  };

  const closeDetail = () => {
    setDetailExiting(true);
    setTimeout(() => {
      setDetailReport(null);
      setDetailExiting(false);
    }, 280);
  };

  if (!account) return null;

  if (!canView) {
    return (
      <div className="auditLogsPage reportsListPage reportsListPage--enter">
        <header className="auditLogsHeader">
          <div className="auditLogsHeaderIcon">
            <Inbox size={24} />
          </div>
          <div className="auditLogsHeaderText">
            <h1 className="auditLogsTitle">Reports</h1>
            <p className="auditLogsSubtitle">You don&apos;t have permission to view reports.</p>
          </div>
        </header>
      </div>
    );
  }

  return (
    <div className="auditLogsPage reportsListPage reportsListPage--enter">
      <header className="auditLogsHeader">
        <div className="auditLogsHeaderIcon">
          <Inbox size={24} />
        </div>
        <div className="auditLogsHeaderText">
          <h1 className="auditLogsTitle">Reports</h1>
          <p className="auditLogsSubtitle">Anonymous reports submitted by users. No submitter information is stored or displayed.</p>
        </div>
      </header>

      <main className="auditLogsMain">
        <div className="auditLogsContent">
          <section className="auditLogsSection">
            {loadError && reports.length === 0 ? (
              <div className="reportsListEmpty reportsListEmpty--error">
                <div className="reportsListEmptyIconWrap">
                  <FileText size={48} className="reportsListEmptyIcon" />
                </div>
                <p className="reportsListEmptyText">Could not load reports</p>
                <p className="reportsListEmptySub">The server may not support reports yet, or the request timed out. Try again later or contact your administrator.</p>
                <button type="button" className="reportsListRetry suggestListBtn" onClick={fetchList}>
                  Retry
                </button>
              </div>
            ) : (
              <>
                <div className="auditLogsToolbar">
                  <div className="auditLogsToolbarFilters">
                    <div className="auditLogsFilterRow auditLogsFilterRow--dates">
                      <DateRangePicker
                        label="Date range"
                        placeholder="From – To"
                        value={{ from: filterDateFrom, to: filterDateTo }}
                        onChange={({ from, to }) => {
                          setFilterDateFrom(from ?? "");
                          setFilterDateTo(to ?? "");
                        }}
                        className="reportsListDateRangePicker"
                      />
                    </div>
                  </div>
                </div>

                <div className="auditLogsTableWrap">
                  <DataTable
                    columns={columns}
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={toggleSort}
                    loading={loading}
                    emptyText="No reports match your filters."
                    rows={sortedReports}
                    onRowClick={openDetail}
                    renderRow={(row) => (
                      <>
                        <div className="td">
                          <div className="cell cell--muted">{formatDate(row.createdAt)}</div>
                        </div>
                        <div className="td">
                          <div className="cell reportsListCategoryCell">
                            {CATEGORY_LABELS[row.category] || row.category || "Other"}
                          </div>
                        </div>
                        <div className="td">
                          <div className="cell strong suggestListTitleCell">{row.title || "—"}</div>
                        </div>
                        <div className="td">
                          <div className="cell cell--muted suggestListContentCell">
                            {row.message || "—"}
                          </div>
                        </div>
                      </>
                    )}
                  />
                </div>
              </>
            )}
          </section>
        </div>
      </main>

      {(detailReport || detailExiting) && (
        <div
          className={`suggestDetailBackdrop ${detailExiting ? "suggestDetailBackdrop--leave" : "suggestDetailBackdrop--enter"}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="reportDetailTitle"
          onClick={closeDetail}
        >
          <div
            className={`suggestDetailModal ${detailExiting ? "suggestDetailModal--leave" : "suggestDetailModal--enter"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="reportDetailTitle" className="suggestDetailTitle">{detailReport?.title || "Report"}</h2>
            <div className="suggestDetailMeta">
              <span className="reportsListDetailCategory">
                {detailReport ? (CATEGORY_LABELS[detailReport.category] || detailReport.category || "Other") : "—"}
              </span>
              <span className="suggestDetailDate">{formatDate(detailReport?.createdAt)}</span>
            </div>
            <div className="suggestDetailContent">{detailReport?.message || "—"}</div>
            <button type="button" className="suggestDetailClose suggestListBtn" onClick={closeDetail}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

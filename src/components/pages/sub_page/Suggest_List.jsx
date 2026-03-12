// Suggest_List — list suggestions (DataTable); permission suggests.view; detail modal with enter/leave animation
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare } from "lucide-react";
import DataTable from "../../ui/DataTable";
import DateRangePicker from "../../ui/DateRangePicker";
import "../../../styles/ui/date_range_picker.css";
import "../../../styles/pages/audit/audit_logs.css";
import "../../../styles/pages/suggests/suggests.css";

const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function formatDate(d) {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "medium",
  });
}

const columns = [
  { key: "createdAt", label: "DATE & TIME", sortable: true, width: "1.4fr" },
  { key: "user", label: "SUBMITTED BY", sortable: true, width: "1.6fr" },
  { key: "title", label: "TITLE", sortable: true, width: "1.4fr" },
  { key: "content", label: "CONTENT", sortable: false, width: "2fr" },
];

export default function SuggestList({ account }) {
  const [suggests, setSuggests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [sort, setSort] = useState({ key: "createdAt", dir: "desc" });
  const sortKey = sort.key;
  const sortDir = sort.dir;
  const [detailSuggest, setDetailSuggest] = useState(null);
  const [detailExiting, setDetailExiting] = useState(false);
  const requestIdRef = useRef(null);
  const filterEffectSkipRef = useRef(true);
  const hasDataRef = useRef(false);
  const fetchListRef = useRef(null);

  const perms = account?.role?.permissions || [];
  const canView = perms.includes("*") || perms.includes("suggests.view");

  const fetchList = useCallback(() => {
    if (!window.api?.wsSend) return;
    /* Only show loading on initial load so re-fetches don't blink the list */
    if (!hasDataRef.current) setLoading(true);
    requestIdRef.current = rid();
    window.api.wsSend({
      type: "suggest:list",
      requestId: requestIdRef.current,
      payload: {
        dateFrom: filterDateFrom || undefined,
        dateTo: filterDateTo || undefined,
      },
    });
  }, [filterDateFrom, filterDateTo]);

  fetchListRef.current = fetchList;

  useEffect(() => {
    if (!window.api) {
      setLoading(false);
      return;
    }

    const unsub = window.api.onWsMessage((msg) => {
      if (msg?.type === "suggest:list" && msg?.requestId === requestIdRef.current) {
        setSuggests(Array.isArray(msg.suggests) ? msg.suggests : []);
        hasDataRef.current = true;
        setLoading(false);
      }
    });

    (async () => {
      try {
        await window.api.wsConnect();
        fetchListRef.current?.();
      } catch {
        setLoading(false);
      }
    })();

    return () => unsub?.();
  }, []);

  useEffect(() => {
    if (!window.api?.wsSend || !canView) return;
    if (filterEffectSkipRef.current) {
      filterEffectSkipRef.current = false;
      return;
    }
    const tid = setTimeout(fetchList, 300);
    return () => clearTimeout(tid);
  }, [filterDateFrom, filterDateTo, canView, fetchList]);

  const toggleSort = useCallback((key) => {
    setSort((prev) => {
      if (prev.key === key) {
        return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      return { key, dir: "desc" };
    });
  }, []);

  const sortedSuggests = useMemo(() => {
    const list = [...suggests];
    const mult = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      switch (sortKey) {
        case "createdAt": {
          const ta = new Date(a.createdAt).getTime();
          const tb = new Date(b.createdAt).getTime();
          return mult * (ta - tb);
        }
        case "user":
          return mult * (a.userName || "").localeCompare(b.userName || "");
        case "title":
          return mult * (a.title || "").localeCompare(b.title || "");
        default:
          return 0;
      }
    });
    return list;
  }, [suggests, sortKey, sortDir]);

  const openDetail = (row) => {
    setDetailSuggest(row);
    setDetailExiting(false);
  };

  const closeDetail = () => {
    setDetailExiting(true);
    setTimeout(() => {
      setDetailSuggest(null);
      setDetailExiting(false);
    }, 280);
  };

  if (!canView) {
    return (
      <div className="auditLogsPage suggestListPage suggestListPage--enter">
        <header className="auditLogsHeader">
          <div className="auditLogsHeaderIcon">
            <MessageSquare size={24} />
          </div>
          <div className="auditLogsHeaderText">
            <h1 className="auditLogsTitle">Suggest list</h1>
            <p className="auditLogsSubtitle">You don&apos;t have permission to view suggestions.</p>
          </div>
        </header>
      </div>
    );
  }

  return (
    <div className="auditLogsPage suggestListPage suggestListPage--enter">
      <header className="auditLogsHeader">
        <div className="auditLogsHeaderIcon">
          <MessageSquare size={24} />
        </div>
        <div className="auditLogsHeaderText">
          <h1 className="auditLogsTitle">Suggest list</h1>
          <p className="auditLogsSubtitle">Suggestions sent to administration; visible to users with suggest list permission.</p>
        </div>
      </header>

      <main className="auditLogsMain">
        <div className="auditLogsContent">
          <section className="auditLogsSection">
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
                    className="suggestListDateRangePicker"
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
                emptyText="No suggestions match your filters."
                rows={sortedSuggests}
                onRowClick={openDetail}
                renderRow={(row) => (
                  <>
                    <div className="td">
                      <div className="cell cell--muted">{formatDate(row.createdAt)}</div>
                    </div>
                    <div className="td">
                      <div className="cell strong">{row.userName || "—"}</div>
                      {row.userEmail && (
                        <div className="cell muted small">{row.userEmail}</div>
                      )}
                    </div>
                    <div className="td">
                      <div className="cell suggestListTitleCell">{row.title || "—"}</div>
                    </div>
                    <div className="td">
                      <div className="cell cell--muted suggestListContentCell">
                        {row.content || "—"}
                      </div>
                    </div>
                  </>
                )}
              />
            </div>
          </section>
        </div>
      </main>

      {/* Detail modal with enter/leave animation */}
      {(detailSuggest || detailExiting) && (
        <div
          className={`suggestDetailBackdrop ${detailExiting ? "suggestDetailBackdrop--leave" : "suggestDetailBackdrop--enter"}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="suggestDetailTitle"
          onClick={closeDetail}
        >
          <div
            className={`suggestDetailModal ${detailExiting ? "suggestDetailModal--leave" : "suggestDetailModal--enter"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="suggestDetailTitle" className="suggestDetailTitle">{detailSuggest?.title || "Suggestion"}</h2>
            <div className="suggestDetailMeta">
              <span>{detailSuggest?.userName || "—"}</span>
              {detailSuggest?.userEmail && <span className="suggestDetailEmail">{detailSuggest.userEmail}</span>}
              <span className="suggestDetailDate">{formatDate(detailSuggest?.createdAt)}</span>
            </div>
            <div className="suggestDetailContent">{detailSuggest?.content || "—"}</div>
            <button type="button" className="suggestDetailClose suggestListBtn" onClick={closeDetail}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

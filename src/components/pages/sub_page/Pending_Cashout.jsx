// Pending_Cashout — list of approved cashout requests (not yet cashed); accountant can open "other" form and cash them
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Wallet, X } from "lucide-react";
import DataTable from "../../ui/DataTable";
import SearchInput from "../../ui/SearchInput";
import "../../../styles/pages/audit/audit_logs.css";
import "../../../styles/pages/cashout/cashout.css";

const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function formatDate(d) {
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

const COLUMNS = [
  { key: "createdAt", label: "DATE", sortable: true, width: "1.2fr" },
  { key: "userName", label: "REQUESTER", sortable: true, width: "1.4fr" },
  { key: "title", label: "TITLE", sortable: true, width: "1.6fr" },
  { key: "amount", label: "AMOUNT", sortable: true, width: "1fr", align: "right" },
  { key: "actions", label: "", sortable: false, width: "0.8fr" },
];

export default function PendingCashout({ account, onOpenCashoutModal }) {
  const [cashouts, setCashouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState({ key: "createdAt", dir: "desc" });
  const [query, setQuery] = useState("");
  const requestIdRef = useRef(null);
  const rejectReqIdRef = useRef(null);

  const fetchList = useCallback(() => {
    if (!window.api?.wsSend) return;
    setLoading(true);
    requestIdRef.current = rid();
    window.api.wsSend({
      type: "cashout:list",
      requestId: requestIdRef.current,
      payload: { filter: "pendingCashout" },
    });
  }, []);

  useEffect(() => {
    if (!window.api) {
      setLoading(false);
      return;
    }
    const unsub = window.api.onWsMessage((msg) => {
      if (msg?.type === "cashout:list" && msg?.requestId === requestIdRef.current) {
        if (msg.error) {
          setCashouts([]);
        } else {
          setCashouts(Array.isArray(msg.cashouts) ? msg.cashouts : []);
        }
        setLoading(false);
      }
      if (msg?.type === "cashout:create:result" && msg?.ok) {
        fetchList();
      }
      if (msg?.type === "cashout:rejectPending:result" && msg?.requestId === rejectReqIdRef.current) {
        if (msg.ok) fetchList();
      }
      if (msg?.type === "cashout:pendingInvalidated") {
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
  }, [fetchList]);

  const filteredCashouts = React.useMemo(() => {
    let list = [...cashouts];
    const q = (query || "").trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          (r.userName && String(r.userName).toLowerCase().includes(q)) ||
          (r.title && String(r.title).toLowerCase().includes(q)) ||
          (r.amount != null && String(r.amount).includes(q))
      );
    }
    const { key, dir } = sort;
    list.sort((a, b) => {
      const va = a[key];
      const vb = b[key];
      const cmp = va == null && vb == null ? 0 : va == null ? 1 : vb == null ? -1 : va < vb ? -1 : va > vb ? 1 : 0;
      if (key === "createdAt" && (va || vb)) {
        const ta = new Date(va).getTime();
        const tb = new Date(vb).getTime();
        return dir === "asc" ? ta - tb : tb - ta;
      }
      return dir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [cashouts, query, sort]);

  const sortKey = sort.key;
  const sortDir = sort.dir;
  const toggleSort = useCallback((key) => {
    setSort((prev) => ({
      key,
      dir: prev.key === key && prev.dir === "desc" ? "asc" : "desc",
    }));
  }, []);

  function handleReject(e, row) {
    e.stopPropagation();
    if (!window.api?.wsSend) return;
    rejectReqIdRef.current = rid();
    window.api.wsSend({
      type: "cashout:rejectPending",
      requestId: rejectReqIdRef.current,
      payload: { id: row.id, cashoutId: row.id },
    });
  }

  function handleRowClick(row) {
    const requesterName = row.userName || "";
    const title = row.title || "";
    const paymentDate = row.paymentDate
      ? new Date(row.paymentDate).toISOString().slice(0, 10)
      : row.createdAt
        ? new Date(row.createdAt).toISOString().slice(0, 10)
        : "";
    onOpenCashoutModal?.("other", {
      initialData: {
        requesterName,
        title,
        amount: row.amount,
        paymentDate: paymentDate || undefined,
        note: row.note || "",
      },
      requestId: row.id,
    });
  }

  return (
    <div className="auditLogsPage cashoutListPage cashoutListPage--enter">
      <header className="auditLogsHeader">
        <div className="auditLogsHeaderIcon">
          <Wallet size={24} />
        </div>
        <div className="auditLogsHeaderText">
          <h1 className="auditLogsTitle">Pending Cashout</h1>
          <p className="auditLogsSubtitle">
            Approved requests waiting to be cashed. Click a row to open the cashout form.
          </p>
        </div>
      </header>

      <main className="auditLogsMain">
        <div className="auditLogsContent">
          <section className="auditLogsSection">
            <div className="auditLogsToolbar cashoutToolbar">
              <SearchInput
                value={query}
                onChange={setQuery}
                placeholder="Search by requester, title, amount…"
                size="md"
                width={320}
              />
            </div>

            <div className="auditLogsTableWrap">
              <DataTable
                columns={COLUMNS}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                loading={loading}
                emptyText="No pending cashouts."
                rows={filteredCashouts}
                displayScrollbar={false}
                onRowClick={handleRowClick}
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
                    <div className="td td-actions">
                      <button
                        type="button"
                        className="cashoutRowBtn cashoutRowBtn--deny"
                        onClick={(e) => handleReject(e, row)}
                        title="Reject"
                      >
                        <X size={14} strokeWidth={2.2} />
                        Reject
                      </button>
                    </div>
                  </>
                )}
              />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

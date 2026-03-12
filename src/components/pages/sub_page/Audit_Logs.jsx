// Audit_Logs.jsx — list audit logs with filters; same layout as Employee_List / Role_List, uses DataTable + PaginatorSelect
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollText, ChevronLeft, ChevronRight } from "lucide-react";
import DataTable from "../../ui/DataTable";
import PaginatorSelect from "../../ui/PaginatorSelect";
import DateRangePicker from "../../ui/DateRangePicker";
import "../../../styles/ui/paginator_select.css";
import "../../../styles/ui/date_range_picker.css";
import "../../../styles/pages/audit/audit_logs.css";

const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

const buildPageModel = (page, totalPages) => {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  if (page <= 3) return [1, 2, 3, 4, "…", totalPages];
  if (page >= totalPages - 2) return [1, "…", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  return [1, "…", page - 1, page, page + 1, "…", totalPages];
};

const ACTION_LABELS = {
  "employees.create": "Create employee",
  "employees.update": "Update employee",
  "employees.delete": "Delete employee",
  "roles.create": "Create role",
  "roles.update": "Update role",
  "roles.delete": "Delete role",
  "settings.update": "Update settings",
  "holiday.request": "Ask for holiday",
  "holiday.approve": "Approve holiday request",
  "holiday.deny": "Deny holiday request",
  "hot.send": "Send hot notification",
  "report.create": "Submit report",
  "maintenance.set": "Maintenance mode",
  "suggest.create": "Submit suggestion",
  "cashout.request": "Request Cashout",
  "cashout.approve": "Approved Cashout",
  "cashout.deny": "Denied Cashout",
  "cashout.transaction": "Create Cashout",
  "cashout.rejectPending": "Reject Pending Cashout",
  "cashout.create": "Cashout (legacy)",
  "cashin.create": "Create Cashin",
  "storage.create": "Add Item",
  "storage.add": "Increase Quantity",
  "storage.decrease": "Decrease Quantity",
  "storage.replace": "Replace Quantity",
  "storage.delete": "Delete Item",
};

function formatDate(d) {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "medium",
  });
}

function detailsText(log) {
  if (!log.details || typeof log.details !== "object") return "—";
  const d = log.details;
  if (log.action && log.action.startsWith("storage.")) {
    const storageParts = [
      d.name ? `"${d.name}"` : null,
      d.quantity != null ? `qty: ${d.quantity}` : null,
      d.amount != null ? `amount: ${d.amount}` : null,
      d.type ? `type: ${d.type}` : null,
      d.previousQuantity != null ? `was ${d.previousQuantity}` : null,
      d.newQuantity != null ? `→ ${d.newQuantity}` : null,
      d.newBrokenCount != null ? `replaced total: ${d.newBrokenCount}` : null,
    ].filter(Boolean);
    return storageParts.length ? storageParts.join(" · ") : "—";
  }
  const parts = [
    d.name,
    d.title ? `"${String(d.title).slice(0, 40)}${String(d.title).length > 40 ? "…" : ""}"` : null,
    d.employeeId ? `Employee ${String(d.employeeId).slice(-6)}` : null,
    d.roleId ? `Role ${String(d.roleId).slice(-6)}` : null,
    d.holidayId ? `Holiday ${String(d.holidayId).slice(-6)}` : null,
    d.days != null ? `${d.days} day(s)` : null,
    d.userName ? `for ${d.userName}` : null,
    d.deliveryType ? `as ${d.deliveryType}` : null,
    d.category ? `category: ${d.category}` : null,
    d.enabled === true ? "enabled" : d.enabled === false ? "disabled" : null,
    d.targetPermission ? `permission: ${d.targetPermission}` : null,
    d.contentPreview ? `"${d.contentPreview}"` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "—";
}

const columns = [
  { key: "createdAt", label: "DATE & TIME", sortable: true, width: "1.4fr" },
  { key: "user", label: "USER", sortable: true, width: "1.6fr" },
  { key: "role", label: "ROLE", sortable: true, width: "1.2fr" },
  { key: "action", label: "ACTION", sortable: true, width: "1.4fr" },
  { key: "details", label: "DETAILS", sortable: false, width: "1.8fr" },
];

export default function AuditLogs({ account }) {
  const [logs, setLogs] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterUserId, setFilterUserId] = useState("");
  const [filterRoleId, setFilterRoleId] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [sort, setSort] = useState({ key: "createdAt", dir: "desc" });
  const sortKey = sort.key;
  const sortDir = sort.dir;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const requestIdRef = useRef(null);
  const prevFiltersRef = useRef(null);

  const perms = account?.role?.permissions || [];
  const canView = perms.includes("*") || perms.includes("audit.view");

  useEffect(() => {
    if (!window.api) {
      setLoading(false);
      return;
    }

    const unsub = window.api.onWsMessage((msg) => {
      if (msg?.type === "audit:list" && msg?.requestId === requestIdRef.current) {
        setLogs(Array.isArray(msg.logs) ? msg.logs : []);
        setLoading(false);
      }
      if (msg?.type === "employees:list" && Array.isArray(msg.employees)) {
        setEmployees(msg.employees);
      }
      if (msg?.type === "roles:list" && Array.isArray(msg.roles)) {
        setRoles(msg.roles);
      }
    });

    (async () => {
      try {
        await window.api.wsConnect();
        requestIdRef.current = rid();
        window.api.wsSend({ type: "employees:list", requestId: rid() });
        window.api.wsSend({ type: "roles:list", requestId: rid() });
        fetchLogs();
      } catch {
        setLoading(false);
      }
    })();

    return () => unsub?.();
  }, []);

  function fetchLogs() {
    if (!window.api) return;
    setLoading(true);
    requestIdRef.current = rid();
    window.api.wsSend({
      type: "audit:list",
      requestId: requestIdRef.current,
      payload: {
        userId: filterUserId || undefined,
        roleId: filterRoleId || undefined,
        action: filterAction?.trim() || undefined,
        dateFrom: filterDateFrom || undefined,
        dateTo: filterDateTo || undefined,
      },
    });
  }

  useEffect(() => {
    if (!window.api?.wsSend) return;
    const current = [filterUserId, filterRoleId, filterAction, filterDateFrom, filterDateTo];
    if (prevFiltersRef.current === null) {
      prevFiltersRef.current = current;
      return;
    }
    if (prevFiltersRef.current.length === current.length && prevFiltersRef.current.every((v, i) => v === current[i])) {
      return;
    }
    prevFiltersRef.current = current;
    const tid = setTimeout(fetchLogs, 300);
    return () => clearTimeout(tid);
  }, [filterUserId, filterRoleId, filterAction, filterDateFrom, filterDateTo]);

  const toggleSort = useCallback((key) => {
    setPage(1);
    setSort((prev) => {
      if (prev.key === key) {
        return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      return { key, dir: "desc" };
    });
  }, []);

  const actionOptions = useMemo(() => {
    return Object.keys(ACTION_LABELS)
      .sort()
      .map((k) => ({ value: k, label: ACTION_LABELS[k] }));
  }, []);

  const userFilterOptions = useMemo(() => {
    return [
      { value: "", label: "All users" },
      ...employees.map((e) => ({
        value: String(e._id),
        label: e?.name || e?.workEmail || String(e._id).slice(-6),
      })),
    ];
  }, [employees]);

  const roleFilterOptions = useMemo(() => {
    return [
      { value: "", label: "All roles" },
      ...roles.map((r) => ({
        value: String(r._id),
        label: r?.name || String(r._id).slice(-6),
      })),
    ];
  }, [roles]);

  const actionFilterOptions = useMemo(() => {
    return [{ value: "", label: "All actions" }, ...actionOptions];
  }, [actionOptions]);

  const sortedLogs = useMemo(() => {
    const list = [...logs];
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
        case "role":
          return mult * (a.roleName || "").localeCompare(b.roleName || "");
        case "action":
          return mult * (a.action || "").localeCompare(b.action || "");
        default:
          return 0;
      }
    });
    return list;
  }, [logs, sortKey, sortDir]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(sortedLogs.length / pageSize)),
    [sortedLogs.length, pageSize]
  );

  useEffect(() => setPage((p) => clamp(p, 1, totalPages)), [totalPages]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedLogs.slice(start, start + pageSize);
  }, [sortedLogs, page, pageSize]);

  const pageModel = useMemo(() => buildPageModel(page, totalPages), [page, totalPages]);

  if (!canView) {
    return (
      <div className="auditLogsPage">
        <header className="auditLogsHeader">
          <div className="auditLogsHeaderIcon">
            <ScrollText size={24} />
          </div>
          <div className="auditLogsHeaderText">
            <h1 className="auditLogsTitle">Audit Logs</h1>
            <p className="auditLogsSubtitle">You don&apos;t have permission to view audit logs.</p>
          </div>
        </header>
      </div>
    );
  }

  return (
    <div className="auditLogsPage">
      <header className="auditLogsHeader">
        <div className="auditLogsHeaderIcon">
          <ScrollText size={24} />
        </div>
        <div className="auditLogsHeaderText">
          <h1 className="auditLogsTitle">Audit Logs</h1>
          <p className="auditLogsSubtitle">Every action taken by users in the system</p>
        </div>
      </header>

      <main className="auditLogsMain">
        <div className="auditLogsContent">
          <section className="auditLogsSection">
            <div className="auditLogsToolbar">
              <div className="auditLogsToolbarFilters">
                <div className="auditLogsFilterRow auditLogsFilterRow--selects">
                  <PaginatorSelect
                    label="User"
                    value={filterUserId}
                    onChange={(v) => setFilterUserId(String(v ?? ""))}
                    options={userFilterOptions}
                    className="auditLogsFilterSelect"
                  />
                  <PaginatorSelect
                    label="Role"
                    value={filterRoleId}
                    onChange={(v) => setFilterRoleId(String(v ?? ""))}
                    options={roleFilterOptions}
                    className="auditLogsFilterSelect"
                  />
                  <PaginatorSelect
                    label="Action"
                    value={filterAction}
                    onChange={(v) => setFilterAction(String(v ?? ""))}
                    options={actionFilterOptions}
                    className="auditLogsFilterSelect"
                    dropClassName="auditLogsActionSelectDrop"
                  />
                </div>
                <div className="auditLogsFilterRow auditLogsFilterRow--dates">
                  <DateRangePicker
                    label="Date range"
                    placeholder="From – To"
                    value={{ from: filterDateFrom, to: filterDateTo }}
                    onChange={({ from, to }) => {
                      setFilterDateFrom(from ?? "");
                      setFilterDateTo(to ?? "");
                    }}
                    className="auditLogsDateRangePicker"
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
                emptyText="No audit logs match your filters."
                rows={pageItems}
                renderRow={(log) => (
                  <>
                    <div className="td">
                      <div className="cell cell--muted">{formatDate(log.createdAt)}</div>
                    </div>
                    <div className="td">
                      <div className="cell strong">{log.userName || "—"}</div>
                      {log.userEmail && (
                        <div className="cell muted small">{log.userEmail}</div>
                      )}
                    </div>
                    <div className="td">
                      <div className="cell">{log.roleName || "—"}</div>
                    </div>
                    <div className="td">
                      <div className="cell">
                        <span className="auditLogsActionBadge">
                          {ACTION_LABELS[log.action] || log.action}
                        </span>
                      </div>
                    </div>
                    <div className="td">
                      <div className="cell cell--muted auditLogsDetailsCell">
                        {detailsText(log)}
                      </div>
                    </div>
                  </>
                )}
                footer={
                  <div className="auditLogsFooter">
                    <div className="auditLogsFooterLeft">
                      <div className="auditLogsPerPage">
                        <PaginatorSelect
                          label="Rows"
                          value={pageSize}
                          onChange={(v) => {
                            setPageSize(v);
                            setPage(1);
                          }}
                          options={[10, 15, 30].map((n) => ({
                            value: n,
                            label: `${n} / page`,
                          }))}
                          openAbove
                        />
                      </div>
                    </div>
                    <div className="auditLogsFooterMid">
                      <button
                        type="button"
                        className="auditLogsPagerBtn"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => p - 1)}
                      >
                        <ChevronLeft size={16} />
                        Previous
                      </button>
                      <div className="auditLogsPages">
                        {pageModel.map((p, idx) =>
                          p === "…" ? (
                            <span key={`dots-${idx}`} className="auditLogsPagesDots">
                              …
                            </span>
                          ) : (
                            <button
                              key={p}
                              type="button"
                              className={`auditLogsPageBtn ${p === page ? "active" : ""}`}
                              onClick={() => setPage(p)}
                            >
                              {p}
                            </button>
                          )
                        )}
                      </div>
                      <button
                        type="button"
                        className="auditLogsPagerBtn"
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        Next
                        <ChevronRight size={16} />
                      </button>
                    </div>
                    <div className="auditLogsFooterRight">
                      <span className="auditLogsMuted">
                        {sortedLogs.length === 0
                          ? "0 results"
                          : `Showing ${(page - 1) * pageSize + 1}–${Math.min(
                              page * pageSize,
                              sortedLogs.length
                            )} of ${sortedLogs.length}`}
                      </span>
                    </div>
                  </div>
                }
              />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

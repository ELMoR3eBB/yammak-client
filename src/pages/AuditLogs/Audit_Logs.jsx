// Audit_Logs.jsx — list audit logs with filters; same layout as Employee_List / Role_List, uses DataTable + PaginatorSelect
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollText, ChevronLeft, ChevronRight } from "lucide-react";
import DataTable from "../../components/ui/DataTable";
import PaginatorSelect from "../../components/ui/PaginatorSelect";
import DateRangePicker from "../../components//ui/DateRangePicker";
import EmployeesFilter from "../../components/shared/EmployeesFilter";
import { useLanguage } from "../../contexts/LanguageContext";
import "../../styles/ui/paginator_select.css";
import "../../styles/ui/date_range_picker.css";
import "../../styles/pages/audit/audit_logs.css";

const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

const buildPageModel = (page, totalPages) => {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  if (page <= 3) return [1, 2, 3, 4, "…", totalPages];
  if (page >= totalPages - 2) return [1, "…", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  return [1, "…", page - 1, page, page + 1, "…", totalPages];
};

const ACTION_LABELS = {
  "employees.create": "auditLogs.action.createEmployee",
  "employees.update": "auditLogs.action.updateEmployee",
  "employees.delete": "auditLogs.action.deleteEmployee",
  "roles.create": "auditLogs.action.createRole",
  "roles.update": "auditLogs.action.updateRole",
  "roles.delete": "auditLogs.action.deleteRole",
  "settings.update": "auditLogs.action.updateSettings",
  "holiday.request": "auditLogs.action.askHoliday",
  "holiday.approve": "auditLogs.action.approveHoliday",
  "holiday.deny": "auditLogs.action.denyHoliday",
  "hot.send": "auditLogs.action.sendHot",
  "report.create": "auditLogs.action.submitReport",
  "maintenance.set": "auditLogs.action.maintenanceMode",
  "suggest.create": "auditLogs.action.submitSuggestion",
  "cashout.request": "auditLogs.action.requestCashout",
  "cashout.approve": "auditLogs.action.approvedCashout",
  "cashout.deny": "auditLogs.action.deniedCashout",
  "cashout.transaction": "auditLogs.action.createCashout",
  "cashout.rejectPending": "auditLogs.action.rejectPendingCashout",
  "cashout.create": "auditLogs.action.cashoutLegacy",
  "cashin.create": "auditLogs.action.createCashin",
  "storage.create": "auditLogs.action.addItem",
  "storage.add": "auditLogs.action.increaseQty",
  "storage.decrease": "auditLogs.action.decreaseQty",
  "storage.replace": "auditLogs.action.replaceQty",
  "storage.delete": "auditLogs.action.deleteItem",
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

function detailsText(log, tr) {
  if (!log.details || typeof log.details !== "object") return "—";
  const d = log.details;
  if (log.action && log.action.startsWith("storage.")) {
    const storageParts = [
      d.name ? `"${d.name}"` : null,
      d.quantity != null ? `${tr("auditLogs.detail.qty", "qty")}: ${d.quantity}` : null,
      d.amount != null ? `${tr("auditLogs.detail.amount", "amount")}: ${d.amount}` : null,
      d.type ? `${tr("auditLogs.detail.type", "type")}: ${d.type}` : null,
      d.previousQuantity != null ? `${tr("auditLogs.detail.was", "was")} ${d.previousQuantity}` : null,
      d.newQuantity != null ? `→ ${d.newQuantity}` : null,
      d.newBrokenCount != null ? `${tr("auditLogs.detail.replacedTotal", "replaced total")}: ${d.newBrokenCount}` : null,
    ].filter(Boolean);
    return storageParts.length ? storageParts.join(" · ") : "—";
  }
  const parts = [
    d.name,
    d.title ? `"${String(d.title).slice(0, 40)}${String(d.title).length > 40 ? "…" : ""}"` : null,
    d.employeeId ? `${tr("auditLogs.detail.employee", "Employee")} ${String(d.employeeId).slice(-6)}` : null,
    d.roleId ? `${tr("auditLogs.detail.role", "Role")} ${String(d.roleId).slice(-6)}` : null,
    d.holidayId ? `${tr("auditLogs.detail.holiday", "Holiday")} ${String(d.holidayId).slice(-6)}` : null,
    d.days != null ? tr("auditLogs.detail.days", "{{count}} day(s)").replace("{{count}}", String(d.days)) : null,
    d.userName ? `${tr("auditLogs.detail.for", "for")} ${d.userName}` : null,
    d.deliveryType ? `${tr("auditLogs.detail.as", "as")} ${d.deliveryType}` : null,
    d.category ? `${tr("auditLogs.detail.category", "category")}: ${d.category}` : null,
    d.enabled === true ? tr("auditLogs.detail.enabled", "enabled") : d.enabled === false ? tr("auditLogs.detail.disabled", "disabled") : null,
    d.targetPermission ? `${tr("auditLogs.detail.permission", "permission")}: ${d.targetPermission}` : null,
    d.contentPreview ? `"${d.contentPreview}"` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "—";
}

export default function AuditLogs({ account }) {
  const { t } = useLanguage();
  const tr = useCallback((key, fallback) => {
    const v = t(key);
    return v === key ? fallback : v;
  }, [t]);
  const [logs, setLogs] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterUserIds, setFilterUserIds] = useState([]);
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
        userIds: filterUserIds.length > 0 ? filterUserIds : undefined,
        roleId: filterRoleId || undefined,
        action: filterAction?.trim() || undefined,
        dateFrom: filterDateFrom || undefined,
        dateTo: filterDateTo || undefined,
      },
    });
  }

  useEffect(() => {
    if (!window.api?.wsSend) return;
    const current = [
      [...filterUserIds].map(String).sort().join(","),
      filterRoleId,
      filterAction,
      filterDateFrom,
      filterDateTo,
    ];
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
  }, [filterUserIds, filterRoleId, filterAction, filterDateFrom, filterDateTo]);

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
      .map((k) => ({ value: k, label: tr(ACTION_LABELS[k], k) }));
  }, [tr]);

  const columns = useMemo(() => ([
    { key: "createdAt", label: tr("auditLogs.colDateTime", "DATE & TIME"), sortable: true, width: "1.4fr" },
    { key: "user", label: tr("auditLogs.colUser", "USER"), sortable: true, width: "1.6fr" },
    { key: "role", label: tr("auditLogs.colRole", "ROLE"), sortable: true, width: "1.2fr" },
    { key: "action", label: tr("auditLogs.colAction", "ACTION"), sortable: true, width: "1.4fr" },
    { key: "details", label: tr("auditLogs.colDetails", "DETAILS"), sortable: false, width: "1.8fr" },
  ]), [tr]);

  const roleNameById = useMemo(() => {
    const map = new Map();
    for (const r of roles) map.set(String(r?._id || ""), r?.name || "");
    return map;
  }, [roles]);

  const employeeOptions = useMemo(
    () =>
      employees.map((e) => {
        const roleIdObj = e?.roleId;
        const roleName =
          (roleIdObj && typeof roleIdObj === "object" ? roleIdObj?.name : "") ||
          roleNameById.get(String(e?.roleId || "")) ||
          tr("auditLogs.noRole", "No role");
        return {
          _id: String(e?._id || ""),
          name: e?.name || e?.workEmail || "—",
          phone: e?.phone || "",
          photoUrl: e?.uploads?.employeePhotoUrl ?? e?.uploads?.employeePhoto ?? null,
          roleName,
        };
      }),
    [employees, roleNameById, tr]
  );

  const roleFilterOptions = useMemo(() => {
    return [
      { value: "", label: tr("auditLogs.allRoles", "All roles") },
      ...roles.map((r) => ({
        value: String(r._id),
        label: r?.name || String(r._id).slice(-6),
      })),
    ];
  }, [roles, tr]);

  const actionFilterOptions = useMemo(() => {
    return [{ value: "", label: tr("auditLogs.allActions", "All actions") }, ...actionOptions];
  }, [actionOptions, tr]);

  const toggleUserFilter = useCallback((id) => {
    const sid = String(id || "");
    if (!sid) return;
    setFilterUserIds((prev) => {
      const has = prev.includes(sid);
      if (has) return prev.filter((x) => x !== sid);
      return [...prev, sid];
    });
  }, []);

  const clearUserFilter = useCallback(() => setFilterUserIds([]), []);

  const auditEmpT = useCallback((key, vars) => {
    const dict = {
      "recordings.empFilterTooltip": tr("auditLogs.filterUsers", "Filter users"),
      "recordings.empFilterAll": tr("auditLogs.allUsers", "All users"),
      "recordings.empFilterCount": tr("auditLogs.selectedCount", "{{count}} selected").replace("{{count}}", String(vars?.count ?? "0")),
      "recordings.dashClearEmployees": tr("auditLogs.clearSelectedUsers", "Clear selected users"),
      "recordings.empFilterPanelTitle": tr("auditLogs.users", "Users"),
      "recordings.empFilterPanelSelected": tr("auditLogs.selectedCount", "{{count}} selected").replace("{{count}}", String(vars?.count ?? "0")),
      "recordings.dashSearchEmployees": tr("auditLogs.searchUsers", "Search users"),
      "recordings.dashNoEmployees": tr("auditLogs.noUsersFound", "No users found"),
      "recordings.empFilterNoCallsMatch": tr("auditLogs.notAvailableAnalytics", "Not available for current analytics"),
    };
    return dict[key] ?? key;
  }, [tr]);

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
            <h1 className="auditLogsTitle">{tr("auditLogs.title", "Audit Logs")}</h1>
            <p className="auditLogsSubtitle">{tr("auditLogs.noPermission", "You don't have permission to view audit logs.")}</p>
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
          <h1 className="auditLogsTitle">{tr("auditLogs.title", "Audit Logs")}</h1>
          <p className="auditLogsSubtitle">{tr("auditLogs.subtitle", "Every action taken by users in the system")}</p>
        </div>
      </header>

      <main className="auditLogsMain">
        <div className="auditLogsContent">
          <section className="auditLogsSection">
            <div className="auditLogsToolbar">
              <div className="auditLogsToolbarFilters">
                <div className="auditLogsFilterRow auditLogsFilterRow--selects">
                  <div className="auditLogsUsersFilter">
                    <span className="auditLogsUsersFilterLabel">{tr("auditLogs.user", "User")}</span>
                    <EmployeesFilter
                      t={auditEmpT}
                      employees={employeeOptions}
                      selectedIds={filterUserIds}
                      onToggle={toggleUserFilter}
                      onClear={clearUserFilter}
                      analyticsLoading={false}
                      getSecondaryText={(e) => e?.roleName || tr("auditLogs.noRole", "No role")}
                    />
                  </div>
                  <PaginatorSelect
                    label={tr("auditLogs.role", "Role")}
                    value={filterRoleId}
                    onChange={(v) => setFilterRoleId(String(v ?? ""))}
                    options={roleFilterOptions}
                    className="auditLogsFilterSelect"
                  />
                  <PaginatorSelect
                    label={tr("auditLogs.action", "Action")}
                    value={filterAction}
                    onChange={(v) => setFilterAction(String(v ?? ""))}
                    options={actionFilterOptions}
                    className="auditLogsFilterSelect"
                    dropClassName="auditLogsActionSelectDrop"
                  />
                </div>
                <div className="auditLogsFilterRow auditLogsFilterRow--dates">
                  <DateRangePicker
                    label={tr("auditLogs.dateRange", "Date range")}
                    placeholder={tr("auditLogs.dateRangePlaceholder", "From – To")}
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
                emptyText={tr("auditLogs.empty", "No audit logs match your filters.")}
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
                          {ACTION_LABELS[log.action] ? tr(ACTION_LABELS[log.action], log.action) : log.action}
                        </span>
                      </div>
                    </div>
                    <div className="td">
                      <div className="cell cell--muted auditLogsDetailsCell">
                        {detailsText(log, tr)}
                      </div>
                    </div>
                  </>
                )}
                footer={
                  <div className="auditLogsFooter">
                    <div className="auditLogsFooterLeft">
                      <div className="auditLogsPerPage">
                        <PaginatorSelect
                          label={tr("auditLogs.rows", "Rows")}
                          value={pageSize}
                          onChange={(v) => {
                            setPageSize(v);
                            setPage(1);
                          }}
                          options={[10, 15, 30].map((n) => ({
                            value: n,
                            label: tr("auditLogs.rowsPerPage", "{{count}} / page").replace("{{count}}", String(n)),
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
                        {tr("auditLogs.previous", "Previous")}
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
                        {tr("auditLogs.next", "Next")}
                        <ChevronRight size={16} />
                      </button>
                    </div>
                    <div className="auditLogsFooterRight">
                      <span className="auditLogsMuted">
                        {sortedLogs.length === 0
                          ? tr("auditLogs.zeroResults", "0 results")
                          : tr("auditLogs.showingOf", "Showing {{from}}–{{to}} of {{total}}")
                              .replace("{{from}}", String((page - 1) * pageSize + 1))
                              .replace("{{to}}", String(Math.min(page * pageSize, sortedLogs.length)))
                              .replace("{{total}}", String(sortedLogs.length))}
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

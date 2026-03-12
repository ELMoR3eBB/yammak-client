// employee_list.jsx — design aligned with Settings (same layout, colours, tokens)
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, PlusCircle, Users, Lock, Unlock, Eye, MessageCircle } from "lucide-react";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";
import "tippy.js/animations/shift-away.css";
import "../../../styles/pages/employees/employee_list.css";

import ConfirmDeleteModal from "../../modals/ConfirmDeleteModal";
import SearchInput from "../../ui/SearchInput";
import DataTable from "../../ui/DataTable";
import PaginatorSelect from "../../ui/PaginatorSelect";
import { useNotification } from "../../NotificationProvider";
import "../../../styles/ui/paginator_select.css";

/* ---------------- tiny utils ---------------- */

const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

const buildPageModel = (page, totalPages) => {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  if (page <= 3) return [1, 2, 3, 4, "…", totalPages];
  if (page >= totalPages - 2)
    return [1, "…", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  return [1, "…", page - 1, page, page + 1, "…", totalPages];
};

const calcAge = (dob) => {
  if (!dob) return "-";
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return "-";
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age >= 0 && age <= 120 ? String(age) : "-";
};

/* ---------------- columns ---------------- */

const columns = [
  { key: "name", label: "NAME", sortable: true, width: "2fr" },
  { key: "id", label: "ID", sortable: true, width: "0.75fr" },
  { key: "age", label: "AGE", sortable: true, width: "0.6fr" },
  { key: "email", label: "EMAIL", sortable: true, width: "1.6fr" },
  { key: "phone", label: "PHONE", sortable: true, width: "1.1fr" },
  { key: "jobTitle", label: "POSITION", sortable: true, width: "1.4fr" },
  { key: "actions", label: "ACTIONS", sortable: false, align: "center", width: "1.8fr" },
];

/* ---------------- component ---------------- */

export default function EmployeesList({ account, onNavigate, onCurrentUserEmployee }) {
  const notify = useNotification();

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState({ key: "createdAt", dir: "desc" });
  const sortKey = sort.key;
  const sortDir = sort.dir;

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [confirmEmp, setConfirmEmp] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [impersonatingId, setImpersonatingId] = useState(null);
  const [onlineUserIds, setOnlineUserIds] = useState(new Set());
  const [contentReady, setContentReady] = useState(false);

  const pending = useRef(new Map());

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setContentReady(true));
    });
    return () => cancelAnimationFrame(id);
  }, []);
  const pendingLockUnlockRef = useRef(null);
  const pendingLockUnlockEmployeeIdRef = useRef(null);

  const myId = String(account?.employeeId || account?.id || account?.user?.id || account?._id || "");

  const perms = account?.role?.permissions || [];
  const canUnlock = perms.includes("*") || perms.includes("account.unlock");
  const canImpersonate = perms.includes("*") || perms.includes("account.impersonate") || perms.includes("account.unlock");
  const isImpersonating = Boolean(account?.impersonation?.active);

  const currentUserEmployee = useMemo(() => {
    if (!myId || !Array.isArray(employees)) return null;
    return employees.find((e) => String(e?._id) === myId) ?? null;
  }, [employees, myId]);

  useEffect(() => {
    onCurrentUserEmployee?.(currentUserEmployee ?? null);
  }, [currentUserEmployee, onCurrentUserEmployee]);

  /* ---------- WS wiring ---------- */

  useEffect(() => {
    if (!window.api) {
      setLoading(false);
      notify?.error?.("API not available");
      return;
    }

    const unsub = window.api.onWsMessage((msg) => {
      if (msg?.type === "employees:list" && Array.isArray(msg.employees)) {
        setEmployees(msg.employees);
        setLoading(false);
      }

      if (msg?.type === "employees:changed") {
        window.api.wsSend({ type: "employees:list", requestId: rid() });
      }

      if (msg?.type === "account:lockedState" && msg?.employeeId != null) {
        const employeeId = String(msg.employeeId);
        const lockedAt = msg.lockedAt ?? null;
        setEmployees((prev) => prev.map((e) => (String(e?._id) === employeeId ? { ...e, lockedAt } : e)));
      }

      if (msg?.type === "employees:delete:result" && msg.requestId) {
        const resolve = pending.current.get(msg.requestId);
        if (resolve) {
          pending.current.delete(msg.requestId);
          resolve(msg);
        }
      }

      if (msg?.type === "account:unlock:result" && msg?.requestId === pendingLockUnlockRef.current) {
        const employeeId = pendingLockUnlockEmployeeIdRef.current;
        pendingLockUnlockRef.current = null;
        pendingLockUnlockEmployeeIdRef.current = null;

        if (msg?.ok) {
          notify?.success?.("Account unlocked.", "Employees");
          if (employeeId) {
            setEmployees((prev) =>
              prev.map((e) => (String(e?._id) === String(employeeId) ? { ...e, lockedAt: null } : e))
            );
          }
        } else {
          notify?.error?.(msg?.error || "Failed to unlock", "Employees");
        }
      }

      if (msg?.type === "account:lock:result" && msg?.requestId === pendingLockUnlockRef.current) {
        const employeeId = pendingLockUnlockEmployeeIdRef.current;
        pendingLockUnlockRef.current = null;
        pendingLockUnlockEmployeeIdRef.current = null;

        if (msg?.ok) {
          notify?.success?.("Account locked. User has been signed out.", "Employees");
          if (employeeId) {
            setEmployees((prev) =>
              prev.map((e) => (String(e?._id) === String(employeeId) ? { ...e, lockedAt: new Date() } : e))
            );
          }
        } else {
          notify?.error?.(msg?.error || "Failed to lock", "Employees");
        }
      }

      if (msg?.type === "presence:list" && Array.isArray(msg.onlineUserIds)) {
        setOnlineUserIds(new Set(msg.onlineUserIds.map((id) => String(id))));
      }

      if (msg?.type === "presence:user" && msg?.user?._id) {
        const id = String(msg.user._id);
        setOnlineUserIds((prev) => {
          const next = new Set(prev);
          if (msg.event === "online") next.add(id);
          else next.delete(id);
          return next;
        });
      }
    });

    (async () => {
      try {
        await window.api.wsConnect();
        window.api.wsSend({ type: "employees:list", requestId: rid() });
        window.api.wsSend({ type: "presence:list", requestId: rid() });
      } catch {
        setLoading(false);
        notify?.error?.("WebSocket not connected", "Connection");
      }
    })();

    return () => unsub?.();
  }, [notify]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && setConfirmEmp(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ---------- filter + sort ---------- */

  const filteredSorted = useMemo(() => {
    const list = Array.isArray(employees) ? employees : [];
    const q = query.trim().toLowerCase();

    const filtered = !q
      ? list
      : list.filter((e) => {
          const hay = [e?._id, e?.name, e?.phone, e?.jobTitle, e?.workEmail, e?.email]
            .map((x) => String(x || "").toLowerCase())
            .join(" ");
          return hay.includes(q);
        });

    const dir = sortDir === "asc" ? 1 : -1;

    const valueOf = (e) => {
      switch (sortKey) {
        case "createdAt":
          return new Date(e?.createdAt || 0).getTime() || 0;
        case "id":
          return String(e?._id || "");
        case "name":
          return String(e?.name || "").toLowerCase();
        case "jobTitle":
          return String(e?.jobTitle || "").toLowerCase();
        case "email":
          return String(e?.workEmail || e?.email || "").toLowerCase();
        case "phone":
          return String(e?.phone || "");
        case "age":
          return Number(calcAge(e?.dob)) || 0;
        default:
          return "";
      }
    };

    return filtered
      .map((e, i) => ({ e, i }))
      .sort((a, b) => {
        const av = valueOf(a.e);
        const bv = valueOf(b.e);
        if (av < bv) return -1 * dir;
        if (av > bv) return 1 * dir;
        return a.i - b.i; // stable
      })
      .map((x) => x.e);
  }, [employees, query, sortKey, sortDir]);

  /* ---------- pagination ---------- */

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredSorted.length / pageSize)), [
    filteredSorted.length,
    pageSize,
  ]);

  useEffect(() => setPage((p) => clamp(p, 1, totalPages)), [totalPages]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredSorted.slice(start, start + pageSize);
  }, [filteredSorted, page, pageSize]);

  const pageModel = useMemo(() => buildPageModel(page, totalPages), [page, totalPages]);

  const toggleSort = useCallback((key) => {
    setPage(1);
    setSort((prev) => {
      if (prev.key === key) {
        return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      return { key, dir: key === "createdAt" ? "desc" : "asc" };
    });
  }, []);

  /* ---------- delete ---------- */

  async function doDelete(emp) {
    if (!emp?._id) return;

    const isSystem = !!emp?.isSystem;
    const isSelf = myId && String(emp?._id || "") === String(myId);

    if (isSystem || isSelf) {
      const msg = isSystem ? "System account cannot be deleted" : "You cannot delete your own account";
      notify?.error?.(msg, "Delete blocked");
      setConfirmEmp(null);
      return;
    }

    setDeleting(true);

    const requestId = rid();
    const waitForResult = new Promise((resolve) => {
      pending.current.set(requestId, resolve);
      setTimeout(() => {
        if (pending.current.has(requestId)) {
          pending.current.delete(requestId);
          resolve({ ok: false, error: "timeout" });
        }
      }, 8000);
    });

    try {
      await window.api.wsSend({
        type: "employees:delete",
        requestId,
        payload: { employeeId: emp._id },
      });
    } catch {
      setDeleting(false);
      notify?.error?.("Failed to send delete request.", "Delete");
      return;
    }

    const res = await waitForResult;
    setDeleting(false);

    if (!res?.ok) {
      notify?.error?.(res?.error || "Failed to delete employee", "Delete failed");
      return;
    }

    notify?.success?.("Employee deleted successfully.", "Deleted");
    setConfirmEmp(null);
    window.api.wsSend({ type: "employees:list", requestId: rid() });
  }

  /* ---------------- UI ---------------- */

  return (
    <div className="employeesPage">
      <header className="employeesHeader">
        <div className="employeesHeaderIcon">
          <Users size={24} />
        </div>
        <div className="employeesHeaderText">
          <h1 className="employeesTitle">Employees</h1>
          <p className="employeesSubtitle">Live synced via WebSocket.</p>
        </div>
        <Tippy content="Create Employee" animation="shift-away" placement="bottom" delay={[200, 0]}>
          <button type="button" className="employeesCreateBtn" onClick={() => onNavigate?.("employees:create")}>
            <PlusCircle size={16} />
            Create
          </button>
        </Tippy>
      </header>

      <main className="employeesMain">
        <div className="employeesContent">
          <section className="employeesSection">
            <div className="employeesToolbar">
              <SearchInput
                value={query}
                clearable={false}
                onChange={(v) => {
                  setQuery(v);
                  setPage(1);
                }}
                fields={["id", "name", "email", "phone", "position"]}
                size="md"
                width={400}
              />
            </div>

            <div className="employeesTableWrap">
              {contentReady ? (
              <DataTable
                columns={columns}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                onRowClick={(e) => onNavigate?.("employees:profile", e)}
                loading={loading}
                emptyText="No employees found."
                rows={pageItems}
                renderRow={(e) => {
                  const fullId = String(e?._id || "");
                  const shortId = fullId ? fullId.slice(-6) : "-";
                  const age = calcAge(e?.dob);

                  const photoUrl = e?.uploads?.employeePhotoUrl ?? e?.uploads?.employeePhoto ?? null;
                  const hasPhoto = photoUrl && typeof photoUrl === "string";
                  const initial = (e?.name || "—").charAt(0).toUpperCase();

                  const empId = String(e?._id || "");
                  const online = onlineUserIds.has(empId);

                  const isSystem = !!e?.isSystem;
                  const isSelf = myId && String(e?._id || "") === String(myId);
                  const delDisabled = !e?._id || isSystem || isSelf;
                  const impersonateDisabled = isImpersonating || isSystem || isSelf || !e?._id;
                  const messageDisabled = isSystem || isSelf || !e?._id;

                  const delTitle = isSystem
                    ? "System account cannot be deleted"
                    : isSelf
                    ? "You cannot delete your own account"
                    : "Delete";
                  const impersonateTitle = isImpersonating
                    ? "Stop current impersonation first"
                    : isSystem
                    ? "System account cannot be impersonated"
                    : isSelf
                      ? "You are already this user"
                      : "View as this employee";
                  const messageTitle = isSystem
                    ? "System account cannot be messaged"
                    : isSelf
                      ? "This is your account"
                      : "Message employee";

                  const locked = Boolean(e?.lockedAt);
                  const lockTitle = locked ? "Unlock account" : "Lock account & sign out";

                  return (
                    <>
                      {/* NAME: avatar + name + status */}
                      <div className="td td-name-with-avatar">
                        <div className="el-nameCell">
                          <div className="el-avatarWrap">
                            {hasPhoto ? (
                              <img src={photoUrl} alt="" className="el-avatarImg" />
                            ) : (
                              <span className="el-avatarInitial">{initial}</span>
                            )}
                          </div>

                          <div className="el-nameBlock">
                            <div className="cell strong">{e?.name || "-"}</div>
                            <div className="el-status">
                              <span className={`el-statusDot ${online ? "is-online" : ""}`} />
                              <span className="cell muted small">{online ? "Online" : "Offline"}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* ID */}
                      <div className="td">
                        <div className="cell mono hasTip">
                          {shortId}
                          {fullId ? <span className="tip">{fullId}</span> : null}
                        </div>
                      </div>

                      {/* AGE */}
                      <div className="td">
                        <div className="cell">{age}</div>
                      </div>

                      {/* EMAIL */}
                      <div className="td">
                        <div className="cell">{e?.workEmail || e?.email || "-"}</div>
                      </div>

                      {/* PHONE */}
                      <div className="td">
                        <div className="cell">{e?.phone || "-"}</div>
                      </div>

                      {/* POSITION */}
                      <div className="td">
                        <div className="cell">{e?.jobTitle || "-"}</div>
                      </div>

                      {/* ACTIONS */}
                      <div className="td td-center">
                        <div className="actions">
                          {canUnlock && String(e?._id) !== myId && (
                            <Tippy
                              key={locked ? "unlock" : "lock"}
                              content={lockTitle}
                              animation="shift-away"
                              placement="top"
                              delay={[200, 0]}
                            >
                              <button
                                type="button"
                                className={`iconBtn ${locked ? "el-unlockBtn" : "el-lockBtn"}`}
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  if (!window.api?.wsSend) return;

                                  pendingLockUnlockRef.current = rid();
                                  pendingLockUnlockEmployeeIdRef.current = e._id;

                                  window.api.wsSend({
                                    type: locked ? "account:unlock" : "account:lock",
                                    requestId: pendingLockUnlockRef.current,
                                    payload: { employeeId: e._id },
                                  });
                                }}
                              >
                                {locked ? <Unlock size={14} /> : <Lock size={14} />}
                              </button>
                            </Tippy>
                          )}

                          {canImpersonate && (
                            <Tippy content={impersonateTitle} animation="shift-away" placement="top" delay={[200, 0]}>
                              <button
                                type="button"
                                className="iconBtn el-impersonateBtn"
                                disabled={impersonateDisabled || impersonatingId === empId}
                                onClick={async (ev) => {
                                  ev.stopPropagation();
                                  if (impersonateDisabled || !window.api?.authImpersonateStart) return;
                                  setImpersonatingId(empId);
                                  try {
                                    const out = await window.api.authImpersonateStart(e._id);
                                    if (!out?.ok) {
                                      notify?.error?.(out?.error || "Failed to start impersonation", "Impersonation");
                                      return;
                                    }
                                    notify?.success?.(`Now viewing as ${e?.name || "selected employee"}.`, "Impersonation");
                                  } catch {
                                    notify?.error?.("Failed to start impersonation", "Impersonation");
                                  } finally {
                                    setImpersonatingId(null);
                                  }
                                }}
                              >
                                {impersonatingId === empId ? <span className="el-impersonateSpinner" aria-hidden /> : <Eye size={14} />}
                              </button>
                            </Tippy>
                          )}

                          <Tippy content={messageTitle} animation="shift-away" placement="top" delay={[200, 0]}>
                            <button
                              type="button"
                              className="iconBtn el-messageBtn"
                              disabled={messageDisabled}
                              onClick={(ev) => {
                                ev.stopPropagation();
                                if (messageDisabled) return;
                                onNavigate?.("chat", {
                                  directUserId: empId,
                                  userId: empId,
                                  directUserName: e?.name || "Employee",
                                });
                              }}
                            >
                              <MessageCircle size={14} />
                            </button>
                          </Tippy>

                          <Tippy content="Edit" animation="shift-away" placement="top" delay={[200, 0]}>
                            <button
                              className="iconBtn"
                              type="button"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                onNavigate?.("employees:edit", e);
                              }}
                            >
                              ✎
                            </button>
                          </Tippy>

                          <Tippy content={delTitle} animation="shift-away" placement="top" delay={[200, 0]}>
                            <div
                              className={`deleteWrap ${delDisabled ? "is-disabled" : ""}`}
                              role="button"
                              tabIndex={0}
                              onClick={(ev) => {
                                ev.stopPropagation();
                                if (delDisabled) return notify?.error?.(delTitle, "Delete blocked");
                                setConfirmEmp(e);
                              }}
                              onKeyDown={(ev) => {
                                if (ev.key !== "Enter" && ev.key !== " ") return;
                                ev.preventDefault();
                                ev.stopPropagation();
                                if (delDisabled) return notify?.error?.(delTitle, "Delete blocked");
                                setConfirmEmp(e);
                              }}
                            >
                              <button className="iconBtn danger" type="button" aria-disabled={delDisabled}>
                                🗑
                              </button>
                            </div>
                          </Tippy>
                        </div>
                      </div>
                    </>
                  );
                }}
                footer={
                  <div className="employeesFooter">
                    <div className="employeesFooterLeft">
                      <div className="employeesPerPage">
                        <PaginatorSelect
                          label="Rows"
                          value={pageSize}
                          onChange={(v) => {
                            setPageSize(v);
                            setPage(1);
                          }}
                          options={[10, 20, 50].map((n) => ({
                            value: n,
                            label: `${n} / page`,
                          }))}
                        />
                      </div>
                    </div>

                    <div className="employeesFooterMid">
                      <button
                        type="button"
                        className="employeesPagerBtn"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => p - 1)}
                      >
                        <ChevronLeft size={16} />
                        Previous
                      </button>

                      <div className="employeesPages">
                        {pageModel.map((p, idx) =>
                          p === "…" ? (
                            <span key={`dots-${idx}`} className="employeesPagesDots">
                              …
                            </span>
                          ) : (
                            <button
                              key={p}
                              type="button"
                              className={`employeesPageBtn ${p === page ? "active" : ""}`}
                              onClick={() => setPage(p)}
                            >
                              {p}
                            </button>
                          )
                        )}
                      </div>

                      <button
                        type="button"
                        className="employeesPagerBtn"
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        Next
                        <ChevronRight size={16} />
                      </button>
                    </div>

                    <div className="employeesFooterRight">
                      <span className="employeesMuted">
                        {filteredSorted.length === 0
                          ? "0 results"
                          : `Showing ${(page - 1) * pageSize + 1}–${Math.min(
                              page * pageSize,
                              filteredSorted.length
                            )} of ${filteredSorted.length}`}
                      </span>
                    </div>
                  </div>
                }
              />
              ) : (
                <div className="employeesTablePlaceholder" aria-hidden>
                  <span className="employeesTablePlaceholderText">Loading…</span>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      <ConfirmDeleteModal
        open={!!confirmEmp}
        title="Delete employee"
        message={
          confirmEmp
            ? `Are you sure you want to delete "${confirmEmp?.name || "this employee"}"?\nThis action cannot be undone.`
            : ""
        }
        confirmText={deleting ? "Deleting…" : "Delete"}
        cancelText="Cancel"
        loading={deleting}
        onClose={() => {
          if (!deleting) setConfirmEmp(null);
        }}
        onConfirm={() => void doDelete(confirmEmp)}
      />
    </div>
  );
}

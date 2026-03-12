// role_list.jsx — same design as Employee_List (Settings theme, layout, transitions)
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, PlusCircle, Shield } from "lucide-react";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";
import "tippy.js/animations/shift-away.css";

import "../../../styles/pages/roles/role_list.css";

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

const fmtPerms = (perms) => {
    const list = Array.isArray(perms) ? perms.filter(Boolean) : [];
    if (!list.length) return "—";
    if (list.length === 1) return list[0];
    return `${list[0]} +${list.length - 1}`;
};

const normalizeColor = (c) => {
    const fallback = "#9ca3af";

    if (c === null || c === undefined) return fallback;

    // Accept common payload shapes from APIs/color pickers.
    let raw = c;
    if (typeof c === "object") {
        raw = c?.hex ?? c?.value ?? c?.color ?? "";
    }

    let value = String(raw || "").trim();
    if (!value) return fallback;

    // Allow hex values sent without '#', e.g. "ffcc00".
    if (/^[0-9a-fA-F]{3}([0-9a-fA-F]{3})?([0-9a-fA-F]{2})?$/.test(value)) {
        value = `#${value}`;
    }

    if (typeof window !== "undefined" && window.CSS?.supports?.("color", value)) {
        return value;
    }

    return fallback;
};

const num = (x, fallback = 0) => {
    const n = Number(x);
    return Number.isFinite(n) ? n : fallback;
};

/* ---------------- columns ---------------- */

const columns = [
    { key: "id", label: "ID", sortable: true, width: "1.8fr" },
    { key: "name", label: "NAME", sortable: true, width: "1.4fr" },
    { key: "priority", label: "PRIORITY", sortable: true, width: "0.95fr" },
    { key: "usersCount", label: "USERS", sortable: true, width: "0.8fr" },
    { key: "permissions", label: "PERMISSIONS", sortable: true, width: "1.8fr" },
    { key: "color", label: "COLOR", sortable: false, width: "0.95fr" },
    { key: "actions", label: "ACTIONS", sortable: false, align: "center", width: "1fr" },
];

/* ---------------- component ---------------- */

export default function RolesList({ account, onNavigate }) {
    const notify = useNotification();

    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);

    const [query, setQuery] = useState("");

    const [sort, setSort] = useState({ key: "priority", dir: "asc" });
    const sortKey = sort.key;
    const sortDir = sort.dir;

    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const [confirmRole, setConfirmRole] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const pending = useRef(new Map());


    const perms = account?.role?.permissions || [];
    const isUserSystem = !!account?.role?.isSystem;
    const userPriority = num(account?.role?.priority, 999999);


    const canEditAny = isUserSystem || perms.includes("*") || perms.includes("roles.edit");
    const canDeleteAny = isUserSystem || perms.includes("*") || perms.includes("roles.delete");

    const isPriorityBlocked = (targetPriority) => {
        const tp = num(targetPriority, 999999);
        if (isUserSystem) return false;
        return userPriority > tp;
    };

    // in-use detector (frontend can only know if backend provides info)
    const roleInUse = (r) => {
        if (!r) return false;
        if (typeof r.inUse === "boolean") return r.inUse;
        if (typeof r.isInUse === "boolean") return r.isInUse;

        const c =
            r.usersCount ??
            r.userCount ??
            r.employeeCount ??
            r.employeesCount ??
            r.usedCount ??
            r.assignedCount ??
            null;

        if (c === null || c === undefined) return false; // unknown -> treat as not-in-use on UI
        return num(c, 0) > 0;
    };

    /* ---------- WS wiring ---------- */

    useEffect(() => {
        if (!window.api) {
            setLoading(false);
            notify?.error?.("API not available");
            return;
        }

        const unsub = window.api.onWsMessage((msg) => {
            if (msg?.type === "roles:list" && Array.isArray(msg.roles)) {
                setRoles(msg.roles);
                setLoading(false);
            }

            if (msg?.type === "roles:changed") {
                window.api.wsSend({ type: "roles:list", requestId: rid() });
            }

            if (msg?.type === "roles:delete:result" && msg.requestId) {
                const resolve = pending.current.get(msg.requestId);
                if (resolve) {
                    pending.current.delete(msg.requestId);
                    resolve(msg);
                }
            }
        });

        (async () => {
            try {
                await window.api.wsConnect();
                window.api.wsSend({ type: "roles:list", requestId: rid() });
            } catch {
                setLoading(false);
                notify?.error?.("WebSocket not connected", "Connection");
            }
        })();

        return () => unsub?.();
    }, [notify]);

    useEffect(() => {
        const onKey = (e) => e.key === "Escape" && setConfirmRole(null);
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    /* ---------- filter + sort ---------- */

    const filteredSorted = useMemo(() => {
        const list = Array.isArray(roles) ? roles : [];
        const q = query.trim().toLowerCase();

        const filtered = !q
            ? list
            : list.filter((r) => {
                const permsText = Array.isArray(r?.permissions) ? r.permissions.join(" ") : "";
                const hay = [r?._id, r?.name, r?.color, r?.priority, permsText]
                    .map((x) => String(x || "").toLowerCase())
                    .join(" ");
                return hay.includes(q);
            });

        const dir = sortDir === "asc" ? 1 : -1;

        const valueOf = (r) => {
            switch (sortKey) {
                case "createdAt":
                    return new Date(r?.createdAt || 0).getTime() || 0;

                case "id":
                    return String(r?._id || "");

                case "name":
                    return String(r?.name || "").toLowerCase();

                case "priority":
                    return num(r?.priority, 0);

                case "usersCount":
                    return num(r?.usersCount, 0);

                // ✅ your column key is "permissions"
                case "permissions":
                    return Array.isArray(r?.permissions) ? r.permissions.length : 0;

                // (optional) allow "permissionsCount" too if some other UI uses it
                case "permissionsCount":
                    return Array.isArray(r?.permissions) ? r.permissions.length : 0;

                // (optional) allow sorting by color if you click it
                case "color":
                    return String(r?.color || "").toLowerCase();

                default:
                    return "";
            }
        };

        return filtered
            .map((r, i) => ({ r, i }))
            .sort((a, b) => {
                const av = valueOf(a.r);
                const bv = valueOf(b.r);
                if (av < bv) return -1 * dir;
                if (av > bv) return 1 * dir;
                return a.i - b.i;
            })
            .map((x) => x.r);
    }, [roles, query, sortKey, sortDir]);

    /* ---------- pagination ---------- */

    const totalPages = useMemo(
        () => Math.max(1, Math.ceil(filteredSorted.length / pageSize)),
        [filteredSorted.length, pageSize]
    );

    useEffect(() => setPage((p) => clamp(p, 1, totalPages)), [totalPages]);

    const pageItems = useMemo(() => {
        const start = (page - 1) * pageSize;
        return filteredSorted.slice(start, start + pageSize);
    }, [filteredSorted, page, pageSize]);

    const pageModel = useMemo(() => buildPageModel(page, totalPages), [page, totalPages]);

    const toggleSort = useCallback((key) => {
        if (!key) return;
        setPage(1);

        setSort((prev) => {
            if (prev.key === key) {
                return { ...prev, dir: prev.dir === "asc" ? "desc" : "asc" };
            }
            return { key, dir: key === "createdAt" ? "desc" : "asc" };
        });
    }, []);

    /* ---------- delete ---------- */

    async function doDelete(role) {
        if (!role?._id) return;

        // hard block: role has users
        if (roleInUse(role)) {
            notify?.error?.("This role is assigned to employees and cannot be deleted.", "Delete blocked");
            setConfirmRole(null);
            return;
        }

        // hard block: permission
        if (!canDeleteAny) {
            notify?.error?.("You don't have permission to delete roles.", "Delete blocked");
            setConfirmRole(null);
            return;
        }


        // priority rule (system bypass)
        if (isPriorityBlocked(role?.priority) && !isUserSystem) {
            notify?.error?.("You can't delete a role with higher priority than yours.", "Delete blocked");
            setConfirmRole(null);
            return;
        }

        // target isSystem is allowed ONLY for system user (per your note)
        if (!!role?.isSystem && !isUserSystem) {
            notify?.error?.("System roles can only be deleted by a system user.", "Delete blocked");
            setConfirmRole(null);
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
                type: "roles:delete",
                requestId,
                payload: { roleId: role._id },
            });
        } catch {
            setDeleting(false);
            notify?.error?.("Failed to send delete request.", "Delete");
            return;
        }

        const res = await waitForResult;
        setDeleting(false);

        if (!res?.ok) {
            const code = String(res?.error || "");
            const msg =
                code === "role_in_use"
                    ? "This role is assigned to employees and cannot be deleted."
                    : code === "system_role_protected"
                        ? "System role cannot be deleted."
                        : code === "not_found"
                            ? "Role not found."
                            : code === "timeout"
                                ? "Delete timed out. Please try again."
                                : "Failed to delete role.";
            notify?.error?.(msg, "Delete failed");
            return;
        }

        notify?.success?.("Role deleted successfully.", "Deleted");
        setConfirmRole(null);
        window.api.wsSend({ type: "roles:list", requestId: rid() });
    }

    /* ---------------- UI ---------------- */

    return (
        <div className="rolesPage">
            <header className="rolesHeader">
                <div className="rolesHeaderIcon">
                    <Shield size={24} />
                </div>
                <div className="rolesHeaderText">
                    <h1 className="rolesTitle">Roles</h1>
                    <p className="rolesSubtitle">Live synced via WebSocket.</p>
                </div>
                <Tippy content="Create Role" animation="shift-away" placement="bottom" delay={[200, 0]}>
                    <button
                    type="button"
                    className="rolesCreateBtn"
                    onClick={() => onNavigate?.("roles:create")}
                >
                    <PlusCircle size={16} />
                    Create
                </button>
                </Tippy>
            </header>

            <main className="rolesMain">
                <div className="rolesContent">
                    <section className="rolesSection">
                        <div className="rolesToolbar">
                            <SearchInput
                                value={query}
                                clearable={false}
                                onChange={(v) => {
                                    setQuery(v);
                                    setPage(1);
                                }}
                                fields={["id", "name", "priority", "permission"]}
                                size="md"
                                width={400}
                            />
                        </div>

                        <div className="rolesTableWrap">
                            <DataTable
                        columns={columns}
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onSort={toggleSort}
                        loading={loading}
                        emptyText="No roles found."
                        rows={pageItems}
                        renderRow={(r) => {
                            const fullId = String(r?._id || "");
                            const shortId = fullId ? fullId.slice(-6) : "-";

                            const color = normalizeColor(r?.color);
                            const permsList = Array.isArray(r?.permissions) ? r.permissions : [];
                            const permsCount = permsList.length;

                            const targetIsSystem = !!r?.isSystem;
                            const targetInUse = roleInUse(r);

                            // EDIT rules
                            const editBlockedNoPerm = !canEditAny;
                            const editBlockedSystemRole = targetIsSystem && !isUserSystem; // only system user can edit system roles
                            const editDisabled = editBlockedNoPerm || editBlockedSystemRole;

                            const editReason = editBlockedNoPerm
                                ? "You don't have permission to edit roles."
                                : editBlockedSystemRole
                                    ? "Only a system user can edit system roles."
                                    : "Edit";

                            // DELETE rules
                            const delBlockedNoPerm = !canDeleteAny;
                            const delBlockedPriority = isPriorityBlocked(r?.priority);
                            const delBlockedInUse = targetInUse;
                            const delBlockedSystemTarget = targetIsSystem; // only system can delete system roles (per your rule)
                            const delDisabled =
                                delBlockedNoPerm || delBlockedPriority || delBlockedInUse || delBlockedSystemTarget;

                            const delReason = delBlockedNoPerm
                                ? "You don't have permission to delete roles."
                                : delBlockedInUse
                                    ? "Role is assigned to employees."
                                    : delBlockedSystemTarget
                                        ? "System roles cannot be deleted."
                                        : delBlockedPriority
                                            ? "You can't delete a role with higher priority than yours."
                                            : "Delete";

                            const tippyProps = {
                                animation: "shift-away",
                                placement: "top",
                                delay: [150, 0],
                                maxWidth: 260,
                            };

                            return (
                                <>
                                    {/* ID */}
                                    <div className="td">
                                        <Tippy content={fullId || "—"} {...tippyProps}>
                                            <div className="cell mono">
                                                {shortId}
                                            </div>
                                        </Tippy>
                                    </div>

                                    {/* NAME */}
                                    <div className="td">
                                        <div className="cell strong">{r?.name || "-"}</div>
                                        {targetIsSystem ? <div className="cell muted small">System role</div> : null}
                                    </div>

                                    {/* PRIORITY */}
                                    <div className="td">
                                        <div className="cell">
                                            {Number.isFinite(Number(r?.priority)) ? r.priority : "-"}
                                        </div>
                                    </div>

                                    {/* USERS */}
                                    <div className="td">
                                        <div className="cell">{num(r?.usersCount, 0)}</div>
                                        <div className="cell muted small">{roleInUse(r) ? "In use" : "—"}</div>
                                    </div>

                                    {/* PERMISSIONS */}
                                    <div className="td">
                                        <Tippy
                                            content={
                                                permsList.length ? (
                                                    <div style={{ whiteSpace: "pre-wrap" }}>
                                                        {permsList.join("\n")}
                                                    </div>
                                                ) : (
                                                    "—"
                                                )
                                            }
                                            {...tippyProps}
                                        >
                                            <div>
                                                <div className="cell">{fmtPerms(permsList)}</div>
                                                <div className="cell muted small">
                                                    {permsCount ? `${permsCount} permission(s)` : "—"}
                                                </div>
                                            </div>
                                        </Tippy>
                                    </div>

                                    {/* COLOR */}
                                    <div className="td">
                                        <Tippy content={color} {...tippyProps}>
                                            <div className="roleColor">
                                                <span className="dot" style={{ backgroundColor: color }} aria-hidden="true" />
                                                <span className="mono small">{color}</span>
                                            </div>
                                        </Tippy>
                                    </div>

                                    {/* ACTIONS */}
                                    <div className="td td-center">
                                        <div className="actions">
                                            {/* EDIT */}
                                            <Tippy
                                                content={editDisabled ? editReason : "Edit"}
                                                animation="shift-away"
                                                placement="top"
                                                delay={[150, 0]}
                                                maxWidth={260}
                                            >
                                                <div
                                                    className={`editWrap ${editDisabled ? "is-disabled" : ""}`}
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={() => {
                                                        if (editDisabled) return notify?.error?.(editReason, "Edit blocked");
                                                        onNavigate?.("roles:edit", r);
                                                    }}
                                                    onKeyDown={(ev) => {
                                                        if (ev.key !== "Enter" && ev.key !== " ") return;
                                                        ev.preventDefault();
                                                        if (editDisabled) return notify?.error?.(editReason, "Edit blocked");
                                                        onNavigate?.("roles:edit", r);
                                                    }}
                                                >
                                                    <button className="iconBtn" type="button" aria-disabled={editDisabled}>
                                                        ✎
                                                    </button>
                                                </div>
                                            </Tippy>

                                            {/* DELETE */}
                                            <Tippy
                                                content={delDisabled ? delReason : "Delete"}
                                                animation="shift-away"
                                                placement="top"
                                                delay={[150, 0]}
                                                maxWidth={260}
                                            >
                                                <div
                                                    className={`deleteWrap ${delDisabled ? "is-disabled" : ""}`}
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={() => {
                                                        if (delDisabled) return notify?.error?.(delReason, "Delete blocked");
                                                        setConfirmRole(r);
                                                    }}
                                                    onKeyDown={(ev) => {
                                                        if (ev.key !== "Enter" && ev.key !== " ") return;
                                                        ev.preventDefault();
                                                        if (delDisabled) return notify?.error?.(delReason, "Delete blocked");
                                                        setConfirmRole(r);
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
                            <div className="rolesFooter">
                                <div className="rolesFooterLeft">
                                    <div className="rolesPerPage">
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

                                <div className="rolesFooterMid">
                                    <button
                                        type="button"
                                        className="rolesPagerBtn"
                                        disabled={page <= 1}
                                        onClick={() => setPage((p) => p - 1)}
                                    >
                                        <ChevronLeft size={16} />
                                        Previous
                                    </button>

                                    <div className="rolesPages">
                                        {pageModel.map((p, idx) =>
                                            p === "…" ? (
                                                <span key={`dots-${idx}`} className="rolesPagesDots">
                                                    …
                                                </span>
                                            ) : (
                                                <button
                                                    key={p}
                                                    type="button"
                                                    className={`rolesPageBtn ${p === page ? "active" : ""}`}
                                                    onClick={() => setPage(p)}
                                                >
                                                    {p}
                                                </button>
                                            )
                                        )}
                                    </div>

                                    <button
                                        type="button"
                                        className="rolesPagerBtn"
                                        disabled={page >= totalPages}
                                        onClick={() => setPage((p) => p + 1)}
                                    >
                                        Next
                                        <ChevronRight size={16} />
                                    </button>
                                </div>

                                <div className="rolesFooterRight">
                                    <span className="rolesMuted">
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
                        </div>
                    </section>
                </div>
            </main>

            <ConfirmDeleteModal
                open={!!confirmRole}
                title="Delete role"
                message={
                    confirmRole
                        ? `Are you sure you want to delete "${confirmRole?.name || "this role"}"?\nThis action cannot be undone.`
                        : ""
                }
                confirmText={deleting ? "Deleting…" : "Delete"}
                cancelText="Cancel"
                loading={deleting}
                onClose={() => {
                    if (!deleting) setConfirmRole(null);
                }}
                onConfirm={() => void doDelete(confirmRole)}
            />
        </div>
    );
}

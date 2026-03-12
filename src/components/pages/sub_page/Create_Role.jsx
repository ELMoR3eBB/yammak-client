import React, { useEffect, useMemo, useRef, useState } from "react";
import { Shield } from "lucide-react";
import { ColorPicker } from "primereact/colorpicker";

import { useNotification } from "../../NotificationProvider";
import "../../../styles/pages/roles/role_create.css";

/* ---------------- helpers ---------------- */

function rid() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function clampInt(n, min, max) {
    const x = Number(n);
    if (!Number.isFinite(x)) return min;
    return Math.min(max, Math.max(min, Math.trunc(x)));
}

function randomHexNoHash() {
    // readable-ish color using HSL -> HEX, returned as "rrggbb"
    const h = Math.floor(Math.random() * 360);
    const s = 70 + Math.floor(Math.random() * 16); // 70-85
    const l = 45 + Math.floor(Math.random() * 11); // 45-55

    // hsl -> rgb -> hex
    const ss = s / 100;
    const ll = l / 100;
    const c = (1 - Math.abs(2 * ll - 1)) * ss;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = ll - c / 2;

    let r1 = 0,
        g1 = 0,
        b1 = 0;
    if (0 <= h && h < 60) [r1, g1, b1] = [c, x, 0];
    else if (60 <= h && h < 120) [r1, g1, b1] = [x, c, 0];
    else if (120 <= h && h < 180) [r1, g1, b1] = [0, c, x];
    else if (180 <= h && h < 240) [r1, g1, b1] = [0, x, c];
    else if (240 <= h && h < 300) [r1, g1, b1] = [x, 0, c];
    else[r1, g1, b1] = [c, 0, x];

    const r = Math.round((r1 + m) * 255);
    const g = Math.round((g1 + m) * 255);
    const b = Math.round((b1 + m) * 255);

    return (
        r.toString(16).padStart(2, "0") +
        g.toString(16).padStart(2, "0") +
        b.toString(16).padStart(2, "0")
    );
}

function formatPermissionLabel(value) {
    const s = String(value).trim();
    if (!s) return s;
    return s
        .split(/[._]/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
}

function coercePermissionsJson(data) {
    if (!data || typeof data !== "object") return [];
    const entries = Object.entries(data).filter(
        ([k, v]) => v != null && String(v).trim() !== ""
    );
    const seen = new Set();
    const opts = [];
    for (const [key, val] of entries) {
        const value = String(val).trim();
        if (seen.has(value)) continue;
        seen.add(value);
        const label =
            key === "HAS_ALL"
                ? "All permissions (*)"
                : formatPermissionLabel(value);
        opts.push({ value, label, key });
    }
    opts.sort((a, b) => {
        if (a.key === "HAS_ALL") return -1;
        if (b.key === "HAS_ALL") return 1;
        return a.label.localeCompare(b.label);
    });
    return opts;
}

/* ---------------- component ---------------- */

export default function RoleCreate({ account, editingRole = null, onNavigate }) {
    const notify = useNotification();

    const isEdit = !!editingRole?._id;
    const editingId = editingRole?._id || "";

    // fields
    const [roleName, setRoleName] = useState("");
    const [priority, setPriority] = useState(1);

    // PrimeReact ColorPicker uses "rrggbb" (no '#')
    const [color, setColor] = useState(() => randomHexNoHash());

    // permissions
    const [permOptions, setPermOptions] = useState([]);
    const [loadingPerms, setLoadingPerms] = useState(true);
    const [selectedPerms, setSelectedPerms] = useState([]);
    const [permFilter, setPermFilter] = useState("");

    const [saving, setSaving] = useState(false);

    // ws
    const pending = useRef(new Map());
    const prefillDoneRef = useRef(false);

    const inputProps = useMemo(
        () => ({
            spellCheck: false,
            autoComplete: "off",
            autoCorrect: "off",
            autoCapitalize: "off",
        }),
        []
    );

    /* ---------- Prefill basic fields on edit ---------- */
    useEffect(() => {
        if (!editingRole) return;
        setRoleName(editingRole.name || "");
        setPriority(Number.isFinite(Number(editingRole.priority)) ? Number(editingRole.priority) : 1);
        const existing = editingRole.color || editingRole.colour || "";
        setColor(existing);
    }, [editingRole]);

    /* ---------- Prefill permissions on edit (once when editingRole and permOptions are ready) ---------- */
    useEffect(() => {
        if (!isEdit || !editingRole || permOptions.length === 0 || prefillDoneRef.current) return;

        const raw =
            editingRole.permissions ||
            editingRole.perms ||
            editingRole.permissionKeys ||
            editingRole.permission_keys ||
            [];
        const arr = Array.isArray(raw)
            ? raw
                  .map((p) => {
                      if (p == null) return "";
                      if (typeof p === "string") return String(p).trim();
                      const v = p.permission ?? p.key ?? p.value ?? p.id ?? p.name;
                      return String(v ?? "").trim();
                  })
                  .filter(Boolean)
            : [];
        setSelectedPerms(arr);
        prefillDoneRef.current = true;
    }, [isEdit, editingRole, permOptions.length]);

    /* ---------- Reset prefill flag when leaving edit mode ---------- */
    useEffect(() => {
        if (!isEdit) prefillDoneRef.current = false;
    }, [isEdit]);

    /* ---------- Load permissions from backend (permission:list) ---------- */
    useEffect(() => {
        if (!window.api?.wsSend) {
            setLoadingPerms(false);
            return;
        }
        let cancelled = false;
        const requestId = rid();
        setLoadingPerms(true);

        const unsub = window.api.onWsMessage?.((msg) => {
            if (msg?.type !== "permission:list" || msg?.requestId !== requestId) return;
            if (cancelled) return;
            const list = Array.isArray(msg.permissions) ? msg.permissions : [];
            const opts = list.map((p) => ({
                value: p.key,
                label: p.title || p.key,
                category: p.category || "",
                description: p.description || "",
            }));
            setPermOptions(opts);
            setLoadingPerms(false);
        });

        window.api.wsSend({ type: "permission:list", requestId });

        return () => {
            cancelled = true;
            unsub?.();
        };
    }, []);

    useEffect(() => {
        if (!window.api) return;

        const unsub = window.api.onWsMessage((msg) => {
            if (
                (msg?.type === "roles:create:result" || msg?.type === "roles:update:result") &&
                msg.requestId
            ) {
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
            } catch {
                notify?.error?.("WebSocket not connected", "Connection");
            }
        })();

        return () => unsub?.();
    }, [notify]);

    function resetAll() {
        setRoleName("");
        setPriority(1);
        setColor(randomHexNoHash());
        setSelectedPerms([]);
        setPermFilter("");
    }

    function validate() {
        if (!roleName.trim()) {
            notify?.warning?.("Role name is required.", "Missing required fields");
            return false;
        }

        const pr = clampInt(priority, 1, 999999);
        if (!pr) {
            notify?.warning?.("Priority must be a positive number.", "Invalid priority");
            return false;
        }

        if (!selectedPerms.length) {
            notify?.warning?.("Select at least 1 permission.", "Missing required fields");
            return false;
        }

        return true;
    }

    async function onSubmit(e) {
        e.preventDefault();
        if (!validate()) return;
        await performSubmit();
    }

    async function performSubmit() {
        if (!window.api?.wsSend) {
            notify?.error?.("API not available.", "Role");
            return;
        }

        setSaving(true);

        try {
            const requestId = rid();

            const resultPromise = new Promise((resolve) => {
                pending.current.set(requestId, resolve);
                setTimeout(() => {
                    if (pending.current.has(requestId)) {
                        pending.current.delete(requestId);
                        resolve({ ok: false, error: "timeout" });
                    }
                }, 8000);
            });

            const payloadBase = {
                name: roleName.trim(),
                permissions: selectedPerms.map(String),
                color: color,
                priority: clampInt(priority, 1, 999999),
                addedBy: account?.id || null,
            };

            if (!isEdit) {
                await window.api.wsSend({ type: "roles:create", requestId, payload: payloadBase });
            } else {
                await window.api.wsSend({
                    type: "roles:update",
                    requestId,
                    payload: { roleId: editingId, ...payloadBase },
                });
            }

            const result = await resultPromise;
            if (!result?.ok) {
                notify?.error?.(result?.error || "Failed to save role", "Role");
                return;
            }

            notify?.success?.(isEdit ? "Role updated." : "Role created.", "Role");

            onNavigate?.("roles:list");
            if (!isEdit) resetAll();
        } catch {
            notify?.error?.(isEdit ? "Failed to update role." : "Failed to create role.", "Role");
        } finally {
            setSaving(false);
        }
    }

    const filteredPermOptions = useMemo(() => {
        const q = (permFilter || "").trim().toLowerCase();
        if (!q) return permOptions;
        return permOptions.filter(
            (o) =>
                (o.label && String(o.label).toLowerCase().includes(q)) ||
                (o.value && String(o.value).toLowerCase().includes(q)) ||
                (o.category && String(o.category).toLowerCase().includes(q)) ||
                (o.description && String(o.description).toLowerCase().includes(q))
        );
    }, [permOptions, permFilter]);

    const permByCategory = useMemo(() => {
        const map = new Map();
        for (const opt of filteredPermOptions) {
            const cat = opt.category || "Other";
            if (!map.has(cat)) map.set(cat, []);
            map.get(cat).push(opt);
        }
        return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }, [filteredPermOptions]);

    function togglePermission(value) {
        const v = String(value).trim();
        if (!v) return;
        setSelectedPerms((prev) => {
            if (prev.includes(v)) return prev.filter((p) => p !== v);
            return [...prev, v];
        });
    }

    /** Give (add) all permissions in the current filter. */
    function giveAllFiltered() {
        const toAdd = filteredPermOptions.map((o) => o.value).filter((v) => !selectedPerms.includes(v));
        if (toAdd.length) setSelectedPerms((prev) => [...prev, ...toAdd]);
    }

    /** Retake (remove) all permissions in the current filter. */
    function retakeAllFiltered() {
        if (filteredPermOptions.length === 0) return;
        const set = new Set(filteredPermOptions.map((o) => o.value));
        setSelectedPerms((prev) => prev.filter((p) => !set.has(p)));
    }

    return (
        <div className="createRolePage">
            <header className="createRoleHeader">
                <div className="createRoleHeaderIcon">
                    <Shield size={24} />
                </div>
                <div className="createRoleHeaderText">
                    <h1 className="createRoleTitle">
                        {isEdit ? "Update Role" : "Create Role"}
                    </h1>
                    <p className="createRoleSubtitle">
                        {isEdit ? "Edit a role" : "Add a new role"}
                    </p>
                </div>
            </header>

            <main className="createRoleMain">
                <div className="createRoleContent">
                    <form className="rc-body" onSubmit={onSubmit}>
                        <section className="rc-card">
                            <div className="rc-sub_card sub_card-column">
                                <div className="rc-block row-block">
                            <div style={{ width: 250 }}>
                                <label>
                                    Role Name <span>*</span>
                                </label>
                                <input
                                    className="rc-input"
                                    value={roleName}
                                    onChange={(e) => setRoleName(e.target.value)}
                                    disabled={saving}
                                    {...inputProps}
                                />
                            </div>

                            <div style={{ width: 220, display: "flex", flexDirection: "column" }}>
                                <label>
                                    Priority <span>*</span>
                                </label>
                                <input
                                    className="rc-input"
                                    type="number"
                                    min={1}
                                    step={1}
                                    value={priority}
                                    onChange={(e) => setPriority(Number(e.target.value))}
                                    disabled={saving}
                                    {...inputProps}
                                />
                            </div>

                            <div style={{ width: 170 }}>
                                <label>
                                    Color <span>*</span>
                                </label>

                                <div className="rc-color-row">
                                    <ColorPicker
                                        value={color}
                                        onChange={(e) => setColor(e.value)}
                                        disabled={saving}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="rc-block rc-perms-row">
                            <div className="rc-perms-block">
                                <label className="rc-perms-label">
                                    Permissions <span className="rc-label-required" aria-hidden="true">*</span>
                                </label>
                                {loadingPerms ? (
                                    <div className="rc-perms-loading">Loading permissions…</div>
                                ) : (
                                    <>
                                        <div className="rc-perms-toolbar">
                                            <input
                                                type="text"
                                                className="rc-input rc-perms-filter"
                                                placeholder="Filter permissions…"
                                                value={permFilter}
                                                onChange={(e) => setPermFilter(e.target.value)}
                                                disabled={saving}
                                                {...inputProps}
                                            />
                                            <div className="rc-perms-actions">
                                                <button
                                                    type="button"
                                                    className="rc-btn rc-btn--sm rc-btn--ghost rc-perms-toolbar-btn"
                                                    onClick={giveAllFiltered}
                                                    disabled={saving || filteredPermOptions.length === 0}
                                                    title="Give all permissions (in current filter)"
                                                >
                                                    Give all
                                                </button>
                                                <button
                                                    type="button"
                                                    className="rc-btn rc-btn--sm rc-btn--ghost rc-perms-toolbar-btn"
                                                    onClick={retakeAllFiltered}
                                                    disabled={saving || filteredPermOptions.length === 0}
                                                    title="Retake all permissions (in current filter)"
                                                >
                                                    Retake all
                                                </button>
                                            </div>
                                        </div>
                                        <div className="rc-perms-list" role="group" aria-label="Permissions">
                                            {filteredPermOptions.length === 0 ? (
                                                <div className="rc-perms-empty">
                                                    {permFilter.trim() ? "No permissions match the filter." : "No permissions available."}
                                                </div>
                                            ) : (
                                                permByCategory.map(([category, opts]) => (
                                                    <div key={category} className="rc-perms-category">
                                                        <div className="rc-perms-category-title">{category}</div>
                                                        {opts.map((opt) => (
                                                            <label key={opt.value} className="rc-perm-item">
                                                                <span className="rc-checkbox-wrap">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={selectedPerms.includes(opt.value)}
                                                                        onChange={() => togglePermission(opt.value)}
                                                                        disabled={saving}
                                                                        className="rc-perm-checkbox"
                                                                    />
                                                                    <span className="rc-checkbox-box" aria-hidden="true" />
                                                                </span>
                                                                <span className="rc-perm-label">
                                                                    <span className="rc-perm-title">{opt.label || opt.value}</span>
                                                                    {opt.description && <span className="rc-perm-desc">{opt.description}</span>}
                                                                </span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                        {selectedPerms.length > 0 && (
                                            <div className="rc-perms-summary">
                                                {selectedPerms.length} permission{selectedPerms.length !== 1 ? "s" : ""} selected
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="rc-divider" role="separator" aria-hidden="true" />

                        <div className="rc-actions">
                            <button className="rc-btn rc-btn--sm" disabled={saving} type="submit">
                                {saving ? (isEdit ? "Updating..." : "Creating...") : isEdit ? "Update" : "Create Role"}
                            </button>

                            <button
                                className="rc-btn rc-btn--sm rc-btn--ghost"
                                type="button"
                                disabled={saving}
                                onClick={() => (isEdit ? onNavigate?.("roles:list") : resetAll())}
                            >
                                {isEdit ? "Cancel" : "Reset"}
                            </button>
                                </div>
                            </div>
                        </section>
                    </form>
                </div>
            </main>
        </div>
    );
}

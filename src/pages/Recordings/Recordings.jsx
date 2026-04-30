// Call recordings — standalone page styles; CDR clid + employee match from API
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mic, Play, Pause, Loader2, RefreshCw, ChevronLeft, ChevronRight, User, Trash2 } from "lucide-react";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";
import "tippy.js/animations/shift-away.css";
import DataTable from "../../components/ui/DataTable";
import PaginatorSelect from "../../components/ui/PaginatorSelect";
import Checkbox from "../../components/ui/Checkbox";
import ConfirmDeleteModal from "../../components/modals/ConfirmDeleteModal";
import RecordingsDashboard from "./RecordingsDashboard";
import { useNotification } from "../../components/NotificationProvider";
import { hasPermission } from "../../helpers/permissions";
import { useLanguage } from "../../contexts/LanguageContext";
import "../../styles/ui/data_table.css";
import "../../styles/ui/paginator_select.css";
import "../../styles/pages/recordings/recordings.css";

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

function rid() {
  return `rec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function defaultDateRangeStrings() {
  // Default to "all time" (no date filters) so full CDR history is visible.
  return { from: "", to: "" };
}

const buildPageModel = (page, totalPages) => {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  if (page <= 3) return [1, 2, 3, 4, "…", totalPages];
  if (page >= totalPages - 2) return [1, "…", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  return [1, "…", page - 1, page, page + 1, "…", totalPages];
};

function formatDate(d) {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, { dateStyle: "short", timeStyle: "medium" });
}

function formatDuration(totalSeconds) {
  const n = Math.max(0, Number(totalSeconds) || 0);
  if (n < 60) return `${n}s`;
  const minutes = Math.floor(n / 60);
  const seconds = n % 60;
  return `${minutes}m ${seconds}s`;
}

function normalizeItem(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    ...raw,
    uniqueid: String(raw.uniqueid ?? ""),
    calldate: raw.calldate,
    clid: raw.clid ?? null,
    callerDisplayName: raw.callerDisplayName ?? null,
    src: raw.src ?? "—",
    dst: raw.dst ?? "—",
    disposition: raw.disposition ?? "—",
    direction: raw.direction ?? "—",
    app: raw.app != null && String(raw.app).trim() !== "" ? String(raw.app).trim() : null,
    channel: raw.channel ?? null,
    dstchannel: raw.dstchannel ?? null,
    dcontext: raw.dcontext ?? null,
    duration: Number(raw.duration) || 0,
    billsec: Number(raw.billsec) || 0,
    hasRecording: Boolean(raw.hasRecording),
    matchFrom: raw.matchFrom && raw.matchFrom.id ? { id: String(raw.matchFrom.id), name: String(raw.matchFrom.name || "") } : null,
    matchTo: raw.matchTo && raw.matchTo.id ? { id: String(raw.matchTo.id), name: String(raw.matchTo.name || "") } : null,
  };
}

function shouldShowPlayForApp(app) {
  const a = String(app ?? "").trim().toLowerCase();
  if (a === "playback") return false;
  if (a === "dial") return true;
  return a === "";
}

function hasUsableRecording(row) {
  if (!row?.hasRecording) return false;
  const isAnswered = normalizeDispositionKey(row.disposition) === "ANSWERED";
  if (!isAnswered) return false;
  return shouldShowPlayForApp(row.app);
}

function rowInDateRange(calldate, fromStr, toStr) {
  if (!fromStr && !toStr) return true;
  const t = new Date(calldate).getTime();
  if (Number.isNaN(t)) return false;
  if (fromStr) {
    const ft = new Date(`${fromStr}T00:00:00`).getTime();
    if (t < ft) return false;
  }
  if (toStr) {
    const tt = new Date(`${toStr}T23:59:59.999`).getTime();
    if (t > tt) return false;
  }
  return true;
}

function rowMatchesListFilters(row, f) {
  if (f.recOnly && !hasUsableRecording(row)) return false;
  if (!rowInDateRange(row.calldate, f.dateFrom, f.dateTo)) return false;
  if (f.employeeIds.length > 0) {
    const id = row.matchFrom?.id;
    if (!id || !f.employeeIdSet.has(String(id))) return false;
  }
  return true;
}

function normalizeDispositionKey(disposition) {
  const s = String(disposition ?? "").trim();
  if (!s || s === "—") return "OTHER";
  return s.toUpperCase().replace(/\s+/g, "_");
}

function dispositionStyleVariant(disposition) {
  const k = normalizeDispositionKey(disposition);
  if (k === "ANSWERED") return "answered";
  if (k === "NO_ANSWER") return "noanswer";
  if (k === "BUSY" || k === "CONGESTION") return "busy";
  if (k === "FAILED" || k === "CANCEL") return "failed";
  if (k === "CHANUNAVAIL") return "unavail";
  return "other";
}

function titleCaseFallback(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "—";
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatDispositionLabel(t, disposition) {
  const key = `recordings.disposition.${normalizeDispositionKey(disposition)}`;
  const out = t(key);
  if (out !== key) return out;
  return titleCaseFallback(disposition);
}

function directionKind(direction) {
  const d = String(direction ?? "unknown").toLowerCase();
  if (d === "inbound" || d === "outbound" || d === "internal" || d === "unknown") return d;
  return "unknown";
}

function formatDirectionLabel(t, direction) {
  const kind = directionKind(direction);
  const key = `recordings.direction.${kind}`;
  const out = t(key);
  if (out !== key) return { label: out, kind };
  return { label: titleCaseFallback(direction), kind: "unknown" };
}

/**
 * Iraq mobile: national `07…` or international `964…` (optional leading `00` stripped).
 */
function telHrefFromParty(value) {
  const s = String(value ?? "").trim();
  if (!s || s === "—") return null;
  if (!/^[\d\s\-+().]+$/.test(s)) return null;
  let digits = s.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (!(digits.startsWith("964") || digits.startsWith("07"))) return null;
  return `tel:${digits}`;
}

function PartyLine({ value }) {
  const s = String(value ?? "");
  const href = telHrefFromParty(value);

  const onTelClick = (e) => {
    e.stopPropagation();
    if (!href) return;
    if (typeof window.api?.openExternal === "function") {
      e.preventDefault();
      void window.api.openExternal(href);
    }
  };

  if (href) {
    return (
      <a href={href} className="recTelLink" onClick={onTelClick}>
        <span className="recTelLinkText cell mono">{s}</span>
      </a>
    );
  }
  return <span className="cell mono">{s}</span>;
}

export default function Recordings({ account, onNavigate }) {
  const notify = useNotification();
  const { t } = useLanguage();
  const notifyRef = useRef(notify);
  const tRef = useRef(t);
  useEffect(() => {
    notifyRef.current = notify;
  }, [notify]);
  useEffect(() => {
    tRef.current = t;
  }, [t]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [sort, setSort] = useState({ key: "calldate", dir: "desc" });
  const [onlyWithRecording, setOnlyWithRecording] = useState(false);
  const initialRange = useMemo(() => defaultDateRangeStrings(), []);
  const [dateFrom, setDateFrom] = useState(initialRange.from);
  const [dateTo, setDateTo] = useState(initialRange.to);
  const [selectedFromEmployeeIds, setSelectedFromEmployeeIds] = useState([]);
  const [employeeOptions, setEmployeeOptions] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  /** Bumps on every successful analytics response so charts can remount and replay enter animation. */
  const [analyticsRevision, setAnalyticsRevision] = useState(0);
  const [listScanCapped, setListScanCapped] = useState(false);
  // Debounce list fetching when selecting employees to keep the UI snappy.
  const [employeeIdsForList, setEmployeeIdsForList] = useState([]);
  const employeeIdsForListRef = useRef(employeeIdsForList);
  const employeeIdsForListKey = useMemo(
    () => [...employeeIdsForList].map(String).sort().join(","),
    [employeeIdsForList]
  );
  const [playingId, setPlayingId] = useState(null);
  const [loadingAudioId, setLoadingAudioId] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [deleteModal, setDeleteModal] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const audioRef = useRef(null);
  const employeeCacheRef = useRef(new Map());
  const pageRef = useRef(page);
  const filtersRef = useRef({
    recOnly: false,
    dateFrom: "",
    dateTo: "",
    employeeIds: [],
    employeeIdSet: new Set(),
  });

  const canView = hasPermission(account, "calls.recordings");
  const canOpenEmployee = hasPermission(account, ["employees.view", "employees.create"]);
  const canPickEmployees = canOpenEmployee;

  const analyticsFetchIdRef = useRef(0);
  const listFetchTimeoutRef = useRef(null);

  useEffect(() => {
    employeeIdsForListRef.current = employeeIdsForList;
  }, [employeeIdsForList]);

  const columns = useMemo(
    () => [
      { key: "calldate", label: t("recordings.colDate"), sortable: true, width: "minmax(128px, 200px)" },
      { key: "src", label: t("recordings.colFrom"), sortable: true, width: "minmax(100px, 205px)" },
      { key: "dst", label: t("recordings.colTo"), sortable: true, width: "minmax(100px, 205px)" },
      { key: "direction", label: t("recordings.colDir"), sortable: true, width: "minmax(72px, 125px)", align: "center" },
      { key: "disposition", label: t("recordings.colStatus"), sortable: true, width: "minmax(88px, 125px)", align: "center" },
      { key: "duration", label: t("recordings.colDuration"), sortable: true, width: "minmax(72px, 110px)", align: "center" },
      { key: "action", label: t("recordings.colPlay"), sortable: false, width: "minmax(52px, 200px)", align: "center" }
    ],
    [t]
  );

  const stopAudioPlayback = useCallback(
    (targetUniqueId = null) => {
      const shouldStop =
        targetUniqueId == null ||
        targetUniqueId === playingId ||
        targetUniqueId === loadingAudioId;

      if (!shouldStop) return;

      const el = audioRef.current;
      if (el) {
        try {
          el.pause();
          el.removeAttribute("src");
          el.load();
        } catch {
          /* ignore */
        }
      }

      setPlayingId(null);
      setLoadingAudioId((current) => (targetUniqueId == null || current === targetUniqueId ? null : current));
      setAudioUrl(null);
      setAudioPlaying(false);
    },
    [loadingAudioId, playingId]
  );

  const fetchList = useCallback(async () => {
    if (!window.api?.callsList || !canView) return;
    setLoading(true);
    const ids = employeeIdsForListRef.current;
    const res = await window.api.callsList({
      page,
      limit: pageSize,
      hasRecording: onlyWithRecording ? true : undefined,
      from: dateFrom || undefined,
      to: dateTo || undefined,
      fromEmployeeIds:
        ids.length > 0 ? ids.join(",") : undefined,
    });
    setLoading(false);
    if (res?.ok && Array.isArray(res.items)) {
      const nextPages = Math.max(1, Number(res.pages) || 1);
      if (page > nextPages) {
        setPages(nextPages);
        setPage(nextPages);
        return;
      }
      setItems(res.items.map((x) => normalizeItem(x)).filter(Boolean));
      setTotal(Number(res.total) || 0);
      setPages(nextPages);
      setListScanCapped(Boolean(res.scanCapped));
    } else {
      setItems([]);
      setListScanCapped(false);
      if (res?.error === "forbidden") {
        notifyRef.current?.error?.(tRef.current("recordings.forbidden"), tRef.current("recordings.title"));
      } else {
        notifyRef.current?.error?.(res?.error || tRef.current("recordings.loadError"), tRef.current("recordings.title"));
      }
    }
  }, [canView, page, pageSize, onlyWithRecording, dateFrom, dateTo, employeeIdsForListKey]);

  const fetchAnalytics = useCallback(async () => {
    if (!window.api?.callsGetAnalytics || !canView) return;
    const fetchId = ++analyticsFetchIdRef.current;
    setAnalyticsLoading(true);
    /* Let React paint loading state so charts unmount; avoids batched no-op refresh with fast IPC. */
    await new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      });
    });
    const res = await window.api.callsGetAnalytics({
      from: dateFrom || undefined,
      to: dateTo || undefined,
      hasRecording: onlyWithRecording ? true : undefined,
    });
    if (fetchId !== analyticsFetchIdRef.current) return; // ignore out-of-order responses
    setAnalyticsLoading(false);
    if (res?.ok && res.data) {
      setAnalytics(res.data);
      setAnalyticsRevision((n) => n + 1);
    } else {
      setAnalytics(null);
      if (res?.error === "forbidden") {
        notifyRef.current?.error?.(tRef.current("recordings.forbidden"), tRef.current("recordings.title"));
      } else if (res?.error) {
        notifyRef.current?.error?.(res.error, tRef.current("recordings.title"));
      }
    }
  }, [canView, dateFrom, dateTo, onlyWithRecording]);

  const onDateRangeChange = useCallback((range) => {
    const from = range?.from ?? "";
    const to = range?.to ?? "";
    setDateFrom(from);
    setDateTo(to);
  }, []);

  pageRef.current = page;
  filtersRef.current = {
    recOnly: onlyWithRecording,
    dateFrom,
    dateTo,
    employeeIds: employeeIdsForListRef.current,
    employeeIdSet: new Set((employeeIdsForListRef.current || []).map(String)),
  };

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    fetchList();
  }, [canView, fetchList]);

  useEffect(() => {
    if (!canView) return;
    fetchAnalytics();
  }, [canView, fetchAnalytics]);

  // Reset to first page when filters that affect the list query change.
  useEffect(() => {
    setPage(1);
  }, [dateFrom, dateTo, onlyWithRecording, employeeIdsForListKey]);

  useEffect(() => {
    if (!canPickEmployees || !window.api?.wsSend || !window.api?.onWsMessage) return;
    const requestId = rid();
    const unsub = window.api.onWsMessage((msg) => {
      if (msg?.type !== "employees:list" || msg?.requestId !== requestId || !Array.isArray(msg.employees)) return;
      setEmployeeOptions(
        msg.employees
          .map((e) => ({
            _id: String(e?._id ?? e?.id ?? ""),
            name: e?.name || "—",
            phone: e?.phone ?? e?.mobile ?? e?.tel ?? "",
            photoUrl: e?.uploads?.employeePhotoUrl ?? e?.uploads?.employeePhoto ?? null,
          }))
          .filter((e) => e._id)
      );
    });
    try {
      window.api.wsSend({ type: "employees:list", requestId });
    } catch {
      /* ignore */
    }
    return () => unsub?.();
  }, [canPickEmployees]);

  const toggleFromEmployee = useCallback((id) => {
    const sid = String(id);
    setSelectedFromEmployeeIds((prev) => {
      const next = new Set(prev.map(String));
      if (next.has(sid)) next.delete(sid);
      else next.add(sid);
      return [...next];
    });
  }, []);

  const clearFromEmployees = useCallback(() => setSelectedFromEmployeeIds([]), []);

  // Debounce applying employee selection to the list query.
  useEffect(() => {
    if (listFetchTimeoutRef.current) {
      clearTimeout(listFetchTimeoutRef.current);
      listFetchTimeoutRef.current = null;
    }
    listFetchTimeoutRef.current = window.setTimeout(() => {
      employeeIdsForListRef.current = selectedFromEmployeeIds;
      setEmployeeIdsForList(selectedFromEmployeeIds);
    }, 200);
    return () => {
      if (listFetchTimeoutRef.current) {
        clearTimeout(listFetchTimeoutRef.current);
        listFetchTimeoutRef.current = null;
      }
    };
  }, [selectedFromEmployeeIds]);

  useEffect(() => {
    if (!Array.isArray(analytics?.fromMatchedEmployeeIds)) return;
    const ok = new Set(analytics.fromMatchedEmployeeIds.map(String));
    setSelectedFromEmployeeIds((prev) => prev.filter((id) => ok.has(String(id))));
  }, [analytics?.fromMatchedEmployeeIds]);

  const refreshAfterDelete = useCallback(() => {
    fetchAnalytics();
    fetchList();
  }, [fetchAnalytics, fetchList]);

  useEffect(() => {
    if (!canView || !window.api?.onWsMessage) return;
    const unsub = window.api.onWsMessage((msg) => {
      const currentPage = pageRef.current;
      const f = filtersRef.current;

      if (msg?.type === "call:new" && msg.data) {
        const row = normalizeItem(msg.data);
        if (!row) return;
        if (!rowMatchesListFilters(row, f)) return;
        setTotal((n) => n + 1);
        setItems((prev) => {
          if (currentPage !== 1) return prev;
          const next = [row, ...prev.filter((x) => x.uniqueid !== row.uniqueid)];
          return next.slice(0, pageSize);
        });
      }
      if (msg?.type === "call:updated" && msg.data) {
        const row = normalizeItem(msg.data);
        if (!row) return;
        if (!rowMatchesListFilters(row, f)) {
          setItems((prev) => prev.filter((x) => x.uniqueid !== row.uniqueid));
          setTotal((n) => Math.max(0, n - 1));
          return;
        }
        setItems((prev) => {
          const idx = prev.findIndex((x) => x.uniqueid === row.uniqueid);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = row;
            return copy;
          }
          if (currentPage === 1) {
            return [row, ...prev].filter((x, i, a) => a.findIndex((y) => y.uniqueid === x.uniqueid) === i).slice(0, pageSize);
          }
          return prev;
        });
      }
      if (msg?.type === "call:deleted" && msg?.uniqueid) {
        const deletedId = String(msg.uniqueid);
        stopAudioPlayback(deletedId);
        if (deleteModal?.uniqueid === deletedId) setDeleteModal(null);
        refreshAfterDelete();
      }
    });
    return () => unsub?.();
  }, [canView, deleteModal?.uniqueid, pageSize, refreshAfterDelete, stopAudioPlayback]);

  const sortedRows = useMemo(() => {
    const list = [...items];
    const { key, dir } = sort;
    const mul = dir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      if (key === "calldate") {
        const ta = new Date(a.calldate).getTime();
        const tb = new Date(b.calldate).getTime();
        return ((Number.isNaN(ta) ? 0 : ta) - (Number.isNaN(tb) ? 0 : tb)) * mul;
      }
      if (key === "duration" || key === "billsec") {
        return ((Number(a[key]) || 0) - (Number(b[key]) || 0)) * mul;
      }
      const sa = String(a[key] ?? "").toLowerCase();
      const sb = String(b[key] ?? "").toLowerCase();
      return sa.localeCompare(sb) * mul;
    });
    return list;
  }, [items, sort]);

  const onSort = useCallback((key) => {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }
    );
  }, []);

  const openEmployee = useCallback(
    async (match) => {
      if (!match?.id || !canOpenEmployee || !onNavigate) return;

      const targetId = String(match.id);
      const cached = employeeCacheRef.current.get(targetId);
      if (cached) {
        onNavigate("employees:profile", cached);
        return;
      }

      // Open quickly with minimum payload, then hydrate with full employee object.
      onNavigate("employees:profile", { _id: targetId, name: match.name });

      if (!window.api?.wsSend || !window.api?.onWsMessage) return;
      const requestId = `rec-emp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

      await new Promise((resolve) => {
        let settled = false;
        let unsub = null;
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          if (unsub) unsub();
          resolve();
        }, 3500);

        const finish = (employee) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          if (unsub) unsub();
          if (employee && employee._id) {
            employeeCacheRef.current.set(String(employee._id), employee);
            onNavigate("employees:profile", employee);
          }
          resolve();
        };

        unsub = window.api.onWsMessage((msg) => {
          if (msg?.type !== "employees:list" || msg?.requestId !== requestId || !Array.isArray(msg.employees)) return;
          const employee = msg.employees.find((e) => String(e?._id ?? e?.id ?? "") === targetId) || null;
          finish(employee);
        });

        try {
          window.api.wsSend({ type: "employees:list", requestId });
        } catch {
          finish(null);
        }
      });
    },
    [canOpenEmployee, onNavigate]
  );

  const handlePlay = useCallback(
    async (uniqueid) => {
      if (!uniqueid || !window.api?.callsGetAudio) return;
      if (loadingAudioId === uniqueid) return;

      if (playingId === uniqueid && audioUrl && audioRef.current) {
        if (audioPlaying) {
          audioRef.current.pause();
        } else {
          audioRef.current.play().catch(() => { });
        }
        return;
      }

      setLoadingAudioId(uniqueid);
      setPlayingId(null);
      setAudioUrl(null);
      setAudioPlaying(false);

      const res = await window.api.callsGetAudio(uniqueid);
      setLoadingAudioId(null);

      if (res?.ok && res.dataUrl) {
        setPlayingId(uniqueid);
        setAudioUrl(res.dataUrl);
      } else {
        notify?.error?.(
          res?.error === "not_found" ? t("recordings.audioMissing") : t("recordings.audioError"),
          t("recordings.title")
        );
      }
    },
    [loadingAudioId, playingId, audioUrl, audioPlaying, notify, t]
  );

  const handleDelete = useCallback(
    async (row) => {
      const uniqueid = String(row?.uniqueid ?? "");
      if (!uniqueid || !window.api?.callsDelete) return;

      setDeletingId(uniqueid);
      const res = await window.api.callsDelete(uniqueid);
      setDeletingId(null);

      if (res?.ok) {
        stopAudioPlayback(uniqueid);
        setDeleteModal(null);
        notify?.success?.(t("recordings.deleteSuccess"), t("recordings.title"));
        refreshAfterDelete();
        return;
      }

      notify?.error?.(
        res?.error === "not_found" ? t("recordings.deleteMissing") : (res?.error || t("recordings.deleteError")),
        t("recordings.title")
      );
    },
    [notify, refreshAfterDelete, stopAudioPlayback, t]
  );

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !audioUrl) return;
    el.load();
    el.play().catch(() => { });
  }, [audioUrl]);

  const totalPages = Math.max(1, pages || Math.ceil(total / pageSize) || 1);
  const pageModel = buildPageModel(page, totalPages);

  if (!canView) {
    return (
      <div className="recordingsPage">
        <header className="recordingsHeader">
          <div className="recordingsHeaderIcon">
            <Mic size={24} />
          </div>
          <div className="recordingsHeaderText">
            <h1 className="recordingsTitle">{t("recordings.title")}</h1>
            <p className="recordingsSubtitle">{t("recordings.noPermission")}</p>
          </div>
        </header>
      </div>
    );
  }

  return (
    <div className="recordingsPage">
      <header className="recordingsHeader">
        <div className="recordingsHeaderIcon">
          <Mic size={24} />
        </div>
        <div className="recordingsHeaderText">
          <h1 className="recordingsTitle">{t("recordings.title")}</h1>
          <p className="recordingsSubtitle">{t("recordings.subtitle")}</p>
        </div>
        <div className="recordingsHeaderExtras">
          <div className="recordingsFilterPill">
            <Checkbox checked={onlyWithRecording} onChange={setOnlyWithRecording}>
              {t("recordings.onlyWithRecording")}
            </Checkbox>
          </div>
          <Tippy content={t("recordings.refresh")} animation="shift-away" placement="bottom" delay={[200, 0]}>
            <button
              type="button"
              className="recordingsIconBtn"
              onClick={() => {
                // Apply the latest selection immediately so refresh reflects the UI.
                if (listFetchTimeoutRef.current) {
                  clearTimeout(listFetchTimeoutRef.current);
                  listFetchTimeoutRef.current = null;
                }
                employeeIdsForListRef.current = selectedFromEmployeeIds;
                setEmployeeIdsForList(selectedFromEmployeeIds);
                fetchList();
                fetchAnalytics();
              }}
            >
              <RefreshCw size={18} />
            </button>
          </Tippy>
        </div>
      </header>

      <main className="recordingsMain">
        <div className="recordingsContent">
          <section className="recordingsSection">
            <RecordingsDashboard
              t={t}
              dateRangeValue={{ from: dateFrom, to: dateTo }}
              onDateRangeChange={onDateRangeChange}
              employeeOptions={employeeOptions}
              selectedEmployeeIds={selectedFromEmployeeIds}
              onToggleEmployee={toggleFromEmployee}
              onClearEmployees={clearFromEmployees}
              canPickEmployees={canPickEmployees}
              analytics={analytics}
              analyticsRevision={analyticsRevision}
              analyticsLoading={analyticsLoading}
              listScanCapped={listScanCapped}
            />
            <div className="recordingsTableWrap">
              {audioUrl ? (
                <audio
                  ref={audioRef}
                  className="recordingsHiddenAudio"
                  src={audioUrl}
                  onPlay={() => setAudioPlaying(true)}
                  onPause={() => setAudioPlaying(false)}
                  onEnded={() => {
                    setPlayingId(null);
                    setAudioUrl(null);
                    setAudioPlaying(false);
                  }}
                />
              ) : null}

              <DataTable
                key={`rec-dt-${dateFrom}-${dateTo}-${onlyWithRecording}-${employeeIdsForListKey}-${page}-${pageSize}`}
                columns={columns}
                sortKey={sort.key}
                sortDir={sort.dir}
                onSort={onSort}
                loading={loading}
                rows={sortedRows}
                emptyText={t("recordings.empty")}
                getRowId={(row) => row.uniqueid}
                rowIdPrefix="recording-"
                disableVirtualization
                useAnimatedList={false}
                minWidth={920}
                renderRow={(row) => {
                  const isLoading = loadingAudioId === row.uniqueid;
                  const isActive = playingId === row.uniqueid && Boolean(audioUrl);
                  const showPause = isActive && !isLoading && audioPlaying;
                  const isDeleting = deletingId === row.uniqueid;
                  const dur = formatDuration(row.billsec != null ? row.billsec : row.duration);
                  const dispLabel = formatDispositionLabel(t, row.disposition);
                  const dispVar = dispositionStyleVariant(row.disposition);
                  const { label: dirLabel, kind: dirKind } = formatDirectionLabel(t, row.direction);
                  const showPlayControl = hasUsableRecording(row);

                  return (
                    <>
                      <div className="td">
                        <div className="cell">{formatDate(row.calldate)}</div>
                      </div>
                      <div className="td">
                        <div className="recPartyStack">
                          <PartyLine value={row.src} />
                          {canOpenEmployee && row.matchFrom ? (
                            <Tippy content={t("recordings.openEmployee", { name: row.matchFrom.name })} animation="shift-away" placement="top" delay={[200, 0]}>
                              <button type="button" className="recEmpChip" onClick={() => openEmployee(row.matchFrom)}>
                                <User size={12} strokeWidth={2.5} />
                                <span className="recEmpChip-label">{row.matchFrom.name}</span>
                              </button>
                            </Tippy>
                          ) : row.callerDisplayName || row.matchFrom?.name ? (
                            <div className="cell small muted">
                              {row.callerDisplayName || row.matchFrom.name}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <div className="td">
                        <div className="recPartyStack">
                          <PartyLine value={row.dst} />
                          {row.matchTo && canOpenEmployee ? (
                            <Tippy content={t("recordings.openEmployee", { name: row.matchTo.name })} animation="shift-away" placement="top" delay={[200, 0]}>
                              <button type="button" className="recEmpChip" onClick={() => openEmployee(row.matchTo)}>
                                <User size={12} strokeWidth={2.5} />
                                <span className="recEmpChip-label">{row.matchTo.name}</span>
                              </button>
                            </Tippy>
                          ) : null}
                        </div>
                      </div>
                      <div className="td">
                        <span className={`recDir recDir--${dirKind}`}>{dirLabel}</span>
                      </div>
                      <div className="td td-center">
                        <span className={`recDisp recDisp--${dispVar}`}>{dispLabel}</span>
                      </div>
                      <div className="td td-center">
                        <div className="cell">{dur}</div>
                      </div>
                      <div className="td actions td-center">
                        {showPlayControl ? (
                          <Tippy
                            content={showPause ? t("recordings.pause") : t("recordings.play")}
                            animation="shift-away"
                            placement="left"
                            delay={[200, 0]}
                          >
                            <button
                              type="button"
                              className={`recPlayBtn ${showPause ? "recPlayBtn--active" : ""} ${isLoading ? "recPlayBtn--loading" : ""}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePlay(row.uniqueid);
                              }}
                              disabled={isLoading}
                              aria-pressed={showPause}
                            >
                              <span className="recPlayBtn-inner">
                                {isLoading ? (
                                  <Loader2 size={18} className="recPlayBtn-spin" />
                                ) : showPause ? (
                                  <Pause size={18} strokeWidth={2.25} />
                                ) : (
                                  <Play size={18} strokeWidth={2.25} className="recPlayBtn-iconPlay" />
                                )}
                              </span>
                            </button>
                          </Tippy>
                        ) : (
                          <span className="recPlayBtn-empty"></span>
                        )}

                        <Tippy
                          content={t("recordings.delete")}
                          animation="shift-away"
                          placement="left"
                          delay={[200, 0]}
                        >
                          <button
                            type="button"
                            className={`recDeleteBtn ${isDeleting ? "recDeleteBtn--loading" : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteModal(row);
                            }}
                            disabled={isDeleting}
                            aria-label={t("recordings.delete")}
                          >
                            {isDeleting ? (
                              <Loader2 size={16} className="recPlayBtn-spin" />
                            ) : (
                              <Trash2 size={16} strokeWidth={2.2} />
                            )}
                          </button>
                        </Tippy>
                      </div>
                    </>
                  );
                }}
                footer={
                  <div className="recordingsFooter">
                    <div className="recordingsFooterLeft">
                      <div className="recordingsPerPage">
                        <PaginatorSelect
                          label={t("recordings.rows")}
                          value={pageSize}
                          onChange={(n) => {
                            setPageSize(n);
                            setPage(1);
                          }}
                          options={[10, 25, 50].map((n) => ({
                            value: n,
                            label: `${n} / page`,
                          }))}
                          openAbove
                        />
                      </div>
                    </div>
                    <div className="recordingsFooterMid">
                      <button
                        type="button"
                        className="recordingsPagerBtn"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => p - 1)}
                      >
                        <ChevronLeft size={16} />
                        {t("recordings.previous")}
                      </button>
                      <div className="recordingsPages">
                        {pageModel.map((p, idx) =>
                          p === "…" ? (
                            <span key={`dots-${idx}`} className="recordingsPagesDots">
                              …
                            </span>
                          ) : (
                            <button
                              key={p}
                              type="button"
                              className={`recordingsPageBtn ${p === page ? "active" : ""}`}
                              onClick={() => setPage(p)}
                            >
                              {p}
                            </button>
                          )
                        )}
                      </div>
                      <button
                        type="button"
                        className="recordingsPagerBtn"
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => clamp(p + 1, 1, totalPages))}
                      >
                        {t("recordings.next")}
                        <ChevronRight size={16} />
                      </button>
                    </div>
                    <div className="recordingsFooterRight">
                      <span className="recordingsMuted">
                        {total === 0
                          ? `0 ${t("recordings.results")}`
                          : t("recordings.showingRange", {
                            from: String((page - 1) * pageSize + 1),
                            to: String(Math.min(page * pageSize, total)),
                            total: String(total),
                          })}
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
        open={Boolean(deleteModal)}
        title={t("recordings.deleteTitle")}
        message={
          deleteModal
            ? t("recordings.deleteMessage", {
              from: deleteModal.src || "-",
              to: deleteModal.dst || "-",
              date: formatDate(deleteModal.calldate),
            })
            : ""
        }
        confirmText={deletingId === deleteModal?.uniqueid ? t("common.saving") : t("common.delete")}
        cancelText={t("common.cancel")}
        loading={deletingId === deleteModal?.uniqueid}
        onClose={() => {
          if (deletingId === deleteModal?.uniqueid) return;
          setDeleteModal(null);
        }}
        onConfirm={() => {
          if (deleteModal) handleDelete(deleteModal);
        }}
      />
    </div>
  );
}

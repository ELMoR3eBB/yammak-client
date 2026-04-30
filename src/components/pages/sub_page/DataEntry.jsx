import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Archive, CheckCircle2, ChevronDown, FileUp, Inbox, Loader2 } from "lucide-react";
import { useLanguage } from "../../../contexts/LanguageContext";
import { useNotification } from "../../NotificationProvider";
import SearchInput from "../../ui/SearchInput";
import { hasPermission } from "../../../helpers/permissions";
import "../../../styles/pages/dataentry/dataentry.css";

const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function formatMoney(v) {
  const n = Number(v || 0);
  if (Number.isNaN(n)) return "0";
  return n.toLocaleString();
}

export default function DataEntry({ account, defaultMode = "view" }) {
  const { t } = useLanguage();
  const notify = useNotification();
  const canCreate = hasPermission(account, ["dataentry.create", "dataentry.manage"]);
  const canView = hasPermission(account, ["dataentry.view", "dataentry.create", "dataentry.manage"]);
  const canManage = hasPermission(account, "dataentry.manage");

  const [mode, setMode] = useState(defaultMode === "create" ? "create" : "view");
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState("");
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [query, setQuery] = useState("");
  const [expandedItemKey, setExpandedItemKey] = useState("");
  const [uploading, setUploading] = useState(false);
  const [chosenFileName, setChosenFileName] = useState("");
  const [statusBusyId, setStatusBusyId] = useState("");

  const listReqRef = useRef("");
  const getReqRef = useRef("");
  const createReqRef = useRef("");
  const statusReqRef = useRef("");
  const fileInputRef = useRef(null);

  const mergeOrInsertEntry = useCallback((entry) => {
    if (!entry?.id) return;
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.id === entry.id);
      if (idx === -1) return [entry, ...prev];
      const next = [...prev];
      next[idx] = { ...next[idx], ...entry };
      return next;
    });
  }, []);

  const fetchList = useCallback(() => {
    if (!window.api?.wsSend || !canView) return;
    setLoading(true);
    const requestId = rid();
    listReqRef.current = requestId;
    window.api.wsSend({ type: "dataentry:list", requestId });
  }, [canView]);

  const fetchEntry = useCallback((entryId) => {
    if (!window.api?.wsSend || !entryId) return;
    const requestId = rid();
    getReqRef.current = requestId;
    window.api.wsSend({ type: "dataentry:get", requestId, payload: { entryId } });
  }, []);

  useEffect(() => {
    setMode(defaultMode === "create" ? "create" : "view");
  }, [defaultMode]);

  useEffect(() => {
    if (!window.api?.onWsMessage) return undefined;
    const unsub = window.api.onWsMessage((msg) => {
      if (msg?.type === "dataentry:list:result" && msg?.requestId === listReqRef.current) {
        setLoading(false);
        if (!msg.ok) {
          notify?.error?.(msg.error || t("dataEntry.loadListFailed"), t("dataEntry.title"));
          return;
        }
        const list = Array.isArray(msg.entries) ? msg.entries : [];
        setEntries(list);
        if (!selectedEntryId && list[0]?.id) setSelectedEntryId(list[0].id);
      }
      if (msg?.type === "dataentry:get:result" && msg?.requestId === getReqRef.current) {
        if (!msg.ok) {
          notify?.error?.(msg.error || t("dataEntry.loadDetailFailed"), t("dataEntry.title"));
          return;
        }
        setSelectedEntry(msg.entry || null);
      }
      if (msg?.type === "dataentry:create:result" && msg?.requestId === createReqRef.current) {
        setUploading(false);
        if (!msg.ok) {
          notify?.error?.(msg.error || t("dataEntry.uploadFailed"), t("dataEntry.title"));
          return;
        }
        notify?.success?.(t("dataEntry.uploadSuccess"), t("dataEntry.title"));
        if (msg.entry) {
          mergeOrInsertEntry(msg.entry);
          setSelectedEntryId(msg.entry.id);
          setMode("view");
        }
      }
      if (msg?.type === "dataentry:updateStatus:result" && msg?.requestId === statusReqRef.current) {
        setStatusBusyId("");
        if (!msg.ok) {
          notify?.error?.(msg.error || t("dataEntry.statusFailed"), t("dataEntry.title"));
          return;
        }
        if (msg.entry) {
          mergeOrInsertEntry(msg.entry);
          setSelectedEntry((prev) => (prev?.id === msg.entry.id ? { ...prev, ...msg.entry } : prev));
        }
      }
      if (msg?.type === "dataentry:created" && msg?.entry) {
        mergeOrInsertEntry(msg.entry);
      }
      if (msg?.type === "dataentry:updated" && msg?.entry) {
        mergeOrInsertEntry(msg.entry);
        setSelectedEntry((prev) => (prev?.id === msg.entry.id ? { ...prev, ...msg.entry } : prev));
      }
    });
    return () => unsub?.();
  }, [selectedEntryId, t, notify, mergeOrInsertEntry]);

  useEffect(() => {
    if (!canView || !window.api?.wsConnect) return;
    window.api.wsConnect().then(fetchList).catch(() => {});
  }, [canView, fetchList]);

  useEffect(() => {
    if (!selectedEntryId) return;
    fetchEntry(selectedEntryId);
    setExpandedItemKey("");
  }, [selectedEntryId, fetchEntry]);

  const groupedItems = useMemo(() => {
    if (!selectedEntry?.items) return [];
    const q = query.trim().toLowerCase();
    const byCategory = new Map();
    for (const item of selectedEntry.items) {
      const category = String(item?.category || t("dataEntry.uncategorized"));
      const name = String(item?.name || "");
      const description = String(item?.description || "");
      const hit =
        !q ||
        category.toLowerCase().includes(q) ||
        name.toLowerCase().includes(q) ||
        description.toLowerCase().includes(q);
      if (!hit) continue;
      if (!byCategory.has(category)) byCategory.set(category, []);
      byCategory.get(category).push(item);
    }
    return Array.from(byCategory.entries()).map(([category, items]) => ({ category, items }));
  }, [selectedEntry, query, t]);

  const onChooseFile = useCallback(async (event) => {
    if (!window.FileReader || !window.api?.wsSend) return;
    const file = event?.target?.files?.[0];
    if (!file) return;
    setChosenFileName(file.name);
    if (!/\.json$/i.test(file.name)) {
      notify?.warning?.(t("dataEntry.onlyJson"), t("dataEntry.title"));
      return;
    }
    try {
      const text = await file.text();
      setUploading(true);
      const requestId = rid();
      createReqRef.current = requestId;
      window.api.wsSend({
        type: "dataentry:create",
        requestId,
        payload: { jsonText: text, fileName: file.name },
      });
    } catch {
      setUploading(false);
      notify?.error?.(t("dataEntry.uploadFailed"), t("dataEntry.title"));
    } finally {
      setChosenFileName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [notify, t]);

  const updateStatus = useCallback((entryId, status) => {
    if (!window.api?.wsSend || !entryId) return;
    setStatusBusyId(entryId);
    const requestId = rid();
    statusReqRef.current = requestId;
    window.api.wsSend({
      type: "dataentry:updateStatus",
      requestId,
      payload: { entryId, status },
    });
  }, []);

  if (!canCreate && !canView) {
    return (
      <div className="dataEntryPage">
        <div className="dataEntryState">{t("settings.noPermission")}</div>
      </div>
    );
  }

  return (
    <div className={`dataEntryPage dataEntryPage--${mode}`}>
      <header className="dataEntryHeader">
        <div className="dataEntryHeaderIcon">
          {mode === "create" ? <FileUp size={24} /> : <Inbox size={24} />}
        </div>
        <div className="dataEntryHeaderText">
          <h1 className="dataEntryTitle">{t("dataEntry.title")}</h1>
          <p className="dataEntrySubtitle">
            {mode === "create" ? t("dataEntry.uploadHint") : t("dataEntry.stores")}
          </p>
        </div>
      </header>

      {mode === "create" && canCreate && (
        <main className="dataEntryMain">
        <section className="dataEntryUploadCard">
          <div className="dataEntryUploadIcon"><FileUp size={28} /></div>
          <h3>{t("dataEntry.uploadTitle")}</h3>
          <p>{t("dataEntry.uploadHint")}</p>
          <label className="dataEntryFileLabel">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={onChooseFile}
              disabled={uploading}
              className="dataEntryFileInput"
            />
            <span className="dataEntryFileLabelText">
              {chosenFileName || t("dataEntry.chooseFile")}
            </span>
          </label>
          {uploading && (
            <div className="dataEntryUploading">
              <Loader2 size={16} className="spin" />
              <span>{t("dataEntry.uploading")}</span>
            </div>
          )}
        </section>
        </main>
      )}

      {mode === "view" && canView && (
        <div className="dataEntryBody">
          <aside className="dataEntryStores">
            <div className="dataEntryStoreHeader">
              <span>{t("dataEntry.stores")}</span>
              <button type="button" onClick={fetchList} className="dataEntryRefresh">
                {t("dataEntry.refresh")}
              </button>
            </div>
            {loading ? (
              <div className="dataEntryState">{t("common.loading")}</div>
            ) : entries.length === 0 ? (
              <div className="dataEntryState">{t("dataEntry.noStores")}</div>
            ) : (
              <div className="dataEntryStoreList">
                {entries.map((entry, idx) => (
                  <button
                    key={entry.id}
                    type="button"
                    className={`dataEntryStoreItem ${selectedEntryId === entry.id ? "active" : ""}`}
                    onClick={() => setSelectedEntryId(entry.id)}
                    style={{ "--de-idx": idx }}
                  >
                    <span className="name">{entry.storeName}</span>
                    <span className={`status status-${entry.status || "active"}`}>{t(`dataEntry.status.${entry.status || "active"}`)}</span>
                  </button>
                ))}
              </div>
            )}
          </aside>

          <section className="dataEntryDetails">
            {!selectedEntry ? (
              <div className="dataEntryState">{t("dataEntry.selectStore")}</div>
            ) : (
              <>
                <div className="dataEntryDetailsHeader">
                  <div>
                    <h3>{selectedEntry.storeName}</h3>
                    <p>{selectedEntry.itemCount || 0} {t("dataEntry.items")}</p>
                  </div>
                  {canManage && (
                    <div className="dataEntryStatusActions">
                      <button
                        type="button"
                        className="statusBtn complete"
                        disabled={statusBusyId === selectedEntry.id}
                        onClick={() => updateStatus(selectedEntry.id, "completed")}
                      >
                        <CheckCircle2 size={14} />
                        {t("dataEntry.markCompleted")}
                      </button>
                      <button
                        type="button"
                        className="statusBtn archive"
                        disabled={statusBusyId === selectedEntry.id}
                        onClick={() => updateStatus(selectedEntry.id, "archived")}
                      >
                        <Archive size={14} />
                        {t("dataEntry.archive")}
                      </button>
                    </div>
                  )}
                </div>

                <SearchInput
                  value={query}
                  onChange={setQuery}
                  width="100%"
                  placeholder={t("dataEntry.searchPlaceholder")}
                />

                <div className="dataEntryCategoryList">
                  {groupedItems.length === 0 ? (
                    <div className="dataEntryState">{t("dataEntry.noMatches")}</div>
                  ) : groupedItems.map((group, groupIdx) => (
                    <div key={group.category} className="dataEntryCategory" style={{ "--de-idx": groupIdx }}>
                      <h4>{group.category}</h4>
                      <div className="dataEntryItems">
                        {group.items.map((item, idx) => {
                          const key = `${group.category}-${item.name}-${idx}`;
                          const open = expandedItemKey === key;
                          return (
                            <div key={key} className={`dataEntryItem ${open ? "open" : ""}`} style={{ "--de-idx": idx }}>
                              <button
                                type="button"
                                className="dataEntryItemHead"
                                onClick={() => setExpandedItemKey(open ? "" : key)}
                              >
                                <div>
                                  <strong>{item.name}</strong>
                                  <span>{formatMoney(item.price)} IQD</span>
                                </div>
                                <ChevronDown size={16} className={open ? "rot" : ""} />
                              </button>
                              <div className="dataEntryItemBody">
                                <p>{item.description || t("dataEntry.noDescription")}</p>
                                {Array.isArray(item.addonGroups) && item.addonGroups.length > 0 && (
                                  <div className="dataEntryAddons">
                                    {item.addonGroups.map((g, gIdx) => (
                                      <div key={`${key}-g-${gIdx}`} className="addonGroup">
                                        <div className="addonGroupTitle">
                                          <span>{g.name}</span>
                                          <small>{g.type === "single" ? t("dataEntry.singleSelect") : t("dataEntry.multiSelect")} - {t("dataEntry.min")}: {g.min ?? 0} / {t("dataEntry.max")}: {g.max ?? "-"}</small>
                                        </div>
                                        <ul>
                                          {(g.options || []).map((opt, oIdx) => (
                                            <li key={`${key}-o-${oIdx}`}>
                                              <span>{opt.name}</span>
                                              <span>{formatMoney(opt.price)} IQD</span>
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

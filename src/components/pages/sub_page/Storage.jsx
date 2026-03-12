// Storage — company clothes for drivers. Permissions: storage.view, storage.manage
import React, { useCallback, useEffect, useMemo, useState, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { Package, Plus, ArrowUpCircle, ArrowDownCircle, Trash2, X, Layers, Box, TrendingUp, RefreshCw } from "lucide-react";
import { useNotification } from "../../NotificationProvider";
import { hasPermission } from "../../../helpers/permissions";
import { useLanguage } from "../../../contexts/LanguageContext";
import { useAnimatedNumber } from "../../../hooks/useAnimatedNumber";
import "../../../styles/pages/storage/storage.css";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const LOW_STOCK_THRESHOLD = 5;
const GOOD_STOCK_THRESHOLD = 15;

function formatDate(d) {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

function getStockLevel(quantity) {
  const q = quantity ?? 0;
  if (q <= 0) return "out";
  if (q <= LOW_STOCK_THRESHOLD) return "low";
  return "good";
}

function formatDayLabel(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T12:00:00");
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const StorageItemCard = memo(function StorageItemCard({
  item,
  canManage,
  onAdd,
  onDecrease,
  onReplace,
  onDelete,
  isDeleting,
  t,
}) {
  const quantity = item.quantity ?? 0;
  const animatedQuantity = useAnimatedNumber(quantity, `storage-item-qty-${item.id}`, 450);
  const level = getStockLevel(quantity);
  const stockLabel =
    level === "out"
      ? t("storage.stockOut")
      : level === "low"
        ? t("storage.stockLow")
        : t("storage.stockGood");
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
      transition={{ duration: 0.25 }}
      className={`storageCard storageCard--${level}`}
    >
      <div className="storageCardLeft">
        <div className="storageCardIconWrap">
          <Package size={24} className="storageCardIcon" />
        </div>
        <div className="storageCardInfo">
          <span className="storageCardName">{item.name || "—"}</span>
          <div className="storageCardMeta">
            <span className={`storageCardStock storageCardStock--${level}`}>{stockLabel}</span>
            {(item.brokenCount ?? 0) > 0 && (
              <span className="storageCardBroken">
                {t("storage.replacedCount").replace("{{count}}", String(item.brokenCount ?? 0))}
              </span>
            )}
            <span className="storageCardUpdated">
              {t("storage.lastUpdated")}: {formatDate(item.updatedAt)}
            </span>
          </div>
          <div className="storageCardBarWrap">
            <div
              className={`storageCardBar storageCardBar--${level}`}
              style={{
                width: `${Math.min(100, (quantity / (GOOD_STOCK_THRESHOLD + 10)) * 100)}%`,
              }}
            />
          </div>
        </div>
      </div>
      <div className="storageCardRight">
        <div className="storageCardQuantityWrap">
          <span className="storageCardQuantity">
            {Math.round(animatedQuantity).toLocaleString()}
          </span>
          <span className="storageCardUnits">{t("storage.units")}</span>
        </div>
        {canManage && (
          <div className="storageCardActions">
            <button
              type="button"
              className="storageCardBtn"
              onClick={() => onAdd(item)}
              title={t("storage.addQuantity")}
            >
              <ArrowUpCircle size={18} />
              {t("storage.add")}
            </button>
            <button
              type="button"
              className="storageCardBtn"
              onClick={() => onDecrease(item)}
              disabled={quantity <= 0}
              title={t("storage.decreaseQuantity")}
            >
              <ArrowDownCircle size={18} />
              {t("storage.decrease")}
            </button>
            <button
              type="button"
              className="storageCardBtn storageCardBtn--replace"
              onClick={() => onReplace(item)}
              disabled={quantity <= 0}
              title={t("storage.replaceQuantity")}
            >
              <RefreshCw size={18} />
              {t("storage.replace")}
            </button>
            <button
              type="button"
              className="storageCardBtn storageCardBtn--danger"
              onClick={() => onDelete(item)}
              disabled={isDeleting}
              title={t("common.delete")}
            >
              <Trash2 size={18} />
              {t("common.delete")}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
});

export default function Storage({ account }) {
  const { t } = useLanguage();
  const notify = useNotification();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addQuantity, setAddQuantity] = useState("");
  const [adding, setAdding] = useState(false);
  const [adjustModal, setAdjustModal] = useState(null); // { id, name, type: "add"|"decrease"|"replace", quantity }
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [deleteModal, setDeleteModal] = useState(null); // { id, name }
  const [deletingId, setDeletingId] = useState(null);
  const [dailyDays, setDailyDays] = useState([]); // { date, added, decreased }[]
  const [chartLoading, setChartLoading] = useState(false);

  const canView = hasPermission(account, "storage.view");
  const canManage = hasPermission(account, "storage.manage");

  const summary = useMemo(() => {
    const count = items.length;
    const total = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
    return { count, total };
  }, [items]);

  const animatedCount = useAnimatedNumber(summary.count, "storage-summary-count", 500);
  const animatedTotal = useAnimatedNumber(summary.total, "storage-summary-total", 500);

  const openAddModal = useCallback((item) => {
    setAdjustModal({ id: item.id, name: item.name, type: "add", quantity: item.quantity });
  }, []);
  const openDecreaseModal = useCallback((item) => {
    setAdjustModal({ id: item.id, name: item.name, type: "decrease", quantity: item.quantity });
  }, []);
  const openReplaceModal = useCallback((item) => {
    setAdjustModal({ id: item.id, name: item.name, type: "replace", quantity: item.quantity });
  }, []);
  const openDeleteModal = useCallback((item) => {
    setDeleteModal({ id: item.id, name: item.name });
  }, []);

  const fetchList = useCallback(async () => {
    if (!window.api?.storageList) return;
    setLoading(true);
    const res = await window.api.storageList();
    setLoading(false);
    if (res?.ok && Array.isArray(res.items)) setItems(res.items);
    else if (res?.error === "forbidden") setItems([]);
  }, []);

  const fetchListSilent = useCallback(async () => {
    if (!window.api?.storageList) return;
    const res = await window.api.storageList();
    if (res?.ok && Array.isArray(res.items)) setItems(res.items);
    else if (res?.error === "forbidden") setItems([]);
  }, []);

  const fetchDailySummary = useCallback(async () => {
    if (!window.api?.storageDailySummary) return;
    setChartLoading(true);
    const res = await window.api.storageDailySummary(14);
    setChartLoading(false);
    if (res?.ok && Array.isArray(res.days)) setDailyDays(res.days);
    else setDailyDays([]);
  }, []);

  const fetchDailySummarySilent = useCallback(async () => {
    if (!window.api?.storageDailySummary) return;
    const res = await window.api.storageDailySummary(14);
    if (res?.ok && Array.isArray(res.days)) setDailyDays(res.days);
  }, []);

  useEffect(() => {
    if (canView || canManage) {
      fetchList();
      fetchDailySummary();
    } else setLoading(false);
  }, [canView, canManage, fetchList, fetchDailySummary]);

  const handleCreate = useCallback(async () => {
    const name = (addName || "").trim();
    const qty = Math.max(0, parseInt(addQuantity, 10) || 0);
    if (!name) {
      notify?.error?.(t("storage.nameRequired"), t("storage.title"));
      return;
    }
    if (!window.api?.storageCreate) return;
    setAdding(true);
    const res = await window.api.storageCreate({ name, quantity: qty });
    setAdding(false);
    if (res?.ok && res.item) {
      notify?.success?.(t("storage.itemCreated"), t("storage.title"));
      setAddModalOpen(false);
      setAddName("");
      setAddQuantity("");
      setItems((prev) =>
        [...prev, { ...res.item, brokenCount: res.item.brokenCount ?? 0 }].sort((a, b) =>
          (a.name || "").localeCompare(b.name || "")
        )
      );
      fetchDailySummarySilent();
    } else {
      notify?.error?.(res?.error || t("storage.createFailed"), t("storage.title"));
    }
  }, [addName, addQuantity, notify, fetchDailySummarySilent, t]);

  const handleAdjust = useCallback(async () => {
    if (!adjustModal?.id || !window.api?.storageAdjust) return;
    const amount = Math.max(0, parseInt(adjustAmount, 10) || 0);
    if (amount <= 0) {
      notify?.error?.(t("storage.amountPositive"), t("storage.title"));
      return;
    }
    const needsStock = adjustModal.type === "decrease" || adjustModal.type === "replace";
    if (needsStock && (items.find((i) => i.id === adjustModal.id)?.quantity ?? 0) < amount) {
      notify?.error?.(t("storage.insufficientQuantity"), t("storage.title"));
      return;
    }
    setAdjusting(true);
    const res = await window.api.storageAdjust({
      id: adjustModal.id,
      type: adjustModal.type,
      amount,
    });
    setAdjusting(false);
    if (res?.ok && res.item) {
      const msg =
        adjustModal.type === "add"
          ? t("storage.addedSuccess")
          : adjustModal.type === "replace"
            ? t("storage.replaceSuccess")
            : t("storage.decreasedSuccess");
      notify?.success?.(msg, t("storage.title"));
      setAdjustModal(null);
      setAdjustAmount("");
      const updated = res.item;
      setItems((prev) =>
        prev.map((i) =>
          i.id === updated.id
            ? {
                ...i,
                quantity: updated.quantity,
                brokenCount: updated.brokenCount ?? i.brokenCount ?? 0,
                updatedAt: updated.updatedAt,
              }
            : i
        )
      );
      fetchDailySummarySilent();
    } else {
      notify?.error?.(res?.error || t("storage.adjustFailed"), t("storage.title"));
    }
  }, [adjustModal, adjustAmount, items, notify, fetchDailySummarySilent, t]);

  const handleDelete = useCallback(async () => {
    if (!deleteModal?.id || !window.api?.storageDelete) return;
    setDeletingId(deleteModal.id);
    const res = await window.api.storageDelete(deleteModal.id);
    setDeletingId(null);
    setDeleteModal(null);
    if (res?.ok) {
      notify?.success?.(t("storage.itemDeleted"), t("storage.title"));
      setItems((prev) => prev.filter((i) => i.id !== deleteModal.id));
      fetchDailySummarySilent();
    } else {
      notify?.error?.(res?.error || t("storage.deleteFailed"), t("storage.title"));
    }
  }, [deleteModal, notify, fetchDailySummarySilent, t]);

  if (!canView && !canManage) {
    return (
      <div className="storagePage">
        <header className="storageHeader">
          <div className="storageHeaderIcon">
            <Package size={24} />
          </div>
          <div className="storageHeaderText">
            <h1 className="storageTitle">{t("storage.title")}</h1>
            <p className="storageSubtitle">{t("storage.noPermission")}</p>
          </div>
        </header>
      </div>
    );
  }

  return (
    <div className="storagePage">
      <header className="storageHeader">
        <div className="storageHeaderIcon">
          <Package size={24} />
        </div>
        <div className="storageHeaderText">
          <h1 className="storageTitle">{t("storage.title")}</h1>
          <p className="storageSubtitle">{t("storage.subtitle")}</p>
        </div>
        {canManage && (
          <button
            type="button"
            className="storageAddBtn"
            onClick={() => {
              setAddModalOpen(true);
              setAddName("");
              setAddQuantity("");
            }}
          >
            <Plus size={18} />
            {t("storage.addItem")}
          </button>
        )}
      </header>

      <main className="storageMain">
        {loading ? (
          <div className="storageLoading">
            <div className="storageSpinner" aria-hidden />
            <p>{t("common.loading")}</p>
          </div>
        ) : (
          <>
            <motion.section
              className="storageChartBlock"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="storageChartHeader">
                <TrendingUp size={20} className="storageChartHeaderIcon" />
                <h2 className="storageChartTitle">{t("storage.flowByDay")}</h2>
              </div>
              {chartLoading ? (
                <div className="storageChartPlaceholder">
                  <div className="storageSpinner" aria-hidden />
                  <p>{t("common.loading")}</p>
                </div>
              ) : dailyDays.length === 0 ? (
                <p className="storageChartNoData">{t("storage.chartNoData")}</p>
              ) : (
                <div className="storageChartWrap">
                  <Bar
                      data={{
                        labels: dailyDays.map((d) => formatDayLabel(d.date)),
                        datasets: [
                          {
                            label: t("storage.chartReceived"),
                            data: dailyDays.map((d) => d.added ?? 0),
                            backgroundColor: "rgba(34, 197, 94, 0.7)",
                            borderColor: "rgba(34, 197, 94, 1)",
                            borderWidth: 1,
                          },
                          {
                            label: t("storage.chartDecreased"),
                            data: dailyDays.map((d) => d.decreased ?? 0),
                            backgroundColor: "rgba(239, 68, 68, 0.7)",
                            borderColor: "rgba(239, 68, 68, 1)",
                            borderWidth: 1,
                          },
                          {
                            label: t("storage.chartReplaced"),
                            data: dailyDays.map((d) => d.replaced ?? 0),
                            backgroundColor: "rgba(245, 158, 11, 0.7)",
                            borderColor: "rgba(245, 158, 11, 1)",
                            borderWidth: 1,
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { position: "top" },
                          tooltip: { mode: "index", intersect: false },
                        },
                        scales: {
                          x: {
                            grid: { display: false },
                            ticks: { maxRotation: 45, font: { size: 11 } },
                          },
                          y: {
                            beginAtZero: true,
                            ticks: { stepSize: 1 },
                            grid: { color: "rgba(255,255,255,0.06)" },
                          },
                        },
                      }}
                    />
                </div>
              )}
            </motion.section>

            {items.length === 0 ? (
              <div className="storageEmpty">
                <Package size={48} className="storageEmptyIcon" />
                <p>{t("storage.empty")}</p>
                {canManage && (
                  <button type="button" className="storageEmptyAdd" onClick={() => setAddModalOpen(true)}>
                    {t("storage.addFirstItem")}
                  </button>
                )}
              </div>
            ) : (
              <>
                <motion.section
                  className="storageSummary"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="storageSummaryCard">
                    <div className="storageSummaryIconWrap">
                      <Layers size={22} />
                    </div>
                    <div className="storageSummaryText">
                      <span className="storageSummaryValue">{animatedCount.toLocaleString()}</span>
                      <span className="storageSummaryLabel">
                        {t("storage.summaryItems").replace("{{count}}", String(summary.count))}
                      </span>
                    </div>
                  </div>
                  <div className="storageSummaryCard">
                    <div className="storageSummaryIconWrap storageSummaryIconWrap--total">
                      <Box size={22} />
                    </div>
                    <div className="storageSummaryText">
                      <span className="storageSummaryValue">{animatedTotal.toLocaleString()}</span>
                      <span className="storageSummaryLabel">
                        {t("storage.summaryTotal").replace("{{total}}", summary.total.toLocaleString())}
                      </span>
                    </div>
                  </div>
                </motion.section>
                <div className="storageList">
                  <AnimatePresence initial={false}>
                    {items.map((item) => (
                      <StorageItemCard
                        key={item.id}
                        item={item}
                        canManage={canManage}
                        onAdd={openAddModal}
                        onDecrease={openDecreaseModal}
                        onReplace={openReplaceModal}
                        onDelete={openDeleteModal}
                        isDeleting={deletingId === item.id}
                        t={t}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </>
            )}
          </>
        )}
      </main>

      {/* Add item modal */}
      <AnimatePresence>
        {addModalOpen && (
          <motion.div
            key="add-modal"
            className="storageBackdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="storage-add-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.target === e.currentTarget && setAddModalOpen(false)}
          >
            <motion.div
              className="storageModal"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
            >
              <header className="storageModalHeader">
                <h2 id="storage-add-title">{t("storage.addItem")}</h2>
                <button type="button" className="storageModalClose" onClick={() => setAddModalOpen(false)}>
                  <X size={18} />
                </button>
              </header>
              <div className="storageModalBody">
                <label className="storageModalLabel">{t("storage.itemName")}</label>
                <input
                  type="text"
                  className="storageModalInput"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder={t("storage.itemNamePlaceholder")}
                />
                <label className="storageModalLabel">{t("storage.initialQuantity")}</label>
                <input
                  type="number"
                  min={0}
                  className="storageModalInput"
                  value={addQuantity}
                  onChange={(e) => setAddQuantity(e.target.value)}
                  placeholder="0"
                />
                <div className="storageModalFooter">
                  <button type="button" className="storageModalBtn" onClick={() => setAddModalOpen(false)}>
                    {t("common.cancel")}
                  </button>
                  <button
                    type="button"
                    className="storageModalBtn storageModalBtn--primary"
                    onClick={handleCreate}
                    disabled={adding}
                  >
                    {adding ? t("common.saving") : t("common.save")}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {adjustModal && (
          <motion.div
            key="adjust-modal"
            className="storageBackdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="storage-adjust-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.target === e.currentTarget && setAdjustModal(null)}
          >
            <motion.div
              className="storageModal"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
            >
              <header className="storageModalHeader">
                <h2 id="storage-adjust-title">
                  {adjustModal.type === "add"
                    ? t("storage.addQuantity")
                    : adjustModal.type === "replace"
                      ? t("storage.replaceQuantity")
                      : t("storage.decreaseQuantity")}{" "}
                  — {adjustModal.name}
                </h2>
                <button type="button" className="storageModalClose" onClick={() => setAdjustModal(null)}>
                  <X size={18} />
                </button>
              </header>
              <div className="storageModalBody">
                {adjustModal.type === "replace" && (
                  <p className="storageReplaceHint">{t("storage.replaceHint")}</p>
                )}
                <p className="storageDeleteMessage" style={{ marginBottom: 12 }}>
                  {t("storage.currentQuantity")}: <strong>{adjustModal.quantity ?? 0}</strong>
                </p>
                <label className="storageModalLabel">{t("storage.amount")}</label>
                <input
                  type="number"
                  min={1}
                  className="storageModalInput"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  placeholder="0"
                />
                <div className="storageModalFooter">
                  <button type="button" className="storageModalBtn" onClick={() => setAdjustModal(null)}>
                    {t("common.cancel")}
                  </button>
                  <button
                    type="button"
                    className="storageModalBtn storageModalBtn--primary"
                    onClick={handleAdjust}
                    disabled={adjusting}
                  >
                    {adjusting ? t("common.saving") : t("common.save")}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteModal && (
          <motion.div
            key="delete-modal"
            className="storageBackdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="storage-delete-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.target === e.currentTarget && setDeleteModal(null)}
          >
            <motion.div
              className="storageModal"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
            >
              <header className="storageModalHeader">
                <h2 id="storage-delete-title">{t("storage.deleteItem")}</h2>
                <button type="button" className="storageModalClose" onClick={() => setDeleteModal(null)}>
                  <X size={18} />
                </button>
              </header>
              <div className="storageModalBody">
                <p className="storageDeleteMessage">
                  {t("storage.deleteConfirm")} <strong>"{deleteModal.name}"</strong>?
                </p>
                <div className="storageModalFooter">
                  <button type="button" className="storageModalBtn" onClick={() => setDeleteModal(null)}>
                    {t("common.cancel")}
                  </button>
                  <button
                    type="button"
                    className="storageModalBtn storageModalBtn--danger"
                    onClick={handleDelete}
                    disabled={deletingId === deleteModal.id}
                  >
                    {deletingId === deleteModal.id ? t("common.saving") : t("common.delete")}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

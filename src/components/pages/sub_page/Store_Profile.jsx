import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDownToLine, ArrowLeft, Calendar, Clock, Percent, Phone, SquarePen, Store, TrendingUp, Wallet, X, AlertCircle } from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";
import "tippy.js/animations/shift-away.css";
import DateRangePicker from "../../ui/DateRangePicker";
import { useNotification } from "../../NotificationProvider";
import { hasPermission } from "../../../helpers/permissions";
import { getAssetUrl } from "../../../utils/publicUrl";
import "../../../styles/pages/audit/audit_logs.css";
import "../../../styles/pages/stores/store_profile.css";
import "../../../styles/ui/date_range_picker.css";
import ViolationsPopout from "../../violations/ViolationsPopout.jsx";
import "../../../styles/pages/violations/violations_popout.css";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

function formatNum(n) {
  if (n == null || Number.isNaN(Number(n))) return "-";
  return Number(n).toLocaleString();
}

function formatDate(d) {
  if (!d) return "-";
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? "-" : x.toLocaleDateString(undefined, { dateStyle: "medium" });
}

function formatLastUpdated(d) {
  if (!d) return "-";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "-";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffM = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);
  if (diffM < 1) return "Just now";
  if (diffM < 60) return `${diffM}m ago`;
  if (diffH < 24) return `${diffH}h ${diffM % 60}m ago`;
  if (diffD < 7) return `${diffD}d ago`;
  return formatDate(d);
}

function telHref(phone) {
  if (!phone || typeof phone !== "string") return null;
  const cleaned = phone.replace(/\s/g, "").replace(/[^\d+]/g, "");
  return cleaned.length > 0 ? `tel:${cleaned}` : null;
}

function toNumOrNull(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

const PRESETS = [
  { id: "7d", label: "7 days" },
  { id: "15d", label: "15 days" },
  { id: "30d", label: "30 days" },
  { id: "custom", label: "Custom" },
];

function valueOrDash(v) {
  const s = v == null ? "" : String(v).trim();
  return s || "-";
}

export default function StoreProfile({ store, account, onNavigate }) {
  const notify = useNotification();
  const [preset, setPreset] = useState("30d");
  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");
  const [snapshots, setSnapshots] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editExiting, setEditExiting] = useState(false);
  const [currentStore, setCurrentStore] = useState(store || null);
  const [violationsOpen, setViolationsOpen] = useState(false);
  const requestIdRef = useRef(null);
  const saveRequestIdRef = useRef(null);

  const [form, setForm] = useState({
    storeType: "",
    companyCommission: "",
    simCardIncluded: false,
    simCardNumber: "",
    simCardMonthlyPrice: "",
    posIncluded: false,
    posTotalAmount: "",
    posMonthlyInstallment: "",
  });

  useEffect(() => {
    setCurrentStore(store || null);
  }, [store]);

  useEffect(() => {
    setForm({
      storeType: currentStore?.storeType || "",
      companyCommission: currentStore?.companyCommission == null ? "" : String(currentStore.companyCommission),
      simCardIncluded: currentStore?.simCardIncluded === true,
      simCardNumber: currentStore?.simCardNumber || "",
      simCardMonthlyPrice: currentStore?.simCardMonthlyPrice == null ? "" : String(currentStore.simCardMonthlyPrice),
      posIncluded: currentStore?.posIncluded === true,
      posTotalAmount: currentStore?.posTotalAmount == null ? "" : String(currentStore.posTotalAmount),
      posMonthlyInstallment: currentStore?.posMonthlyInstallment == null ? "" : String(currentStore.posMonthlyInstallment),
    });
  }, [currentStore?._id, currentStore?.id, currentStore?.storeType, currentStore?.companyCommission, currentStore?.simCardIncluded, currentStore?.simCardNumber, currentStore?.simCardMonthlyPrice, currentStore?.posIncluded, currentStore?.posTotalAmount, currentStore?.posMonthlyInstallment]);

  const { fromDate, toDate } = useMemo(() => {
    const now = new Date();
    const to = endOfDay(now);
    let from;
    if (preset === "7d") {
      from = startOfDay(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000));
    } else if (preset === "15d") {
      from = startOfDay(new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000));
    } else if (preset === "30d") {
      from = startOfDay(new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000));
    } else {
      const f = fromInput ? new Date(fromInput) : null;
      const t = toInput ? new Date(toInput) : null;
      if (f && !Number.isNaN(f.getTime()) && t && !Number.isNaN(t.getTime())) {
        from = startOfDay(f);
        return { fromDate: from, toDate: endOfDay(t) };
      }
      from = startOfDay(new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000));
    }
    return { fromDate: from, toDate: to };
  }, [preset, fromInput, toInput]);

  const storeId = currentStore?.id ?? (currentStore?._id ? String(currentStore._id) : null);
  const canManageViolations = hasPermission(account, ["violations.manage", "cashout.manage", "cashout.viewAll"]);

  const fetchHistory = useCallback(() => {
    if (!storeId || !window.api?.wsSend) return;
    setHistoryLoading(true);
    requestIdRef.current = Math.random().toString(36).slice(2) + Date.now();
    window.api.wsSend({
      type: "stores:history",
      requestId: requestIdRef.current,
      payload: {
        storeId,
        fromDate: fromDate.toISOString(),
        toDate: toDate.toISOString(),
      },
    });
  }, [storeId, fromDate, toDate]);

  useEffect(() => {
    if (!window.api) return;
    const unsub = window.api.onWsMessage((msg) => {
      if (msg?.type === "stores:history" && msg?.requestId === requestIdRef.current) {
        setSnapshots(Array.isArray(msg.snapshots) ? msg.snapshots : []);
        setHistoryLoading(false);
      }
      if (msg?.type === "stores:update:result" && msg?.requestId === saveRequestIdRef.current) {
        setSaving(false);
        if (msg.ok) {
          if (msg.store) setCurrentStore(msg.store);
          notify?.success?.("Store profile updated.", "Stores");
          setEditExiting(true);
          setTimeout(() => {
            setEditOpen(false);
            setEditExiting(false);
          }, 280);
        } else {
          notify?.error?.(msg.error || "Failed to update store profile", "Stores");
        }
      }
    });
    return unsub;
  }, [notify]);

  useEffect(() => {
    if (storeId) fetchHistory();
    else setHistoryLoading(false);
  }, [storeId, fetchHistory]);

  const dailyRevenue = useMemo(() => {
    const list = [...(snapshots || [])].sort(
      (a, b) => new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime()
    );
    const daily = [];
    let revenueInPeriod = 0;
    let lastBalance = 0;

    for (let i = 0; i < list.length; i++) {
      const curr = list[i];
      const prev = i > 0 ? list[i - 1] : null;
      const dayRevenue = prev
        ? (Number(curr.totalEarning) || 0) - (Number(prev.totalEarning) || 0)
        : Number(curr.totalEarning) || 0;
      revenueInPeriod += dayRevenue;
      lastBalance = Number(curr.balance) || 0;
      const d = new Date(curr.lastUpdated);
      daily.push({
        label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        revenue: dayRevenue,
      });
    }

    return {
      daily,
      revenueInPeriod,
      lastBalance,
      totalWithdrawn: Number(list[list.length - 1]?.totalWithdrawn) || 0,
    };
  }, [snapshots]);

  const chartData = useMemo(
    () => ({
      labels: dailyRevenue.daily.map((d) => d.label),
      datasets: [
        {
          label: "Revenue",
          data: dailyRevenue.daily.map((d) => d.revenue),
          fill: true,
          tension: 0.35,
          backgroundColor: "rgba(45, 212, 191, 0.15)",
          borderColor: "rgba(45, 212, 191, 0.95)",
          borderWidth: 2,
          pointBackgroundColor: "rgba(45, 212, 191, 0.95)",
          pointBorderColor: "rgba(45, 212, 191, 1)",
          pointBorderWidth: 1,
          pointRadius: 3,
          pointHoverRadius: 5,
        },
      ],
    }),
    [dailyRevenue]
  );

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `Revenue: ${formatNum(ctx.raw)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: "rgba(255,255,255,0.6)", maxRotation: 45 },
        },
        y: {
          grid: { color: "rgba(255,255,255,0.06)" },
          ticks: { color: "rgba(255,255,255,0.6)" },
        },
      },
    }),
    []
  );

  const closeEditModal = useCallback(() => {
    if (!editOpen || editExiting) return;
    setEditExiting(true);
    setTimeout(() => {
      setEditOpen(false);
      setEditExiting(false);
    }, 280);
  }, [editOpen, editExiting]);

  const openEditModal = useCallback(() => {
    setEditOpen(true);
    setEditExiting(false);
  }, []);

  const onSave = useCallback(() => {
    if (!storeId || !window.api?.wsSend || saving) return;
    if (form.simCardIncluded && !form.simCardNumber.trim()) {
      notify?.warning?.("SimCard number is required when SimCard is included.", "Stores");
      return;
    }
    setSaving(true);
    saveRequestIdRef.current = Math.random().toString(36).slice(2) + Date.now();
    window.api.wsSend({
      type: "stores:update",
      requestId: saveRequestIdRef.current,
      payload: {
        storeId,
        updates: {
          storeType: form.storeType,
          companyCommission: toNumOrNull(form.companyCommission) ?? 0,
          simCardIncluded: form.simCardIncluded,
          simCardNumber: form.simCardNumber,
          simCardMonthlyPrice: toNumOrNull(form.simCardMonthlyPrice),
          posIncluded: form.posIncluded,
          posTotalAmount: toNumOrNull(form.posTotalAmount),
          posMonthlyInstallment: toNumOrNull(form.posMonthlyInstallment),
        },
      },
    });
  }, [form, saving, storeId, notify]);

  if (!currentStore) {
    return (
      <div className="auditLogsPage storeProfilePage storeProfilePage--enter">
        <header className="auditLogsHeader">
          <button type="button" className="storeProfileBack" onClick={() => onNavigate?.("stores")} aria-label="Back to stores">
            <ArrowLeft size={22} />
          </button>
          <div className="auditLogsHeaderIcon">
            <Store size={24} />
          </div>
          <div className="auditLogsHeaderText">
            <h1 className="auditLogsTitle">Store profile</h1>
            <p className="auditLogsSubtitle">No store selected</p>
          </div>
        </header>
      </div>
    );
  }

  const id = currentStore.id != null ? String(currentStore.id) : (currentStore._id ? String(currentStore._id).slice(-8) : "-");
  const phone = currentStore.storePhone || currentStore.ownerPhone || "";
  const imageSrc = currentStore.storeImage
    ? (/^(https?:)?\//.test(currentStore.storeImage) ? currentStore.storeImage : getAssetUrl(currentStore.storeImage))
    : getAssetUrl("assets/avatar-fallback.webp");

  return (
    <div className="auditLogsPage storeProfilePage storeProfilePage--enter">
      <header className="auditLogsHeader">
        <button type="button" className="storeProfileBack" onClick={() => onNavigate?.("stores")} aria-label="Back to stores">
          <ArrowLeft size={22} />
        </button>
        <div className="auditLogsHeaderIcon">
          <Store size={24} />
        </div>
        <div className="auditLogsHeaderText">
          <h1 className="auditLogsTitle">{currentStore.storeName || "-"}</h1>
          <p className="auditLogsSubtitle">Store profile - ID {id}</p>
        </div>
        <div className="storeProfileHeaderActions">
          <button type="button" className="storeProfileEditBtn" onClick={openEditModal}>
            <SquarePen size={16} />
            Edit store
          </button>
        </div>
      </header>

      <main className="auditLogsMain">
        <div className="auditLogsContent">
          <section className="storeProfilePersonaSection">
            <div className="storeProfilePersona">
              <div className="storeProfilePersonaLeft">
                <img src={imageSrc} alt="" className="storeProfilePersonaAvatar" />
                <div className="storeProfilePersonaInfo">
                  <h2 className="storeProfilePersonaName">{currentStore.storeName || "-"}</h2>
                  <p className="storeProfilePersonaPhone">
                    <Phone size={14} className="storeProfilePersonaPhoneIcon" />
                    {telHref(phone) ? (
                      <Tippy content="Call or open in phone app" animation="shift-away" placement="top" delay={[200, 0]}>
                        <a href={telHref(phone)} className="storeProfilePersonaPhoneLink" rel="noopener noreferrer">
                          {phone}
                        </a>
                      </Tippy>
                    ) : (
                      <span>{phone || "-"}</span>
                    )}
                  </p>
                  <div className="storeProfilePersonaType">
                    <Store size={16} className="storeProfilePersonaTypeIcon" />
                    <span>{currentStore.storeType || "Not set"}</span>
                  </div>
                </div>
              </div>
              <div className="storeProfilePersonaRight">
                <span className="storeProfilePersonaLastUpdatedLabel">Last updated</span>
                <span className="storeProfilePersonaLastUpdatedTime">
                  <Clock size={14} className="storeProfilePersonaClockIcon" />
                  {formatLastUpdated(currentStore.lastUpdated)}
                </span>
              </div>
            </div>
          </section>

          <section className="storeProfileFilterSection">
            <p className="storeProfileFilterNote">Revenue chart uses daily snapshots for the selected period.</p>
            <div className="storeProfileFilterRow">
              <Calendar size={18} className="storeProfileFilterIcon" />
              <span className="storeProfileFilterLabel">Period</span>
              <div className="storeProfileFilterPresets">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`storeProfileFilterBtn ${preset === p.id ? "active" : ""}`}
                    onClick={() => setPreset(p.id)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {preset === "custom" && (
                <div className="storeProfileFilterCustom">
                  <DateRangePicker
                    label=""
                    placeholder="From - To"
                    value={{ from: fromInput, to: toInput }}
                    onChange={({ from, to }) => {
                      setFromInput(from ?? "");
                      setToInput(to ?? "");
                    }}
                    className="storeProfileDateRangePicker"
                  />
                </div>
              )}
            </div>
          </section>

          <section className="storeProfileKpiSection">
            <div className="storeProfileKpiGrid">
              <div className="storeProfileKpiCard storeProfileKpiCard--earnings">
                <div className="storeProfileKpiCardIcon">
                  <TrendingUp size={24} strokeWidth={2} />
                </div>
                <p className="storeProfileKpiLabel">Revenue in period</p>
                <span className="storeProfileKpiValue">{historyLoading ? "-" : formatNum(dailyRevenue.revenueInPeriod)}</span>
              </div>
              <div className="storeProfileKpiCard storeProfileKpiCard--balance">
                <div className="storeProfileKpiCardIcon">
                  <Wallet size={24} strokeWidth={2} />
                </div>
                <p className="storeProfileKpiLabel">Balance (end of period)</p>
                <span className="storeProfileKpiValue">{historyLoading ? "-" : formatNum(dailyRevenue.lastBalance)}</span>
              </div>
              <div className="storeProfileKpiCard storeProfileKpiCard--withdrawn">
                <div className="storeProfileKpiCardIcon">
                  <ArrowDownToLine size={24} strokeWidth={2} />
                </div>
                <p className="storeProfileKpiLabel">Total withdrawn</p>
                <span className="storeProfileKpiValue">{historyLoading ? "-" : formatNum(dailyRevenue.totalWithdrawn)}</span>
              </div>
              <div className="storeProfileKpiCard storeProfileKpiCard--commission">
                <div className="storeProfileKpiCardIcon">
                  <Percent size={24} strokeWidth={2} />
                </div>
                <p className="storeProfileKpiLabel">Company commission</p>
                <span className="storeProfileKpiValue">{formatNum(currentStore.companyCommission ?? 0)}%</span>
              </div>
            </div>
          </section>

          <section className="storeProfileChartSection">
            <h2 className="storeProfileSectionTitle">Revenue per day</h2>
            <p className="storeProfileSectionNote">Daily revenue from store sync snapshots.</p>
            <div className="storeProfileChartWrap">
              {historyLoading ? (
                <div className="storeProfileChartLoading">Loading chart...</div>
              ) : dailyRevenue.daily.length === 0 ? (
                <div className="storeProfileChartEmpty">No daily data in this period.</div>
              ) : (
                <Line data={chartData} options={chartOptions} />
              )}
            </div>
          </section>

          <section className="storeProfileBoardSection">
            <h2 className="storeProfileSectionTitle">Store intelligence board</h2>
            <p className="storeProfileSectionNote">All metadata is split by domain for quicker scanning.</p>
            <div className="storeBoardGrid">
              <article className="storeBoardPanel storeBoardPanel--identity">
                <h3>Identity</h3>
                <div className="storeMetricGrid">
                  <div className="storeMetric"><span>Owner</span><strong>{valueOrDash(currentStore.ownerName)}</strong></div>
                  <div className="storeMetric"><span>Owner phone</span><strong>{valueOrDash(currentStore.ownerPhone)}</strong></div>
                  <div className="storeMetric"><span>Store phone</span><strong>{valueOrDash(currentStore.storePhone)}</strong></div>
                  <div className="storeMetric"><span>Location</span><strong>{valueOrDash(currentStore.location)}</strong></div>
                  <div className="storeMetric"><span>Email</span><strong>{valueOrDash(currentStore.email)}</strong></div>
                </div>
              </article>

              <article className="storeBoardPanel storeBoardPanel--commercial">
                <h3>Commercial</h3>
                <div className="storeMetricGrid">
                  <div className="storeMetric"><span>Work type</span><strong>{valueOrDash(currentStore.workType)}</strong></div>
                  <div className="storeMetric"><span>Work commission</span><strong>{currentStore.workCommission == null ? "-" : `${formatNum(currentStore.workCommission)}%`}</strong></div>
                  <div className="storeMetric"><span>Company commission</span><strong>{currentStore.companyCommission == null ? "-" : `${formatNum(currentStore.companyCommission)}%`}</strong></div>
                  <div className="storeMetric"><span>Store type</span><strong>{valueOrDash(currentStore.storeType)}</strong></div>
                </div>
              </article>

              <article className="storeBoardPanel storeBoardPanel--sim">
                <h3>SimCard</h3>
                <div className="storeMetricGrid">
                  <div className="storeMetric">
                    <span>Status</span>
                    <strong>
                      <span className={`storeBadge ${currentStore.simCardIncluded ? "ok" : "off"}`}>
                        {currentStore.simCardIncluded ? "Included" : "Not included"}
                      </span>
                    </strong>
                  </div>
                  <div className="storeMetric"><span>Number</span><strong>{valueOrDash(currentStore.simCardNumber)}</strong></div>
                  <div className="storeMetric"><span>Monthly</span><strong>{currentStore.simCardMonthlyPrice == null ? "Free" : `${formatNum(currentStore.simCardMonthlyPrice)} IQD`}</strong></div>
                </div>
              </article>

              <article className="storeBoardPanel storeBoardPanel--pos">
                <h3>POS</h3>
                <div className="storeMetricGrid">
                  <div className="storeMetric">
                    <span>Status</span>
                    <strong>
                      <span className={`storeBadge ${currentStore.posIncluded ? "ok" : "off"}`}>
                        {currentStore.posIncluded ? "Included" : "Not included"}
                      </span>
                    </strong>
                  </div>
                  <div className="storeMetric"><span>Total amount</span><strong>{currentStore.posTotalAmount == null ? "Free" : `${formatNum(currentStore.posTotalAmount)} IQD`}</strong></div>
                  <div className="storeMetric"><span>Monthly split</span><strong>{currentStore.posMonthlyInstallment == null ? "-" : `${formatNum(currentStore.posMonthlyInstallment)} IQD`}</strong></div>
                </div>
              </article>
            </div>
          </section>
        </div>
      </main>

      {/* Floating Violations button — portaled to body so it stays fixed to viewport (like AI FAB) */}
      {currentStore && canManageViolations && (
        <>
          {createPortal(
            <div className="violationsFabWrap">
              <button
                type="button"
                className="violationsFab"
                onClick={() => setViolationsOpen(true)}
                aria-label="Open violations"
              >
                <span className="violationsFabInner">
                  <span className="violationsFabSpacer" aria-hidden="true" />
                  <span className="violationsFabIconBox">
                    <AlertCircle size={22} className="violationsFabIcon" />
                  </span>
                  <span className="violationsFabText">Violations</span>
                </span>
              </button>
            </div>,
            document.body
          )}
          {violationsOpen && (
            <ViolationsPopout
              entityType="store"
              entityId={String(currentStore.id ?? currentStore._id ?? currentStore.externalId ?? "")}
              entityName={currentStore.storeName ?? currentStore.name}
              userName={account?.name ?? account?.dbUser?.name}
              userRoleName={account?.role?.name}
              onClose={() => setViolationsOpen(false)}
            />
          )}
        </>
      )}

      {(editOpen || editExiting) && createPortal(
        <div
          className={`storeEditModalBackdrop ${editExiting ? "storeEditModalBackdrop--exiting" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="storeEditTitle"
          onClick={closeEditModal}
        >
          <div
            className={`storeEditModal ${editExiting ? "storeEditModal--exiting" : ""}`}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="storeEditModalHeader">
              <h2 id="storeEditTitle" className="storeEditModalTitle">
                <span className="storeEditModalTitleIcon"><SquarePen size={20} /></span>
                Edit store manual details
              </h2>
              <button type="button" className="storeEditModalClose" onClick={closeEditModal} aria-label="Close">
                <X size={18} />
              </button>
            </header>

            <div className="storeEditModalBody">
              <div className="storeEditGrid">
                <label className="storeEditField">
                  <span>Store type</span>
                  <input
                    type="text"
                    value={form.storeType}
                    onChange={(e) => setForm((p) => ({ ...p, storeType: e.target.value }))}
                    placeholder="Class A, Class B, ..."
                  />
                </label>
                <label className="storeEditField">
                  <span>Company commission (%)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.companyCommission}
                    onChange={(e) => setForm((p) => ({ ...p, companyCommission: e.target.value }))}
                    placeholder="0"
                  />
                </label>
              </div>

              <div className="storeEditBlock">
                <label className="storeEditCheck" htmlFor="store-edit-simcard">
                  <span className="storeEditCheckboxWrap">
                    <input
                      id="store-edit-simcard"
                      type="checkbox"
                      className="storeEditCheckboxInput"
                      checked={form.simCardIncluded}
                      onChange={(e) => setForm((p) => ({ ...p, simCardIncluded: e.target.checked }))}
                      aria-label="SimCard included"
                    />
                    <span className="storeEditCheckboxBox" aria-hidden="true" />
                  </span>
                  <span className="storeEditCheckLabel">Is SimCard included?</span>
                </label>

                <div className={`storeEditBlockInner ${form.simCardIncluded ? "storeEditBlockInner--expanded" : ""}`}>
                  <div className="storeEditGrid">
                    <label className="storeEditField">
                      <span>SimCard number</span>
                      <input
                        type="text"
                        value={form.simCardNumber}
                        onChange={(e) => setForm((p) => ({ ...p, simCardNumber: e.target.value }))}
                        placeholder="Required"
                      />
                    </label>
                    <label className="storeEditField">
                      <span>SimCard monthly price (IQD, optional)</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.simCardMonthlyPrice}
                        onChange={(e) => setForm((p) => ({ ...p, simCardMonthlyPrice: e.target.value }))}
                        placeholder="Leave empty for free"
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="storeEditBlock">
                <label className="storeEditCheck" htmlFor="store-edit-pos">
                  <span className="storeEditCheckboxWrap">
                    <input
                      id="store-edit-pos"
                      type="checkbox"
                      className="storeEditCheckboxInput"
                      checked={form.posIncluded}
                      onChange={(e) => setForm((p) => ({ ...p, posIncluded: e.target.checked }))}
                      aria-label="POS included"
                    />
                    <span className="storeEditCheckboxBox" aria-hidden="true" />
                  </span>
                  <span className="storeEditCheckLabel">Is POS included?</span>
                </label>

                <div className={`storeEditBlockInner ${form.posIncluded ? "storeEditBlockInner--expanded" : ""}`}>
                  <div className="storeEditGrid">
                    <label className="storeEditField">
                      <span>POS total amount (IQD, optional)</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.posTotalAmount}
                        onChange={(e) => setForm((p) => ({ ...p, posTotalAmount: e.target.value }))}
                        placeholder="Leave empty for free"
                      />
                    </label>
                    <label className="storeEditField">
                      <span>Monthly payment split (IQD, optional)</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.posMonthlyInstallment}
                        onChange={(e) => setForm((p) => ({ ...p, posMonthlyInstallment: e.target.value }))}
                        placeholder="How much can be paid monthly"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <footer className="storeEditModalActions">
              <button type="button" className="storeEditBtn storeEditBtn--ghost" onClick={closeEditModal} disabled={saving}>
                Cancel
              </button>
              <button type="button" className="storeEditBtn storeEditBtn--primary" onClick={onSave} disabled={saving}>
                {saving ? "Saving..." : "Save changes"}
              </button>
            </footer>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

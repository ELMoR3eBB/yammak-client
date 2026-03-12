// Driver_Profile.jsx — KPI cards (filtered by date), earnings chart, orders table (UI)
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";
import "tippy.js/animations/shift-away.css";
import { Truck, ArrowLeft, Phone, Wallet, Package, Gift, Calendar, Bike, Clock, AlertCircle } from "lucide-react";
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
import DataTable from "../../ui/DataTable";
import DateRangePicker from "../../ui/DateRangePicker";
import { getAssetUrl } from "../../../utils/publicUrl";
import "../../../styles/pages/audit/audit_logs.css";
import "../../../styles/pages/drivers/drivers.css";
import "../../../styles/ui/data_table.css";
import "../../../styles/ui/date_range_picker.css";
import { hasPermission } from "../../../helpers/permissions";
import ViolationsPopout from "../../violations/ViolationsPopout.jsx";
import "../../../styles/pages/violations/violations_popout.css";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

function formatNum(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return Number(n).toLocaleString();
}

function formatDate(d) {
  if (!d) return "—";
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? "—" : x.toLocaleDateString(undefined, { dateStyle: "medium" });
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

function formatLastUpdated(d) {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
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

/** Normalize phone for tel: href (digits and + only) so Windows opens default phone app */
function telHref(phone) {
  if (!phone || typeof phone !== "string") return null;
  const cleaned = phone.replace(/\s/g, "").replace(/[^\d+]/g, "");
  return cleaned.length > 0 ? `tel:${cleaned}` : null;
}

// Animated number: counts from 0 (or previous value) to target with comma formatting
function useAnimatedNumber(value, key, duration = 800) {
  const [display, setDisplay] = useState(0);
  const prevKeyRef = useRef(key);
  const displayRef = useRef(0);
  const rafRef = useRef(null);
  displayRef.current = display;

  useEffect(() => {
    const num = Number(value);
    const target = Number.isNaN(num) ? 0 : num;
    const keyChanged = prevKeyRef.current !== key;
    prevKeyRef.current = key;
    const startVal = keyChanged ? 0 : displayRef.current;
    const startTime = performance.now();

    const tick = (now) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - t, 2);
      const current = Math.round(startVal + (target - startVal) * ease);
      setDisplay(current);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, key, duration]);

  return display;
}

function AnimatedKpiNumber({ value, keySuffix, duration = 800 }) {
  const num = Number(value);
  const target = Number.isNaN(num) ? 0 : num;
  const display = useAnimatedNumber(target, keySuffix, duration);
  return <span className="driverProfileKpiValue">{formatNum(display)}</span>;
}

const PRESETS = [
  { id: "7d", label: "7 days" },
  { id: "15d", label: "15 days" },
  { id: "30d", label: "30 days" },
  { id: "custom", label: "Custom" },
];

const ORDER_COLUMNS = [
  { key: "orderId", label: "ORDER ID", sortable: true, width: "0.9fr" },
  { key: "date", label: "DATE", sortable: true, width: "1fr" },
  { key: "customer", label: "CUSTOMER", sortable: false, width: "1.2fr" },
  { key: "status", label: "STATUS", sortable: true, width: "0.9fr" },
  { key: "amount", label: "AMOUNT", sortable: true, width: "1fr", align: "right" },
];

export default function DriverProfile({ driver, account, onNavigate }) {
  const [preset, setPreset] = useState("30d");
  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");
  const [snapshots, setSnapshots] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [violationsOpen, setViolationsOpen] = useState(false);
  const requestIdRef = useRef(null);

  // Re-render periodically so "Last updated" relative time ticks without refreshing the page
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

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

  const driverId = driver?.id ?? (driver?._id ? String(driver._id) : null);

  const fetchHistory = useCallback(() => {
    if (!driverId || !window.api?.wsSend) return;
    setHistoryLoading(true);
    requestIdRef.current = Math.random().toString(36).slice(2) + Date.now();
    window.api.wsSend({
      type: "drivers:history",
      requestId: requestIdRef.current,
      payload: {
        driverId,
        fromDate: fromDate.toISOString(),
        toDate: toDate.toISOString(),
      },
    });
  }, [driverId, fromDate, toDate]);

  useEffect(() => {
    if (!window.api) return;
    const unsub = window.api.onWsMessage((msg) => {
      if (msg?.type === "drivers:history" && msg?.requestId === requestIdRef.current) {
        setSnapshots(Array.isArray(msg.snapshots) ? msg.snapshots : []);
        setHistoryLoading(false);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (driverId) fetchHistory();
    else setHistoryLoading(false);
  }, [driverId, fetchHistory]);

  const { dailyEarnings, kpiEarnings, kpiOrders, kpiBalance, kpiBonuses } = useMemo(() => {
    const list = [...(snapshots || [])].sort(
      (a, b) => new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime()
    );
    let totalEarningsDelta = 0;
    let totalOrdersDelta = 0;
    let totalBonusesDelta = 0;
    let lastBalance = 0;
    const daily = [];

    for (let i = 0; i < list.length; i++) {
      const curr = list[i];
      const prev = i > 0 ? list[i - 1] : null;
      const earningsThatDay = prev
        ? (Number(curr.totalEarnings) || 0) - (Number(prev.totalEarnings) || 0)
        : Number(curr.totalEarnings) || 0;
      const ordersThatDay = prev
        ? (Number(curr.totalOrders) || 0) - (Number(prev.totalOrders) || 0)
        : Number(curr.totalOrders) || 0;
      const bonusesThatDay = prev
        ? (Number(curr.incentivesPaidTotal) || 0) - (Number(prev.incentivesPaidTotal) || 0)
        : Number(curr.incentivesPaidTotal) || 0;
      totalEarningsDelta += earningsThatDay;
      totalOrdersDelta += ordersThatDay;
      totalBonusesDelta += bonusesThatDay;
      lastBalance = Number(curr.balance) || 0;
      const d = new Date(curr.lastUpdated);
      daily.push({
        date: curr.lastUpdated,
        label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        earnings: earningsThatDay,
      });
    }

    return {
      dailyEarnings: daily,
      kpiEarnings: totalEarningsDelta,
      kpiOrders: totalOrdersDelta,
      kpiBalance: lastBalance,
      kpiBonuses: totalBonusesDelta,
    };
  }, [snapshots]);

  const chartData = useMemo(
    () => ({
      labels: dailyEarnings.map((d) => d.label),
      datasets: [
        {
          label: "Earnings",
          data: dailyEarnings.map((d) => d.earnings),
          fill: true,
          tension: 0.35,
          backgroundColor: "rgba(251, 191, 36, 0.15)",
          borderColor: "rgba(251, 191, 36, 0.9)",
          borderWidth: 2,
          pointBackgroundColor: "rgba(251, 191, 36, 0.9)",
          pointBorderColor: "rgba(251, 191, 36, 1)",
          pointBorderWidth: 1,
          pointRadius: 3,
          pointHoverRadius: 5,
        },
      ],
    }),
    [dailyEarnings]
  );

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `Earnings: ${formatNum(ctx.raw)}`,
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

  const filterKey = `${fromDate?.getTime() ?? 0}-${toDate?.getTime() ?? 0}`;
  const canManageViolations = hasPermission(account, ["violations.manage", "cashout.manage", "cashout.viewAll"]);

  if (!driver) {
    return (
      <div className="auditLogsPage driversPage driverProfilePage driverProfilePage--enter">
        <header className="auditLogsHeader">
          <button
            type="button"
            className="driverProfileBack"
            onClick={() => onNavigate?.("drivers")}
            aria-label="Back to drivers"
          >
            <ArrowLeft size={22} />
          </button>
          <div className="auditLogsHeaderIcon">
            <Truck size={24} />
          </div>
          <div className="auditLogsHeaderText">
            <h1 className="auditLogsTitle">Driver profile</h1>
            <p className="auditLogsSubtitle">No driver selected</p>
          </div>
        </header>
        <main className="auditLogsMain">
          <div className="driverProfileEmpty">
            <p>Select a driver from the list to view their profile.</p>
            <button type="button" className="driverProfileBackBtn" onClick={() => onNavigate?.("drivers")}>
              <ArrowLeft size={18} />
              Back to drivers
            </button>
          </div>
        </main>
      </div>
    );
  }

  const id = driver.id != null ? String(driver.id) : (driver._id ? String(driver._id).slice(-8) : "—");

  return (
    <div className="auditLogsPage driversPage driverProfilePage driverProfilePage--enter">
      <header className="auditLogsHeader">
        <button
          type="button"
          className="driverProfileBack"
          onClick={() => onNavigate?.("drivers")}
          aria-label="Back to drivers"
        >
          <ArrowLeft size={22} />
        </button>
        <div className="auditLogsHeaderIcon">
          <Truck size={24} />
        </div>
        <div className="auditLogsHeaderText">
          <h1 className="auditLogsTitle">{driver.name || "—"}</h1>
          <p className="auditLogsSubtitle">Driver profile · ID {id}</p>
        </div>
      </header>

      <main className="auditLogsMain">
        <div className="auditLogsContent">
          {/* Driver persona */}
          <section className="driverProfilePersonaSection">
            <div className="driverProfilePersona">
              <div className="driverProfilePersonaLeft">
                <img
                  src={getAssetUrl("assets/avatar-fallback.webp")}
                  alt=""
                  className="driverProfilePersonaAvatar"
                />
                <div className="driverProfilePersonaInfo">
                  <h2 className="driverProfilePersonaName">{driver.name || "—"}</h2>
                  <p className="driverProfilePersonaPhone">
                    <Phone size={14} className="driverProfilePersonaPhoneIcon" />
                    {telHref(driver.phone) ? (
                      <Tippy content="Call or open in phone app" animation="shift-away" placement="top" delay={[200, 0]}>
                        <a
                          href={telHref(driver.phone)}
                          className="driverProfilePersonaPhoneLink"
                          rel="noopener noreferrer"
                        >
                          {driver.phone}
                        </a>
                      </Tippy>
                    ) : (
                      <Tippy content="Phone number" animation="shift-away" placement="top" delay={[200, 0]}>
                        <span>{driver.phone || "—"}</span>
                      </Tippy>
                    )}
                  </p>
                  <div className="driverProfilePersonaType">
                    <Bike size={16} className="driverProfilePersonaTypeIcon" />
                    <span>{driver.driverType || "Bike"}</span>
                  </div>
                </div>
              </div>
              <div className="driverProfilePersonaRight">
                <span className="driverProfilePersonaLastUpdatedLabel">Last updated</span>
                <span className="driverProfilePersonaLastUpdatedTime">
                  <Clock size={14} className="driverProfilePersonaClockIcon" />
                  {formatLastUpdated(driver.lastUpdated)}
                </span>
              </div>
            </div>
          </section>

          {/* KPI filter */}
          <section className="driverProfileFilterSection">
            <p className="driverProfileFilterNote">KPIs and chart use daily snapshots for the selected period.</p>
            <div className="driverProfileFilterRow">
              <Calendar size={18} className="driverProfileFilterIcon" />
              <span className="driverProfileFilterLabel">Period</span>
              <div className="driverProfileFilterPresets">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`driverProfileFilterBtn ${preset === p.id ? "active" : ""}`}
                    onClick={() => setPreset(p.id)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {preset === "custom" && (
                <div className="driverProfileFilterCustom">
                  <DateRangePicker
                    label=""
                    placeholder="From - To"
                    value={{ from: fromInput, to: toInput }}
                    onChange={({ from, to }) => {
                      setFromInput(from ?? "");
                      setToInput(to ?? "");
                    }}
                    className="driverProfileDateRangePicker"
                  />
                </div>
              )}
            </div>
          </section>

          {/* KPI cards */}
          <section className="driverProfileKpiSection">
            <div className="driverProfileKpiGrid">
              <div className="driverProfileKpiCard driverProfileKpiCard--earnings">
                <div className="driverProfileKpiCardIcon">
                  <Wallet size={22} />
                </div>
                <p className="driverProfileKpiLabel">Earnings in period</p>
                {historyLoading ? (
                  <span className="driverProfileKpiValue driverProfileKpiSkeleton">—</span>
                ) : (
                  <AnimatedKpiNumber value={kpiEarnings} keySuffix={`earnings-${filterKey}`} />
                )}
              </div>
              <div className="driverProfileKpiCard driverProfileKpiCard--orders">
                <div className="driverProfileKpiCardIcon">
                  <Package size={22} />
                </div>
                <p className="driverProfileKpiLabel">Orders in period</p>
                {historyLoading ? (
                  <span className="driverProfileKpiValue driverProfileKpiSkeleton">—</span>
                ) : (
                  <AnimatedKpiNumber value={kpiOrders} keySuffix={`orders-${filterKey}`} />
                )}
              </div>
              <div className="driverProfileKpiCard driverProfileKpiCard--balance">
                <div className="driverProfileKpiCardIcon">
                  <Wallet size={22} />
                </div>
                <p className="driverProfileKpiLabel">Balance (end of period)</p>
                {historyLoading ? (
                  <span className="driverProfileKpiValue driverProfileKpiSkeleton">—</span>
                ) : (
                  <AnimatedKpiNumber value={kpiBalance} keySuffix={`balance-${filterKey}`} />
                )}
              </div>
              <div className="driverProfileKpiCard driverProfileKpiCard--bonuses">
                <div className="driverProfileKpiCardIcon">
                  <Gift size={22} />
                </div>
                <p className="driverProfileKpiLabel">Bonuses in period</p>
                {historyLoading ? (
                  <span className="driverProfileKpiValue driverProfileKpiSkeleton">—</span>
                ) : (
                  <AnimatedKpiNumber value={kpiBonuses} keySuffix={`bonuses-${filterKey}`} />
                )}
              </div>
            </div>
          </section>

          {/* Earnings per day chart — flow line */}
          <section className="driverProfileChartSection driverProfileChartSection--spaced">
            <h2 className="driverProfileSectionTitle">Earnings per day</h2>
            <p className="driverProfileChartNote">Daily earnings from driver sync; line shows the flow over the period.</p>
            <div className="driverProfileChartWrap">
              {historyLoading ? (
                <div className="driverProfileChartLoading">Loading chart…</div>
              ) : dailyEarnings.length === 0 ? (
                <div className="driverProfileChartEmpty">No daily data in this period.</div>
              ) : (
                <Line data={chartData} options={chartOptions} />
              )}
            </div>
          </section>

          {/* Floating Violations button — portaled to body so it stays fixed to viewport (like AI FAB) */}
          {canManageViolations && (
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
              {violationsOpen && (driver.externalId != null || driver._id != null || driver.id != null) && (
                <ViolationsPopout
                  entityType="driver"
                  entityId={String(driver.externalId ?? driver._id ?? driver.id)}
                  entityName={driver?.name}
                  userName={account?.name ?? account?.dbUser?.name}
                  userRoleName={account?.role?.name}
                  onClose={() => setViolationsOpen(false)}
                />
              )}
            </>
          )}

          {/* Orders table (UI only, empty) */}
          <section className="auditLogsSection driverProfileOrdersSection">
            <h2 className="driverProfileSectionTitle">Orders</h2>
            <p className="driverProfileOrdersNote">Order history will appear here when available.</p>
            <div className="driverProfileOrdersTableWrap">
              <DataTable
                columns={ORDER_COLUMNS}
                rows={[]}
                emptyContent={
                  <div className="driverProfileOrdersEmpty">
                    <img src={getAssetUrl("assets/svg/nodata-ill.svg")} alt="" className="driverProfileOrdersEmptyIll" />
                    <p className="driverProfileOrdersEmptyText">No orders data yet</p>
                  </div>
                }
                renderRow={() => null}
                className="driverProfileOrdersTable"
              />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

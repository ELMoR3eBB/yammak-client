import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  LineElement,
  PointElement,
  LineController,
  Filler,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import { BarChart3, PieChart, Timer, Percent } from "lucide-react";
import DateRangePicker from "../../components/ui/DateRangePicker";
import EmployeesFilter from "../../components/shared/EmployeesFilter";
import AnimatedInteger from "../../components/ui/AnimatedInteger";
import Skeleton from "../../components/ui/Skeleton";
import "../../styles/ui/date_range_picker.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  LineElement,
  PointElement,
  LineController,
  Filler,
  Title,
  Tooltip,
  Legend
);

const GOLD = "rgba(251, 191, 36, 0.95)";
const GOLD_FILL = "rgba(251, 191, 36, 0.12)";
const GREEN = "rgba(74, 222, 128, 0.95)";
const GREEN_FILL = "rgba(74, 222, 128, 0.1)";
const CYAN = "rgba(125, 211, 252, 0.75)";
const MUTED = "rgba(255, 255, 255, 0.45)";

const CHART_ANIMATION = {
  duration: 1000,
  easing: "easeOutQuart",
};

const CHART_BODY_MIN_PX = 48;

function formatHumanDuration(totalSeconds) {
  const n = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  if (n < 60) return `${n}s`;
  const m = Math.floor(n / 60);
  if (m < 60) return `${m}m ${n % 60}s`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${rm}m`;
}

function peakDayLabel(byDay, t) {
  if (!byDay?.length) return "—";
  let best = byDay[0];
  for (const d of byDay) {
    if (d.total > best.total) best = d;
  }
  const date = new Date(best.date + "T12:00:00");
  const label = Number.isNaN(date.getTime())
    ? best.date
    : date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  return t("recordings.dashPeakDayValue", {
    label,
    count: String(best.total),
  });
}

function peakDayKey(byDay) {
  if (!byDay?.length) return "none";
  let best = byDay[0];
  for (const d of byDay) {
    if (d.total > best.total) best = d;
  }
  return `${best.date}-${best.total}`;
}

function emptyChartCopy(kind, analytics, analyticsLoading, t) {
  if (analyticsLoading) return "";
  if (!analytics) return t("recordings.dashNoCalls");
  if (Number(analytics.totalCalls) === 0) return t("recordings.dashNoCalls");
  if (kind === "flow" && (!analytics.byDay || analytics.byDay.length === 0)) {
    return t("recordings.dashNoCalls");
  }
  if (kind === "employee") {
    const answered = Number(analytics.answeredCalls) || 0;
    if (answered === 0) return t("recordings.dashNoAnsweredForBreakdown");
    return t("recordings.dashNoEmployeeSegments");
  }
  return t("recordings.dashNoCalls");
}

/**
 * Mount Chart.js only after the chart container has a real layout box.
 * This prevents initial animations from finishing while hidden behind a spinner.
 */
function useChartBodyMountReady(armed, containerRef) {
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    if (!armed) {
      setReady(false);
      return undefined;
    }

    const el = containerRef.current;
    if (!el) return undefined;

    let cancelled = false;
    let raf1 = 0;
    let raf2 = 0;

    const arm = () => {
      if (cancelled) return;

      const r = el.getBoundingClientRect();
      if (r.width < CHART_BODY_MIN_PX || r.height < CHART_BODY_MIN_PX) return;

      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);

      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          if (!cancelled) setReady(true);
        });
      });
    };

    arm();

    const ro = new ResizeObserver(arm);
    ro.observe(el);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      ro.disconnect();
    };
  }, [armed, containerRef]);

  return ready;
}

export default function RecordingsDashboard({
  t,
  dateRangeValue,
  onDateRangeChange,
  employeeOptions,
  selectedEmployeeIds,
  onToggleEmployee,
  onClearEmployees,
  canPickEmployees,
  analytics,
  analyticsRevision = 0,
  analyticsLoading,
  listScanCapped,
}) {
  const isLightTheme = typeof document !== "undefined" && document.documentElement?.dataset?.theme === "light";
  const mutedColor = isLightTheme ? "rgba(51, 65, 85, 0.88)" : MUTED;
  const gridColor = isLightTheme ? "rgba(15, 23, 42, 0.12)" : "rgba(255, 255, 255, 0.06)";

  const chartPlugins = useMemo(
    () => ({
      legend: { labels: { color: mutedColor } },
    }),
    [mutedColor]
  );

  const axisCommon = useMemo(
    () => ({
      ticks: { color: mutedColor, maxRotation: 45 },
      grid: { color: gridColor },
    }),
    [gridColor, mutedColor]
  );

  const doughnutData = useMemo(() => {
    const rows = analytics?.byEmployeeAnswered || [];
    const top = rows.slice(0, 10);
    const rest = rows.slice(10).reduce((s, r) => s + r.count, 0);

    const labels = top.map((r) => r.name);
    const data = top.map((r) => r.count);

    if (rest > 0) {
      labels.push(t("recordings.dashOther"));
      data.push(rest);
    }

    const colors = [
      "rgba(251, 191, 36, 0.85)",
      "rgba(125, 211, 252, 0.75)",
      "rgba(74, 222, 128, 0.75)",
      "rgba(168, 85, 247, 0.75)",
      "rgba(248, 113, 113, 0.75)",
      "rgba(251, 191, 36, 0.5)",
      "rgba(125, 211, 252, 0.45)",
      "rgba(74, 222, 128, 0.45)",
      "rgba(253, 224, 71, 0.7)",
      "rgba(244, 114, 182, 0.7)",
      MUTED,
    ];

    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor: labels.map((_, i) => colors[i % colors.length]),
          borderWidth: 0,
        },
      ],
    };
  }, [analytics, t]);

  const donutEmployeeIdByIndex = useMemo(() => {
    const rows = analytics?.byEmployeeAnswered || [];
    const top = rows.slice(0, 10);
    const ids = top.map((r) => String(r.employeeId || ""));
    const rest = rows.slice(10).reduce((s, r) => s + Number(r.count || 0), 0);
    if (rest > 0) ids.push("");
    return ids;
  }, [analytics?.byEmployeeAnswered]);

  const flowLineData = useMemo(() => {
    const days = analytics?.byDay || [];
    return {
      labels: days.map((d) => {
        const dt = new Date(d.date + "T12:00:00");
        return Number.isNaN(dt.getTime())
          ? d.date
          : dt.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          });
      }),
      datasets: [
        {
          type: "line",
          label: t("recordings.chartTotalCalls"),
          data: days.map((d) => d.total),
          borderColor: GOLD,
          backgroundColor: GOLD_FILL,
          fill: true,
          tension: 0.35,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: GOLD,
          pointBorderColor: "rgba(0,0,0,0.2)",
          borderWidth: 2,
        },
        {
          type: "line",
          label: t("recordings.chartAnsweredCalls"),
          data: days.map((d) => d.answered),
          borderColor: GREEN,
          backgroundColor: GREEN_FILL,
          fill: true,
          tension: 0.35,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: GREEN,
          pointBorderColor: "rgba(0,0,0,0.2)",
          borderWidth: 2,
        },
      ],
    };
  }, [analytics, t]);

  const talkBarData = useMemo(() => {
    const rows = (analytics?.byEmployeeTalkSeconds || []).slice(0, 12);
    return {
      labels: rows.map((r) => r.name),
      datasets: [
        {
          label: t("recordings.dashTalkTimeAxis"),
          data: rows.map((r) => r.seconds),
          backgroundColor: CYAN,
          borderColor: "rgba(125, 211, 252, 0.9)",
          borderWidth: 1,
        },
      ],
    };
  }, [analytics, t]);

  const avgTalkTimeTopData = useMemo(() => {
    const answeredRows = analytics?.byEmployeeAnswered || [];
    const talkRows = analytics?.byEmployeeTalkSeconds || [];

    const countById = new Map(
      answeredRows.map((r) => [String(r.employeeId), Number(r.count || 0)])
    );

    const merged = talkRows
      .map((r) => {
        const eid = String(r.employeeId);
        const count = countById.get(eid) || 0;
        if (!count) return null;

        const seconds = Number(r.seconds || 0);
        if (!seconds) return null;

        return {
          id: eid,
          name: r.name || "—",
          avgSeconds: seconds / count,
        };
      })
      .filter(Boolean);

    merged.sort((a, b) => b.avgSeconds - a.avgSeconds);

    const top = merged.slice(0, 8);
    const labels = top.map((r) => r.name);
    const data = top.map((r) => r.avgSeconds);

    const palette = [
      "rgba(251, 191, 36, 0.85)",
      "rgba(125, 211, 252, 0.75)",
      "rgba(74, 222, 128, 0.75)",
      "rgba(168, 85, 247, 0.75)",
      "rgba(248, 113, 113, 0.75)",
      "rgba(251, 191, 36, 0.5)",
      "rgba(125, 211, 252, 0.45)",
      "rgba(74, 222, 128, 0.45)",
      MUTED,
    ];

    return {
      labels,
      datasets: [
        {
          label: t("recordings.chartTotalCalls"),
          data,
          backgroundColor: labels.map((_, i) => palette[i % palette.length]),
          borderWidth: 0,
        },
      ],
    };
  }, [analytics, t]);

  const avgTalkEmployeeIdByIndex = useMemo(() => {
    const answeredRows = analytics?.byEmployeeAnswered || [];
    const talkRows = analytics?.byEmployeeTalkSeconds || [];
    const countById = new Map(answeredRows.map((r) => [String(r.employeeId), Number(r.count || 0)]));
    const merged = talkRows
      .map((r) => {
        const eid = String(r.employeeId);
        const count = countById.get(eid) || 0;
        if (!count) return null;
        const seconds = Number(r.seconds || 0);
        if (!seconds) return null;
        return { id: eid, avgSeconds: seconds / count };
      })
      .filter(Boolean);
    merged.sort((a, b) => b.avgSeconds - a.avgSeconds);
    return merged.slice(0, 8).map((r) => r.id);
  }, [analytics?.byEmployeeAnswered, analytics?.byEmployeeTalkSeconds]);

  const flowLineOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { ...CHART_ANIMATION },
      interaction: { mode: "index", intersect: false },
      plugins: chartPlugins,
      scales: {
        x: { ...axisCommon, grid: { color: isLightTheme ? "rgba(15, 23, 42, 0.1)" : "rgba(255, 255, 255, 0.04)" } },
        y: {
          ...axisCommon,
          beginAtZero: true,
          ticks: { ...axisCommon.ticks, stepSize: 1, precision: 0 },
        },
      },
      elements: {
        line: { borderJoinStyle: "round" },
        point: { hitRadius: 12 },
      },
    }),
    [axisCommon, chartPlugins, isLightTheme]
  );

  const talkBarOptions = useMemo(
    () => ({
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      animation: { ...CHART_ANIMATION },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => formatHumanDuration(ctx.raw),
          },
        },
      },
      scales: {
        x: {
          ...axisCommon,
          beginAtZero: true,
          ticks: {
            ...axisCommon.ticks,
            callback: (v) => formatHumanDuration(v),
          },
        },
        y: { ...axisCommon, grid: { display: false } },
      },
    }),
    [axisCommon]
  );

  const avgTalkTimeTopOptions = useMemo(
    () => ({
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 1000,
        easing: "easeOutQuart",
      },
      animations: {
        x: {
          from: 0,
        },
      },
      interaction: { mode: "nearest", intersect: true },
      onHover: (evt, activeEls) => {
        const canvas = evt?.native?.target;
        if (canvas?.style) canvas.style.cursor = activeEls?.length ? "pointer" : "default";
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => formatHumanDuration(Number(ctx.raw || 0)),
          },
        },
      },
      scales: {
        x: {
          ...axisCommon,
          beginAtZero: true,
          ticks: {
            ...axisCommon.ticks,
            callback: (v) => formatHumanDuration(v),
          },
        },
        y: { ...axisCommon, grid: { display: false } },
      },
    }),
    [axisCommon]
  );

  const doughnutOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 1600,
        easing: "easeOutCubic",
        animateRotate: true,
        animateScale: false,
      },
      interaction: { mode: "nearest", intersect: true },
      onHover: (evt, activeEls) => {
        const canvas = evt?.native?.target;
        if (canvas?.style) canvas.style.cursor = activeEls?.length ? "pointer" : "default";
      },
      plugins: {
        legend: {
          position: "right",
          labels: { color: mutedColor, boxWidth: 10 },
        },
      },
    }),
    [mutedColor]
  );

  const totalCalls = analytics?.totalCalls ?? 0;
  const answeredCalls = analytics?.answeredCalls ?? 0;
  const rate = totalCalls ? Math.round((answeredCalls / totalCalls) * 100) : 0;

  const donutEmptyMsg = emptyChartCopy("employee", analytics, analyticsLoading, t);
  const flowEmptyMsg = emptyChartCopy("flow", analytics, analyticsLoading, t);
  const talkEmptyMsg = emptyChartCopy("employee", analytics, analyticsLoading, t);

  const hasDonutRows = (analytics?.byEmployeeAnswered || []).length > 0;
  const hasFlowRows = (analytics?.byDay || []).length > 0;
  const hasTalkRows = (analytics?.byEmployeeTalkSeconds || []).length > 0;
  const hasAvgTalkRows =
    (analytics?.byEmployeeTalkSeconds || []).length > 0 &&
    (analytics?.byEmployeeAnswered || []).length > 0;

  const donutBodyRef = useRef(null);
  const avgBarBodyRef = useRef(null);
  const flowBodyRef = useRef(null);
  const talkBodyRef = useRef(null);
  const donutChartRef = useRef(null);
  const avgTalkChartRef = useRef(null);

  const donutMountReady = useChartBodyMountReady(
    !analyticsLoading && hasDonutRows,
    donutBodyRef
  );
  const avgBarMountReady = useChartBodyMountReady(
    !analyticsLoading && hasAvgTalkRows,
    avgBarBodyRef
  );
  const flowMountReady = useChartBodyMountReady(
    !analyticsLoading && hasFlowRows,
    flowBodyRef
  );
  const talkMountReady = useChartBodyMountReady(
    !analyticsLoading && hasTalkRows,
    talkBodyRef
  );

  const handleDonutChartClick = useCallback(
    (_event, elements) => {
      if (!Array.isArray(elements) || elements.length === 0) return;
      const idx = Number(elements[0]?.index);
      if (!Number.isFinite(idx)) return;
      const id = donutEmployeeIdByIndex[idx];
      if (!id) return; // "Other" slice
      onToggleEmployee?.(id);
    },
    [donutEmployeeIdByIndex, onToggleEmployee]
  );

  const handleAvgTalkChartClick = useCallback(
    (_event, elements) => {
      if (!Array.isArray(elements) || elements.length === 0) return;
      const idx = Number(elements[0]?.index);
      if (!Number.isFinite(idx)) return;
      const id = avgTalkEmployeeIdByIndex[idx];
      if (!id) return;
      onToggleEmployee?.(id);
    },
    [avgTalkEmployeeIdByIndex, onToggleEmployee]
  );

  // Force a visible enter animation after loading by resetting and replaying once mounted.
  useEffect(() => {
    if (analyticsLoading || !donutMountReady || !hasDonutRows) return;
    const chart = donutChartRef.current;
    if (!chart) return;
    chart.stop();
    chart.reset();
    chart.update();
  }, [analyticsLoading, donutMountReady, hasDonutRows, analyticsRevision]);

  useEffect(() => {
    if (analyticsLoading || !avgBarMountReady || !hasAvgTalkRows) return;
    const chart = avgTalkChartRef.current;
    if (!chart) return;
    chart.stop();
    chart.reset();
    chart.update();
  }, [analyticsLoading, avgBarMountReady, hasAvgTalkRows, analyticsRevision]);

  const kpiShowSkeleton = analyticsLoading;
  const peakKey = peakDayKey(analytics?.byDay);
  const peakText = peakDayLabel(analytics?.byDay, t);

  const donutChartKey = useMemo(() => {
    const rows = analytics?.byEmployeeAnswered || [];
    const dataPart =
      rows.map((r) => `${r.employeeId}:${r.count}`).join("|") || "empty";
    return `${dataPart}@${analyticsRevision}`;
  }, [analytics?.byEmployeeAnswered, analyticsRevision]);

  const avgTalkTimeChartKey = useMemo(() => {
    const ans = analytics?.byEmployeeAnswered || [];
    const talk = analytics?.byEmployeeTalkSeconds || [];
    const ansPart =
      ans.map((r) => `${r.employeeId}:${r.count}`).join("|") || "empty";
    const talkPart =
      talk.map((r) => `${r.employeeId}:${r.seconds}`).join("|") || "empty";
    return `${ansPart}@@${talkPart}@${analyticsRevision}`;
  }, [analytics?.byEmployeeAnswered, analytics?.byEmployeeTalkSeconds, analyticsRevision]);

  const flowChartKey = useMemo(() => {
    const days = analytics?.byDay || [];
    const dataPart =
      days.map((d) => `${d.date}:${d.total}:${d.answered}`).join("|") || "empty";
    return `${dataPart}@${analyticsRevision}`;
  }, [analytics?.byDay, analyticsRevision]);

  const talkChartKey = useMemo(() => {
    const rows = analytics?.byEmployeeTalkSeconds || [];
    const dataPart =
      rows.map((r) => `${r.employeeId}:${r.seconds}`).join("|") || "empty";
    return `${dataPart}@${analyticsRevision}`;
  }, [analytics?.byEmployeeTalkSeconds, analyticsRevision]);

  return (
    <div className="recordingsDashboard">
      <div className="recordingsDashTopBar recordingsDashReveal">
        <div className="recordingsDashTopBarLeft">
          <DateRangePicker
            value={dateRangeValue}
            onChange={onDateRangeChange}
            label={t("recordings.dashDateRangeLabel")}
            placeholder={t("recordings.dateRangePlaceholder")}
            className="recordingsDashDateRange"
            popoverClassName="recordingsDashDatePopover"
            closeOnRangeSelect
            clearButtonLabel={t("recordings.dateRangeReset")}
          />
        </div>

        {canPickEmployees ? (
          <div className="recordingsDashTopBarRight">
            <EmployeesFilter
              t={t}
              employees={employeeOptions}
              selectedIds={selectedEmployeeIds}
              onToggle={onToggleEmployee}
              onClear={onClearEmployees}
              fromMatchedEmployeeIds={analytics?.fromMatchedEmployeeIds}
              analyticsLoading={analyticsLoading}
            />
          </div>
        ) : null}
      </div>

      {listScanCapped ? (
        <div className="recordingsDashWarn recordingsDashWarn--enter">
          {t("recordings.dashScanCappedList")}
        </div>
      ) : null}

      {analytics?.scanCapped ? (
        <div className="recordingsDashWarn recordingsDashWarn--enter">
          {t("recordings.dashScanCappedAnalytics")}
        </div>
      ) : null}

      <div className="recordingsDashKpis">
        {[
          { icon: BarChart3, label: t("recordings.dashKpiTotal"), i: 0, kind: "total" },
          { icon: PieChart, label: t("recordings.dashKpiAnswered"), i: 1, kind: "answered" },
          { icon: Percent, label: t("recordings.dashKpiAnswerRate"), i: 2, kind: "rate" },
          { icon: Timer, label: t("recordings.dashKpiPeak"), i: 3, kind: "peak" },
        ].map(({ icon: Icon, label, i, kind }) => (
          <div
            key={label}
            className="recordingsDashKpi recordingsDashKpi--enter"
            style={{ "--rec-kpi-i": String(i) }}
          >
            <Icon size={18} className="recordingsDashKpiIcon" aria-hidden />

            <span
              className={`recordingsDashKpiVal ${kind === "rate" ? "recordingsDashKpiVal--sm" : ""
                } ${kind === "peak" ? "recordingsDashKpiVal--wrap" : ""}`}
            >
              {kpiShowSkeleton ? (
                kind === "peak" ? (
                  <span
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      width: "100%",
                      alignItems: "flex-start",
                    }}
                  >
                    <Skeleton
                      className="recordingsDashKpiSkeleton"
                      style={{ height: 18, width: "88%", borderRadius: 6 }}
                    />
                    <Skeleton
                      className="recordingsDashKpiSkeleton"
                      style={{ height: 18, width: "64%", borderRadius: 6 }}
                    />
                  </span>
                ) : (
                  <Skeleton
                    className="recordingsDashKpiSkeleton"
                    style={{ height: 26, width: "56%", borderRadius: 6 }}
                  />
                )
              ) : kind === "peak" ? (
                <span
                  key={`${peakKey}@${analyticsRevision}`}
                  className="recordingsDashKpiPeakText"
                >
                  {peakText}
                </span>
              ) : kind === "rate" ? (
                <span className="recordingsDashKpiRate">
                  <AnimatedInteger
                    key={analyticsRevision}
                    value={rate}
                    duration={720}
                    entranceFromZero
                  />
                  <span className="recordingsDashKpiRatePct">%</span>
                </span>
              ) : (
                <AnimatedInteger
                  key={analyticsRevision}
                  value={kind === "total" ? totalCalls : answeredCalls}
                  duration={720}
                  entranceFromZero
                />
              )}
            </span>

            <span className="recordingsDashKpiLabel">{label}</span>
          </div>
        ))}
      </div>

      <div className="recordingsDashCharts">
        <div
          className="recordingsDashChartCard recordingsDashChartCard--enter"
          style={{ "--rec-card-i": "0" }}
        >
          <h3 className="recordingsDashChartTitle">
            {t("recordings.dashChartAnsweredDonut")}
          </h3>

          <div
            ref={donutBodyRef}
            className="recordingsDashChartBody recordingsDashChartBody--donut recordingsDashChartCanvas"
          >
            {analyticsLoading ? (
              <div className="recordingsDashChartLoading">
                <span className="recordingsDashSpinner" />
              </div>
            ) : !hasDonutRows ? (
              <div className="recordingsDashChartEmpty recordingsDashReveal">
                <p>{donutEmptyMsg}</p>
              </div>
            ) : !donutMountReady ? (
              <div className="recordingsDashChartLoading">
                <span className="recordingsDashSpinner" />
              </div>
            ) : (
              <Doughnut
                ref={donutChartRef}
                key={donutChartKey}
                redraw
                data={doughnutData}
                options={doughnutOptions}
                onClick={handleDonutChartClick}
              />
            )}
          </div>
        </div>

        <div
          className="recordingsDashChartCard recordingsDashChartCard--enter"
          style={{ "--rec-card-i": "1" }}
        >
          <h3 className="recordingsDashChartTitle">
            {t("recordings.dashChartAnsweredTopBars")}
          </h3>
          <p className="recordingsDashChartHint">
            {t("recordings.dashChartAnsweredTopBarsHint")}
          </p>

          <div
            ref={avgBarBodyRef}
            className="recordingsDashChartBody recordingsDashChartBody--bars recordingsDashChartCanvas"
          >
            {analyticsLoading ? (
              <div className="recordingsDashChartLoading">
                <span className="recordingsDashSpinner" />
              </div>
            ) : !hasAvgTalkRows ? (
              <div className="recordingsDashChartEmpty recordingsDashReveal">
                <p>{talkEmptyMsg}</p>
              </div>
            ) : !avgBarMountReady ? (
              <div className="recordingsDashChartLoading">
                <span className="recordingsDashSpinner" />
              </div>
            ) : (
              <Bar
                ref={avgTalkChartRef}
                key={avgTalkTimeChartKey}
                data={avgTalkTimeTopData}
                options={avgTalkTimeTopOptions}
                onClick={handleAvgTalkChartClick}
              />
            )}
          </div>
        </div>

        <div
          className="recordingsDashChartCard recordingsDashChartCard--wide recordingsDashChartCard--enter"
          style={{ "--rec-card-i": "2" }}
        >
          <h3 className="recordingsDashChartTitle">
            {t("recordings.dashChartDailyFlow")}
          </h3>
          <p className="recordingsDashChartHint">
            {t("recordings.dashChartFlowLineHint")}
          </p>

          <div
            ref={flowBodyRef}
            className="recordingsDashChartBody recordingsDashChartBody--flow recordingsDashChartCanvas"
          >
            {analyticsLoading ? (
              <div className="recordingsDashChartLoading">
                <span className="recordingsDashSpinner" />
              </div>
            ) : !hasFlowRows ? (
              <div className="recordingsDashChartEmpty recordingsDashReveal">
                <p>{flowEmptyMsg}</p>
              </div>
            ) : !flowMountReady ? (
              <div className="recordingsDashChartLoading">
                <span className="recordingsDashSpinner" />
              </div>
            ) : (
              <Line
                key={flowChartKey}
                data={flowLineData}
                options={flowLineOptions}
              />
            )}
          </div>
        </div>

        <div
          className="recordingsDashChartCard recordingsDashChartCard--wide recordingsDashChartCard--enter"
          style={{ "--rec-card-i": "3" }}
        >
          <h3 className="recordingsDashChartTitle">
            {t("recordings.dashChartTalkBar")}
          </h3>
          <p className="recordingsDashChartHint">
            {t("recordings.dashChartTalkHint")}
          </p>

          <div
            ref={talkBodyRef}
            className="recordingsDashChartBody recordingsDashChartBody--talk recordingsDashChartCanvas"
          >
            {analyticsLoading ? (
              <div className="recordingsDashChartLoading">
                <span className="recordingsDashSpinner" />
              </div>
            ) : !hasTalkRows ? (
              <div className="recordingsDashChartEmpty recordingsDashReveal">
                <p>{talkEmptyMsg}</p>
              </div>
            ) : !talkMountReady ? (
              <div className="recordingsDashChartLoading">
                <span className="recordingsDashSpinner" />
              </div>
            ) : (
              <Bar
                key={talkChartKey}
                data={talkBarData}
                options={talkBarOptions}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
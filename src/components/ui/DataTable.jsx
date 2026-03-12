import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FixedSizeList as List } from "react-window";
import AnimatedList from "./AnimatedList";
import Skeleton from "./Skeleton";
import "../../styles/ui/data_table.css";
import "../../styles/ui/animated_list.css";

const VIRTUALIZE_THRESHOLD = 25;
const VIRTUAL_ROW_HEIGHT = 56;
const VIRTUAL_BODY_HEIGHT = 420;

export default function DataTable({
  columns,
  sortKey,
  sortDir,
  onSort,
  loading = false,
  skeletonRowCount = 8,
  emptyText = "No results.",
  emptyContent = null,
  rows = [],
  renderRow,
  footer = null,
  className = "",
  style,
  minWidth,
  getRowId,
  rowIdPrefix = "holiday-row-",
  onRowClick,
  onRowContextMenu,
  useAnimatedList = true,
  showGradients = false,
  enableArrowNavigation = false,
  displayScrollbar = true,
  virtualizedBodyHeight = VIRTUAL_BODY_HEIGHT,
  virtualizedRowHeight = VIRTUAL_ROW_HEIGHT,
  disableVirtualization = false,
}) {
  const FADE_MS = 320;
  const MIN_LOADING_VISIBLE_MS = 420;
  const grid = useMemo(() => columns.map((c) => c.width || "1fr").join(" "), [columns]);
  const sortMark = (key) => (sortKey === key ? (sortDir === "asc" ? "▲" : "▼") : "");
  const [showLoading, setShowLoading] = useState(loading);
  const [loadingPhase, setLoadingPhase] = useState(loading ? "enter" : "exit");
  const [contentFadeIn, setContentFadeIn] = useState(!loading);
  const [lastResolvedRowCount, setLastResolvedRowCount] = useState(
    Array.isArray(rows) ? rows.length : 0
  );
  const fadeTimerRef = useRef(null);
  const loadingStartedAtRef = useRef(loading ? Date.now() : 0);

  const alignClass = (align) => {
    if (align === "right") return "right";
    if (align === "center") return "center";
    return ""; // left default
  };

  const skeletonRows = useMemo(() => {
    const rowsCount = Array.isArray(rows) ? rows.length : 0;
    const fallback = Math.max(3, Math.min(20, Number(skeletonRowCount) || 8));
    const preferred =
      loading && lastResolvedRowCount > 0
        ? lastResolvedRowCount
        : loading && rowsCount > 0
          ? rowsCount
          : fallback;
    const n = Math.max(1, Math.min(20, preferred));
    return Array.from({ length: n }, (_, i) => i);
  }, [rows, loading, skeletonRowCount, lastResolvedRowCount]);

  useEffect(() => {
    if (!loading) {
      setLastResolvedRowCount(Array.isArray(rows) ? rows.length : 0);
    }
  }, [loading, rows]);

  useEffect(() => {
    if (fadeTimerRef.current) {
      clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }

    if (loading) {
      loadingStartedAtRef.current = Date.now();
      setShowLoading(true);
      setLoadingPhase("enter");
      setContentFadeIn(false);
      return;
    }

    if (showLoading) {
      setLoadingPhase("exit");
      const elapsed = loadingStartedAtRef.current ? Date.now() - loadingStartedAtRef.current : 0;
      const waitMs = Math.max(FADE_MS, MIN_LOADING_VISIBLE_MS - elapsed);
      fadeTimerRef.current = setTimeout(() => {
        setShowLoading(false);
        setContentFadeIn(true);
        fadeTimerRef.current = null;
      }, waitMs);
      return;
    }

    setContentFadeIn(true);
  }, [loading, showLoading]);

  useEffect(
    () => () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    },
    []
  );

  const useVirtualized = !disableVirtualization && rows.length > VIRTUALIZE_THRESHOLD;
  const Row = useCallback(
    ({ index, style: rowStyle }) => {
      const r = rows[index];
      const rowId = getRowId ? getRowId(r, index) : null;
      return (
        <div
          className={`dt-row${onRowClick ? " dt-row--clickable" : ""}`}
          style={rowStyle}
          data-row-id={rowId ?? undefined}
          id={rowId != null && rowId !== "" ? `${rowIdPrefix}${rowId}` : undefined}
          role={onRowClick ? "button" : undefined}
          tabIndex={onRowClick ? 0 : undefined}
          onClick={onRowClick ? () => onRowClick(r) : undefined}
          onContextMenu={onRowContextMenu ? (event) => onRowContextMenu(event, r, index) : undefined}
          onKeyDown={onRowClick ? (e) => e.key === "Enter" && onRowClick(r) : undefined}
        >
          {renderRow?.(r)}
        </div>
      );
    },
    [rows, getRowId, rowIdPrefix, onRowClick, onRowContextMenu, renderRow]
  );

  const bodyContent = useVirtualized && rows.length > 0 ? (
    <div className="dt-body dt-body--virtualized" style={{ height: virtualizedBodyHeight }}>
      <List
        height={virtualizedBodyHeight}
        itemCount={rows.length}
        itemSize={virtualizedRowHeight}
        width="100%"
        overscanCount={5}
      >
        {Row}
      </List>
    </div>
  ) : useAnimatedList && rows.length > 0 ? (
    <AnimatedList
      items={rows}
      renderItem={(r) => renderRow?.(r)}
      onItemSelect={onRowClick}
      showGradients={showGradients}
      enableArrowNavigation={enableArrowNavigation}
      displayScrollbar={displayScrollbar}
      className="dt-body"
      itemClassName={`dt-row${onRowClick ? " dt-row--clickable" : ""}`}
      onItemContextMenu={onRowContextMenu}
      getItemKey={(r, idx) => r?._id ?? r?.id ?? idx}
      getItemId={(r, idx) => {
        const id = getRowId ? getRowId(r, idx) : null;
        return id != null && id !== "" ? `${rowIdPrefix}${id}` : undefined;
      }}
      getItemData={getRowId ? (r, idx) => ({ "data-row-id": getRowId(r, idx) }) : undefined}
    />
  ) : !rows.length ? null : (
    <div className="dt-body">
      {rows.map((r, idx) => {
        const rowId = getRowId ? getRowId(r, idx) : null;
        return (
          <div
            className={`dt-row${onRowClick ? " dt-row--clickable" : ""}`}
            key={r?._id || r?.id || idx}
            data-row-id={rowId ?? undefined}
            id={rowId != null && rowId !== "" ? `${rowIdPrefix}${rowId}` : undefined}
            role={onRowClick ? "button" : undefined}
            tabIndex={onRowClick ? 0 : undefined}
            onClick={onRowClick ? () => onRowClick(r) : undefined}
            onContextMenu={onRowContextMenu ? (event) => onRowContextMenu(event, r, idx) : undefined}
            onKeyDown={onRowClick ? (e) => e.key === "Enter" && onRowClick(r) : undefined}
          >
            {renderRow?.(r)}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className={`dt ${className}`} style={{ ...style, ["--dt-grid"]: grid, minWidth }}>
      <div className="dt-head">
        {columns.map((c) => {
          const base = `dt-th ${alignClass(c.align)} ${c.headerClassName || ""}`;

          if (!c.sortable) return <div key={c.key} className={base}>{c.label}</div>;

          return (
            <button
              key={c.key}
              className={`${base} sort`}
              type="button"
              onClick={() => onSort?.(c.key)}
            >
              <span>{c.label}</span>
              <span className="dt-sortMark">{sortMark(c.key)}</span>
            </button>
          );
        })}
      </div>

      {showLoading ? (
        <div
          className={`dt-body dt-body--skeleton ${loadingPhase === "enter" ? "dt-fade-in" : "dt-fade-out"}`}
          aria-busy="true"
        >
          {skeletonRows.map((i) => (
            <div className="dt-row dt-row--skeleton" key={`sk-${i}`}>
              {columns.map((c, colIdx) => (
                <div className={`td ${alignClass(c.align)}`} key={`${c.key}-${colIdx}`}>
                  <Skeleton
                    className="dt-skeleton"
                    style={{
                      height: 16,
                      width: `${Math.max(34, 92 - colIdx * 8)}%`,
                      borderRadius: 6,
                    }}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className={`dt-content ${contentFadeIn ? "dt-fade-in" : ""}`}>
          {!rows.length ? <div className="dt-empty">{emptyContent ?? emptyText}</div> : bodyContent}
        </div>
      )}

      {footer ? <div className="dt-footer">{footer}</div> : null}
    </div>
  );
}

// AnimatedList — list with fade-in + bounce, optional gradients, arrow navigation, scrollbar
import React, { useCallback, useEffect, useRef, useState } from "react";
import "../../styles/ui/animated_list.css";

function getItemLabel(item) {
  if (item == null) return "";
  if (typeof item === "object" && "label" in item) return String(item.label);
  return String(item);
}

export default function AnimatedList({
  items = [],
  onItemSelect,
  onItemContextMenu,
  renderItem,
  showGradients = false,
  enableArrowNavigation = false,
  displayScrollbar = false,
  className = "",
  itemClassName = "",
  getItemKey,
  getItemId,
  getItemData,
}) {
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const listRef = useRef(null);
  const itemRefs = useRef([]);

  const selectItem = useCallback(
    (item, index) => {
      if (typeof onItemSelect === "function") onItemSelect(item, index);
    },
    [onItemSelect]
  );

  useEffect(() => {
    setSelectedIndex(-1);
  }, [items]);

  useEffect(() => {
    if (!enableArrowNavigation || !listRef.current) return;

    const handleKeyDown = (e) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Enter") return;
      e.preventDefault();

      const len = items.length;
      if (len === 0) return;

      if (e.key === "Enter") {
        if (selectedIndex >= 0 && selectedIndex < len) {
          selectItem(items[selectedIndex], selectedIndex);
        }
        return;
      }

      const step = e.key === "ArrowDown" ? 1 : -1;
      let next = selectedIndex + step;
      if (next < 0) next = 0;
      if (next >= len) next = len - 1;
      setSelectedIndex(next);

      const el = itemRefs.current[next];
      if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    };

    const list = listRef.current;
    list.addEventListener("keydown", handleKeyDown);
    return () => list.removeEventListener("keydown", handleKeyDown);
  }, [enableArrowNavigation, items, selectedIndex, selectItem]);

  const setItemRef = useCallback((el, i) => {
    itemRefs.current[i] = el;
  }, []);

  if (!Array.isArray(items)) return null;

  return (
    <div
      ref={listRef}
      className={`animatedList ${showGradients ? "animatedList--gradients" : ""} ${displayScrollbar ? "animatedList--scrollbar" : ""} ${className}`}
      role="listbox"
      aria-label="List"
      tabIndex={enableArrowNavigation ? 0 : undefined}
    >
      {items.map((item, index) => {
        const key = getItemKey ? getItemKey(item, index) : item?._id ?? item?.id ?? index;
        const id = getItemId ? getItemId(item, index) : undefined;
        const dataAttrs = getItemData ? getItemData(item, index) : undefined;
        const isSelected = selectedIndex === index;
        const animationDelay = `${Math.min(index, 10) * 0.022}s`;
        return (
          <div
            key={key}
            ref={(el) => setItemRef(el, index)}
            role="option"
            aria-selected={isSelected}
            tabIndex={-1}
            id={id}
            {...(dataAttrs && typeof dataAttrs === "object" ? dataAttrs : {})}
            className={`animatedList-item ${isSelected ? "animatedList-item--selected" : ""} ${itemClassName}`.trim()}
            style={{ animationDelay }}
            onClick={() => selectItem(item, index)}
            onContextMenu={onItemContextMenu ? (event) => onItemContextMenu(event, item, index) : undefined}
          >
            {renderItem ? renderItem(item, index) : getItemLabel(item)}
          </div>
        );
      })}
    </div>
  );
}

import React, { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownCircle, UserRound, Wallet } from "lucide-react";
import "../../styles/ui/driver_context_menu.css";

const VIEWPORT_GAP = 10;
const MENU_WIDTH = 248;
const MENU_HEIGHT_ESTIMATE = 240;

function clampMenuPosition(x, y) {
  if (typeof window === "undefined") return { x, y };
  const maxX = Math.max(VIEWPORT_GAP, window.innerWidth - MENU_WIDTH - VIEWPORT_GAP);
  const maxY = Math.max(VIEWPORT_GAP, window.innerHeight - MENU_HEIGHT_ESTIMATE - VIEWPORT_GAP);
  return {
    x: Math.max(VIEWPORT_GAP, Math.min(Number(x) || 0, maxX)),
    y: Math.max(VIEWPORT_GAP, Math.min(Number(y) || 0, maxY)),
  };
}

function resolveDriverId(driver) {
  if (!driver || typeof driver !== "object") return "";
  const value = driver.id ?? driver.externalId ?? driver._id ?? "";
  if (value == null || value === "") return "";
  return String(value);
}

export default function DriverContextMenu({
  menu,
  onClose,
  onAction,
  canViewProfile = true,
  canCashIn = true,
  canCashOut = true,
}) {
  const menuRef = useRef(null);
  const isOpen = Boolean(menu?.open && menu?.driver);

  const position = useMemo(() => {
    if (!isOpen) return { x: 0, y: 0 };
    return clampMenuPosition(menu?.x, menu?.y);
  }, [isOpen, menu?.x, menu?.y]);

  const actions = useMemo(() => {
    const list = [];
    if (canViewProfile) {
      list.push({ key: "profile", label: "Open profile", icon: UserRound, tone: "neutral" });
    }
    if (canCashIn) {
      list.push({ key: "cashin", label: "Cash in", icon: ArrowDownCircle, tone: "positive" });
    }
    if (canCashOut) {
      list.push({ key: "cashout", label: "Cash out", icon: Wallet, tone: "accent" });
    }
    return list;
  }, [canViewProfile, canCashIn, canCashOut]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleEscape = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    const handlePointerDown = (event) => {
      if (menuRef.current?.contains(event.target)) return;
      onClose?.();
    };
    const handleContextOutside = (event) => {
      if (menuRef.current?.contains(event.target)) return;
      onClose?.();
    };
    const handleRepositionClose = () => onClose?.();

    document.addEventListener("keydown", handleEscape);
    document.addEventListener("mousedown", handlePointerDown, true);
    document.addEventListener("contextmenu", handleContextOutside, true);
    window.addEventListener("resize", handleRepositionClose);
    window.addEventListener("scroll", handleRepositionClose, true);

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("mousedown", handlePointerDown, true);
      document.removeEventListener("contextmenu", handleContextOutside, true);
      window.removeEventListener("resize", handleRepositionClose);
      window.removeEventListener("scroll", handleRepositionClose, true);
    };
  }, [isOpen, onClose]);

  if (!isOpen || actions.length === 0) return null;

  const driver = menu.driver;
  const driverName = driver?.name || "Driver";
  const phoneText = driver?.phone ? String(driver.phone) : "No phone";
  const driverId = resolveDriverId(driver);

  return createPortal(
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        className="driverContextMenu"
        role="menu"
        aria-label={`Driver actions for ${driverName}`}
        initial={{ opacity: 0, scale: 0.95, y: 10, filter: "blur(4px)" }}
        animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
        exit={{ opacity: 0, scale: 0.98, y: 6, filter: "blur(2px)" }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        style={{ left: `${position.x}px`, top: `${position.y}px` }}
      >
        <div className="driverContextMenuHead">
          <div className="driverContextMenuDriverInfo">
            <span className="driverContextMenuName">{driverName}</span>
            <span className="driverContextMenuMeta">
              {driverId ? `ID ${driverId}` : "ID -"} | {phoneText}
            </span>
          </div>
        </div>

        <div className="driverContextMenuActions">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.key}
                type="button"
                role="menuitem"
                className={`driverContextMenuAction driverContextMenuAction--${action.tone}`}
                onClick={() => {
                  onAction?.(action.key, driver);
                  onClose?.();
                }}
              >
                <span className="driverContextMenuActionIcon">
                  <Icon size={15} />
                </span>
                <span className="driverContextMenuActionLabel">{action.label}</span>
              </button>
            );
          })}
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

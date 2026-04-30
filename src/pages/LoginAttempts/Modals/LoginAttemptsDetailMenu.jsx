import React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import moment from "moment";

export default function LoginAttemptsDetailMenu({
  detailMenu,
  detailGroups,
  menuContainerRef,
  onClose,
  tr = (key, fallback) => fallback || key,
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {detailMenu && (
        <>
          <motion.div
            key="la-detail-backdrop"
            className="la-detail-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            onMouseDown={onClose}
            aria-hidden
          />
          <motion.div
            key={`${detailMenu.email}-${detailMenu.type}`}
            ref={menuContainerRef}
            className="la-detail-menu"
            initial={{ opacity: 0, scale: 0.96, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -6 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            style={{
              position: "fixed",
              left: detailMenu?.anchorRect
                ? Math.max(
                    8,
                    Math.min(
                      detailMenu.anchorRect.left,
                      typeof window !== "undefined" ? window.innerWidth - 320 - 8 : detailMenu.anchorRect.left
                    )
                  )
                : "50%",
              top: detailMenu?.anchorRect ? detailMenu.anchorRect.bottom + 8 : "50%",
              transform: detailMenu?.anchorRect ? "none" : "translate(-50%, -50%)",
            }}
          >
            <div className={`la-detail-menu__header la-detail-menu__header--${detailMenu?.type || "success"}`}>
              {detailMenu?.type === "success" ? (
                <>{tr("loginAttempts.detail.successTitle", "Successful logins")} - {detailMenu?.email}</>
              ) : (
                <>{tr("loginAttempts.detail.failTitle", "Failed logins")} - {detailMenu?.email}</>
              )}
            </div>
            <div className="la-detail-menu__body">
              {detailMenu?.loading ? (
                <div className="la-detail-menu__loading">
                  <Loader2 size={20} className="la-detail-menu__spinner" />
                  <span>{tr("loginAttempts.detail.loading", "Loading...")}</span>
                </div>
              ) : detailGroups.length === 0 ? (
                <div className="la-detail-menu__empty">{tr("loginAttempts.detail.empty", "No attempts in this period")}</div>
              ) : (
                <div className="la-detail-menu__groups">
                  {detailGroups.map((group, gi) => (
                    <motion.div
                      key={group.dateKey}
                      className={`la-detail-menu__group la-detail-menu__group--${detailMenu?.type || "success"}`}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: gi * 0.06, duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                    >
                      <div className="la-detail-menu__date-wrap">
                        <span className="la-detail-menu__date-dot" aria-hidden />
                        <div className="la-detail-menu__date">{group.dateLabel}</div>
                      </div>
                      <ul className="la-detail-menu__times">
                        {group.times.map((t, ti) => (
                          <motion.li
                            key={t}
                            className="la-detail-menu__time"
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: gi * 0.06 + (ti + 1) * 0.04, duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                          >
                            <span className="la-detail-menu__time-value">{moment(t).format("h:mm A")}</span>
                          </motion.li>
                        ))}
                      </ul>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}

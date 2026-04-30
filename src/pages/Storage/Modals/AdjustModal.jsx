import React from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";

export default function AdjustModal({
  adjustModal,
  setAdjustModal,
  adjustAmount,
  setAdjustAmount,
  handleAdjust,
  adjusting,
  t,
}) {
  return (
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
  );
}

import React from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";

export default function AddModal({
  setAddModalOpen,
  addName,
  setAddName,
  addQuantity,
  setAddQuantity,
  handleCreate,
  adding,
  t,
}) {
  return (
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
  );
}

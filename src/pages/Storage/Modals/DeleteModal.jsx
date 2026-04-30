import React from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";

export default function DeleteModal({
  deleteModal,
  setDeleteModal,
  handleDelete,
  deletingId,
  t,
}) {
  return (
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
  );
}

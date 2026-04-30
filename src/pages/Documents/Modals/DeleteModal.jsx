import React from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";

export default function DeleteModal({
  deleteModal,
  setDeleteModal,
  confirmDelete,
  deletingId,
}) {
  return (
    <motion.div
      key="delete-modal"
      className="documentsViewBackdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="doc-delete-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={(e) => e.target === e.currentTarget && setDeleteModal(null)}
    >
      <motion.div
        className="documentsViewModal documentsUploadModal documentsDeleteModal"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="documentsViewHeader">
          <h2 id="doc-delete-title">Delete document</h2>
          <button
            type="button"
            className="documentsViewBtn documentsViewBtn--close"
            onClick={() => setDeleteModal(null)}
          >
            <X size={18} />
          </button>
        </header>
        <div className="documentsUploadBody">
          <p className="documentsDeleteMessage">
            Are you sure you want to delete <strong>"{deleteModal.title}"</strong>? This cannot be undone.
          </p>
          <div className="documentsUploadFooter">
            <button type="button" className="documentsViewBtn" onClick={() => setDeleteModal(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="documentsViewBtn documentsCardBtn--danger"
              onClick={confirmDelete}
              disabled={deletingId === deleteModal.id}
            >
              {deletingId === deleteModal.id ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

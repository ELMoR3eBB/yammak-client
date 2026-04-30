import React from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";

export default function EditModal({
  editModal,
  setEditModal,
  handleUpdate,
  updating,
}) {
  return (
    <motion.div
      key="edit-modal"
      className="documentsViewBackdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="doc-edit-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={(e) => e.target === e.currentTarget && setEditModal(null)}
    >
      <motion.div
        className="documentsViewModal documentsUploadModal"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="documentsViewHeader">
          <h2 id="doc-edit-title">Edit document</h2>
          <button
            type="button"
            className="documentsViewBtn documentsViewBtn--close"
            onClick={() => setEditModal(null)}
          >
            <X size={18} />
          </button>
        </header>
        <div className="documentsUploadBody">
          <label className="documentsUploadLabel">Title</label>
          <input
            type="text"
            className="documentsUploadInput"
            value={editModal.title ?? ""}
            onChange={(e) => setEditModal((p) => ({ ...p, title: e.target.value }))}
            placeholder="Document title"
          />
          <label className="documentsUploadLabel">Replace PDF (optional)</label>
          <div className="documentsUploadFileRow">
            <button
              type="button"
              className="documentsUploadSelect"
              onClick={async () => {
                const res = await window.api?.pickPdf?.();
                if (res?.ok && res.path) setEditModal((p) => ({ ...p, filePath: res.path }));
              }}
            >
              {editModal.filePath ? "Change PDF" : "Select new PDF"}
            </button>
            <span className="documentsUploadFileName">
              {editModal.filePath ? editModal.filePath.split(/[/\\]/).pop() : "Keep current"}
            </span>
          </div>
          <div className="documentsUploadFooter">
            <button type="button" className="documentsViewBtn" onClick={() => setEditModal(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="documentsViewBtn documentsViewBtn--print"
              onClick={handleUpdate}
              disabled={updating}
            >
              {updating ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

import React from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";

export default function UploadModal({
  setUploadModalOpen,
  uploadTitle,
  setUploadTitle,
  uploadFilePath,
  handleSelectPdf,
  handleUpload,
  uploading,
}) {
  return (
    <motion.div
      key="upload-modal"
      className="documentsViewBackdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="doc-upload-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={(e) => e.target === e.currentTarget && setUploadModalOpen(false)}
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
          <h2 id="doc-upload-title">Upload PDF</h2>
          <button
            type="button"
            className="documentsViewBtn documentsViewBtn--close"
            onClick={() => setUploadModalOpen(false)}
          >
            <X size={18} />
          </button>
        </header>
        <div className="documentsUploadBody">
          <label className="documentsUploadLabel">Title (optional)</label>
          <input
            type="text"
            className="documentsUploadInput"
            value={uploadTitle}
            onChange={(e) => setUploadTitle(e.target.value)}
            placeholder="Document title"
          />
          <label className="documentsUploadLabel">PDF file</label>
          <div className="documentsUploadFileRow">
            <button type="button" className="documentsUploadSelect" onClick={handleSelectPdf}>
              {uploadFilePath ? "Change PDF" : "Select PDF"}
            </button>
            <span className="documentsUploadFileName">
              {uploadFilePath ? uploadFilePath.split(/[/\\]/).pop() : "No file selected"}
            </span>
          </div>
          <div className="documentsUploadFooter">
            <button
              type="button"
              className="documentsViewBtn"
              onClick={() => setUploadModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="documentsViewBtn documentsViewBtn--print"
              onClick={handleUpload}
              disabled={!uploadFilePath || uploading}
            >
              {uploading ? "Uploading…" : "Upload"}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

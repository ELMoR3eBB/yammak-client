import React from "react";
import { motion } from "framer-motion";
import { X, Printer } from "lucide-react";
import DocumentsPdfViewer from "../Components/DocumentsPdfViewer.jsx";

export default function ViewModal({ viewPdf, handleCloseView, handlePrint }) {
  return (
    <motion.div
      key="view-modal"
      className="documentsViewBackdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="doc-view-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={(e) => e.target === e.currentTarget && handleCloseView()}
    >
      <motion.div
        className="documentsViewModal"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="documentsViewHeader">
          <h2 id="doc-view-title" className="documentsViewTitle">
            {viewPdf.title || "Document"}
          </h2>
          <div className="documentsViewActions">
            <button
              type="button"
              className="documentsViewBtn documentsViewBtn--print"
              onClick={handlePrint}
            >
              <Printer size={18} />
              Print
            </button>
            <button
              type="button"
              className="documentsViewBtn documentsViewBtn--close"
              onClick={handleCloseView}
            >
              <X size={18} />
              Close
            </button>
          </div>
        </header>
        <div className="documentsViewBody">
          <DocumentsPdfViewer file={viewPdf.dataUrl} className="documentsPdfViewer" />
        </div>
      </motion.div>
    </motion.div>
  );
}

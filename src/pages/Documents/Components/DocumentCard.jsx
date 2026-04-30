import React from "react";
import { motion } from "framer-motion";
import { FileText, Eye, Printer, Pencil, Trash2 } from "lucide-react";
import { formatDate } from "../Documents.jsx";

export default function DocumentCard({
  doc,
  canUse,
  canCreate,
  handleOpenView,
  handlePrint,
  setEditModal,
  setDeleteModal,
  deletingId,
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
      transition={{ duration: 0.25 }}
      className="documentsCard"
    >
      <div className="documentsCardMain">
        <div className="documentsCardIconWrap">
          <FileText size={22} className="documentsCardIcon" />
        </div>
        <div className="documentsCardInfo">
          <span className="documentsCardTitle">{doc.title || "Untitled"}</span>
          <span className="documentsCardMeta">
            Uploaded by {doc.uploadedByName || "—"} · {formatDate(doc.createdAt)}
          </span>
          <span className="documentsCardMeta documentsCardMeta--print">
            Printed {doc.printCount ?? 0} time{(doc.printCount ?? 0) === 1 ? "" : "s"}
            {doc.printCount > 0 && (doc.lastPrintedByName || doc.lastPrintedAt) && (
              <>
                {" · "}Last printed by {doc.lastPrintedByName || "—"}
                {doc.lastPrintedAt ? ` on ${formatDate(doc.lastPrintedAt)}` : ""}
              </>
            )}
          </span>
        </div>
      </div>
      <div className="documentsCardActions">
        {canUse && (
          <>
            <button
              type="button"
              className="documentsCardBtn"
              onClick={() => handleOpenView(doc)}
              title="View"
            >
              <Eye size={18} />
              View
            </button>
            <button
              type="button"
              className="documentsCardBtn"
              onClick={() => handleOpenView(doc).then(() => setTimeout(handlePrint, 300))}
              title="Print"
            >
              <Printer size={18} />
              Print
            </button>
          </>
        )}
        {canCreate && (
          <>
            <button
              type="button"
              className="documentsCardBtn"
              onClick={() => setEditModal({ id: doc.id, title: doc.title })}
              title="Edit"
            >
              <Pencil size={18} />
              Edit
            </button>
            <button
              type="button"
              className="documentsCardBtn documentsCardBtn--danger"
              onClick={() => setDeleteModal({ id: doc.id, title: doc.title || "Untitled" })}
              disabled={deletingId === doc.id}
              title="Delete"
            >
              <Trash2 size={18} />
              Delete
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}

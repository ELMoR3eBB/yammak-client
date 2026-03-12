// Documents — upload, list, view and print PDFs. Permissions: documents.create, documents.use
import React, { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Plus, Eye, Printer, Pencil, Trash2, X } from "lucide-react";
import { useNotification } from "../../NotificationProvider";
import { hasPermission } from "../../../helpers/permissions";
import DocumentsPdfViewer from "./DocumentsPdfViewer";
import "../../../styles/pages/audit/audit_logs.css";
import "../../../styles/pages/documents/documents.css";

function formatDate(d) {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

export default function Documents({ account }) {
  const notify = useNotification();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewPdf, setViewPdf] = useState(null); // { id, dataUrl, title }
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadFilePath, setUploadFilePath] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [editModal, setEditModal] = useState(null); // { id, title, filePath? }
  const [updating, setUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [dropUploading, setDropUploading] = useState(false);
  const [deleteModal, setDeleteModal] = useState(null); // { id, title }

  const canCreate = hasPermission(account, "documents.create");
  const canUse = hasPermission(account, "documents.use");

  const fetchList = useCallback(async () => {
    if (!window.api?.documentsList) return;
    setLoading(true);
    const res = await window.api.documentsList();
    setLoading(false);
    if (res?.ok && Array.isArray(res.documents)) setDocuments(res.documents);
    else if (res?.error === "forbidden") setDocuments([]);
  }, []);

  useEffect(() => {
    if (canUse || canCreate) fetchList();
    else setLoading(false);
  }, [canUse, canCreate, fetchList]);

  const handleOpenView = useCallback(async (doc) => {
    if (!window.api?.documentsGetFile) return;
    const res = await window.api.documentsGetFile(doc.id);
    if (res?.ok && res.dataUrl) {
      setViewPdf({ id: doc.id, dataUrl: res.dataUrl, title: doc.title });
    } else {
      notify?.error?.(res?.error === "not_found" ? "Document not found." : "Failed to load PDF.", "Documents");
    }
  }, [notify]);

  const handlePrint = useCallback(async () => {
    if (!viewPdf) return;
    if (window.api?.documentsPrintCount) {
      await window.api.documentsPrintCount(viewPdf.id);
      fetchList();
    }
    window.print();
  }, [viewPdf, fetchList]);

  const handleCloseView = useCallback(() => {
    setViewPdf(null);
  }, []);

  const handleSelectPdf = useCallback(async () => {
    if (!window.api?.pickPdf) return;
    const res = await window.api.pickPdf();
    if (res?.ok && res.path) setUploadFilePath(res.path);
  }, []);

  const handleUpload = useCallback(async () => {
    if (!uploadFilePath || !window.api?.documentsUpload) return;
    setUploading(true);
    const res = await window.api.documentsUpload({
      title: (uploadTitle || "").trim() || undefined,
      filePath: uploadFilePath,
    });
    setUploading(false);
    if (res?.ok) {
      notify?.success?.("PDF uploaded.", "Documents");
      setUploadModalOpen(false);
      setUploadTitle("");
      setUploadFilePath(null);
      fetchList();
    } else {
      notify?.error?.(res?.error || "Upload failed", "Documents");
    }
  }, [uploadTitle, uploadFilePath, notify, fetchList]);

  const handleUpdate = useCallback(async () => {
    if (!editModal?.id || !window.api?.documentsUpdate) return;
    setUpdating(true);
    const res = await window.api.documentsUpdate({
      id: editModal.id,
      title: (editModal.title || "").trim() || undefined,
      filePath: editModal.filePath || undefined,
    });
    setUpdating(false);
    if (res?.ok) {
      notify?.success?.("Document updated.", "Documents");
      setEditModal(null);
      fetchList();
    } else {
      notify?.error?.(res?.error || "Update failed", "Documents");
    }
  }, [editModal, notify, fetchList]);

  const handleDelete = useCallback(async (id) => {
    if (!window.api?.documentsDelete) return;
    setDeletingId(id);
    const res = await window.api.documentsDelete(id);
    setDeletingId(null);
    setDeleteModal(null);
    if (res?.ok) {
      notify?.success?.("Document deleted.", "Documents");
      if (viewPdf?.id === id) setViewPdf(null);
      fetchList();
    } else {
      notify?.error?.(res?.error || "Delete failed", "Documents");
    }
  }, [notify, fetchList, viewPdf?.id]);

  const confirmDelete = useCallback(() => {
    if (deleteModal?.id) handleDelete(deleteModal.id);
  }, [deleteModal?.id, handleDelete]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (canCreate) setIsDragOver(true);
  }, [canCreate]);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget)) setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    async (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      if (!canCreate || !window.api?.documentsUploadFromBuffer) return;
      const file = Array.from(e.dataTransfer?.files || []).find(
        (f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name)
      );
      if (!file) {
        notify?.error?.("Please drop a PDF file.", "Documents");
        return;
      }
      setDropUploading(true);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const fileName = file.name || "document.pdf";
        const suggestedTitle = fileName.replace(/\.pdf$/i, "") || "Untitled";
        const res = await window.api.documentsUploadFromBuffer({
          title: suggestedTitle,
          arrayBuffer,
          fileName,
        });
        if (res?.ok) {
          const doc = res.document ?? res;
          notify?.success?.("PDF uploaded. Set a title below.", "Documents");
          fetchList();
          setEditModal({ id: doc.id, title: doc.title ?? suggestedTitle });
        } else {
          notify?.error?.(res?.error || "Upload failed", "Documents");
        }
      } catch (err) {
        notify?.error?.("Failed to upload PDF.", "Documents");
      } finally {
        setDropUploading(false);
      }
    },
    [canCreate, notify, fetchList]
  );

  if (!canUse && !canCreate) {
    return (
      <div className="auditLogsPage documentsPage">
        <header className="auditLogsHeader">
          <div className="auditLogsHeaderIcon">
            <FileText size={24} />
          </div>
          <div className="auditLogsHeaderText">
            <h1 className="auditLogsTitle">Documents</h1>
            <p className="auditLogsSubtitle">You don&apos;t have permission to view or manage documents.</p>
          </div>
        </header>
      </div>
    );
  }

  return (
    <div className="auditLogsPage documentsPage">
      <header className="auditLogsHeader">
        <div className="auditLogsHeaderIcon">
          <FileText size={24} />
        </div>
        <div className="auditLogsHeaderText">
          <h1 className="auditLogsTitle">Documents</h1>
          <p className="auditLogsSubtitle">Upload PDFs and use them for viewing or printing</p>
        </div>
        {canCreate && (
          <button
            type="button"
            className="documentsUploadBtn"
            onClick={() => {
              setUploadModalOpen(true);
              setUploadTitle("");
              setUploadFilePath(null);
            }}
          >
            <Plus size={18} />
            Upload PDF
          </button>
        )}
      </header>

      <main
        className={`auditLogsMain documentsDropZone ${isDragOver ? "documentsDropZone--active" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {dropUploading && (
          <div className="documentsDropOverlay">
            <div className="documentsSpinner" aria-hidden />
            <p>Uploading PDF…</p>
          </div>
        )}
        <section className="auditLogsSection">
          {loading ? (
            <div className="documentsLoading">
              <div className="documentsSpinner" aria-hidden />
              <p>Loading documents…</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="documentsEmpty">
              <FileText size={48} className="documentsEmptyIcon" />
              <p>No documents yet.</p>
              {canCreate && (
                <p className="documentsEmptyHint">Drag and drop a PDF here to upload</p>
              )}
              {canCreate && (
                <button type="button" className="documentsEmptyUpload" onClick={() => setUploadModalOpen(true)}>
                  Upload your first PDF
                </button>
              )}
            </div>
          ) : (
            <div className="documentsList">
              <AnimatePresence initial={false}>
                {documents.map((doc) => (
                  <motion.div
                    key={doc.id}
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
                          {(doc.printCount > 0 && (doc.lastPrintedByName || doc.lastPrintedAt)) && (
                            <> · Last printed by {doc.lastPrintedByName || "—"} {doc.lastPrintedAt ? ` on ${formatDate(doc.lastPrintedAt)}` : ""}</>
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
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>
      </main>

      {/* View / Print modal — in-app PDF viewer */}
      <AnimatePresence>
        {viewPdf && (
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
                <h2 id="doc-view-title" className="documentsViewTitle">{viewPdf.title || "Document"}</h2>
                <div className="documentsViewActions">
                  <button type="button" className="documentsViewBtn documentsViewBtn--print" onClick={handlePrint}>
                    <Printer size={18} />
                    Print
                  </button>
                  <button type="button" className="documentsViewBtn documentsViewBtn--close" onClick={handleCloseView}>
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
        )}
      </AnimatePresence>

      {/* Upload modal */}
      <AnimatePresence>
        {uploadModalOpen && (
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
                <button type="button" className="documentsViewBtn documentsViewBtn--close" onClick={() => setUploadModalOpen(false)}>
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
                  <span className="documentsUploadFileName">{uploadFilePath ? uploadFilePath.split(/[/\\]/).pop() : "No file selected"}</span>
                </div>
                <div className="documentsUploadFooter">
                  <button type="button" className="documentsViewBtn" onClick={() => setUploadModalOpen(false)}>Cancel</button>
                  <button type="button" className="documentsViewBtn documentsViewBtn--print" onClick={handleUpload} disabled={!uploadFilePath || uploading}>
                    {uploading ? "Uploading…" : "Upload"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit modal */}
      <AnimatePresence>
        {editModal && (
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
                <button type="button" className="documentsViewBtn documentsViewBtn--close" onClick={() => setEditModal(null)}>
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
                  <span className="documentsUploadFileName">{editModal.filePath ? editModal.filePath.split(/[/\\]/).pop() : "Keep current"}</span>
                </div>
                <div className="documentsUploadFooter">
                  <button type="button" className="documentsViewBtn" onClick={() => setEditModal(null)}>Cancel</button>
                  <button type="button" className="documentsViewBtn documentsViewBtn--print" onClick={handleUpdate} disabled={updating}>
                    {updating ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {deleteModal && (
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
                <button type="button" className="documentsViewBtn documentsViewBtn--close" onClick={() => setDeleteModal(null)}>
                  <X size={18} />
                </button>
              </header>
              <div className="documentsUploadBody">
                <p className="documentsDeleteMessage">
                  Are you sure you want to delete <strong>"{deleteModal.title}"</strong>? This cannot be undone.
                </p>
                <div className="documentsUploadFooter">
                  <button type="button" className="documentsViewBtn" onClick={() => setDeleteModal(null)}>Cancel</button>
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
        )}
      </AnimatePresence>

      {/* Print: hide app chrome, show only in-app PDF viewer */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .documentsViewBackdrop, .documentsViewBackdrop * { visibility: visible; }
          .documentsViewBackdrop { position: fixed; inset: 0; background: #fff; }
          .documentsViewModal { max-width: none; height: 100%; box-shadow: none; border: none; }
          .documentsViewHeader, .documentsViewBtn { visibility: hidden !important; display: none !important; }
          .documentsViewBody { position: absolute; inset: 0; padding: 0; overflow: visible; }
          .documentsPdfViewer { position: absolute; inset: 0; overflow: visible; }
          .documentsPdfViewer .react-pdf__Page { margin: 0 auto 12px; box-shadow: none; }
        }
      `}</style>
    </div>
  );
}

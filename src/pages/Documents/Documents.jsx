// Documents — upload, list, view and print PDFs. Permissions: documents.create, documents.use
import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Plus, Eye, Printer, Pencil, Trash2, X } from "lucide-react";
import { useNotification } from "../../components/NotificationProvider";
import { hasPermission } from "../../helpers/permissions";
import DocumentsPdfViewer from "./Components/DocumentsPdfViewer.jsx";
import DocumentCard from "./Components/DocumentCard.jsx";
import ViewModal from "./Modals/ViewModal.jsx";
import UploadModal from "./Modals/UploadModal.jsx";
import EditModal from "./Modals/EditModal.jsx";
import DeleteModal from "./Modals/DeleteModal.jsx";
import "../../styles/pages/documents/documents.css";

export function formatDate(d) {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

const MIN_LOADING_VISIBLE_MS = 380;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitNextPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
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
  const listFetchIdRef = useRef(0);

  const canCreate = hasPermission(account, "documents.create");
  const canUse = hasPermission(account, "documents.use");

  const fetchList = useCallback(async () => {
    if (!window.api?.documentsList) return;
    const fetchId = ++listFetchIdRef.current;
    const startedAt = Date.now();
    setLoading(true);
    const res = await window.api.documentsList();

    if (fetchId !== listFetchIdRef.current) return;

    if (res?.ok && Array.isArray(res.documents)) setDocuments(res.documents);
    else if (res?.error === "forbidden") setDocuments([]);
    else setDocuments([]);

    const elapsed = Date.now() - startedAt;
    const remaining = Math.max(0, MIN_LOADING_VISIBLE_MS - elapsed);
    if (remaining > 0) await wait(remaining);
    await waitNextPaint();

    if (fetchId !== listFetchIdRef.current) return;
    setLoading(false);
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
              <AnimatePresence>
                {documents.map((doc) => (
                  <DocumentCard
                    key={doc.id}
                    doc={doc}
                    canUse={canUse}
                    canCreate={canCreate}
                    handleOpenView={handleOpenView}
                    handlePrint={handlePrint}
                    setEditModal={setEditModal}
                    setDeleteModal={setDeleteModal}
                    deletingId={deletingId}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>
      </main>

      {/* View / Print modal — in-app PDF viewer */}
      <AnimatePresence>
        {viewPdf && (
          <ViewModal
            viewPdf={viewPdf}
            handleCloseView={handleCloseView}
            handlePrint={handlePrint}
          />
        )}
      </AnimatePresence>

      {/* Upload modal */}
      <AnimatePresence>
        {uploadModalOpen && (
          <UploadModal
            setUploadModalOpen={setUploadModalOpen}
            uploadTitle={uploadTitle}
            setUploadTitle={setUploadTitle}
            uploadFilePath={uploadFilePath}
            handleSelectPdf={handleSelectPdf}
            handleUpload={handleUpload}
            uploading={uploading}
          />
        )}
      </AnimatePresence>

      {/* Edit modal */}
      <AnimatePresence>
        {editModal && (
          <EditModal
            editModal={editModal}
            setEditModal={setEditModal}
            handleUpdate={handleUpdate}
            updating={updating}
          />
        )}
      </AnimatePresence>

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {deleteModal && (
          <DeleteModal
            deleteModal={deleteModal}
            setDeleteModal={setDeleteModal}
            confirmDelete={confirmDelete}
            deletingId={deletingId}
          />
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

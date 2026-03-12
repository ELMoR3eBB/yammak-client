// In-app PDF viewer using react-pdf (no iframe). Used for view + print.
import React, { useEffect, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Set worker so parsing runs off main thread. Use CDN to match bundled pdfjs version.
if (typeof window !== "undefined" && pdfjs?.GlobalWorkerOptions) {
  try {
    const version = pdfjs.version || "4.0.379";
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
  } catch (_) {}
}

export default function DocumentsPdfViewer({ file, className }) {
  const [numPages, setNumPages] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setNumPages(null);
    setError(null);
  }, [file]);

  const onLoadSuccess = ({ numPages: n }) => setNumPages(n);
  const onLoadError = (e) => setError(e?.message || "Failed to load PDF");

  if (!file) return null;
  if (error) {
    return (
      <div className={className} style={{ padding: 24, color: "var(--st-text-muted)", textAlign: "center" }}>
        {error}
      </div>
    );
  }

  return (
    <div className={className}>
      <Document file={file} onLoadSuccess={onLoadSuccess} onLoadError={onLoadError} loading={null}>
        {numPages != null &&
          Array.from({ length: numPages }, (_, i) => (
            <Page key={i} pageNumber={i + 1} width={null} renderTextLayer renderAnnotationLayer />
          ))}
      </Document>
    </div>
  );
}

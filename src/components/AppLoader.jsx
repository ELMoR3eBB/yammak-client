import React from "react";
import "../styles/AppLoader.css";

/**
 * Full-screen loading overlay used when opening the home window (after login or app start).
 * Shows a spinner and message with a smooth fade-in; used as Suspense fallback and for the extended stability period.
 */
export default function AppLoader() {
  return (
    <div className="appLoader" role="status" aria-live="polite" aria-label="Loading application">
      <div className="appLoader-backdrop" />
      <div className="appLoader-content">
        <div className="appLoader-spinner" aria-hidden />
        <p className="appLoader-text">Preparing your workspace…</p>
        <p className="appLoader-sub">This may take a moment</p>
      </div>
    </div>
  );
}

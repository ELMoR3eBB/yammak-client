import React, { createContext, useContext, useMemo, useCallback } from "react";
import "../styles/notification.css";

// Create context
const NotificationContext = createContext(null);
export const useNotification = () => useContext(NotificationContext);

/* =========================================================
   Toast system (ported from home.js)
   - toast-host
   - toast-item + modifier
   - close anim + progress bar
   ========================================================= */

const Icons = {
  close: `
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
    </svg>
  `,
  spark: `
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M12 2.6l1.1 4.6 4.6 1.1-4.6 1.1L12 14l-1.1-4.6L6.3 8.3l4.6-1.1L12 2.6Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M5 14.5l.7 2.7 2.7.7-2.7.7L5 21.3l-.7-2.7-2.7-.7 2.7-.7L5 14.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
    </svg>
  `,
  info: `
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M12 21.5a9.5 9.5 0 1 0 0-19 9.5 9.5 0 0 0 0 19Z" stroke="currentColor" stroke-width="1.6"/>
      <path d="M12 10.8v6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M12 7.4h.01" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
    </svg>
  `,
  success: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 6L9 17l-5-5"/>
    </svg>
  `,
};

// same idea as home.js
function ensureToastHost() {
  let host = document.getElementById("toastHost");
  if (!host) {
    host = document.createElement("div");
    host.id = "toastHost";
    host.className = "toast-host";
    document.body.appendChild(host);
  }
  return host;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// map your notify types -> home.js-ish toast modifiers
function mapType(type) {
  // keep your existing types usable
  if (type === "error") return "danger";
  if (type === "warning") return "warn";
  if (type === "success") return "success";
  // custom ones
  if (type === "online") return "success";
  if (type === "welcome") return "info";
  return "info";
}

function toastIcon(type) {
  // use the same Icons approach as home.js
  if (type === "success") return Icons.success;
  if (type === "danger") return Icons.close;
  if (type === "warn") return Icons.info;
  return Icons.info;
}

function toast({ type = "info", title = "", message = "", duration = 3200 }) {
  const host = ensureToastHost();

  const mapped = mapType(type);
  const el = document.createElement("div");
  el.className = `toast-item toast-item--${mapped}`;
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");

  const ms = Math.max(300, Number(duration) || 3200);

  el.innerHTML = `
    <div class="toast-item__icon">${toastIcon(mapped)}</div>
    <div class="toast-item__content">
      ${title ? `<div class="toast-item__title">${escapeHtml(title)}</div>` : ""}
      ${message ? `<div class="toast-item__msg">${escapeHtml(message)}</div>` : ""}
    </div>
    <button class="toast-item__close" type="button" aria-label="Close">
      <span class="toast-item__closeIcon">${Icons.close}</span>
    </button>
    <div class="toast-item__bar" style="animation-duration:${ms}ms"></div>
  `;

  const close = () => {
    if (!el.isConnected) return;
    el.classList.add("is-hiding");
    window.setTimeout(() => {
      try {
        el.remove();
      } catch { }
    }, 220);
  };

  el.addEventListener("click", (e) => {
    // allow click-to-dismiss (like your old alerts)
    // but don't double-trigger if close button
    if (e.target?.closest?.(".toast-item__close")) return;
    close();
  });

  el.querySelector(".toast-item__close")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    close();
  });

  host.appendChild(el);

  window.setTimeout(close, ms);

  return { close };
}

/* =========================================================
   Provider API (keeps your existing context usable)
   ========================================================= */
export const NotificationProvider = ({ children }) => {
  const notifyBase = useCallback((type, message, title, options = {}) => {
    toast({
      type,
      message: message || "",
      title: title || "",
      duration: options.displayDuration ?? 3200,
    });
  }, []);

  const api = useMemo(
    () => ({
      info: (msg, title, opts) => notifyBase("info", msg, title, opts),
      success: (msg, title, opts) => notifyBase("success", msg, title, opts),
      warning: (msg, title, opts) => notifyBase("warning", msg, title, opts),
      error: (msg, title, opts) => notifyBase("error", msg, title, opts),

      // keep these working if you used them
      online: (msg, title, opts) => notifyBase("online", msg, title, opts),
      welcome: (msg, title, opts) => notifyBase("welcome", msg, title, opts),
    }),
    [notifyBase]
  );

  return <NotificationContext.Provider value={api}>{children}</NotificationContext.Provider>;
};

// New_Suggest — submit a suggestion to administration (title + content); confirmation + note about visibility
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MessageSquare, Send, Info } from "lucide-react";
import { useNotification } from "../../NotificationProvider";
import "../../../styles/pages/suggests/suggests.css";

const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const CONFIRM_EXIT_MS = 260;

export default function NewSuggest({ account, onUnreadChange }) {
  const notify = useNotification();
  const perms = account?.role?.permissions || [];
  const canCreate = perms.includes("*") || perms.includes("suggest.create");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmExiting, setConfirmExiting] = useState(false);
  const createRequestIdRef = useRef(null);
  const exitTimerRef = useRef(null);

  useEffect(() => {
    if (!window.api) return;

    const unsub = window.api.onWsMessage((msg) => {
      if (msg?.type === "suggest:create:result" && msg?.requestId === createRequestIdRef.current) {
        if (msg.ok) {
          notify?.success?.("Your suggestion was sent to administration.", "Suggestion sent");
          setTitle("");
          setContent("");
          setError("");
          setConfirmExiting(true);
          setTimeout(() => {
            setShowConfirm(false);
            setConfirmExiting(false);
          }, CONFIRM_EXIT_MS);
          onUnreadChange?.();
        } else {
          setError(msg.error || "Failed to submit");
        }
        setSubmitting(false);
      }
    });

    return () => unsub?.();
  }, [onUnreadChange, notify]);

  const doSubmit = useCallback(() => {
    const t = title.trim();
    const c = content.trim();
    if (!c || !window.api?.wsSend) return;
    setSubmitting(true);
    setError("");
    createRequestIdRef.current = rid();
    window.api.wsSend({
      type: "suggest:create",
      requestId: createRequestIdRef.current,
      payload: { title: t || undefined, content: c },
    });
  }, [title, content]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    const t = title.trim();
    const c = content.trim();
    if (!c) {
      notify?.warning?.("Please enter the content of your suggestion.", "Content required");
      return;
    }
    if (!window.api?.wsSend) {
      notify?.error?.("Not connected.", "Connection");
      return;
    }
    setShowConfirm(true);
  };

  const handleConfirmSend = () => {
    doSubmit();
  };

  const closeConfirm = useCallback(() => {
    if (confirmExiting) return;
    setConfirmExiting(true);
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    exitTimerRef.current = setTimeout(() => {
      setShowConfirm(false);
      setConfirmExiting(false);
      exitTimerRef.current = null;
    }, CONFIRM_EXIT_MS);
  }, [confirmExiting]);

  useEffect(() => {
    return () => {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  }, []);

  if (!canCreate) {
    return (
      <div className="newSuggestPage">
        <header className="newSuggestHeader">
          <div className="newSuggestHeaderIcon">
            <MessageSquare size={24} />
          </div>
          <div className="newSuggestHeaderText">
            <h1 className="newSuggestTitle">New suggestion</h1>
            <p className="newSuggestSubtitle">You don&apos;t have permission to submit suggestions.</p>
          </div>
        </header>
      </div>
    );
  }

  return (
    <div className="newSuggestPage">
      <header className="newSuggestHeader">
        <div className="newSuggestHeaderIcon">
          <MessageSquare size={24} />
        </div>
        <div className="newSuggestHeaderText">
          <h1 className="newSuggestTitle">New suggestion</h1>
          <p className="newSuggestSubtitle">
            Share your ideas or feedback with the team. Your title and message will be reviewed by authorized staff.
          </p>
        </div>
      </header>

      <main className="newSuggestMain">
        <form onSubmit={handleSubmit} className="newSuggestForm">
          <div className="newSuggestNotice">
            <Info size={20} className="newSuggestNoticeIcon" />
            <span>
              Your name and email are shared with staff who review suggestions so they can follow up if needed. 
              Submissions are handled in confidence and used only for improving our processes.
            </span>
          </div>

          <div className="newSuggestField">
            <label htmlFor="new-suggest-title" className="newSuggestLabel">Title (optional)</label>
            <input
              id="new-suggest-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="newSuggestInput"
              placeholder="e.g. Feature idea or feedback"
              maxLength={200}
              disabled={submitting}
            />
          </div>
          <div className="newSuggestField">
            <label htmlFor="new-suggest-content" className="newSuggestLabel">Content</label>
            <textarea
              id="new-suggest-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="newSuggestTextarea"
              placeholder="Your suggestion…"
              rows={6}
              disabled={submitting}
            />
          </div>
          {error && <div className="newSuggestError">{error}</div>}
          <div className="newSuggestActions">
            <button type="submit" className="newSuggestSubmit suggestListBtn" disabled={submitting}>
              <Send size={18} />
              {submitting ? "Sending…" : "Send Submit"}
            </button>
          </div>
        </form>
      </main>

      {(showConfirm || confirmExiting) &&
        createPortal(
          <div
            className={`newSuggestConfirmPortal newSuggestConfirmBackdrop ${confirmExiting ? "newSuggestConfirmBackdrop--exiting" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="newSuggestConfirmTitle"
            onClick={(e) => e.target === e.currentTarget && closeConfirm()}
          >
            <div
              className={`newSuggestConfirmModal ${confirmExiting ? "newSuggestConfirmModal--exiting" : ""}`}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="newSuggestConfirmTitle" className="newSuggestConfirmTitle">Send this suggestion?</h2>
              <p className="newSuggestConfirmMessage">
                Your suggestion will be sent to administration for review.
              </p>
              <div className="newSuggestConfirmNote">
                Staff who review suggestions will see your name and email so they can respond or follow up when appropriate.
              </div>
              <div className="newSuggestConfirmActions">
                <button
                  type="button"
                  className="newSuggestConfirmBtn newSuggestConfirmBtn--ghost"
                  onClick={closeConfirm}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="newSuggestConfirmBtn newSuggestConfirmBtn--primary"
                  onClick={handleConfirmSend}
                  disabled={submitting}
                >
                  {submitting ? "Sending…" : "Send"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

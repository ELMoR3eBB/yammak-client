// Submit_Report.jsx — anonymous report submission (any logged-in user)
import React, { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Shield, ChevronDown } from "lucide-react";
import { useNotification } from "../../NotificationProvider";
import "../../../styles/pages/reports/reports_submit.css";

const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const REPORT_CATEGORIES = [
  { id: "feedback", label: "Feedback" },
  { id: "concern", label: "Concern" },
  { id: "incident", label: "Incident" },
  { id: "suggestion", label: "Suggestion" },
  { id: "other", label: "Other" },
];

export default function SubmitReport({ account, onReportSent }) {
  const notify = useNotification();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("feedback");
  const [submitting, setSubmitting] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const reqIdRef = useRef(null);
  const categorySelectRef = useRef(null);

  const categoryLabel = REPORT_CATEGORIES.find((c) => c.id === category)?.label ?? category;

  const closeCategory = useCallback(() => setCategoryOpen(false), []);

  useEffect(() => {
    if (!categoryOpen) return;
    const onDocClick = (e) => {
      if (categorySelectRef.current && !categorySelectRef.current.contains(e.target)) closeCategory();
    };
    document.addEventListener("mousedown", onDocClick, true);
    return () => document.removeEventListener("mousedown", onDocClick, true);
  }, [categoryOpen, closeCategory]);

  useEffect(() => {
    if (!window.api?.onWsMessage) return;
    const unsub = window.api.onWsMessage((msg) => {
      if (msg?.type === "report:submit:result" && msg?.requestId === reqIdRef.current) {
        setSubmitting(false);
        if (msg.ok) {
          notify?.success?.("Your report was submitted anonymously. Thank you.", "Report submitted");
          setTitle("");
          setMessage("");
          setCategory("feedback");
          onReportSent?.();
        } else {
          notify?.error?.(msg.error || "Failed to submit report", "Report");
        }
      }
    });
    return () => unsub?.();
  }, [notify, onReportSent]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!window.api?.wsSend || submitting) return;
    const t = title.trim();
    if (!t) {
      notify?.warning?.("Please enter a title.", "Report");
      return;
    }
    setSubmitting(true);
    reqIdRef.current = rid();
    window.api.wsSend({
      type: "report:submit",
      requestId: reqIdRef.current,
      payload: {
        title: t,
        message: message.trim() || null,
        category: category || "other",
      },
    });
  }

  if (!account) return null;

  return (
    <div className="reportSubmitPage">
      <header className="reportSubmitHeader">
        <div className="reportSubmitHeaderIcon">
          <FileText size={24} />
        </div>
        <div className="reportSubmitHeaderText">
          <h1 className="reportSubmitTitle">Submit a report</h1>
          <p className="reportSubmitSubtitle">
            Share feedback, concerns, or incidents. Your report is <strong>anonymous</strong> — your identity is not stored or shown to anyone.
          </p>
        </div>
      </header>

      <main className="reportSubmitMain">
        <div className="reportSubmitPrivacy">
          <Shield size={20} className="reportSubmitPrivacyIcon" />
          <span>Reports are reviewed only by authorized staff. Your privacy is protected.</span>
        </div>

        <form className="reportSubmitForm" onSubmit={handleSubmit}>
          <div className="reportSubmitField">
            <label className="reportSubmitLabel" htmlFor="report-title">Title *</label>
            <input
              id="report-title"
              type="text"
              className="reportSubmitInput"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief summary of your report"
              maxLength={200}
            />
          </div>
          <div className="reportSubmitField">
            <label className="reportSubmitLabel" id="report-category-label">Category</label>
            <div
              ref={categorySelectRef}
              className={`reportSubmitSelectWrap ${categoryOpen ? "open" : ""}`}
              role="combobox"
              aria-expanded={categoryOpen}
              aria-haspopup="listbox"
              aria-labelledby="report-category-label"
            >
              <button
                type="button"
                className="reportSubmitSelectBtn"
                onClick={() => setCategoryOpen((o) => !o)}
                aria-label="Category"
              >
                <span className="reportSubmitSelectLabel">{categoryLabel}</span>
                <span className="reportSubmitSelectArrow" aria-hidden>
                  <ChevronDown size={18} />
                </span>
              </button>
              <div className="reportSubmitSelectMenu" role="listbox">
                {REPORT_CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="option"
                    aria-selected={c.id === category}
                    className={`reportSubmitSelectItem ${c.id === category ? "active" : ""}`}
                    onClick={() => {
                      setCategory(c.id);
                      closeCategory();
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="reportSubmitField">
            <label className="reportSubmitLabel" htmlFor="report-message">Details</label>
            <textarea
              id="report-message"
              className="reportSubmitTextarea"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Provide as much detail as you're comfortable sharing..."
              rows={5}
            />
          </div>
          <button type="submit" className="reportSubmitSubmit" disabled={submitting}>
            {submitting ? "Submitting…" : "Submit anonymously"}
          </button>
        </form>
      </main>
    </div>
  );
}

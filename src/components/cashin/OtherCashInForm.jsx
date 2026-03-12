// Other Cash In — source, amount, date, note
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Calendar, Send } from "lucide-react";
import { useNotification } from "../NotificationProvider";
import "../../styles/pages/cashout/other_cashout_form.css";

const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function parseMoneyToNumber(formatted) {
  return Number(String(formatted).replace(/[^\d]/g, "")) || 0;
}

function formatMoneyWithCommas(digits) {
  return String(digits).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function todayYYYYMMDD() {
  return new Date().toISOString().slice(0, 10);
}

export default function OtherCashInForm({ account, onClose }) {
  const notify = useNotification();
  const [source, setSource] = useState("");
  const [amountRaw, setAmountRaw] = useState("");
  const [cashinDate, setCashinDate] = useState(todayYYYYMMDD());
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const createRequestIdRef = useRef(null);

  const amount = parseMoneyToNumber(amountRaw);

  const handleAmountInput = useCallback((value) => {
    const digits = String(value).replace(/\D/g, "");
    setAmountRaw(digits ? formatMoneyWithCommas(digits) : "");
  }, []);

  useEffect(() => {
    if (!window.api?.wsSend) return;
    const unsub = window.api.onWsMessage((msg) => {
      if (msg?.type === "cashin:create:result" && msg?.requestId === createRequestIdRef.current) {
        setSubmitting(false);
        if (msg.ok) {
          notify?.success?.("Cash in recorded.", "Other Cash In");
          onClose?.();
        } else {
          notify?.error?.(msg.error || "Failed to record cash in", "Other Cash In");
        }
      }
    });
    return () => unsub?.();
  }, [notify, onClose]);

  const handleSubmit = useCallback(() => {
    const sourceTrim = source.trim();
    if (!sourceTrim) {
      notify?.warning?.("Please enter a source.", "Other Cash In");
      return;
    }
    if (amount <= 0) {
      notify?.warning?.("Please enter a valid amount.", "Other Cash In");
      return;
    }
    if (!window.api?.wsSend) {
      notify?.error?.("API not available.", "Other Cash In");
      return;
    }
    setSubmitting(true);
    createRequestIdRef.current = rid();
    window.api.wsSend({
      type: "cashin:create",
      requestId: createRequestIdRef.current,
      payload: {
        type: "other",
        source: sourceTrim,
        amount,
        cashinDate: cashinDate || undefined,
        note: note.trim() || undefined,
      },
    });
  }, [source, amount, cashinDate, note, notify, onClose]);

  const currencyLabel = "IQD";

  return (
    <div className="othCashoutForm">
      <div className="othCashoutFormInner">
        <div className="othCashoutField othCashoutField--full">
          <label className="othCashoutLabel">Source</label>
          <div className="othCashoutInputWrap">
            <input
              type="text"
              className="othCashoutInput"
              placeholder="e.g. Office rent, Sale, Refund"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              aria-label="Source"
            />
          </div>
        </div>

        <div className="othCashoutRow">
          <div className="othCashoutField">
            <label className="othCashoutLabel">Amount ({currencyLabel})</label>
            <div className="othCashoutInputWrap">
              <input
                type="text"
                className="othCashoutInput"
                placeholder="e.g. 500000"
                value={amountRaw}
                onChange={(e) => handleAmountInput(e.target.value)}
                aria-label="Amount"
              />
            </div>
          </div>
          <div className="othCashoutField">
            <label className="othCashoutLabel">Date</label>
            <div className="othCashoutInputWrap othCashoutDateWrap">
              <Calendar size={16} className="othCashoutInputIcon" />
              <input
                type="date"
                className="othCashoutInput othCashoutDateInput"
                value={cashinDate}
                onChange={(e) => setCashinDate(e.target.value || todayYYYYMMDD())}
                aria-label="Cash in date"
              />
            </div>
          </div>
        </div>

        <div className="othCashoutField othCashoutField--full">
          <label className="othCashoutLabel">Note</label>
          <textarea
            className="othCashoutInput othCashoutTextarea"
            placeholder="Optional note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            aria-label="Note"
          />
        </div>

        <div className="othCashoutActions">
          <button type="button" className="othCashoutBtn othCashoutBtn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="othCashoutBtn othCashoutBtn--primary"
            onClick={handleSubmit}
            disabled={submitting}
            aria-busy={submitting}
          >
            <Send size={16} />
            {submitting ? "Submitting…" : "Record Cash In"}
          </button>
        </div>
      </div>
    </div>
  );
}

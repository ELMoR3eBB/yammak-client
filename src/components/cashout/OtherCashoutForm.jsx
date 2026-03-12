// OtherCashoutForm — form for creating an "other" cashout (source name, amount, date, note)
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

function toYYYYMMDD(d) {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toISOString().slice(0, 10);
}

function todayYYYYMMDD() {
  return toYYYYMMDD(new Date());
}

export default function OtherCashoutForm({ account, onClose, initialData, requestId }) {
  const notify = useNotification();
  const isFromPending = initialData?.requesterName != null;
  const requesterName = (initialData?.requesterName ?? "").trim();
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [sourceName, setSourceName] = useState(initialData?.sourceName ?? "");
  const [amountRaw, setAmountRaw] = useState(
    initialData?.amount != null && Number(initialData.amount) > 0 ? formatMoneyWithCommas(String(initialData.amount).replace(/\D/g, "")) : ""
  );
  const [paymentDate, setPaymentDate] = useState(
    initialData?.paymentDate ? toYYYYMMDD(new Date(initialData.paymentDate)) : todayYYYYMMDD()
  );
  const [note, setNote] = useState(initialData?.note ?? "");
  const [submitting, setSubmitting] = useState(false);
  const createRequestIdRef = useRef(null);

  useEffect(() => {
    if (!initialData) return;
    if (initialData.requesterName != null) {
      setTitle(initialData.title ?? "");
    } else {
      setSourceName(initialData.sourceName ?? "");
    }
    setAmountRaw(
      initialData.amount != null && Number(initialData.amount) > 0 ? formatMoneyWithCommas(String(initialData.amount).replace(/\D/g, "")) : ""
    );
    setPaymentDate(initialData.paymentDate ? toYYYYMMDD(new Date(initialData.paymentDate)) : todayYYYYMMDD());
    setNote(initialData.note ?? "");
  }, [initialData]);

  const amount = parseMoneyToNumber(amountRaw);

  const handleAmountInput = useCallback((value) => {
    const digits = String(value).replace(/\D/g, "");
    setAmountRaw(digits ? formatMoneyWithCommas(digits) : "");
  }, []);

  useEffect(() => {
    if (!window.api?.wsSend) return;
    const unsub = window.api.onWsMessage((msg) => {
      if (msg?.type === "cashout:create:result" && msg?.requestId === createRequestIdRef.current) {
        setSubmitting(false);
        if (msg.ok) {
          notify?.success?.("Cashout recorded.", "Other Cashout");
          if (window.api?.wsSend) {
            window.api.wsSend({
              type: "notification:create",
              requestId: rid(),
              payload: { type: "cashout_created", title: "New cashout created", message: "Other cashout recorded." },
            });
          }
          onClose?.();
        } else {
          notify?.error?.(
            msg.error === "insufficient_company_balance"
              ? "Insufficient liquid assets. Cannot process this cashout."
              : msg.error || "Failed to create cashout",
            "Other Cashout"
          );
        }
      }
    });
    return () => unsub?.();
  }, [notify, onClose]);

  const handleSubmit = useCallback(() => {
    const finalSourceName = isFromPending
      ? (requesterName ? `${requesterName}: ${(title || "").trim()}` : (title || "").trim()).trim()
      : sourceName.trim();
    if (!finalSourceName) {
      notify?.warning?.(isFromPending ? "Please enter the cashout title." : "Please enter a source name.", "Other Cashout");
      return;
    }
    if (amount <= 0) {
      notify?.warning?.("Please enter a valid amount.", "Other Cashout");
      return;
    }
    if (!window.api?.wsSend) {
      notify?.error?.("API not available.", "Other Cashout");
      return;
    }
    setSubmitting(true);
    createRequestIdRef.current = rid();
    const payload = {
      category: "other",
      sourceName: finalSourceName,
      amount,
      paymentDate: paymentDate || undefined,
      note: note.trim() || undefined,
    };
    if (requestId) payload.requestId = requestId;
    window.api.wsSend({
      type: "cashout:create",
      requestId: createRequestIdRef.current,
      payload,
    });
  }, [isFromPending, requesterName, title, sourceName, amount, paymentDate, note, requestId, notify, onClose]);

  const currencyLabel = "IQD";

  return (
    <div className="othCashoutForm">
      <div className="othCashoutFormInner">
        {isFromPending ? (
          <>
            <div className="othCashoutField othCashoutField--full">
              <label className="othCashoutLabel">Employee / Requester</label>
              <div className="othCashoutInputWrap othCashoutReadOnlyWrap">
                <span className="othCashoutReadOnly" aria-readonly="true">{requesterName || "—"}</span>
              </div>
            </div>
            <div className="othCashoutField othCashoutField--full">
              <label className="othCashoutLabel">Title of cashout request</label>
              <div className="othCashoutInputWrap">
                <input
                  type="text"
                  className="othCashoutInput"
                  placeholder="e.g. Salary advance, Bonus"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  aria-label="Title of cashout request"
                />
              </div>
            </div>
          </>
        ) : (
          <div className="othCashoutField othCashoutField--full">
            <label className="othCashoutLabel">Source name</label>
            <div className="othCashoutInputWrap">
              <input
                type="text"
                className="othCashoutInput"
                placeholder="e.g. Office rent, Internet, Maintenance"
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                aria-label="Source name"
              />
            </div>
          </div>
        )}

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
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value || todayYYYYMMDD())}
                aria-label="Payment date"
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
          <button
            type="button"
            className="othCashoutBtn othCashoutBtn--primary"
            onClick={handleSubmit}
            disabled={submitting}
            aria-busy={submitting}
          >
            <Send size={16} />
            {submitting ? "Submitting…" : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}


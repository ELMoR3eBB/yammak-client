import React from "react";
import { X } from "lucide-react";
import { formatDateOnly, formatAmount } from "../Transactions.jsx";

export default function TransactionDetailModal({
  detailRow,
  detailBackdropRef,
  detailExiting,
  closeDetail,
}) {
  if (!detailRow) return null;

  return (
    <div
      ref={detailBackdropRef}
      className={`transactionsDetailBackdrop ${detailExiting ? "transactionsDetailBackdrop--exiting" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="transactionsDetailTitle"
      onClick={detailExiting ? undefined : closeDetail}
    >
      <div
        className={`transactionsDetailModal ${detailExiting ? "transactionsDetailModal--exiting" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="transactionsDetailHeader">
          <h2 id="transactionsDetailTitle" className="transactionsDetailTitle">
            Transaction {detailRow._reportId}
          </h2>
          <button
            type="button"
            className="transactionsDetailClose"
            onClick={detailExiting ? undefined : closeDetail}
            aria-label="Close"
            disabled={detailExiting}
          >
            <X size={20} />
          </button>
        </div>
        <div className="transactionsDetailBody">
          {detailRow._transactionKind === "cashin" ? (
            <>
              <div className="transactionsDetailRow">
                <span className="transactionsDetailLabel">
                  {detailRow.type === "driver" ? "Driver" : detailRow.type === "store" ? "Store" : "Source"}
                </span>
                <span className="transactionsDetailValue">
                  {(detailRow.userName || detailRow.driverName || detailRow.storeName || detailRow.source || "").trim() || "—"}
                </span>
              </div>
              <div className="transactionsDetailRow transactionsDetailRow--total">
                <span className="transactionsDetailLabel">Amount</span>
                <span className="transactionsDetailValue">{formatAmount(detailRow.amount ?? detailRow.netAmount)}</span>
              </div>
              <div className="transactionsDetailRow">
                <span className="transactionsDetailLabel">Date</span>
                <span className="transactionsDetailValue">{formatDateOnly(detailRow.paymentDate || detailRow.createdAt)}</span>
              </div>
              <div className="transactionsDetailRow">
                <span className="transactionsDetailLabel">Note</span>
                <span className="transactionsDetailValue transactionsDetailNote">{detailRow.note || "—"}</span>
              </div>
            </>
          ) : (
            <>
              <div className="transactionsDetailRow">
                <span className="transactionsDetailLabel">{detailRow.type === "store" ? "Store" : "Name"}</span>
                <span className="transactionsDetailValue">
                  {(detailRow.userName || detailRow.driverName || detailRow.storeName || "").trim() || "—"}
                </span>
              </div>
              <div className="transactionsDetailRow">
                <span className="transactionsDetailLabel">Extra charge</span>
                <span className="transactionsDetailValue">{formatAmount(detailRow.extraCharge ?? 0)}</span>
              </div>
              <div className="transactionsDetailRow">
                <span className="transactionsDetailLabel">Violations</span>
                <span className="transactionsDetailValue">{formatAmount(Number(detailRow.violations) || 0)}</span>
              </div>
              <div className="transactionsDetailRow">
                <span className="transactionsDetailLabel">Debts</span>
                <span className="transactionsDetailValue">{formatAmount(detailRow.debts ?? 0)}</span>
              </div>
              <div className="transactionsDetailRow transactionsDetailRow--total">
                <span className="transactionsDetailLabel">Total amount</span>
                <span className="transactionsDetailValue">{formatAmount(detailRow.totalAmount ?? detailRow.amount)}</span>
              </div>
              <div className="transactionsDetailRow">
                <span className="transactionsDetailLabel">Note</span>
                <span className="transactionsDetailValue transactionsDetailNote">{detailRow.note || "—"}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

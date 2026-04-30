import React from "react";
import { createPortal } from "react-dom";
import { getAssetUrl } from "../../../utils/publicUrl";

export default function HotSendMassRecipientsModal({
  isOpen,
  isClosing,
  recipientCount,
  recipientPercent,
  sending,
  onClose,
  onConfirm,
  tr = (key, fallback) => fallback || key,
}) {
  if ((!isOpen && !isClosing) || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`hotSendModalBackdrop ${isClosing ? "hotSendModalBackdrop--exit" : ""}`}
      onClick={isClosing ? undefined : onClose}
      role="presentation"
    >
      <div
        className={`hotSendModal ${isClosing ? "hotSendModal--exit" : ""}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="hotSendModalTitle"
      >
        <img src={getAssetUrl("assets/svg/warning-ill.svg")} alt="" className="hotSendModalIll" />
        <h2 id="hotSendModalTitle" className="hotSendModalTitle">{tr("hotSend.modal.title", "Send to many users")}</h2>
        <p className="hotSendModalMessage">
          {tr("hotSend.modal.line1", "You are about to send this notification to")}{" "}
          <strong>{recipientCount}</strong>{" "}
          {tr(recipientCount !== 1 ? "hotSend.usersPlural" : "hotSend.userSingle", recipientCount !== 1 ? "users" : "user")}{" "}
          ({recipientPercent}% {tr("hotSend.ofAllUsers", "of all users")}).
          {" "}
          {tr("hotSend.modal.line2", "This action will deliver the message immediately. Are you sure?")}
        </p>
        <div className="hotSendModalActions">
          <button
            type="button"
            className="hotSendModalBtn hotSendModalBtn--close"
            onClick={onClose}
            disabled={isClosing}
          >
            {tr("common.close", "Close")}
          </button>
          <button
            type="button"
            className="hotSendModalBtn hotSendModalBtn--confirm"
            onClick={onConfirm}
            disabled={sending || isClosing}
          >
            {sending ? tr("hotSend.sendingDots", "Sending...") : tr("hotSend.confirmSend", "Confirm send")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

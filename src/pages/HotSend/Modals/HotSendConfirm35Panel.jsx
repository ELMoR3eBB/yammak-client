import React from "react";

export default function HotSendConfirm35Panel({
  active,
  countdown,
  sending,
  onConfirm,
  onCancel,
  tr = (key, fallback) => fallback || key,
}) {
  if (!active) return null;

  return (
    <div className="hotSendConfirm35">
      <p className="hotSendConfirm35Text">
        {tr("hotSend.confirm35.textPrefix", "You have")} <strong>{countdown}</strong>{" "}
        {tr(countdown !== 1 ? "hotSend.secondsPlural" : "hotSend.secondSingle", countdown !== 1 ? "seconds" : "second")}{" "}
        {tr("hotSend.confirm35.textSuffix", "to confirm. After that, the send will be cancelled.")}
      </p>
      <div className="hotSendConfirm35Actions">
        <button
          type="button"
          className="hotSendConfirm35Btn"
          onClick={onConfirm}
          disabled={sending}
        >
          {tr("hotSend.confirmSend", "Confirm send")} ({countdown})
        </button>
        <button
          type="button"
          className="hotSendConfirm35Cancel"
          onClick={onCancel}
        >
          {tr("common.cancel", "Cancel")}
        </button>
      </div>
    </div>
  );
}

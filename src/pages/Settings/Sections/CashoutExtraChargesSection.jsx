import { useState, useRef, useEffect } from "react";
import { Trash2, Plus } from "lucide-react";


function parseMoneyToNumber(formatted) {
  return Number(String(formatted).replace(/[^\d]/g, "")) || 0;
}

function formatMoneyWithCommas(val) {
  return String(val).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}


export default function CashoutExtraChargesSection({ settings, onUpdate, loading, disabled, canManage = true, t }) {
  const charges = Array.isArray(settings?.cashoutExtraCharges) ? [...settings.cashoutExtraCharges] : [];
  const [exitingChargeIndex, setExitingChargeIndex] = useState(null);
  const exitingChargeRowRef = useRef(null);

  useEffect(() => {
    if (exitingChargeIndex === null || !exitingChargeRowRef.current) return;
    const el = exitingChargeRowRef.current;
    const onEnd = (e) => {
      if (e.target !== el || e.animationName !== "stExtraChargesItemOut") return;
      onUpdate((prev) => {
        const list = (prev?.cashoutExtraCharges ?? []).filter((_, i) => i !== exitingChargeIndex);
        return { ...prev, cashoutExtraCharges: list };
      });
      setExitingChargeIndex(null);
    };
    el.addEventListener("animationend", onEnd, { once: true });
    return () => el.removeEventListener("animationend", onEnd);
  }, [exitingChargeIndex, onUpdate]);

  const addCharge = () => {
    onUpdate((prev) => ({
      ...prev,
      cashoutExtraCharges: [...(prev?.cashoutExtraCharges ?? []), { name: "", amount: 0 }],
    }));
  };

  const updateCharge = (index, field, value) => {
    onUpdate((prev) => {
      const list = [...(prev?.cashoutExtraCharges ?? [])];
      if (!list[index]) return prev;
      list[index] = {
        ...list[index],
        [field]: field === "amount" ? (value === "" ? "" : (Number(value) || 0)) : value,
      };
      return { ...prev, cashoutExtraCharges: list };
    });
  };

  const handleAmountChange = (index, rawInput) => {
    const trimmed = String(rawInput ?? "").trim();
    if (trimmed === "") {
      updateCharge(index, "amount", "");
      return;
    }
    const parsed = parseMoneyToNumber(rawInput);
    updateCharge(index, "amount", parsed);
  };

  const amountDisplay = (c) =>
    c.amount === "" || c.amount == null ? "" : formatMoneyWithCommas(String(c.amount));

  const startRemoveCharge = (index) => {
    setExitingChargeIndex(index);
  };

  if (loading) {
    return (
      <div className="settingsFormRow settingsLoading">
        <div className="settingsFormGroup">
          <span className="settingsLabel">{t("settings.extraChargesLoading")}</span>
          <span className="settingsHint">{t("common.loading")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="settingsForm">
      <div className="settingsFormBlock stExtraChargesBlock">
        <p className="stExtraChargesDesc">
          {t("settings.extraChargesDesc")}
        </p>
        <div className="stExtraChargesList">
          {charges.map((c, i) => (
            <div
              key={i}
              ref={i === exitingChargeIndex ? exitingChargeRowRef : null}
              className={`stExtraChargesItem stExtraChargesItem--in ${i === exitingChargeIndex ? "stExtraChargesItem--exiting" : ""}`}
            >
              <span className="stExtraChargesItemIndex">{i + 1}</span>
              <input
                className="stExtraChargesInput stExtraChargesInput--name"
                type="text"
                value={c.name || ""}
                onChange={(e) => updateCharge(i, "name", e.target.value)}
                disabled={disabled || i === exitingChargeIndex}
                readOnly={!canManage}
                spellCheck="false"
                placeholder={t("settings.chargeName")}
                aria-label={`${t("settings.chargeName")} ${i + 1}`}
              />
              <div className="stExtraChargesAmountWrap">
                <input
                  className="stExtraChargesInput stExtraChargesInput--amount"
                  type="text"
                  inputMode="numeric"
                  value={amountDisplay(c)}
                  onChange={(e) => handleAmountChange(i, e.target.value)}
                  disabled={disabled || i === exitingChargeIndex}
                  readOnly={!canManage}
                  placeholder="0"
                  aria-label={`${t("settings.chargeName")} ${i + 1} amount`}
                />
                <span className="stExtraChargesCurrency">{t("settings.iqd")}</span>
              </div>
              {canManage && (
              <button
                type="button"
                className="stExtraChargesRemove"
                onClick={() => startRemoveCharge(i)}
                disabled={disabled || i === exitingChargeIndex}
                title={t("settings.removeCharge")}
                aria-label={t("settings.removeCharge")}
              >
                <Trash2 size={14} strokeWidth={2} />
              </button>
            )}
            </div>
          ))}
        </div>
        {canManage && (
        <button
          type="button"
          className="stExtraChargesAdd"
          onClick={addCharge}
          disabled={disabled}
        >
          <Plus size={18} strokeWidth={2} />
          <span>{t("settings.addExtraCharge")}</span>
        </button>
        )}
      </div>
    </div>
  );
}
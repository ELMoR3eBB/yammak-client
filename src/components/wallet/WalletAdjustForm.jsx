import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { ChevronDown, Search, Send, AlertTriangle } from "lucide-react";
import { useNotification } from "../NotificationProvider";
import { useLanguage } from "../../contexts/LanguageContext";
import "../../styles/pages/cashout/driver_cashout_form.css";
import "../../styles/pages/cashout/store_cashout_form.css";

import { useAnimatedNumber } from "../../hooks/useAnimatedNumber";

const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function formatMoneyWithCommas(digits) {
  return String(digits).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function parseMoneyToNumber(formatted) {
  return Number(String(formatted).replace(/[^\d]/g, "")) || 0;
}

export default function WalletAdjustForm({ onClose, targetType, operation }) {
  const notify = useNotification();
  const { t } = useLanguage();
  const [entities, setEntities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [amountRaw, setAmountRaw] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownExiting, setDropdownExiting] = useState(false);
  const [search, setSearch] = useState("");
  const [formBodyExiting, setFormBodyExiting] = useState(false);
  const [pendingEntity, setPendingEntity] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmExiting, setConfirmExiting] = useState(false);

  const listRequestIdRef = useRef(null);
  const submitRequestIdRef = useRef(null);
  const dropdownRef = useRef(null);
  const dropdownPanelRef = useRef(null);
  const searchInputRef = useRef(null);
  const formBodyRef = useRef(null);
  const confirmExitTimerRef = useRef(null);

  const amount = useMemo(() => parseMoneyToNumber(amountRaw), [amountRaw]);
  const currencyLabel = "IQD";
  const tr = useCallback(
    (key, vars = null) => {
      const template = String(t(key));
      if (!vars || typeof vars !== "object") return template;
      return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => {
        if (vars[k] == null) return "";
        return String(vars[k]);
      });
    },
    [t]
  );
  const isCredit = operation === "add";
  const signedAmount = amount > 0 ? `${isCredit ? "+" : "-"}${formatMoneyWithCommas(String(amount))} ${currencyLabel}` : `0 ${currencyLabel}`;
  const entityName = targetType === "driver" ? t("sidebar.driver") : t("sidebar.store");
  const dropdownPlaceholder =
    targetType === "driver" ? t("wallet.selectDriverPlaceholder") : t("wallet.selectStorePlaceholder");

  const selectedLabel = targetType === "driver" ? selectedEntity?.name : selectedEntity?.storeName;
  const selectedBalance = Number(selectedEntity?.balance ?? 0) || 0;

  const resultingBalance = useMemo(() => {
    if (!selectedEntity) return selectedBalance;

    return isCredit
      ? selectedBalance + amount
      : selectedBalance - amount;
  }, [selectedBalance, amount, isCredit, selectedEntity]);

  const animatedBalance = useAnimatedNumber(
    resultingBalance,
    selectedEntity?.id ?? selectedEntity?._id ?? selectedEntity?.externalId
  );

  const animatedBalanceFormatted =
  `${formatMoneyWithCommas(String(animatedBalance))} ${currencyLabel}`;

  const resultingBalanceFormatted = `${formatMoneyWithCommas(
    String(Math.max(resultingBalance, 0))
  )} ${currencyLabel}`;

  const filteredEntities = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entities;
    return entities.filter((entity) => {
      const name = String(targetType === "driver" ? entity?.name : entity?.storeName).toLowerCase();
      const phone =
        targetType === "driver"
          ? String(entity?.phone ?? "").toLowerCase()
          : String(entity?.storePhone ?? entity?.ownerPhone ?? "").toLowerCase();
      const id = String(entity?.externalId ?? entity?.id ?? entity?._id ?? "").toLowerCase();
      return name.includes(q) || phone.includes(q) || id.includes(q);
    });
  }, [entities, search, targetType]);

  const closeDropdown = useCallback((immediate = false) => {
    if (immediate) {
      setDropdownOpen(false);
      setDropdownExiting(false);
      setSearch("");
      return;
    }
    setDropdownExiting(true);
  }, []);

  const fetchEntities = useCallback(() => {
    if (!window.api?.wsSend) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const requestId = rid();
    listRequestIdRef.current = requestId;
    if (targetType === "driver") {
      window.api.wsSend({
        type: "drivers:list",
        requestId,
        payload: { sortBy: "name", sortDir: "asc", page: 1, pageSize: 100 },
      });
      return;
    }
    window.api.wsSend({
      type: "stores:list",
      requestId,
      payload: { sortBy: "storeName", sortDir: "asc", page: 1, pageSize: 100 },
    });
  }, [targetType]);

  useEffect(() => {
    fetchEntities();
  }, [fetchEntities]);

  useEffect(() => {
    if (!window.api?.onWsMessage) return;
    const unsub = window.api.onWsMessage((msg) => {
      if (targetType === "driver" && msg?.type === "drivers:list" && msg?.requestId === listRequestIdRef.current) {
        setEntities(Array.isArray(msg.drivers) ? msg.drivers : []);
        setLoading(false);
      }
      if (targetType === "store" && msg?.type === "stores:list" && msg?.requestId === listRequestIdRef.current) {
        setEntities(Array.isArray(msg.stores) ? msg.stores : []);
        setLoading(false);
      }
      if (msg?.type === "wallet:adjust:result" && msg?.requestId === submitRequestIdRef.current) {
        setSubmitting(false);
        if (msg.ok) {
          notify?.success?.(
            tr(isCredit ? "wallet.successAddMessage" : "wallet.successDeductMessage", { amount: amount.toLocaleString() }),
            t(isCredit ? "wallet.successAddTitle" : "wallet.successDeductTitle")
          );
          onClose?.();
        } else {
          notify?.error?.(msg.error || t("wallet.errorGeneric"), t("wallet.errorTitle"));
        }
      }
    });
    return () => unsub?.();
  }, [targetType, notify, onClose, t, amount, isCredit]);

  useEffect(() => {
    const onDocClick = (event) => {
      if (dropdownOpen && dropdownRef.current && !dropdownRef.current.contains(event.target)) closeDropdown();
    };
    document.addEventListener("mousedown", onDocClick, true);
    return () => document.removeEventListener("mousedown", onDocClick, true);
  }, [dropdownOpen, closeDropdown]);

  useEffect(() => {
    if (!dropdownExiting || !dropdownPanelRef.current) return;
    const el = dropdownPanelRef.current;
    const onEnd = () => {
      setDropdownOpen(false);
      setDropdownExiting(false);
      setSearch("");
    };
    el.addEventListener("animationend", onEnd, { once: true });
    return () => el.removeEventListener("animationend", onEnd);
  }, [dropdownExiting]);

  useEffect(() => {
    if (dropdownOpen && !dropdownExiting) {
      setSearch("");
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [dropdownOpen, dropdownExiting]);

  const handleAmountInput = useCallback((value) => {
    const digits = String(value).replace(/[^\d]/g, "");
    setAmountRaw(digits ? formatMoneyWithCommas(digits) : "");
  }, []);

  const handleFormBodyAnimationEnd = useCallback(() => {
    if (!formBodyExiting || !pendingEntity) return;
    setSelectedEntity(pendingEntity);
    setAmountRaw("");
    setReason("");
    setPendingEntity(null);
    setFormBodyExiting(false);
  }, [formBodyExiting, pendingEntity]);

  useEffect(() => {
    if (!formBodyExiting || !formBodyRef.current) return;
    const el = formBodyRef.current;
    const onEnd = (event) => {
      if (event.target !== el || event.animationName !== "empCashoutFormBodyOut") return;
      handleFormBodyAnimationEnd();
    };
    el.addEventListener("animationend", onEnd, { once: true });
    return () => el.removeEventListener("animationend", onEnd);
  }, [formBodyExiting, handleFormBodyAnimationEnd]);

  useEffect(() => {
    return () => {
      if (confirmExitTimerRef.current) clearTimeout(confirmExitTimerRef.current);
    };
  }, []);

  const closeConfirmModal = useCallback((afterClose) => {
    if (confirmExiting) return;
    setConfirmExiting(true);
    if (confirmExitTimerRef.current) clearTimeout(confirmExitTimerRef.current);
    confirmExitTimerRef.current = setTimeout(() => {
      setConfirmOpen(false);
      setConfirmExiting(false);
      confirmExitTimerRef.current = null;
      afterClose?.();
    }, 220);
  }, [confirmExiting]);

  const handleConfirm = useCallback(() => {
    if (!selectedEntity) {
      notify?.warning?.(
        t(targetType === "driver" ? "wallet.selectDriverWarning" : "wallet.selectStoreWarning"),
        t("wallet.warningTitle")
      );
      return;
    }
    if (amount <= 0) {
      notify?.warning?.(t("wallet.amountRequiredWarning"), t("wallet.warningTitle"));
      return;
    }
    if (!reason.trim()) {
      notify?.warning?.(t("wallet.reasonRequiredWarning"), t("wallet.warningTitle"));
      return;
    }
    setConfirmExiting(false);
    setConfirmOpen(true);
  }, [selectedEntity, amount, reason, notify, t, targetType]);

  const submitWalletAdjustment = useCallback(() => {
    if (!window.api?.wsSend || !selectedEntity) {
      notify?.error?.(t("wallet.apiUnavailable"), t("wallet.errorTitle"));
      return;
    }
    const entityId = selectedEntity?.externalId ?? selectedEntity?.id ?? selectedEntity?._id;
    const currentEntityName = targetType === "driver" ? selectedEntity?.name : selectedEntity?.storeName;
    setSubmitting(true);
    closeConfirmModal();
    submitRequestIdRef.current = rid();
    window.api.wsSend({
      type: "wallet:adjust",
      requestId: submitRequestIdRef.current,
      payload: {
        targetType,
        operation: isCredit ? "add" : "deduct",
        entityId,
        entityName: currentEntityName ?? "",
        amount,
        reason: reason.trim(),
      },
    });
  }, [selectedEntity, targetType, isCredit, amount, reason, notify, t, closeConfirmModal]);

  return (
    <div className="empCashoutForm">
      <div className="empCashoutFormInner">
        <div className="empCashoutField empCashoutField--full">
          <label className="empCashoutLabel">{entityName}</label>
          <div className="empCashoutSelectWrap" ref={dropdownRef}>
            <button
              type="button"
              className="empCashoutSelectBtn"
              onClick={() => {
                if (dropdownOpen || dropdownExiting) closeDropdown();
                else setDropdownOpen(true);
              }}
              aria-expanded={dropdownOpen || dropdownExiting}
            >
              <span className="empCashoutSelectValue">{selectedLabel || dropdownPlaceholder}</span>
              <ChevronDown size={16} className="empCashoutSelectChev" />
            </button>
            {(dropdownOpen || dropdownExiting) && (
              <div ref={dropdownPanelRef} className={`empCashoutDropdown ${dropdownExiting ? "empCashoutDropdown--exiting" : ""}`}>
                <div className="empCashoutDropdownSearch">
                  <Search size={14} className="empCashoutSearchIcon" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    className="empCashoutSearchInput"
                    placeholder={t("wallet.searchPlaceholder")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="empCashoutDropdownList">
                  {loading ? (
                    <div className="empCashoutDropdownItem empCashoutDropdownItem--muted">{t("common.loading")}</div>
                  ) : filteredEntities.length === 0 ? (
                    <div className="empCashoutDropdownItem empCashoutDropdownItem--muted">{t("wallet.noResults")}</div>
                  ) : (
                    filteredEntities.map((entity) => {
                      const entityId = entity?.id ?? entity?._id ?? entity?.externalId;
                      const selectedId = selectedEntity?.id ?? selectedEntity?._id ?? selectedEntity?.externalId;
                      const isSame = selectedEntity && String(entityId) === String(selectedId);
                      const label = targetType === "driver" ? entity?.name : entity?.storeName;
                      const balance = Number(entity?.balance ?? 0) || 0;
                      return (
                        <button
                          key={String(entityId)}
                          type="button"
                          className="empCashoutDropdownItem"
                          onClick={() => {
                            if (isSame) {
                              closeDropdown();
                              return;
                            }
                            if (selectedEntity) {
                              setPendingEntity(entity);
                              setFormBodyExiting(true);
                              closeDropdown();
                            } else {
                              setSelectedEntity(entity);
                              closeDropdown();
                            }
                          }}
                        >
                          {label || "—"} ({formatMoneyWithCommas(String(balance))} {currencyLabel})
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {selectedEntity && (
          <div ref={formBodyRef} className={`empCashoutFormBody ${formBodyExiting ? "empCashoutFormBody--exiting" : ""}`}>
            <div key={String(selectedEntity?.id ?? selectedEntity?._id ?? selectedEntity?.externalId)} className="empCashoutFormBodyContent">
              <div className="empCashoutEmployeeInfo empCashoutAnimateIn empCashoutAnimateIn--0">
                <div className="empCashoutEmployeeRow">
                  <span className="empCashoutEmployeeLabel">{entityName}:</span>
                  <span className="empCashoutEmployeeValue">{selectedLabel || "—"}</span>
                </div>
                <div className="empCashoutEmployeeRow">
                  <span className="empCashoutEmployeeLabel">{t("wallet.currentBalance")}:</span>
                  <span className="empCashoutEmployeeValue">
                    {formatMoneyWithCommas(String(selectedBalance))} {currencyLabel}
                  </span>
                </div>
              </div>

              <div className="empCashoutRow empCashoutAnimateIn empCashoutAnimateIn--1">
                <div className="empCashoutField">
                  <label className="empCashoutLabel">{tr("wallet.amountLabel", { currency: currencyLabel })}</label>
                  <div className="empCashoutInputWrap">
                    <input
                      type="text"
                      className="empCashoutInput"
                      placeholder="0"
                      value={amountRaw}
                      onChange={(e) => handleAmountInput(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="empCashoutSummary empCashoutAnimateIn empCashoutAnimateIn--2">
                <div className="empCashoutSummaryRow">
                  <span className="empCashoutSummaryLabel">{t("wallet.netImpactLabel")}:</span>
                  <span
                    className="empCashoutSummaryValue"
                    style={{ color: isCredit ? "var(--emerald-300, #34d399)" : "var(--ec-accent, #f59e0b)" }}
                  >
                    {animatedBalanceFormatted}
                  </span>
                </div>
              </div>

              <div className="empCashoutField empCashoutField--full empCashoutAnimateIn empCashoutAnimateIn--3">
                <label className="empCashoutLabel">{t("wallet.reasonLabel")}</label>
                <textarea
                  className="empCashoutTextarea"
                  placeholder={t("wallet.reasonPlaceholder")}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="empCashoutActions empCashoutAnimateIn empCashoutAnimateIn--4">
                <button type="button" className="empCashoutBtn empCashoutBtn--secondary" onClick={onClose}>
                  {t("common.cancel")}
                </button>
                <button type="button" className="empCashoutBtn empCashoutBtn--primary" onClick={handleConfirm} disabled={submitting}>
                  <Send size={16} />
                  {submitting ? t("common.saving") : t("wallet.confirmAction")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {confirmOpen &&
        ReactDOM.createPortal(
          <div
            className={`storeCashoutExceedBackdrop ${confirmExiting ? "storeCashoutExceedBackdrop--exiting" : ""}`}
            role="alertdialog"
            aria-labelledby="walletConfirmTitle"
            onClick={() => closeConfirmModal()}
          >
            <div
              className={`storeCashoutExceedModal ${confirmExiting ? "storeCashoutExceedModal--exiting" : ""}`}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="storeCashoutExceedIcon">
                <AlertTriangle size={28} />
              </div>
              <h3 id="walletConfirmTitle" className="storeCashoutExceedTitle">
                {t("wallet.secondConfirmTitle")}
              </h3>
              <p className="storeCashoutExceedMessage">
                {tr("wallet.secondConfirmMessage", {
                  action: isCredit ? t("wallet.actionAdd") : t("wallet.actionDeduct"),
                  entity: entityName.toLowerCase(),
                  amount: signedAmount,
                })}
              </p>
              <div className="storeCashoutExceedActions securityAlert-actions">
                <button type="button" className="securityAlert-btn securityAlert-btn--ghost" onClick={() => closeConfirmModal()}>
                  {t("common.no")}
                </button>
                <button
                  type="button"
                  className="securityAlert-btn securityAlert-btn--primary"
                  onClick={submitWalletAdjustment}
                  disabled={submitting}
                >
                  {t("common.yes")}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

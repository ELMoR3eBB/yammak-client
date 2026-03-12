// StoreCashoutForm — store selector, balance, amount (≤ balance unless permission), date,
// violations (like driver), net, notes. Exceed-balance warning modal. Standalone CSS.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { Calendar, ChevronDown, Search, Send, Plus, X, AlertTriangle } from "lucide-react";
import { useNotification } from "../NotificationProvider";
import { hasPermission } from "../../helpers/permissions";
import "../../styles/pages/cashout/store_cashout_form.css";

const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function formatMoneyWithCommas(digits) {
  return String(digits).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function parseMoneyToNumber(formatted) {
  return Number(String(formatted).replace(/[^\d]/g, "")) || 0;
}

function todayYYYYMMDD() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

const PAYOUT_REASON_DEFAULT = "تسليم المستحقات";

export default function StoreCashoutForm({ account, onClose }) {
  const notify = useNotification();
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStore, setSelectedStore] = useState(null);

  const [paymentDate, setPaymentDate] = useState(todayYYYYMMDD());
  const [amountRaw, setAmountRaw] = useState("");
  const [violationsList, setViolationsList] = useState([]);
  const [note, setNote] = useState("");

  const [storeDropdownOpen, setStoreDropdownOpen] = useState(false);
  const [dropdownExiting, setDropdownExiting] = useState(false);
  const [storeSearch, setStoreSearch] = useState("");
  const [formBodyExiting, setFormBodyExiting] = useState(false);
  const [pendingStore, setPendingStore] = useState(null);

  const [exceedWarningOpen, setExceedWarningOpen] = useState(false);
  const [exceedWarningExiting, setExceedWarningExiting] = useState(false);
  const [amountAnimating, setAmountAnimating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastCashoutError, setLastCashoutError] = useState(null);
  const createRequestIdRef = useRef(null);
  const lastStoresFetchRef = useRef(0);
  const CACHE_TTL_MS = 2 * 60 * 1000;
  const dropdownRef = useRef(null);
  const dropdownPanelRef = useRef(null);
  const searchInputRef = useRef(null);
  const formBodyRef = useRef(null);
  const exceedWarningRef = useRef(null);
  const displayedNetRef = useRef(0);
  const netRafRef = useRef(null);
  const loadedViolationsForStoreIdRef = useRef(null);
  const violationsListReqIdRef = useRef(null);
  const storesRequestIdRef = useRef(null);
  const storesSearchDebounceRef = useRef(null);

  const [displayedNetAmount, setDisplayedNetAmount] = useState(0);

  const balance = Number(selectedStore?.balance) ?? 0;
  const amount = useMemo(() => parseMoneyToNumber(amountRaw), [amountRaw]);
  const violations = useMemo(
    () => violationsList.reduce((s, v) => s + parseMoneyToNumber(v.amountRaw), 0),
    [violationsList]
  );
  const netAmount = useMemo(() => Math.max(0, amount - violations), [amount, violations]);

  // Animate displayed net toward netAmount when it changes (e.g. adding/editing violations)
  useEffect(() => {
    const start = displayedNetRef.current;
    const end = netAmount;
    if (start === end) return;
    if (netRafRef.current != null) cancelAnimationFrame(netRafRef.current);
    const duration = 400;
    const startTime = performance.now();
    const step = (now) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - (1 - t) * (1 - t);
      const current = Math.round(start + (end - start) * eased);
      setDisplayedNetAmount(current);
      displayedNetRef.current = current;
      if (t < 1) netRafRef.current = requestAnimationFrame(step);
      else netRafRef.current = null;
    };
    netRafRef.current = requestAnimationFrame(step);
    return () => {
      if (netRafRef.current != null) cancelAnimationFrame(netRafRef.current);
    };
  }, [netAmount]);
  const deductionsExceedAmount = amount > 0 && violations > amount;

  const canExceedBalance = useMemo(() => hasPermission(account, "cashout.storeExceedBalance"), [account]);
  const maxAllowedAmount = canExceedBalance ? undefined : balance;
  const amountError = maxAllowedAmount != null && amount > maxAllowedAmount;
  const canEnterDeductions = amount > 0;
  const wouldExceedBalance = amount > balance && balance >= 0;

  // Subscribe to stores:list responses (initial load and server-side search)
  useEffect(() => {
    if (!window.api?.onWsMessage) return;
    const unsub = window.api.onWsMessage((msg) => {
      if (msg?.type === "stores:list" && msg?.requestId === storesRequestIdRef.current) {
        setStores(Array.isArray(msg.stores) ? msg.stores : []);
        setLoading(false);
        lastStoresFetchRef.current = Date.now();
      }
    });
    return () => unsub?.();
  }, []);

  // Load stores: on mount (storeSearch "") and when user types (server-side search, same as Stores page)
  useEffect(() => {
    if (!window.api?.wsSend) {
      setLoading(false);
      return;
    }
    const q = storeSearch.trim();
    if (storesSearchDebounceRef.current) clearTimeout(storesSearchDebounceRef.current);
    const delay = q === "" ? 0 : 300;
    storesSearchDebounceRef.current = setTimeout(() => {
      storesSearchDebounceRef.current = null;
      setLoading(true);
      storesRequestIdRef.current = rid();
      window.api.wsSend({
        type: "stores:list",
        requestId: storesRequestIdRef.current,
        payload: { sortBy: "storeName", sortDir: "asc", page: 1, pageSize: 100, query: q || undefined },
      });
    }, delay);
    return () => {
      if (storesSearchDebounceRef.current) clearTimeout(storesSearchDebounceRef.current);
    };
  }, [storeSearch]);

  const storeEntityId = selectedStore
    ? String(selectedStore.id ?? selectedStore._id ?? selectedStore.externalId ?? "")
    : null;

  useEffect(() => {
    if (!window.api?.wsSend || amount <= 0 || !storeEntityId) return;
    const alreadyLoaded = loadedViolationsForStoreIdRef.current === storeEntityId;
    if (alreadyLoaded) return;
    loadedViolationsForStoreIdRef.current = storeEntityId;
    violationsListReqIdRef.current = rid();
    window.api.wsSend({
      type: "violations:list",
      requestId: violationsListReqIdRef.current,
      payload: { entityType: "store", entityId: storeEntityId },
    });
  }, [amount, storeEntityId]);

  useEffect(() => {
    if (!window.api?.onWsMessage || !storeEntityId) return;
    const unsub = window.api.onWsMessage((msg) => {
      if (
        msg?.type === "violations:list:result" &&
        msg?.requestId === violationsListReqIdRef.current &&
        Array.isArray(msg.violations)
      ) {
        const mapped = msg.violations.map((v) => ({
          amountRaw: formatMoneyWithCommas(String(v.amount ?? 0)),
          reason: v.reason ?? "",
        }));
        setViolationsList(mapped);
      }
    });
    return () => unsub?.();
  }, [storeEntityId]);

  useEffect(() => {
    if (!selectedStore) {
      loadedViolationsForStoreIdRef.current = null;
      setViolationsList([]);
      return;
    }
    const id = String(selectedStore.id ?? selectedStore._id ?? selectedStore.externalId ?? "");
    if (loadedViolationsForStoreIdRef.current != null && loadedViolationsForStoreIdRef.current !== id) {
      loadedViolationsForStoreIdRef.current = null;
      setViolationsList([]);
    }
  }, [selectedStore?.id, selectedStore?._id, selectedStore?.externalId]);

  const closeDropdown = useCallback((immediate = false) => {
    if (immediate) {
      setStoreDropdownOpen(false);
      setDropdownExiting(false);
      setStoreSearch("");
      return;
    }
    setDropdownExiting(true);
  }, []);

  useEffect(() => {
    const onDocClick = (e) => {
      if (storeDropdownOpen && dropdownRef.current && !dropdownRef.current.contains(e.target)) closeDropdown();
    };
    document.addEventListener("mousedown", onDocClick, true);
    return () => document.removeEventListener("mousedown", onDocClick, true);
  }, [storeDropdownOpen, closeDropdown]);

  useEffect(() => {
    if (!dropdownExiting || !dropdownPanelRef.current) return;
    const el = dropdownPanelRef.current;
    const onEnd = () => {
      setStoreDropdownOpen(false);
      setDropdownExiting(false);
      setStoreSearch("");
    };
    el.addEventListener("animationend", onEnd, { once: true });
    return () => el.removeEventListener("animationend", onEnd);
  }, [dropdownExiting]);

  useEffect(() => {
    if (storeDropdownOpen && !dropdownExiting) {
      setStoreSearch("");
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [storeDropdownOpen, dropdownExiting]);

  const handleAmountInput = useCallback((value) => {
    const digits = String(value).replace(/[^\d]/g, "");
    setAmountRaw(digits ? formatMoneyWithCommas(digits) : "");
  }, []);

  const setStoreBalance = useCallback(() => {
    if (balance == null || balance <= 0) return;
    const currentAmount = parseMoneyToNumber(amountRaw);
    if (currentAmount === balance) return;
    setAmountAnimating(true);
    setAmountRaw("0");
    const target = balance;
    const duration = 600;
    const startTime = performance.now();
    const step = (now) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - (1 - t) * (1 - t);
      const current = Math.round(eased * target);
      setAmountRaw(formatMoneyWithCommas(String(current)));
      if (t < 1) requestAnimationFrame(step);
      else setAmountAnimating(false);
    };
    requestAnimationFrame(step);
  }, [balance, amountRaw]);

  const handleFormBodyAnimationEnd = useCallback(() => {
    if (!formBodyExiting || !pendingStore) return;
    setSelectedStore(pendingStore);
    setPaymentDate(todayYYYYMMDD());
    setAmountRaw("");
    setViolationsList([]);
    setNote("");
    setPendingStore(null);
    setFormBodyExiting(false);
  }, [formBodyExiting, pendingStore]);

  useEffect(() => {
    if (!formBodyExiting || !formBodyRef.current) return;
    const el = formBodyRef.current;
    const onEnd = (e) => {
      if (e.target !== el || e.animationName !== "storeCashoutFormBodyOut") return;
      handleFormBodyAnimationEnd();
    };
    el.addEventListener("animationend", onEnd, { once: true });
    return () => el.removeEventListener("animationend", onEnd);
  }, [formBodyExiting, handleFormBodyAnimationEnd]);

  const addViolation = useCallback(() => {
    setViolationsList((prev) => [...prev, { amountRaw: "", reason: "" }]);
  }, []);

  const updateViolation = useCallback((index, field, value) => {
    setViolationsList((prev) => {
      const next = [...prev];
      if (!next[index]) return prev;
      if (field === "amountRaw") {
        const digits = String(value).replace(/[^\d]/g, "");
        next[index] = { ...next[index], amountRaw: digits ? formatMoneyWithCommas(digits) : "" };
      } else {
        next[index] = { ...next[index], reason: value };
      }
      return next;
    });
  }, []);

  const [violatingExitingIndex, setViolatingExitingIndex] = useState(null);
  const violationRowRef = useRef(null);

  useEffect(() => {
    if (violatingExitingIndex === null || !violationRowRef.current) return;
    const el = violationRowRef.current;
    const onEnd = (e) => {
      if (e.target !== el || e.animationName !== "storeCashoutViolationRowOut") return;
      setViolationsList((prev) => prev.filter((_, idx) => idx !== violatingExitingIndex));
      setViolatingExitingIndex(null);
    };
    el.addEventListener("animationend", onEnd, { once: true });
    return () => el.removeEventListener("animationend", onEnd);
  }, [violatingExitingIndex]);

  const startRemoveViolation = useCallback((index) => {
    setViolatingExitingIndex(index);
  }, []);

  useEffect(() => {
    if (!exceedWarningExiting || !exceedWarningRef.current) return;
    const el = exceedWarningRef.current;
    const onEnd = (e) => {
      if (e.target !== el || e.animationName !== "storeCashoutExceedModalOut") return;
      setExceedWarningOpen(false);
      setExceedWarningExiting(false);
    };
    el.addEventListener("animationend", onEnd, { once: true });
    return () => el.removeEventListener("animationend", onEnd);
  }, [exceedWarningExiting]);

  useEffect(() => {
    if (!window.api) return;
    const unsub = window.api.onWsMessage((msg) => {
      if (msg?.type === "cashout:create:result" && msg?.requestId === createRequestIdRef.current) {
        setSubmitting(false);
        if (msg.ok) {
          setLastCashoutError(null);
          notify?.success?.("Store cashout recorded.", "Store Cashout");
          if (window.api?.wsSend) {
            if (storeEntityId) {
              window.api.wsSend({
                type: "violations:clearForEntity",
                requestId: rid(),
                payload: { entityType: "store", entityId: storeEntityId },
              });
            }
            window.api.wsSend({
              type: "notification:create",
              requestId: rid(),
              payload: {
                type: "cashout_created",
                title: "New cashout created",
                message: "Store cashout recorded.",
              },
            });
          }
          onClose?.();
        } else {
          const errMsg =
            msg.error === "insufficient_company_balance"
              ? "Insufficient liquid assets. Cannot process this cashout."
              : msg.error === "store_api_token_unavailable"
                ? "Store API token is not available. Please configure admin auth (YAMMAK_ADMIN_EMAIL / YAMMAK_ADMIN_PASSWORD) and ensure the token has been refreshed."
                : msg.error === "store_wallet_debit_failed"
                  ? "Store wallet debit failed. Check violations amount and store connection."
                  : msg.error === "store_payout_failed"
                    ? "Store payout failed. Check amount and store connection."
                    : msg.error || "Failed to create cashout";
          notify?.error?.(errMsg, "Store Cashout");
          const canRetry = msg.error === "store_wallet_debit_failed" || msg.error === "store_payout_failed";
          setLastCashoutError(canRetry ? errMsg : null);
        }
      }
    });
    return () => unsub?.();
  }, [notify, onClose, storeEntityId]);

  const doSubmit = useCallback(() => {
    if (!window.api?.wsSend) {
      notify?.error?.("API not available.", "Store Cashout");
      return;
    }
    const storeExternalId = selectedStore?.externalId != null ? selectedStore.externalId : selectedStore?.id ?? selectedStore?._id;
    const violationsDetail = violationsList
      .map((v) => ({ amount: parseMoneyToNumber(v.amountRaw), reason: (v.reason || "").trim() }))
      .filter((v) => v.amount > 0 || v.reason !== "");

    setSubmitting(true);
    createRequestIdRef.current = rid();
    // Backend should: if violations → POST wallet/debit; if 200 & data.message === 'Wallet debited', wait 2s → POST payout; then create cashout; register notification + audit.
    window.api.wsSend({
      type: "cashout:create",
      requestId: createRequestIdRef.current,
      payload: {
        category: "store",
        storeId: storeExternalId,
        storeExternalId,
        storeName: selectedStore?.storeName ?? "",
        amount,
        totalAmount: amount,
        netAmount,
        violations,
        violationsDetail: violationsDetail.length > 0 ? violationsDetail : undefined,
        note: note.trim() || undefined,
        paymentDate: paymentDate || undefined,
        payoutReason: PAYOUT_REASON_DEFAULT,
      },
    });
  }, [selectedStore, amount, netAmount, violations, violationsList, note, paymentDate, notify, onClose]);

  const handleConfirm = useCallback(() => {
    if (!selectedStore) {
      notify?.warning?.("Please select a store.", "Store Cashout");
      return;
    }
    if (!paymentDate || (typeof paymentDate === "string" && !paymentDate.trim())) {
      notify?.warning?.("Please set the payment date.", "Store Cashout");
      return;
    }
    const amountEmpty = amount <= 0 || (typeof amountRaw === "string" && !amountRaw.trim());
    if (amountEmpty) {
      notify?.warning?.("Please enter a valid cashout amount.", "Store Cashout");
      return;
    }
    if (maxAllowedAmount != null && amount > maxAllowedAmount) {
      notify?.warning?.(
        `Amount cannot exceed store balance (${formatMoneyWithCommas(String(maxAllowedAmount))}) unless you have permission.`,
        "Store Cashout"
      );
      return;
    }
    if (deductionsExceedAmount) {
      notify?.warning?.("Violations cannot exceed the cashout amount.", "Store Cashout");
      return;
    }

    // If user can exceed balance and amount > balance, show warning modal before submit
    if (canExceedBalance && wouldExceedBalance) {
      setExceedWarningOpen(true);
      return;
    }

    doSubmit();
  }, [
    selectedStore,
    paymentDate,
    amount,
    amountRaw,
    maxAllowedAmount,
    deductionsExceedAmount,
    canExceedBalance,
    wouldExceedBalance,
    notify,
    doSubmit,
  ]);

  const handleExceedWarningConfirm = useCallback(() => {
    setExceedWarningExiting(true);
    setTimeout(() => doSubmit(), 260);
  }, [doSubmit]);

  const currencyLabel = "IQD";

  return (
    <div className="storeCashoutForm">
      <div className="storeCashoutFormInner">
        <div className="storeCashoutField storeCashoutField--full">
          <label className="storeCashoutLabel">Store</label>
          <div className="storeCashoutSelectWrap" ref={dropdownRef}>
            <button
              type="button"
              className="storeCashoutSelectBtn"
              onClick={() => {
                if (storeDropdownOpen || dropdownExiting) closeDropdown();
                else {
                  if (window.api?.wsSend && Date.now() - lastStoresFetchRef.current > CACHE_TTL_MS) {
                    setLoading(true);
                    storesRequestIdRef.current = rid();
                    window.api.wsSend({
                      type: "stores:list",
                      requestId: storesRequestIdRef.current,
                      payload: {
                        sortBy: "storeName",
                        sortDir: "asc",
                        page: 1,
                        pageSize: 100,
                        query: storeSearch.trim() || undefined,
                      },
                    });
                  }
                  setStoreDropdownOpen(true);
                }
              }}
              aria-expanded={storeDropdownOpen || dropdownExiting}
            >
              <span className="storeCashoutSelectValue">
                {selectedStore ? selectedStore.storeName ?? "—" : "Select store..."}
              </span>
              <ChevronDown size={16} className="storeCashoutSelectChev" />
            </button>
            {(storeDropdownOpen || dropdownExiting) && (
              <div
                ref={dropdownPanelRef}
                className={`storeCashoutDropdown ${dropdownExiting ? "storeCashoutDropdown--exiting" : ""}`}
              >
                <div className="storeCashoutDropdownSearch">
                  <Search size={14} className="storeCashoutSearchIcon" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    className="storeCashoutSearchInput"
                    placeholder="Search by name, ID..."
                    value={storeSearch}
                    onChange={(e) => setStoreSearch(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="storeCashoutDropdownList">
                  {loading ? (
                    <div className="storeCashoutDropdownItem storeCashoutDropdownItem--muted">Loading...</div>
                  ) : stores.length === 0 ? (
                    <div className="storeCashoutDropdownItem storeCashoutDropdownItem--muted">No stores found</div>
                  ) : (
                    stores.map((s) => {
                      const sId = s.id ?? s._id ?? s.externalId;
                      const isSame =
                        selectedStore && sId === (selectedStore.id ?? selectedStore._id ?? selectedStore.externalId);
                      return (
                        <button
                          key={sId}
                          type="button"
                          className="storeCashoutDropdownItem"
                          onClick={() => {
                            if (isSame) {
                              closeDropdown();
                              return;
                            }
                            if (selectedStore) {
                              setPendingStore(s);
                              setFormBodyExiting(true);
                              closeDropdown();
                            } else {
                              setSelectedStore(s);
                              closeDropdown();
                            }
                          }}
                        >
                          {s.storeName ?? "—"}{" "}
                          {s.balance != null ? `(${formatMoneyWithCommas(String(s.balance))} ${currencyLabel})` : ""}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {lastCashoutError && (
          <div className="storeCashoutErrorBanner">
            <AlertTriangle size={18} className="storeCashoutErrorBannerIcon" />
            <span className="storeCashoutErrorBannerText">{lastCashoutError}</span>
            <button
              type="button"
              className="storeCashoutErrorBannerRetry"
              onClick={() => {
                setLastCashoutError(null);
                doSubmit();
              }}
              disabled={submitting}
            >
              Retry
            </button>
          </div>
        )}
        {selectedStore && (
          <div
            ref={formBodyRef}
            className={`storeCashoutFormBody ${formBodyExiting ? "storeCashoutFormBody--exiting" : ""}`}
          >
            <div
              key={selectedStore.id ?? selectedStore._id ?? selectedStore.externalId}
              className="storeCashoutFormBodyContent"
            >
              <div className="storeCashoutStoreInfo storeCashoutAnimateIn storeCashoutAnimateIn--0">
                <div className="storeCashoutStoreRow">
                  <span className="storeCashoutStoreLabel">Store:</span>
                  <span className="storeCashoutStoreValue">{selectedStore.storeName ?? "—"}</span>
                </div>
                <div className="storeCashoutStoreRow">
                  <span className="storeCashoutStoreLabel">Balance:</span>
                  <span className="storeCashoutStoreValue">
                    {formatMoneyWithCommas(String(balance))} {currencyLabel}
                  </span>
                </div>
                {!canExceedBalance && (
                  <div className="storeCashoutStoreRow">
                    <span className="storeCashoutStoreLabel storeCashoutStoreLabel--hint">Amount must be ≤ balance</span>
                  </div>
                )}
              </div>

              <div className="storeCashoutRow storeCashoutAnimateIn storeCashoutAnimateIn--1">
                <div className="storeCashoutField">
                  <label className="storeCashoutLabel">Date</label>
                  <div className="storeCashoutInputWrap storeCashoutDateWrap">
                    <Calendar size={16} className="storeCashoutInputIcon" />
                    <input
                      type="date"
                      className="storeCashoutInput storeCashoutDateInput"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value || todayYYYYMMDD())}
                    />
                  </div>
                </div>
                <div className="storeCashoutField">
                  <label className="storeCashoutLabel">Amount ({currencyLabel})</label>
                  <div className="storeCashoutInputWrap">
                    <input
                      type="text"
                      className={`storeCashoutInput ${amountError ? "storeCashoutInput--error" : ""}`}
                      placeholder="0"
                      value={amountRaw}
                      onChange={(e) => handleAmountInput(e.target.value)}
                      readOnly={amountAnimating}
                      aria-readonly={amountAnimating}
                      aria-invalid={amountError}
                    />
                    {balance != null && balance > 0 && (
                      <button
                        type="button"
                        className="storeCashoutUseBalanceBtn"
                        onClick={setStoreBalance}
                        disabled={amountAnimating}
                      >
                        Use balance
                      </button>
                    )}
                  </div>
                  {amountError && (
                    <p className="storeCashoutHint" style={{ color: "var(--sc-accent)" }}>
                      Amount exceeds store balance. Permission required to exceed.
                    </p>
                  )}
                </div>
              </div>

              <div className="storeCashoutField storeCashoutField--full storeCashoutAnimateIn storeCashoutAnimateIn--2">
                <label className="storeCashoutLabel">Violations (deducted from payment)</label>
                <button
                  type="button"
                  className="storeCashoutAddViolationBtn"
                  onClick={addViolation}
                  disabled={!canEnterDeductions}
                >
                  <Plus size={14} style={{ marginRight: 4 }} />
                  Add violation
                </button>
                {violationsList.length > 0 && (
                  <div className="storeCashoutViolationsList">
                    {violationsList.map((v, i) => (
                      <div
                        key={i}
                        ref={i === violatingExitingIndex ? violationRowRef : null}
                        className={`storeCashoutViolationRow storeCashoutViolationRowIn ${
                          i === violatingExitingIndex ? "storeCashoutViolationRow--exiting" : ""
                        }`}
                      >
                        <input
                          type="text"
                          className="storeCashoutInput storeCashoutViolationAmountInput"
                          placeholder="Amount"
                          value={v.amountRaw}
                          onChange={(e) => updateViolation(i, "amountRaw", e.target.value)}
                          disabled={!canEnterDeductions || i === violatingExitingIndex}
                        />
                        <input
                          type="text"
                          className="storeCashoutInput storeCashoutViolationReasonInput"
                          placeholder="Reason"
                          value={v.reason}
                          onChange={(e) => updateViolation(i, "reason", e.target.value)}
                          disabled={!canEnterDeductions || i === violatingExitingIndex}
                        />
                        <button
                          type="button"
                          className="storeCashoutViolationRemoveBtn"
                          onClick={() => startRemoveViolation(i)}
                          disabled={!canEnterDeductions || i === violatingExitingIndex}
                          aria-label="Remove violation"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {violations > 0 && (
                  <p className="storeCashoutHint" style={{ marginTop: 4 }}>
                    Total violations: {formatMoneyWithCommas(String(violations))} {currencyLabel}
                  </p>
                )}
              </div>

              <div className="storeCashoutSummary storeCashoutAnimateIn storeCashoutAnimateIn--3">
                <div className="storeCashoutSummaryRow">
                  <span className="storeCashoutSummaryLabel">Net (store will take):</span>
                  <span className="storeCashoutSummaryValue" aria-live="polite">
                    {formatMoneyWithCommas(String(displayedNetAmount))} {currencyLabel}
                  </span>
                </div>
                {deductionsExceedAmount && (
                  <p className="storeCashoutHint" style={{ marginTop: 6, color: "var(--sc-accent, #f59e0b)" }}>
                    Violations cannot exceed the cashout amount. Reduce them to confirm.
                  </p>
                )}
              </div>

              <div className="storeCashoutField storeCashoutField--full storeCashoutAnimateIn storeCashoutAnimateIn--4">
                <label className="storeCashoutLabel">Note</label>
                <textarea
                  className="storeCashoutTextarea"
                  placeholder="Optional note..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                />
              </div>

              {/* Commented: liquid assets check — prevent cashout if company Liquid Assets would go minus after this transaction
              useEffect or validation before doSubmit:
              const companyBalance = ... from settings/finance;
              if (companyBalance - netAmount < 0) { notify.error('...'); return; }
              */}

              <div className="storeCashoutActions storeCashoutAnimateIn storeCashoutAnimateIn--5">
                <button type="button" className="storeCashoutBtn storeCashoutBtn--secondary" onClick={onClose}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="storeCashoutBtn storeCashoutBtn--primary"
                  onClick={handleConfirm}
                  disabled={submitting || amountError}
                >
                  <Send size={16} />
                  {submitting ? "Saving…" : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Exceed balance warning modal — portal to body */}
      {exceedWarningOpen &&
        ReactDOM.createPortal(
          <div
            className={`storeCashoutExceedBackdrop ${exceedWarningExiting ? "storeCashoutExceedBackdrop--exiting" : ""}`}
            role="alertdialog"
            aria-labelledby="storeCashoutExceedTitle"
            aria-modal="true"
            onClick={() => !exceedWarningExiting && setExceedWarningExiting(true)}
          >
            <div
              ref={exceedWarningRef}
              className={`storeCashoutExceedModal ${exceedWarningExiting ? "storeCashoutExceedModal--exiting" : ""}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="storeCashoutExceedIcon">
                <AlertTriangle size={28} />
              </div>
              <h3 id="storeCashoutExceedTitle" className="storeCashoutExceedTitle">
                Exceed store balance
              </h3>
              <p className="storeCashoutExceedMessage">
                You are about to give the store more than their current balance. Please confirm you intend to do this.
              </p>
              <div className="storeCashoutExceedActions">
                <button
                  type="button"
                  className="storeCashoutBtn storeCashoutBtn--secondary"
                  onClick={() => setExceedWarningExiting(true)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="storeCashoutBtn storeCashoutBtn--primary"
                  onClick={handleExceedWarningConfirm}
                  disabled={submitting}
                >
                  I understand, continue
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

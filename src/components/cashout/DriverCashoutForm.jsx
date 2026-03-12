// DriverCashoutForm — balance, amount (≤ balance unless permission), date, violations, extra charges, net, note
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { Info, Calendar, ChevronDown, Search, Send, Plus, X } from "lucide-react";
import { useNotification } from "../NotificationProvider";
import { hasPermission } from "../../helpers/permissions";
import "../../styles/pages/cashout/driver_cashout_form.css";

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

function getDriverIds(driver) {
  if (!driver || typeof driver !== "object") return [];
  const ids = [driver.externalId, driver._id, driver.id];
  return ids
    .filter((value) => value != null && String(value).trim() !== "")
    .map((value) => String(value));
}

function normalizePhone(phone) {
  return String(phone ?? "").replace(/[^\d+]/g, "");
}

function findMatchingDriver(drivers, target) {
  if (!Array.isArray(drivers) || drivers.length === 0 || !target) return null;
  const targetIds = new Set(getDriverIds(target));
  const targetPhone = normalizePhone(target.phone);
  const targetName = String(target.name ?? "").trim().toLowerCase();

  return (
    drivers.find((driver) => {
      const candidateIds = getDriverIds(driver);
      if (candidateIds.some((id) => targetIds.has(id))) return true;

      const candidatePhone = normalizePhone(driver.phone);
      if (targetPhone && candidatePhone && candidatePhone === targetPhone) return true;

      const candidateName = String(driver.name ?? "").trim().toLowerCase();
      return Boolean(targetName && candidateName && candidateName === targetName);
    }) ?? null
  );
}

export default function DriverCashoutForm({ account, onClose, initialDriver = null }) {
  const notify = useNotification();
  const [drivers, setDrivers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDriver, setSelectedDriver] = useState(null);

  const [paymentDate, setPaymentDate] = useState(todayYYYYMMDD());
  const [amountRaw, setAmountRaw] = useState("");
  const [violationsList, setViolationsList] = useState([]);
  const [appliedCharges, setAppliedCharges] = useState([]);
  const [note, setNote] = useState("");

  const [driverDropdownOpen, setDriverDropdownOpen] = useState(false);
  const [dropdownExiting, setDropdownExiting] = useState(false);
  const [driverSearch, setDriverSearch] = useState("");
  const [formBodyExiting, setFormBodyExiting] = useState(false);
  const [pendingDriver, setPendingDriver] = useState(null);

  const [extraChargeDropdownOpen, setExtraChargeDropdownOpen] = useState(false);
  const [extraChargeMenuClosing, setExtraChargeMenuClosing] = useState(false);

  // Floating menu position (fixed + portal); width is menu width (min 280), left/top clamped to viewport
  const [extraMenuPos, setExtraMenuPos] = useState(null); // { left, top, width }
  const EXTRA_MENU_MIN_WIDTH = 280;
  const EXTRA_MENU_MAX_HEIGHT = 240;
  const VIEWPORT_PAD = 12;
  const syncExtraMenuPosRafRef = useRef(null);

  const [submitting, setSubmitting] = useState(false);
  const createRequestIdRef = useRef(null);
  const settingsRequestIdRef = useRef(null);
  const loadedViolationsForDriverIdRef = useRef(null);
  const violationsListReqIdRef = useRef(null);

  const dropdownRef = useRef(null);
  const dropdownPanelRef = useRef(null);
  const formBodyRef = useRef(null);
  const searchInputRef = useRef(null);

  const extraChargeMenuRef = useRef(null);
  const extraChargeAddBtnRef = useRef(null);

  const balance = Number(selectedDriver?.balance) || 0;
  const amount = useMemo(() => parseMoneyToNumber(amountRaw), [amountRaw]);
  const violations = useMemo(
    () => violationsList.reduce((s, v) => s + parseMoneyToNumber(v.amountRaw), 0),
    [violationsList]
  );
  const totalExtra = useMemo(
    () => appliedCharges.reduce((s, c) => s + (Number(c.amount) || 0), 0),
    [appliedCharges]
  );
  const netAmount = useMemo(() => Math.max(0, amount - violations - totalExtra), [amount, violations, totalExtra]);
  const deductionsExceedAmount = amount > 0 && violations + totalExtra > amount;

  const canExceedBalance = useMemo(() => hasPermission(account, "cashout.driverExceedBalance"), [account]);

  const maxAllowedAmount = canExceedBalance ? undefined : balance;
  const amountError = maxAllowedAmount != null && amount > maxAllowedAmount;
  const canEnterDeductions = amount > 0;

  const extraChargesFromSettings = useMemo(
    () => (Array.isArray(settings?.cashoutExtraCharges) ? settings.cashoutExtraCharges : []),
    [settings]
  );

  useEffect(() => {
    if (!window.api) {
      setLoading(false);
      return;
    }
    const reqId = rid();
    const settingsReqId = rid();
    settingsRequestIdRef.current = settingsReqId;
    window.api.wsSend({ type: "drivers:list", requestId: reqId });
    window.api.wsSend({ type: "settings:get", requestId: settingsReqId });

    const unsub = window.api.onWsMessage((msg) => {
      if (msg?.type === "drivers:list" && msg?.requestId === reqId) {
        setDrivers(Array.isArray(msg.drivers) ? msg.drivers : []);
        setLoading(false);
      }
      if (msg?.type === "settings:get:result" && msg?.requestId === settingsReqId && msg?.ok && msg.settings) {
        setSettings(msg.settings);
      }
    });
    return () => unsub?.();
  }, []);

  // Load pending violations for selected driver when amount > 0 (once per driver)
  const driverEntityId = selectedDriver
    ? String(selectedDriver.externalId ?? selectedDriver._id ?? selectedDriver.id ?? "")
    : null;
  useEffect(() => {
    if (!window.api?.wsSend || amount <= 0 || !driverEntityId) return;
    const alreadyLoaded = loadedViolationsForDriverIdRef.current === driverEntityId;
    if (alreadyLoaded) return;
    loadedViolationsForDriverIdRef.current = driverEntityId;
    violationsListReqIdRef.current = rid();
    window.api.wsSend({
      type: "violations:list",
      requestId: violationsListReqIdRef.current,
      payload: { entityType: "driver", entityId: driverEntityId },
    });
  }, [amount, driverEntityId]);

  useEffect(() => {
    if (!window.api?.onWsMessage || !driverEntityId) return;
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
  }, [driverEntityId]);

  // When driver changes, reset so we load violations for the new driver when amount > 0
  useEffect(() => {
    if (!selectedDriver) {
      loadedViolationsForDriverIdRef.current = null;
      setViolationsList([]);
      return;
    }
    const id = String(selectedDriver.externalId ?? selectedDriver._id ?? selectedDriver.id ?? "");
    if (loadedViolationsForDriverIdRef.current != null && loadedViolationsForDriverIdRef.current !== id) {
      loadedViolationsForDriverIdRef.current = null;
      setViolationsList([]);
    }
  }, [selectedDriver?.externalId, selectedDriver?._id, selectedDriver?.id]);

  const filteredDrivers = useMemo(() => {
    const q = driverSearch.trim().toLowerCase();
    if (!q) return drivers;
    return drivers.filter((d) => {
      const name = String(d?.name ?? "").toLowerCase();
      const phone = String(d?.phone ?? "").toLowerCase();
      const id = String(d?.id ?? d?.externalId ?? "").toLowerCase();
      return name.includes(q) || phone.includes(q) || id.includes(q);
    });
  }, [drivers, driverSearch]);

  useEffect(() => {
    if (!initialDriver || selectedDriver || drivers.length === 0) return;
    const matched = findMatchingDriver(drivers, initialDriver);
    if (matched) setSelectedDriver(matched);
  }, [drivers, initialDriver, selectedDriver]);

  const closeDropdown = useCallback((immediate = false) => {
    if (immediate) {
      setDriverDropdownOpen(false);
      setDropdownExiting(false);
      setDriverSearch("");
      return;
    }
    setDropdownExiting(true);
  }, []);

  const closeExtraChargeMenu = useCallback(() => {
    setExtraChargeMenuClosing(true);
  }, []);

  // Calculate floating menu position: wide menu, clamped to viewport so it doesn't overflow
  const syncExtraMenuPos = useCallback(() => {
    const btn = extraChargeAddBtnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const gap = 6;
    const menuWidth = Math.max(r.width, EXTRA_MENU_MIN_WIDTH);
    const maxLeft = window.innerWidth - menuWidth - VIEWPORT_PAD;
    const maxTop = window.innerHeight - EXTRA_MENU_MAX_HEIGHT - VIEWPORT_PAD;
    setExtraMenuPos({
      left: Math.round(Math.max(VIEWPORT_PAD, Math.min(r.left, maxLeft))),
      top: Math.round(Math.max(VIEWPORT_PAD, Math.min(r.bottom + gap, maxTop))),
      width: menuWidth,
    });
  }, []);

  const syncExtraMenuPosDebounced = useCallback(() => {
    if (syncExtraMenuPosRafRef.current != null) cancelAnimationFrame(syncExtraMenuPosRafRef.current);
    syncExtraMenuPosRafRef.current = requestAnimationFrame(() => {
      syncExtraMenuPosRafRef.current = null;
      syncExtraMenuPos();
    });
  }, [syncExtraMenuPos]);

  const openExtraChargeMenu = useCallback(() => {
    syncExtraMenuPos();
    setExtraChargeDropdownOpen(true);
  }, [syncExtraMenuPos]);

  // Keep menu “attached” on scroll/resize while open
  useEffect(() => {
    if (!(extraChargeDropdownOpen && !extraChargeMenuClosing)) return;

    const onScrollOrResize = () => syncExtraMenuPosDebounced();
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);

    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
      if (syncExtraMenuPosRafRef.current != null) cancelAnimationFrame(syncExtraMenuPosRafRef.current);
    };
  }, [extraChargeDropdownOpen, extraChargeMenuClosing, syncExtraMenuPosDebounced]);

  useEffect(() => {
    if (!extraChargeDropdownOpen && !extraChargeMenuClosing) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeExtraChargeMenu();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [extraChargeDropdownOpen, extraChargeMenuClosing, closeExtraChargeMenu]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (driverDropdownOpen && dropdownRef.current && !dropdownRef.current.contains(e.target)) closeDropdown();

      if (!extraChargeDropdownOpen && !extraChargeMenuClosing) return;

      const menuEl = extraChargeMenuRef.current;
      const addBtnEl = extraChargeAddBtnRef.current;

      if (menuEl?.contains(e.target) || addBtnEl?.contains(e.target)) return;
      closeExtraChargeMenu();
    };
    document.addEventListener("mousedown", onDocClick, true);
    return () => document.removeEventListener("mousedown", onDocClick, true);
  }, [driverDropdownOpen, extraChargeDropdownOpen, extraChargeMenuClosing, closeExtraChargeMenu, closeDropdown]);

  useEffect(() => {
    if (!extraChargeMenuClosing) return;
    const el = extraChargeMenuRef.current;
    const onEnd = (e) => {
      if (e.target !== el || e.animationName !== "driverExtraMenuOut") return;
      setExtraChargeDropdownOpen(false);
      setExtraChargeMenuClosing(false);
      setExtraMenuPos(null);
    };
    const fallback = setTimeout(() => {
      setExtraChargeDropdownOpen(false);
      setExtraChargeMenuClosing(false);
      setExtraMenuPos(null);
    }, 220);
    if (el) el.addEventListener("animationend", onEnd, { once: true });
    return () => {
      clearTimeout(fallback);
      if (el) el.removeEventListener("animationend", onEnd);
    };
  }, [extraChargeMenuClosing]);

  useEffect(() => {
    if (!dropdownExiting || !dropdownPanelRef.current) return;
    const el = dropdownPanelRef.current;
    const onEnd = () => {
      setDriverDropdownOpen(false);
      setDropdownExiting(false);
      setDriverSearch("");
    };
    el.addEventListener("animationend", onEnd, { once: true });
    return () => el.removeEventListener("animationend", onEnd);
  }, [dropdownExiting]);

  useEffect(() => {
    if (driverDropdownOpen && !dropdownExiting) {
      setDriverSearch("");
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [driverDropdownOpen, dropdownExiting]);

  const handleAmountInput = useCallback((value) => {
    const digits = String(value).replace(/[^\d]/g, "");
    setAmountRaw(digits ? formatMoneyWithCommas(digits) : "");
  }, []);

  const handleFormBodyAnimationEnd = useCallback(() => {
    if (!formBodyExiting || !pendingDriver) return;
    setSelectedDriver(pendingDriver);
    setPaymentDate(todayYYYYMMDD());
    setAmountRaw("");
    setViolationsList([]);
    setAppliedCharges([]);
    setNote("");
    setPendingDriver(null);
    setFormBodyExiting(false);
  }, [formBodyExiting, pendingDriver]);

  useEffect(() => {
    if (!formBodyExiting || !formBodyRef.current) return;
    const el = formBodyRef.current;
    const onEnd = (e) => {
      if (e.target !== el || e.animationName !== "empCashoutFormBodyOut") return;
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
      if (e.target !== el || e.animationName !== "empCashoutViolationRowOut") return;
      setViolationsList((prev) => prev.filter((_, idx) => idx !== violatingExitingIndex));
      setViolatingExitingIndex(null);
    };
    el.addEventListener("animationend", onEnd, { once: true });
    return () => el.removeEventListener("animationend", onEnd);
  }, [violatingExitingIndex]);

  const startRemoveViolation = useCallback((index) => {
    setViolatingExitingIndex(index);
  }, []);

  const [chargeExitingIndex, setChargeExitingIndex] = useState(null);
  const chargeChipRef = useRef(null);

  useEffect(() => {
    if (chargeExitingIndex === null || !chargeChipRef.current) return;
    const el = chargeChipRef.current;
    const onEnd = (e) => {
      if (e.target !== el || e.animationName !== "driverExtraTagOut") return;
      setAppliedCharges((prev) => prev.filter((_, i) => i !== chargeExitingIndex));
      setChargeExitingIndex(null);
    };
    el.addEventListener("animationend", onEnd, { once: true });
    return () => el.removeEventListener("animationend", onEnd);
  }, [chargeExitingIndex]);

  const addExtraCharge = useCallback(
    (charge) => {
      if (!charge || (charge.name || "").trim() === "") return;
      const chargeAmount = Number(charge.amount) || 0;
      if (chargeAmount <= 0) return;
      const wouldBeTotal = violations + totalExtra + chargeAmount;
      if (wouldBeTotal > amount) {
        closeExtraChargeMenu();
        notify?.warning?.("This charge would make deductions exceed the amount.", "Driver Cashout");
        return;
      }
      closeExtraChargeMenu();
      setAppliedCharges((prev) => [...prev, { name: String(charge.name).trim(), amount: chargeAmount }]);
    },
    [closeExtraChargeMenu, violations, totalExtra, amount, notify]
  );

  const startRemoveAppliedCharge = useCallback((index) => {
    setChargeExitingIndex(index);
  }, []);

  useEffect(() => {
    if (!window.api) return;
    const unsub = window.api.onWsMessage((msg) => {
      if (msg?.type === "cashout:create:result" && msg?.requestId === createRequestIdRef.current) {
        setSubmitting(false);
        if (msg.ok) {
          notify?.success?.("Driver cashout recorded.", "Driver Cashout");
          if (window.api?.wsSend && driverEntityId) {
            window.api.wsSend({
              type: "violations:clearForEntity",
              requestId: rid(),
              payload: { entityType: "driver", entityId: driverEntityId },
            });
            window.api.wsSend({
              type: "notification:create",
              requestId: rid(),
              payload: { type: "cashout_created", title: "New cashout created", message: "Driver cashout recorded." },
            });
          }
          onClose?.();
        } else {
          notify?.error?.(
            msg.error === "insufficient_company_balance"
              ? "Insufficient liquid assets. Cannot process this cashout."
              : msg.error || "Failed to create cashout",
            "Driver Cashout"
          );
        }
      }
    });
    return () => unsub?.();
  }, [notify, onClose, driverEntityId]);

  const handleConfirm = useCallback(() => {
    if (!selectedDriver) {
      notify?.warning?.("Please select a driver.", "Driver Cashout");
      return;
    }
    if (!paymentDate || (typeof paymentDate === "string" && !paymentDate.trim())) {
      notify?.warning?.("Please set the payment date.", "Driver Cashout");
      return;
    }
    const amountEmpty = amount <= 0 || (typeof amountRaw === "string" && !amountRaw.trim());
    if (amountEmpty) {
      notify?.warning?.("Please enter a valid cashout amount.", "Driver Cashout");
      return;
    }
    if (maxAllowedAmount != null && amount > maxAllowedAmount) {
      notify?.warning?.(
        `Amount cannot exceed driver balance (${formatMoneyWithCommas(String(maxAllowedAmount))}) unless you have permission.`,
        "Driver Cashout"
      );
      return;
    }
    const totalDeductions = violations + totalExtra;
    if (totalDeductions > amount) {
      notify?.warning?.("Deductions cannot exceed the cashout amount.", "Driver Cashout");
      return;
    }
    if (!window.api?.wsSend) {
      notify?.error?.("API not available.", "Driver Cashout");
      return;
    }
    const driverId = selectedDriver.externalId != null ? selectedDriver.externalId : selectedDriver._id;
    setSubmitting(true);
    createRequestIdRef.current = rid();
    const violationsDetail = violationsList
      .map((v) => ({ amount: parseMoneyToNumber(v.amountRaw), reason: (v.reason || "").trim() }))
      .filter((v) => v.amount > 0 || v.reason !== "");
    window.api.wsSend({
      type: "cashout:create",
      requestId: createRequestIdRef.current,
      payload: {
        category: "driver",
        driverId,
        driverName: selectedDriver.name ?? "",
        amount: netAmount,
        totalAmount: amount,
        netAmount,
        extraCharge: totalExtra,
        violations,
        violationsDetail: violationsDetail.length > 0 ? violationsDetail : undefined,
        note: note.trim() || undefined,
        paymentDate: paymentDate || undefined,
      },
    });
  }, [selectedDriver, paymentDate, amount, amountRaw, netAmount, totalExtra, violations, violationsList, note, maxAllowedAmount, notify, onClose]);

  const currencyLabel = "IQD";

  return (
    <div className="empCashoutForm">
      <div className="empCashoutFormInner">
        <div className="empCashoutField empCashoutField--full">
          <label className="empCashoutLabel">Driver</label>
          <div className="empCashoutSelectWrap" ref={dropdownRef}>
            <button
              type="button"
              className="empCashoutSelectBtn"
              onClick={() => {
                if (driverDropdownOpen || dropdownExiting) closeDropdown();
                else setDriverDropdownOpen(true);
              }}
              aria-expanded={driverDropdownOpen || dropdownExiting}
            >
              <span className="empCashoutSelectValue">{selectedDriver ? selectedDriver.name ?? "—" : "Select driver..."}</span>
              <ChevronDown size={16} className="empCashoutSelectChev" />
            </button>
            {(driverDropdownOpen || dropdownExiting) && (
              <div ref={dropdownPanelRef} className={`empCashoutDropdown ${dropdownExiting ? "empCashoutDropdown--exiting" : ""}`}>
                <div className="empCashoutDropdownSearch">
                  <Search size={14} className="empCashoutSearchIcon" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    className="empCashoutSearchInput"
                    placeholder="Search by name, phone, ID..."
                    value={driverSearch}
                    onChange={(e) => setDriverSearch(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="empCashoutDropdownList">
                  {loading ? (
                    <div className="empCashoutDropdownItem empCashoutDropdownItem--muted">Loading...</div>
                  ) : filteredDrivers.length === 0 ? (
                    <div className="empCashoutDropdownItem empCashoutDropdownItem--muted">No drivers found</div>
                  ) : (
                    filteredDrivers.map((d) => {
                      const dId = d.id ?? d._id ?? d.externalId;
                      const isSame = selectedDriver && dId === (selectedDriver.id ?? selectedDriver._id ?? selectedDriver.externalId);
                      return (
                        <button
                          key={dId}
                          type="button"
                          className="empCashoutDropdownItem"
                          onClick={() => {
                            if (isSame) {
                              closeDropdown();
                              return;
                            }
                            if (selectedDriver) {
                              setPendingDriver(d);
                              setFormBodyExiting(true);
                              closeDropdown();
                            } else {
                              setSelectedDriver(d);
                              closeDropdown();
                            }
                          }}
                        >
                          {d.name ?? "—"} {d.balance != null ? `(${formatMoneyWithCommas(String(d.balance))} ${currencyLabel})` : ""}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {selectedDriver && (
          <div ref={formBodyRef} className={`empCashoutFormBody ${formBodyExiting ? "empCashoutFormBody--exiting" : ""}`}>
            <div key={selectedDriver.id ?? selectedDriver._id ?? selectedDriver.externalId} className="empCashoutFormBodyContent">
              <div className="empCashoutEmployeeInfo empCashoutAnimateIn empCashoutAnimateIn--0">
                <div className="empCashoutEmployeeRow">
                  <span className="empCashoutEmployeeLabel">Driver:</span>
                  <span className="empCashoutEmployeeValue">{selectedDriver.name ?? "—"}</span>
                </div>
                <div className="empCashoutEmployeeRow">
                  <span className="empCashoutEmployeeLabel">Balance:</span>
                  <span className="empCashoutEmployeeValue">
                    {formatMoneyWithCommas(String(balance))} {currencyLabel}
                  </span>
                </div>
                {!canExceedBalance && (
                  <div className="empCashoutEmployeeRow">
                    <span className="empCashoutEmployeeLabel empCashoutEmployeeLabel--hint">Amount must be ≤ balance</span>
                  </div>
                )}
              </div>

              <div className="empCashoutRow empCashoutAnimateIn empCashoutAnimateIn--1">
                <div className="empCashoutField">
                  <label className="empCashoutLabel">Payment date</label>
                  <div className="empCashoutInputWrap empCashoutDateWrap">
                    <Calendar size={16} className="empCashoutInputIcon" />
                    <input
                      type="date"
                      className="empCashoutInput empCashoutDateInput"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value || todayYYYYMMDD())}
                    />
                  </div>
                </div>
                <div className="empCashoutField">
                  <label className="empCashoutLabel">Amount ({currencyLabel})</label>
                  <div className="empCashoutInputWrap">
                    <input
                      type="text"
                      className={`empCashoutInput ${amountError ? "empCashoutInput--error" : ""}`}
                      placeholder="0"
                      value={amountRaw}
                      onChange={(e) => handleAmountInput(e.target.value)}
                      aria-invalid={amountError}
                    />
                  </div>
                  {amountError && (
                    <p className="empCashoutHint" style={{ color: "var(--ec-accent)" }}>
                      Amount exceeds driver balance. Permission required to exceed.
                    </p>
                  )}
                </div>
              </div>

              <div className="empCashoutField empCashoutField--full empCashoutAnimateIn empCashoutAnimateIn--2">
                <label className="empCashoutLabel">Violations (deducted from payment)</label>
                <button type="button" className="empCashoutUseSalaryBtn" onClick={addViolation} disabled={!canEnterDeductions}>
                  <Plus size={14} style={{ marginRight: 4 }} />
                  Add violation
                </button>
                {violationsList.length > 0 && (
                  <div className="empCashoutViolationsList">
                    {violationsList.map((v, i) => (
                      <div
                        key={i}
                        ref={i === violatingExitingIndex ? violationRowRef : null}
                        className={`empCashoutViolationRow empCashoutViolationRowIn ${
                          i === violatingExitingIndex ? "empCashoutViolationRow--exiting" : ""
                        }`}
                      >
                        <input
                          type="text"
                          className="empCashoutInput empCashoutViolationAmountInput"
                          placeholder="Amount"
                          value={v.amountRaw}
                          onChange={(e) => updateViolation(i, "amountRaw", e.target.value)}
                          disabled={!canEnterDeductions || i === violatingExitingIndex}
                        />
                        <input
                          type="text"
                          className="empCashoutInput empCashoutViolationReasonInput"
                          placeholder="Reason"
                          value={v.reason}
                          onChange={(e) => updateViolation(i, "reason", e.target.value)}
                          disabled={!canEnterDeductions || i === violatingExitingIndex}
                        />
                        <button
                          type="button"
                          className="empCashoutViolationRemoveBtn"
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
                  <p className="empCashoutHint" style={{ marginTop: 4 }}>
                    Total violations: {formatMoneyWithCommas(String(violations))} {currencyLabel}
                  </p>
                )}
              </div>

              <div className="empCashoutField empCashoutField--full empCashoutAnimateIn empCashoutAnimateIn--3">
                <div className="driverExtraWrap">
                  <div className="driverExtraBlock">
                    <div className="driverExtraHead">
                      <span className="driverExtraTitle">Extra charges</span>
                      <button
                        ref={extraChargeAddBtnRef}
                        type="button"
                        className={`driverExtraAddBtn ${extraChargeDropdownOpen && !extraChargeMenuClosing ? "is-open" : ""}`}
                        onClick={() => {
                          if (extraChargeDropdownOpen || extraChargeMenuClosing) closeExtraChargeMenu();
                          else openExtraChargeMenu();
                        }}
                        disabled={!canEnterDeductions || extraChargesFromSettings.length === 0}
                        aria-expanded={extraChargeDropdownOpen && !extraChargeMenuClosing}
                        aria-haspopup="listbox"
                      >
                        <Plus size={14} />
                        Add charge
                      </button>
                    </div>
                    <div className="driverExtraBody">
                      {appliedCharges.length === 0 ? (
                        <p className="driverExtraEmpty">
                          {extraChargesFromSettings.length === 0 ? "Add charges in Settings → Cashout." : "No charges added. Click “Add charge” to choose."}
                        </p>
                      ) : (
                        <ul className="driverExtraAppliedList" aria-label="Applied extra charges">
                          {appliedCharges.map((c, i) => (
                            <li
                              key={i}
                              ref={i === chargeExitingIndex ? chargeChipRef : null}
                              className={`driverExtraTag driverExtraTagIn ${i === chargeExitingIndex ? "driverExtraTagOut" : ""}`}
                            >
                              <span className="driverExtraTagText">
                                {c.name} · {formatMoneyWithCommas(String(c.amount))} {currencyLabel}
                              </span>
                              <button
                                type="button"
                                className="driverExtraTagRemove"
                                onClick={() => startRemoveAppliedCharge(i)}
                                disabled={i === chargeExitingIndex}
                                aria-label={`Remove ${c.name}`}
                              >
                                <X size={12} />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  {/* ✅ FIX: Portal menu (like a select) so it floats over everything and never clips */}
                  {(extraChargeDropdownOpen || extraChargeMenuClosing) &&
                    extraChargesFromSettings.length > 0 &&
                    extraMenuPos &&
                    ReactDOM.createPortal(
                      <div
                        ref={extraChargeMenuRef}
                        className={`driverExtraMenu driverExtraMenu--portal ${extraChargeMenuClosing ? "is-closing" : ""}`}
                        role="listbox"
                        aria-label="Choose a charge to add"
                        style={{
                          position: "fixed",
                          left: `${extraMenuPos.left}px`,
                          top: `${extraMenuPos.top}px`,
                          width: `${extraMenuPos.width}px`,
                          minWidth: EXTRA_MENU_MIN_WIDTH,
                        }}
                      >
                        <ul className="driverExtraMenuList">
                          {extraChargesFromSettings.map((c, i) => (
                            <li key={i} className="driverExtraMenuLi">
                              <button type="button" role="option" className="driverExtraMenuOption" onClick={() => addExtraCharge(c)}>
                                <span className="driverExtraMenuName">{c.name}</span>
                                <span className="driverExtraMenuAmount">
                                  {formatMoneyWithCommas(String(c.amount || 0))} {currencyLabel}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>,
                      document.body
                    )}
                </div>
              </div>

              <div className="empCashoutSummary empCashoutAnimateIn empCashoutAnimateIn--4">
                <div className="empCashoutSummaryRow">
                  <span className="empCashoutSummaryLabel">Net cashout:</span>
                  <span className="empCashoutSummaryValue">
                    {formatMoneyWithCommas(String(netAmount))} {currencyLabel}
                  </span>
                </div>
                {deductionsExceedAmount && (
                  <p className="empCashoutHint" style={{ marginTop: 6, color: "var(--ec-accent, #f59e0b)" }}>
                    Total deductions (violations + extra charges) cannot exceed the cashout amount. Reduce them to confirm.
                  </p>
                )}
              </div>

              <div className="empCashoutField empCashoutField--full empCashoutAnimateIn empCashoutAnimateIn--5">
                <label className="empCashoutLabel">Note</label>
                <textarea
                  className="empCashoutTextarea"
                  placeholder="Optional note..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="empCashoutActions empCashoutAnimateIn empCashoutAnimateIn--6">
                <button type="button" className="empCashoutBtn empCashoutBtn--secondary" onClick={onClose}>
                  Cancel
                </button>
                <button type="button" className="empCashoutBtn empCashoutBtn--primary" onClick={handleConfirm} disabled={submitting || amountError}>
                  <Send size={16} />
                  {submitting ? "Saving…" : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

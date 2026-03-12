// Driver Cash In — select driver, show money in hand, amount to receive, date, note, and "left in hand"
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Calendar, ChevronDown, Search, Send } from "lucide-react";
import { useNotification } from "../NotificationProvider";
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

export default function DriverCashInForm({ account, onClose, initialDriver = null }) {
  const notify = useNotification();
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [cashinDate, setCashinDate] = useState(todayYYYYMMDD());
  const [amountRaw, setAmountRaw] = useState("");
  const [note, setNote] = useState("");
  const [driverDropdownOpen, setDriverDropdownOpen] = useState(false);
  const [dropdownExiting, setDropdownExiting] = useState(false);
  const [driverSearch, setDriverSearch] = useState("");
  const [formBodyExiting, setFormBodyExiting] = useState(false);
  const [pendingDriver, setPendingDriver] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [amountAnimating, setAmountAnimating] = useState(false);
  const createRequestIdRef = useRef(null);
  const driversListRequestIdRef = useRef(null);
  const lastDriversFetchRef = useRef(0);
  const CACHE_TTL_MS = 2 * 60 * 1000;
  const dropdownRef = useRef(null);
  const dropdownPanelRef = useRef(null);
  const searchInputRef = useRef(null);
  const formBodyRef = useRef(null);

  // Use same "money in hand" as Drivers page (CASH IN HAND column): cashInHands with fallback to balance
  const moneyInHand = Number(selectedDriver?.cashInHands ?? selectedDriver?.balance) ?? 0;
  const amount = useMemo(() => parseMoneyToNumber(amountRaw), [amountRaw]);
  const leftInHand = Math.max(0, moneyInHand - amount);
  const amountError = amount > moneyInHand;

  const setMoneyInHand = useCallback(() => {
    if (moneyInHand == null || moneyInHand <= 0) return;
    const currentAmount = parseMoneyToNumber(amountRaw);
    if (currentAmount === moneyInHand) return;
    setAmountAnimating(true);
    setAmountRaw("0");
    const target = moneyInHand;
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
  }, [moneyInHand, amountRaw]);

  const fetchDrivers = useCallback(() => {
    if (!window.api?.wsSend) return;
    setLoading(true);
    driversListRequestIdRef.current = rid();
    // Request all drivers (backend caps pageSize at 100) so dropdown search can find any driver
    window.api.wsSend({
      type: "drivers:list",
      requestId: driversListRequestIdRef.current,
      payload: { sortBy: "name", sortDir: "asc", page: 1, pageSize: 100 },
    });
  }, []);

  useEffect(() => {
    if (!window.api) {
      setLoading(false);
      return;
    }
    fetchDrivers();
  }, [fetchDrivers]);

  // Single listener for drivers:list (handles initial fetch and refetch after sync)
  useEffect(() => {
    if (!window.api?.onWsMessage) return;
    const unsub = window.api.onWsMessage((msg) => {
      if (msg?.type === "drivers:list" && msg?.requestId === driversListRequestIdRef.current) {
        setDrivers(Array.isArray(msg.drivers) ? msg.drivers : []);
        setLoading(false);
        lastDriversFetchRef.current = Date.now();
      }
      if (msg?.type === "sync:drivers:result" && msg?.ok) fetchDrivers();
    });
    return () => unsub?.();
  }, [fetchDrivers]);

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

  useEffect(() => {
    const onDocClick = (e) => {
      if (driverDropdownOpen && dropdownRef.current && !dropdownRef.current.contains(e.target)) closeDropdown();
    };
    document.addEventListener("mousedown", onDocClick, true);
    return () => document.removeEventListener("mousedown", onDocClick, true);
  }, [driverDropdownOpen, closeDropdown]);

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
    setCashinDate(todayYYYYMMDD());
    setAmountRaw("");
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

  useEffect(() => {
    if (!window.api) return;
    const unsub = window.api.onWsMessage((msg) => {
      if (msg?.type === "cashin:create:result" && msg?.requestId === createRequestIdRef.current) {
        setSubmitting(false);
        if (msg.ok) {
          notify?.success?.("Cash in recorded. Driver balance updated.", "Driver Cash In");
          onClose?.();
        } else {
          const errMsg =
            msg.error === "driver_cash_collect_token_unavailable"
              ? "Cash collect API token is not available. Please configure admin auth and ensure the token has been refreshed."
              : msg.error === "driver_cash_collect_failed"
                ? "Cash collect failed. The external API did not confirm. Check amount and driver connection."
                : msg.error || "Failed to record cash in";
          notify?.error?.(errMsg, "Driver Cash In");
        }
      }
    });
    return () => unsub?.();
  }, [notify, onClose]);

  const handleConfirm = useCallback(() => {
    if (!selectedDriver) {
      notify?.warning?.("Please select a driver.", "Driver Cash In");
      return;
    }
    if (!cashinDate?.trim()) {
      notify?.warning?.("Please set the cash in date.", "Driver Cash In");
      return;
    }
    if (amount <= 0) {
      notify?.warning?.("Please enter a valid amount to receive.", "Driver Cash In");
      return;
    }
    if (amount > moneyInHand) {
      notify?.warning?.("Amount cannot exceed driver's money in hand.", "Driver Cash In");
      return;
    }
    if (!window.api?.wsSend) {
      notify?.error?.("API not available.", "Driver Cash In");
      return;
    }
    const driverId = selectedDriver.externalId != null ? selectedDriver.externalId : selectedDriver._id;
    setSubmitting(true);
    createRequestIdRef.current = rid();
    window.api.wsSend({
      type: "cashin:create",
      requestId: createRequestIdRef.current,
      payload: {
        type: "driver",
        driverId,
        driverName: selectedDriver.name ?? "",
        amount,
        cashinDate: cashinDate || undefined,
        note: note.trim() || undefined,
      },
    });
  }, [selectedDriver, cashinDate, amount, moneyInHand, note, notify, onClose]);

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
                else {
                  if (Date.now() - lastDriversFetchRef.current > CACHE_TTL_MS) fetchDrivers();
                  setDriverDropdownOpen(true);
                }
              }}
              aria-expanded={driverDropdownOpen || dropdownExiting}
            >
              <span className="empCashoutSelectValue">
                {selectedDriver ? selectedDriver.name ?? "—" : "Select driver..."}
              </span>
              <ChevronDown size={16} className="empCashoutSelectChev" />
            </button>
            {(driverDropdownOpen || dropdownExiting) && (
              <div
                ref={dropdownPanelRef}
                className={`empCashoutDropdown ${dropdownExiting ? "empCashoutDropdown--exiting" : ""}`}
              >
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
                      const isSame =
                        selectedDriver &&
                        dId === (selectedDriver.id ?? selectedDriver._id ?? selectedDriver.externalId);
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
                          {d.name ?? "—"}{" "}
                          {(d.cashInHands != null || d.balance != null)
                            ? `(${formatMoneyWithCommas(String(d.cashInHands ?? d.balance ?? 0))} ${currencyLabel} in hand)`
                            : ""}
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
          <div
            ref={formBodyRef}
            className={`empCashoutFormBody ${formBodyExiting ? "empCashoutFormBody--exiting" : ""}`}
          >
            <div
              key={selectedDriver.id ?? selectedDriver._id ?? selectedDriver.externalId}
              className="empCashoutFormBodyContent"
            >
              <div className="empCashoutEmployeeInfo empCashoutAnimateIn empCashoutAnimateIn--0">
                <div className="empCashoutEmployeeRow">
                  <span className="empCashoutEmployeeLabel">Driver:</span>
                  <span className="empCashoutEmployeeValue">{selectedDriver.name ?? "—"}</span>
                </div>
                <div className="empCashoutEmployeeRow">
                  <span className="empCashoutEmployeeLabel">Money in hand:</span>
                  <span className="empCashoutEmployeeValue">
                    {formatMoneyWithCommas(String(moneyInHand))} {currencyLabel}
                  </span>
                </div>
              </div>

              <div className="empCashoutRow empCashoutAnimateIn empCashoutAnimateIn--1">
                <div className="empCashoutField">
                  <label className="empCashoutLabel">Date of cash in</label>
                  <div className="empCashoutInputWrap empCashoutDateWrap">
                    <Calendar size={16} className="empCashoutInputIcon" />
                    <input
                      type="date"
                      className="empCashoutInput empCashoutDateInput"
                      value={cashinDate}
                      onChange={(e) => setCashinDate(e.target.value || todayYYYYMMDD())}
                    />
                  </div>
                </div>
                <div className="empCashoutField">
                  <label className="empCashoutLabel">Amount to receive ({currencyLabel})</label>
                  <div className="empCashoutInputWrap">
                    <input
                      type="text"
                      className={`empCashoutInput ${amountError ? "empCashoutInput--error" : ""}`}
                      placeholder="0"
                      value={amountRaw}
                      onChange={(e) => handleAmountInput(e.target.value)}
                      readOnly={amountAnimating}
                      aria-readonly={amountAnimating}
                      aria-invalid={amountError}
                    />
                    {moneyInHand != null && moneyInHand > 0 && (
                      <button
                        type="button"
                        className="empCashoutUseBalanceBtn"
                        onClick={setMoneyInHand}
                        disabled={amountAnimating}
                      >
                        Use money in hand
                      </button>
                    )}
                  </div>
                  {amountError && (
                    <p className="empCashoutHint" style={{ color: "var(--ec-accent)" }}>
                      Cannot exceed money in hand.
                    </p>
                  )}
                </div>
              </div>

              <div className="empCashoutSummary empCashoutAnimateIn empCashoutAnimateIn--2">
                <div className="empCashoutSummaryRow">
                  <span className="empCashoutSummaryLabel">Left in hand after cash in:</span>
                  <span className="empCashoutSummaryValue">
                    {formatMoneyWithCommas(String(leftInHand))} {currencyLabel}
                  </span>
                </div>
              </div>

              <div className="empCashoutField empCashoutField--full empCashoutAnimateIn empCashoutAnimateIn--3">
                <label className="empCashoutLabel">Note</label>
                <textarea
                  className="empCashoutTextarea"
                  placeholder="Optional note..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="empCashoutActions empCashoutAnimateIn empCashoutAnimateIn--4">
                <button type="button" className="empCashoutBtn empCashoutBtn--secondary" onClick={onClose}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="empCashoutBtn empCashoutBtn--primary"
                  onClick={handleConfirm}
                  disabled={submitting || amountError}
                >
                  <Send size={16} />
                  {submitting ? "Saving…" : "Record Cash In"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// EmployeeCashoutForm — form for creating an employee cashout (debts, date, amount, deductions, net)
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Info, Calendar, ChevronDown, Search, Send, Plus, X } from "lucide-react";
import { useNotification } from "../NotificationProvider";
import "../../styles/pages/cashout/employee_cashout_form.css";

const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function formatMoneyWithCommas(digits) {
  return String(digits).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function parseMoneyToNumber(formatted) {
  return Number(String(formatted).replace(/[^\d]/g, "")) || 0;
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

export default function EmployeeCashoutForm({ account, onClose }) {
  const notify = useNotification();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const [paymentDate, setPaymentDate] = useState(todayYYYYMMDD());
  const [cashoutAmountRaw, setCashoutAmountRaw] = useState("");
  const [useDebtRepayment, setUseDebtRepayment] = useState(false);
  const [debtRepaymentRaw, setDebtRepaymentRaw] = useState("");
  const [violationsList, setViolationsList] = useState([]);
  const [note, setNote] = useState("");

  const [employeeDropdownOpen, setEmployeeDropdownOpen] = useState(false);
  const [dropdownExiting, setDropdownExiting] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [formBodyExiting, setFormBodyExiting] = useState(false);
  const [pendingEmployee, setPendingEmployee] = useState(null);
  const [debtRepaymentInputExiting, setDebtRepaymentInputExiting] = useState(false);
  const [amountAnimating, setAmountAnimating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const createRequestIdRef = useRef(null);
  const dropdownRef = useRef(null);
  const dropdownPanelRef = useRef(null);
  const searchInputRef = useRef(null);
  const formBodyRef = useRef(null);

  const debt = selectedEmployee?.debt ?? selectedEmployee?.debts ?? 0;
  const debtNum = Number(debt) || 0;
  const basicSalary = selectedEmployee?.salary != null ? Number(selectedEmployee.salary) : null;

  const cashoutAmount = useMemo(() => parseMoneyToNumber(cashoutAmountRaw), [cashoutAmountRaw]);
  const debtRepayment = useMemo(() => parseMoneyToNumber(debtRepaymentRaw), [debtRepaymentRaw]);
  const violations = useMemo(
    () => violationsList.reduce((s, v) => s + parseMoneyToNumber(v.amountRaw), 0),
    [violationsList]
  );

  const debtRepaymentClamped = useMemo(
    () => Math.min(Math.max(0, debtRepayment), debtNum, cashoutAmount),
    [debtRepayment, debtNum, cashoutAmount]
  );

  const effectiveDebtRepayment = useDebtRepayment ? debtRepaymentClamped : 0;

  const netForEmployee = useMemo(() => {
    const totalDeductions = effectiveDebtRepayment + violations;
    return Math.max(0, cashoutAmount - totalDeductions);
  }, [cashoutAmount, effectiveDebtRepayment, violations]);

  const debtsAfterOperation = useMemo(
    () => Math.max(0, debtNum - effectiveDebtRepayment),
    [debtNum, effectiveDebtRepayment]
  );

  const canEnterDeductions = cashoutAmount > 0;

  useEffect(() => {
    if (debtNum <= 0) setDebtRepaymentRaw("");
  }, [debtNum]);

  useEffect(() => {
    if (!window.api) {
      setLoading(false);
      return;
    }
    const unsub = window.api.onWsMessage((msg) => {
      if (msg?.type === "employees:list" && Array.isArray(msg.employees)) {
        setEmployees(msg.employees);
        setLoading(false);
      }
    });
    window.api.wsSend({ type: "employees:list", requestId: rid() });
    return () => unsub?.();
  }, []);

  const filteredEmployees = useMemo(() => {
    const q = employeeSearch.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => {
      const name = String(e?.name ?? "").toLowerCase();
      const phone = String(e?.phone ?? "").toLowerCase();
      const email = String(e?.email ?? e?.workEmail ?? "").toLowerCase();
      return name.includes(q) || phone.includes(q) || email.includes(q);
    });
  }, [employees, employeeSearch]);

  const closeDropdown = useCallback((immediate = false) => {
    if (immediate) {
      setEmployeeDropdownOpen(false);
      setDropdownExiting(false);
      setEmployeeSearch("");
      return;
    }
    setDropdownExiting(true);
  }, []);

  useEffect(() => {
    const onDocClick = (e) => {
      if (employeeDropdownOpen && dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        closeDropdown();
      }
    };
    document.addEventListener("mousedown", onDocClick, true);
    return () => document.removeEventListener("mousedown", onDocClick, true);
  }, [employeeDropdownOpen, closeDropdown]);

  useEffect(() => {
    if (!dropdownExiting || !dropdownPanelRef.current) return;
    const el = dropdownPanelRef.current;
    const onEnd = () => {
      setEmployeeDropdownOpen(false);
      setDropdownExiting(false);
      setEmployeeSearch("");
    };
    el.addEventListener("animationend", onEnd, { once: true });
    return () => el.removeEventListener("animationend", onEnd);
  }, [dropdownExiting]);

  useEffect(() => {
    if (employeeDropdownOpen && !dropdownExiting) {
      setEmployeeSearch("");
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [employeeDropdownOpen, dropdownExiting]);

  const handleFormBodyAnimationEnd = useCallback(() => {
    if (!formBodyExiting) return;
    setSelectedEmployee(pendingEmployee);
    setPaymentDate(todayYYYYMMDD());
    setCashoutAmountRaw("");
    setUseDebtRepayment(false);
    setDebtRepaymentRaw("");
    setViolationsList([]);
    setNote("");
    setPendingEmployee(null);
    setFormBodyExiting(false);
  }, [formBodyExiting, pendingEmployee]);

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

  const setBasicSalary = useCallback(() => {
    if (basicSalary != null && basicSalary > 0) {
      const currentAmount = parseMoneyToNumber(cashoutAmountRaw);
      if (currentAmount === basicSalary) return;
      setAmountAnimating(true);
      setCashoutAmountRaw("0");
      const target = basicSalary;
      const duration = 600;
      const startTime = performance.now();
      const step = (now) => {
        const elapsed = now - startTime;
        const t = Math.min(elapsed / duration, 1);
        const eased = 1 - (1 - t) * (1 - t);
        const current = Math.round(eased * target);
        setCashoutAmountRaw(formatMoneyWithCommas(String(current)));
        if (t < 1) requestAnimationFrame(step);
        else setAmountAnimating(false);
      };
      requestAnimationFrame(step);
    }
  }, [basicSalary, cashoutAmountRaw]);

  const handleDebtRepaymentInput = useCallback((value) => {
    if (debtNum <= 0) {
      setDebtRepaymentRaw("");
      return;
    }
    const digits = String(value).replace(/[^\d]/g, "");
    if (!digits) {
      setDebtRepaymentRaw("");
      return;
    }
    const num = Number(digits) || 0;
    const clamped = Math.min(num, debtNum);
    setDebtRepaymentRaw(formatMoneyWithCommas(String(clamped)));
  }, [debtNum]);

  const handleCashoutAmountInput = useCallback((value) => {
    const digits = String(value).replace(/[^\d]/g, "");
    setCashoutAmountRaw(digits ? formatMoneyWithCommas(digits) : "");
  }, []);

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
  const debtRepaymentInputRef = useRef(null);

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

  const handleDebtRepaymentChange = useCallback((checked) => {
    if (checked) {
      setDebtRepaymentInputExiting(false);
      setUseDebtRepayment(true);
    } else {
      setUseDebtRepayment(false);
      setDebtRepaymentInputExiting(true);
    }
  }, []);

  useEffect(() => {
    if (!debtRepaymentInputExiting || !debtRepaymentInputRef.current) return;
    const el = debtRepaymentInputRef.current;
    const onEnd = (e) => {
      if (e.target !== el || e.animationName !== "empCashoutDebtRepaymentOut") return;
      setDebtRepaymentInputExiting(false);
    };
    el.addEventListener("animationend", onEnd, { once: true });
    return () => el.removeEventListener("animationend", onEnd);
  }, [debtRepaymentInputExiting]);

  useEffect(() => {
    if (!window.api) return;
    const unsub = window.api.onWsMessage((msg) => {
      if (msg?.type === "cashout:create:result" && msg?.requestId === createRequestIdRef.current) {
        setSubmitting(false);
        if (msg.ok) {
          notify?.success?.("Cashout recorded.", "Employee Cashout");
          if (window.api?.wsSend) {
            window.api.wsSend({
              type: "notification:create",
              requestId: rid(),
              payload: { type: "cashout_created", title: "New cashout created", message: "Employee cashout recorded." },
            });
          }
          onClose?.();
        } else {
          notify?.error?.(
            msg.error === "insufficient_company_balance"
              ? "Insufficient liquid assets. Cannot process this cashout."
              : msg.error || "Failed to create cashout",
            "Employee Cashout"
          );
        }
      }
    });
    return () => unsub?.();
  }, [notify, onClose]);

  const handleConfirm = useCallback(() => {
    if (!selectedEmployee) {
      notify?.warning?.("Please select an employee.", "Employee Cashout");
      return;
    }
    if (!paymentDate) {
      notify?.warning?.("Please set the payment date.", "Employee Cashout");
      return;
    }
    if (!cashoutAmount || cashoutAmount <= 0) {
      notify?.warning?.("Please enter a valid cashout amount.", "Employee Cashout");
      return;
    }
    if (!window.api?.wsSend) {
      notify?.error?.("API not available.", "Employee Cashout");
      return;
    }
    const violationsDetail = violationsList
      .map((v) => ({ amount: parseMoneyToNumber(v.amountRaw), reason: (v.reason || "").trim() }))
      .filter((v) => v.amount > 0 || v.reason !== "");
    setSubmitting(true);
    createRequestIdRef.current = rid();
    window.api.wsSend({
      type: "cashout:create",
      requestId: createRequestIdRef.current,
      payload: {
        category: "employee",
        employeeId: selectedEmployee._id,
        employeeName: selectedEmployee.name ?? "",
        amount: netForEmployee,
        totalAmount: cashoutAmount,
        netAmount: netForEmployee,
        extraCharge: 0,
        violations,
        violationsDetail: violationsDetail.length > 0 ? violationsDetail : undefined,
        debts: effectiveDebtRepayment,
        note: note.trim() || undefined,
        paymentDate: paymentDate || undefined,
      },
    });
  }, [selectedEmployee, paymentDate, cashoutAmount, netForEmployee, effectiveDebtRepayment, violations, violationsList, note, notify, onClose]);

  const currencyLabel = "IQD";

  return (
    <div className="empCashoutForm">
      <div className="empCashoutFormInner">
        {/* Employee selector — searchable (Chosen-style) */}
        <div className="empCashoutField empCashoutField--full">
          <label className="empCashoutLabel">Employee</label>
          <div className="empCashoutSelectWrap" ref={dropdownRef}>
            <button
              type="button"
              className="empCashoutSelectBtn"
              onClick={() => {
                if (employeeDropdownOpen || dropdownExiting) closeDropdown();
                else setEmployeeDropdownOpen(true);
              }}
              aria-expanded={employeeDropdownOpen || dropdownExiting}
            >
              <span className="empCashoutSelectValue">
                {selectedEmployee ? selectedEmployee.name ?? "—" : "Select employee..."}
              </span>
              <ChevronDown size={16} className="empCashoutSelectChev" />
            </button>
            {(employeeDropdownOpen || dropdownExiting) && (
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
                    placeholder="Search by name, phone, email..."
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="empCashoutDropdownList">
                  {loading ? (
                    <div className="empCashoutDropdownItem empCashoutDropdownItem--muted">Loading...</div>
                  ) : filteredEmployees.length === 0 ? (
                    <div className="empCashoutDropdownItem empCashoutDropdownItem--muted">No employees found</div>
                  ) : (
                    filteredEmployees.map((emp) => (
                      <button
                        key={emp._id}
                        type="button"
                        className="empCashoutDropdownItem"
                        onClick={() => {
                          if (emp._id === selectedEmployee?._id) {
                            closeDropdown();
                            return;
                          }
                          if (selectedEmployee) {
                            setPendingEmployee(emp);
                            setFormBodyExiting(true);
                            closeDropdown();
                          } else {
                            setSelectedEmployee(emp);
                            closeDropdown();
                          }
                        }}
                      >
                        {emp.name ?? "—"}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {selectedEmployee && (
          <div
            ref={formBodyRef}
            className={`empCashoutFormBody ${formBodyExiting ? "empCashoutFormBody--exiting" : ""}`}
          >
            <div key={selectedEmployee._id} className="empCashoutFormBodyContent">
              <div className="empCashoutEmployeeInfo empCashoutAnimateIn empCashoutAnimateIn--0">
              <div className="empCashoutEmployeeRow">
                <span className="empCashoutEmployeeLabel">Employee:</span>
                <span className="empCashoutEmployeeValue">{selectedEmployee.name ?? "—"}</span>
              </div>
              <div className="empCashoutEmployeeRow">
                <span className="empCashoutEmployeeLabel">ID:</span>
                <span className="empCashoutEmployeeValue">#{selectedEmployee._id ?? "—"}</span>
              </div>
              <div className="empCashoutEmployeeRow">
                <span className="empCashoutEmployeeLabel">Phone:</span>
                <span className="empCashoutEmployeeValue">{selectedEmployee.phone ?? "—"}</span>
              </div>
            </div>

            {/* Debts */}
            <div className="empCashoutDebtsBlock empCashoutAnimateIn empCashoutAnimateIn--1">
              <div className="empCashoutDebtsHeader">
                <span className="empCashoutDebtsLabel">Debts</span>
                <Info size={12} className="empCashoutDebtsInfo" aria-hidden />
              </div>
              <div className="empCashoutDebtsValue">
                {formatMoneyWithCommas(String(debtNum))} {currencyLabel}
              </div>
            </div>

            <div className={`empCashoutRow empCashoutAnimateIn empCashoutAnimateIn--2`}>
              {/* Payment date */}
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

              {/* Cashout amount */}
              <div className="empCashoutField">
                <label className="empCashoutLabel">Amount ({currencyLabel})</label>
                <div className="empCashoutInputWrap">
                  <input
                    type="text"
                    className="empCashoutInput"
                    placeholder="e.g. 500000"
                    value={cashoutAmountRaw}
                    onChange={(e) => handleCashoutAmountInput(e.target.value)}
                    readOnly={amountAnimating}
                    aria-readonly={amountAnimating}
                  />
                  {basicSalary != null && basicSalary > 0 && (
                    <button
                      type="button"
                      className="empCashoutUseSalaryBtn"
                      onClick={setBasicSalary}
                      disabled={amountAnimating}
                    >
                      Basic salary
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Debt repayment */}
            <div className="empCashoutField empCashoutField--full empCashoutAnimateIn empCashoutAnimateIn--3">
              <label className={`empCashoutCheckLabel empCashoutCheckLabel--custom ${!canEnterDeductions ? "empCashoutCheckLabel--disabled" : ""}`}>
                <span className="empCashoutCheckboxWrap">
                  <input
                    type="checkbox"
                    checked={useDebtRepayment}
                    onChange={(e) => canEnterDeductions && handleDebtRepaymentChange(e.target.checked)}
                    className="empCashoutCheckboxInput"
                    aria-hidden="false"
                    aria-label="Repay or reduce debt from this payment"
                    disabled={!canEnterDeductions}
                  />
                  <span className="empCashoutCheckboxBox" aria-hidden="true" />
                </span>
                <span className="empCashoutCheckLabelText">Repay / reduce debt from this payment</span>
              </label>
              <p className="empCashoutHint">
                You can repay part of the debt even if it is greater than the salary/payment.
              </p>
              {(useDebtRepayment || debtRepaymentInputExiting) && (
                <div
                  ref={debtRepaymentInputRef}
                  className={`empCashoutDebtRepaymentInputWrap ${useDebtRepayment && !debtRepaymentInputExiting ? "empCashoutDebtRepaymentInputWrap--in" : "empCashoutDebtRepaymentInputWrap--exiting"}`}
                >
                  <label className="empCashoutLabel empCashoutLabel--inline">Debt repayment amount</label>
                  <input
                    type="text"
                    className="empCashoutInput"
                    value={debtRepaymentRaw}
                    onChange={(e) => handleDebtRepaymentInput(e.target.value)}
                    placeholder="0"
                    disabled={debtNum <= 0}
                    aria-disabled={debtNum <= 0}
                  />
                </div>
              )}
            </div>

            {/* Violations */}
            <div className="empCashoutField empCashoutField--full empCashoutAnimateIn empCashoutAnimateIn--4">
              <label className="empCashoutLabel">Violations (deducted from payment)</label>
              <button
                type="button"
                className="empCashoutUseSalaryBtn"
                onClick={addViolation}
                disabled={!canEnterDeductions}
              >
                <Plus size={14} style={{ marginRight: 4 }} />
                Add violation
              </button>
              {violationsList.length > 0 && (
                <div className="empCashoutViolationsList">
                  {violationsList.map((v, i) => (
                    <div
                      key={i}
                      ref={i === violatingExitingIndex ? violationRowRef : null}
                      className={`empCashoutViolationRow empCashoutViolationRowIn ${i === violatingExitingIndex ? "empCashoutViolationRow--exiting" : ""}`}
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
              <p className="empCashoutHint">
                Violations are counted as company profit and deducted from the employee net.
              </p>
            </div>

            {/* Summary: net + debts after */}
            <div className="empCashoutSummary empCashoutAnimateIn empCashoutAnimateIn--5">
              <div className="empCashoutSummaryRow">
                <span className="empCashoutSummaryLabel">Net for employee:</span>
                <span className="empCashoutSummaryValue">
                  {formatMoneyWithCommas(String(netForEmployee))} {currencyLabel}
                </span>
              </div>
              <div className="empCashoutSummaryRow">
                <span className="empCashoutSummaryLabel">Debts after:</span>
                <span className="empCashoutSummaryValue">
                  {formatMoneyWithCommas(String(debtsAfterOperation))} {currencyLabel}
                </span>
              </div>
            </div>

            {/* Note */}
            <div className="empCashoutField empCashoutField--full empCashoutAnimateIn empCashoutAnimateIn--6">
              <label className="empCashoutLabel">Note</label>
              <textarea
                className="empCashoutTextarea"
                placeholder="e.g. Month salary..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
              />
            </div>
            </div>
          </div>
        )}

        {selectedEmployee && (
          <div className="empCashoutActions empCashoutAnimateIn empCashoutAnimateIn--7">
            <button type="button" className="empCashoutBtn empCashoutBtn--secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="empCashoutBtn empCashoutBtn--primary"
              onClick={handleConfirm}
              disabled={submitting}
            >
              <Send size={16} />
              {submitting ? "Saving…" : "Confirm"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

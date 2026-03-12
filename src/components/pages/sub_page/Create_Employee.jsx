// Create_Employee.jsx (FULL - supports Create + Update via props)
// Props:
// - account
// - editingEmployee (null for create, employee object for edit)
// - onNavigate(page, payload?)

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { UserPlus, ChevronDown } from "lucide-react";
import { useNotification } from "../../NotificationProvider";
import "../../../styles/pages/employees/create_employee.css";

import ConfirmEmployeeActionModal from "../../modals/ConfirmEmployeeActionModal";
import PasswordInput from "../../ui/PasswordInput";
import { PlusIcon } from "../../../helpers/icons";

/* ---------------- helpers ---------------- */

function rid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function formatMoneyWithCommas(digits) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function parseMoneyToNumber(formatted) {
  return Number(String(formatted).replace(/[^\d]/g, "")) || 0;
}

function sanitizeSalaryInput(nextValue, prevValue, notify, warnLockRef) {
  const digits = String(nextValue ?? "").replace(/[^\d]/g, "");
  if (!digits) return "";

  if (digits.startsWith("0")) {
    if (!warnLockRef.current) {
      warnLockRef.current = true;
      notify?.warning?.("Salary cannot start with 0.", "Invalid Salary");
      setTimeout(() => {
        warnLockRef.current = false;
      }, 600);
    }
    return prevValue;
  }

  return formatMoneyWithCommas(digits);
}

function toYYYYMMDD(d) {
  if (!d) return "";
  try {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return "";
    return dt.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

/* ---------------- EcSelect (custom dropdown for employment/salary type) ---------------- */
function EcSelect({ className, value, onChange, options, disabled }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const label = useMemo(
    () => options.find((o) => o.value === value)?.label ?? value,
    [options, value]
  );

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) close();
    };
    document.addEventListener("mousedown", onDocClick, true);
    return () => document.removeEventListener("mousedown", onDocClick, true);
  }, [open, close]);

  return (
    <div
      ref={wrapRef}
      className={`ec-select-custom ${open ? "ec-select-custom--open" : ""} ${className ?? ""}`}
    >
      <button
        type="button"
        className="ec-select-custom__trigger"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="ec-select-custom__value">{label}</span>
        <span className="ec-select-custom__arrow" aria-hidden>
          <ChevronDown size={18} />
        </span>
      </button>
      <div className="ec-select-custom__drop" role="listbox" aria-hidden={!open}>
        <div className="ec-select-custom__drop-inner">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={opt.value === value}
              className={`ec-select-custom__option ${opt.value === value ? "ec-select-custom__option--selected" : ""}`}
              onClick={() => {
                onChange(opt.value);
                close();
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- component ---------------- */

export default function CreateEmployee({ account, editingEmployee = null, onNavigate }) {
  const notify = useNotification();

  const isEdit = !!editingEmployee?._id;
  const editingId = editingEmployee?._id || "";

  // confirm modal state
  const [confirmOpen, setConfirmOpen] = useState(false);

  // roles
  const [roles, setRoles] = useState([]);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [roleId, setRoleId] = useState("");

  const rolesSorted = useMemo(
    () => [...roles].sort((a, b) => String(a.name).localeCompare(String(b.name))),
    [roles]
  );

  const roleSelectRef = useRef(null);

  // fields
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState(""); // personal email
  const [workEmail, setWorkEmail] = useState("");
  const [dob, setDob] = useState("");

  const [nationalId, setNationalId] = useState("");
  const [address, setAddress] = useState("");

  const [jobTitle, setJobTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [employmentType, setEmploymentType] = useState("full_time");
  const [startDate, setStartDate] = useState("");

  const [salary, setSalary] = useState(""); // formatted
  const [salaryType, setSalaryType] = useState("monthly");
  const [rating, setRating] = useState(""); // 0.5–5 or empty
  const [notes, setNotes] = useState("");

  const perms = account?.role?.permissions || [];
  const canRate = perms.includes("*") || perms.includes("employees.rate");
  const canViewSalary = perms.includes("*") || perms.includes("cashout.create.employee");

  // passwords
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // uploads
  const [employeePhotoPath, setEmployeePhotoPath] = useState("");
  const [employeePhotoUrl, setEmployeePhotoUrl] = useState("");

  const [nidFrontPath, setNidFrontPath] = useState("");
  const [nidFrontUrl, setNidFrontUrl] = useState("");

  const [nidBackPath, setNidBackPath] = useState("");
  const [nidBackUrl, setNidBackUrl] = useState("");

  const [hcidFrontPath, setHCidFrontPath] = useState("");
  const [hcidFrontUrl, setHCidFrontUrl] = useState("");

  const [hcidBackPath, setHCidBackPath] = useState("");
  const [hcidBackUrl, setHCidBackUrl] = useState("");

  const [saving, setSaving] = useState(false);

  const salaryWarnLock = useRef(false);
  const pending = useRef(new Map()); // requestId -> resolve

  // Prefill on edit
  useEffect(() => {
    if (!editingEmployee) return;

    setFullName(editingEmployee.name || "");
    setPhoneNumber(String(editingEmployee.phone || "").replace(/[^\d]/g, ""));
    setEmail(editingEmployee.email || "");
    setWorkEmail(editingEmployee.workEmail || editingEmployee.work_email || "");
    setDob(toYYYYMMDD(editingEmployee.dob));

    setNationalId(editingEmployee.nationalId || "");
    setAddress(editingEmployee.address || "");

    setJobTitle(editingEmployee.jobTitle || "");
    setDepartment(editingEmployee.department || "");
    setEmploymentType(editingEmployee.employmentType || "full_time");
    setStartDate(toYYYYMMDD(editingEmployee.startDate));

    const s = Number(editingEmployee.salary) || 0;
    setSalary(s > 0 ? formatMoneyWithCommas(String(s)) : "");
    setSalaryType(editingEmployee.salaryType || "monthly");
    setRating(
      editingEmployee.rating != null && Number(editingEmployee.rating) >= 0.5
        ? String(editingEmployee.rating)
        : ""
    );
    setNotes(editingEmployee.notes || "");

    // role prefill (supports raw id or populated roleId object)
    const rawRole = editingEmployee.roleId ?? editingEmployee.role;
    const r =
      rawRole != null && typeof rawRole === "object" && rawRole._id != null
        ? rawRole._id
        : editingEmployee.roleId ?? editingEmployee.role?.id ?? editingEmployee.role?._id ?? "";
    setRoleId(r ? String(r) : "");

    // passwords blank by default on edit
    setPassword("");
    setConfirmPassword("");

    const up = editingEmployee.uploads || {};
    setEmployeePhotoUrl(up.employeePhotoUrl || "");
    setNidFrontUrl(up.nationalIdFrontUrl || "");
    setNidBackUrl(up.nationalIdBackUrl || "");
    setHCidFrontUrl(up.housingCardFrontUrl || "");
    setHCidBackUrl(up.housingCardBackUrl || "");

    // clear local picked paths
    setEmployeePhotoPath("");
    setNidFrontPath("");
    setNidBackPath("");
    setHCidFrontPath("");
    setHCidBackPath("");
  }, [editingEmployee]);

  // --- Chosen wiring (robust) ---
  // 1) init once when roles list changes (re-render options)
  useEffect(() => {
    if (!window.$ || !roleSelectRef.current) return;

    const $el = window.$(roleSelectRef.current);

    // destroy if already chosen (prevents double init on role list changes)
    if ($el.data("chosen")) {
      $el.off(".createEmployeeChosen");
      $el.chosen("destroy");
    }

    // init
    $el.chosen({
      width: "100%",
      search_contains: true,
      disable_search_threshold: 0,
      placeholder_text_single: "Select a role",
      no_results_text: "No roles found",
    });

    // improve search input
    setTimeout(() => {
      const searchInput = $el.next(".chosen-container").find(".chosen-search input");
      if (searchInput.length) {
        searchInput.attr({
          spellcheck: "false",
          autocomplete: "off",
          autocorrect: "off",
          autocapitalize: "off",
        });
      }
    }, 0);

    // IMPORTANT: use `change` to sync chosen -> state
    $el.on("change.createEmployeeChosen", () => {
      const v = $el.val();
      setRoleId(v != null && v !== "" ? String(v) : "");
    });

    // ensure chosen UI reflects current state
    $el.val(roleId || "");
    $el.trigger("chosen:updated");

    return () => {
      if ($el.data("chosen")) {
        $el.off(".createEmployeeChosen");
        $el.chosen("destroy");
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolesSorted]);

  // 2) when roleId changes, force DOM + chosen to reflect it (prevents desync)
  useEffect(() => {
    if (!window.$ || !roleSelectRef.current) return;
    const $el = window.$(roleSelectRef.current);
    if (!$el.data("chosen")) return;

    $el.val(roleId || "");
    $el.trigger("chosen:updated");
  }, [roleId]);

  // WS listener + connect (roles + employee create/update results)
  useEffect(() => {
    if (!window.api) return;

    const unsub = window.api.onWsMessage((msg) => {
      // roles list
      if (msg?.type === "roles:list" && Array.isArray(msg.roles)) {
        setRoles(msg.roles);
        setLoadingRoles(false);

        // ✅ FIX: avoid stale closure; only default if still empty NOW
        if (msg.roles[0]?._id) {
          setRoleId((prev) => (prev && String(prev).trim() ? prev : String(msg.roles[0]._id)));
        }
      }

      if (
        (msg?.type === "employees:create:result" || msg?.type === "employees:update:result") &&
        msg.requestId
      ) {
        const resolve = pending.current.get(msg.requestId);
        if (resolve) {
          pending.current.delete(msg.requestId);
          resolve(msg);
        }
      }
    });

    (async () => {
      try {
        await window.api.wsConnect();

        // load cached roles first (fast UI)
        const cached = await window.api.getRolesCache?.();
        if (cached?.roles?.length) {
          setRoles(cached.roles);
          setLoadingRoles(false);

          // ✅ FIX: avoid stale closure; only default if still empty NOW
          if (cached.roles[0]?._id) {
            setRoleId((prev) => (prev && String(prev).trim() ? prev : String(cached.roles[0]._id)));
          }
        }

        // subscribe roles live
        window.api.wsSend({ type: "roles:subscribe", requestId: rid() });
      } catch {
        setLoadingRoles(false);
        notify?.error?.("WebSocket not connected", "Connection");
      }
    })();

    return () => unsub?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inputProps = useMemo(
    () => ({
      spellCheck: false,
      autoComplete: "off",
      autoCorrect: "off",
      autoCapitalize: "off",
    }),
    []
  );

  async function pickImage(setPath, setUrl) {
    try {
      const res = await window.api?.pickImage?.();
      if (!res?.ok || !res.path) return;

      setPath(res.path);

      const prev = await window.api?.fileToDataUrl?.(res.path);
      if (prev?.ok && prev.dataUrl) {
        setUrl(prev.dataUrl);
      } else {
        setUrl("");
        notify?.warning?.("Selected image, but preview failed.", "Preview");
      }
    } catch {
      notify?.error?.("Failed to pick image.", "File Picker");
    }
  }

  function clearPicked(setPath, setUrl) {
    setPath("");
    setUrl("");
  }

  function resetAll() {
    setFullName("");
    setPhoneNumber("");
    setEmail("");
    setWorkEmail("");
    setDob("");
    setNationalId("");
    setAddress("");
    setJobTitle("");
    setDepartment("");
    setEmploymentType("full_time");
    setStartDate("");
    setSalary("");
    setSalaryType("monthly");
    setRating("");
    setNotes("");
    setPassword("");
    setConfirmPassword("");
    // keep role as-is

    clearPicked(setEmployeePhotoPath, setEmployeePhotoUrl);
    clearPicked(setNidFrontPath, setNidFrontUrl);
    clearPicked(setNidBackPath, setNidBackUrl);
    clearPicked(setHCidFrontPath, setHCidFrontUrl);
    clearPicked(setHCidBackPath, setHCidBackUrl);
  }

  async function uploadFilesIfAny() {
    if (!window.api?.uploadEmployeeFiles) return { ok: true, uploads: {} };

    const files = {
      employeePhotoPath,
      nationalIdFrontPath: nidFrontPath,
      nationalIdBackPath: nidBackPath,
      housingCardFrontPath: hcidFrontPath,
      housingCardBackPath: hcidBackPath,
    };

    const hasAny = Object.values(files).some((p) => typeof p === "string" && p.trim().length > 0);
    if (!hasAny) return { ok: true, uploads: {} };

    const res = await window.api.uploadEmployeeFiles(files);
    if (!res?.ok) throw new Error(res?.error || "Upload failed");
    return res;
  }

  function getEffectiveRoleId() {
    const fromState = roleId && String(roleId).trim() ? String(roleId).trim() : "";
    if (fromState) return fromState;

    const fromRef =
      roleSelectRef.current && String(roleSelectRef.current.value || "").trim()
        ? String(roleSelectRef.current.value || "").trim()
        : "";

    return fromRef;
  }

  // only validates then opens confirm modal
  function onSubmit(e) {
    e.preventDefault();

    const salaryNumber = parseMoneyToNumber(salary);
    const effectiveRoleId = getEffectiveRoleId();

    if (!effectiveRoleId)
      return notify?.warning?.("Role is required.", "Missing required fields");

    if (!fullName.trim())
      return notify?.warning?.("Full name is required.", "Missing required fields");
    if (!phoneNumber.trim())
      return notify?.warning?.("Phone number is required.", "Missing required fields");
    if (!workEmail.trim())
      return notify?.warning?.("Work email is required.", "Missing required fields");
    const requireSalary = !isEdit || canViewSalary;
    if (requireSalary && (!salaryNumber || salaryNumber <= 0))
      return notify?.warning?.("Salary must be greater than 0.", "Missing required fields");
    if (!jobTitle.trim())
      return notify?.warning?.("Job title is required.", "Missing required fields");
    if (!department.trim())
      return notify?.warning?.("Department is required.", "Missing required fields");
    if (!startDate)
      return notify?.warning?.("Start date is required.", "Missing required fields");

    // passwords: required on create, optional on edit
    if (!isEdit) {
      if (!password.trim())
        return notify?.warning?.("Password is required.", "Missing required fields");
      if (!confirmPassword.trim())
        return notify?.warning?.("Confirm password is required.", "Missing required fields");
    }
    if (password || confirmPassword) {
      if (password !== confirmPassword)
        return notify?.warning?.("Passwords do not match.", "Invalid Password");
      if (password.length < 6)
        return notify?.warning?.("Password must be at least 6 characters.", "Invalid Password");
    }

    setConfirmOpen(true);
  }

  // does the real create/update after confirmation
  async function performSubmit() {
    const salaryNumber = parseMoneyToNumber(salary);
    const includeSalaryInPayload = !isEdit || canViewSalary;
    setSaving(true);

    try {
      const effectiveRoleId = getEffectiveRoleId();

      // 1) upload new picked images (if any)
      let newUploads = {};
      try {
        const up = await uploadFilesIfAny();
        newUploads = up.uploads || {};
      } catch (err) {
        notify?.error?.(String(err?.message || err || "Upload failed"), "File Upload");
        return;
      }

      // 2) merge uploads (keep existing if not replaced)
      const mergedUploads = {
        employeePhotoUrl: newUploads.employeePhotoUrl ?? employeePhotoUrl ?? null,
        nationalIdFrontUrl: newUploads.nationalIdFrontUrl ?? nidFrontUrl ?? null,
        nationalIdBackUrl: newUploads.nationalIdBackUrl ?? nidBackUrl ?? null,
        housingCardFrontUrl: newUploads.housingCardFrontUrl ?? hcidFrontUrl ?? null,
        housingCardBackUrl: newUploads.housingCardBackUrl ?? hcidBackUrl ?? null,
      };

      const requestId = rid();

      const resultPromise = new Promise((resolve) => {
        pending.current.set(requestId, resolve);
        setTimeout(() => {
          if (pending.current.has(requestId)) {
            pending.current.delete(requestId);
            resolve({ ok: false, error: "timeout" });
          }
        }, 8000);
      });

      const payloadBase = {
        name: fullName.trim(),
        phone: phoneNumber.trim(),
        email: email.trim() || null, // personal
        workEmail: workEmail.trim() || null,

        roleId: effectiveRoleId,

        dob: dob || null,
        nationalId: nationalId.trim() || null,
        address: address.trim() || null,

        jobTitle: jobTitle.trim(),
        department: department.trim(),
        employmentType,
        startDate,

        ...(includeSalaryInPayload ? { salary: salaryNumber, salaryType } : {}),

        ...(canRate
          ? {
              rating:
                rating === "" || rating == null ? null : Math.round(Number(rating) * 2) / 2,
            }
          : {}),

        notes: notes.trim() || null,
        uploads: mergedUploads,

        // matches backend style (ws.user.id is derived from access token)
        addedBy: account?.id || null,
      };

      // include password ONLY if provided & valid
      const payloadWithPassword =
        password && password === confirmPassword ? { ...payloadBase, password } : payloadBase;

      if (!isEdit) {
        await window.api.wsSend({
          type: "employees:create",
          requestId,
          payload: payloadWithPassword,
        });
      } else {
        await window.api.wsSend({
          type: "employees:update",
          requestId,
          payload: { employeeId: editingId, ...payloadWithPassword },
        });
      }

      const result = await resultPromise;

      if (!result?.ok) {
        notify?.error?.(
          result?.error || (isEdit ? "Failed to update employee" : "Failed to create employee"),
          isEdit ? "Update Employee" : "Create Employee"
        );
        return;
      }

      notify?.success?.(
        isEdit ? "Employee has been updated successfully." : "Employee has been created successfully.",
        isEdit ? "Successfully Updated Employee" : "Successfully Created Employee"
      );

      setConfirmOpen(false);
      onNavigate?.("employees:list");
      if (!isEdit) resetAll();
    } catch {
      notify?.error?.(
        isEdit ? "Failed to update employee." : "Failed to create employee.",
        isEdit ? "Update Employee" : "Create Employee"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="createEmployeePage">
      <header className="createEmployeeHeader">
        <div className="createEmployeeHeaderIcon">
          <UserPlus size={24} />
        </div>
        <div className="createEmployeeHeaderText">
          <h1 className="createEmployeeTitle">{isEdit ? "Update Employee" : "Create Employee"}</h1>
          <p className="createEmployeeSubtitle">
            {isEdit ? "Edit an employee record" : "Add a new employee record"}
          </p>
        </div>
      </header>

      <main className="createEmployeeMain">
        <div className="createEmployeeContent">
          <form className="ec-body" onSubmit={onSubmit}>
            <section className="ec-card">
              <div className="ec-sub_card">
                <div className="ec-upload-block">
                  <div className="ec-upload-title">Employee Photo</div>
                  <label
                    className="ec-drop ec-drop--square"
                    onClick={(e) => {
                      e.preventDefault();
                      if (!saving) pickImage(setEmployeePhotoPath, setEmployeePhotoUrl);
                    }}
                  >
                    {employeePhotoUrl ? (
                      <img
                        className="ec-preview"
                        src={employeePhotoUrl}
                        alt="employee"
                        onError={(e) => {
                          console.error("Preview failed:", employeePhotoUrl);
                          e.currentTarget.style.display = "none";
                          notify?.error?.("Image preview failed.", "Preview");
                        }}
                      />
                    ) : (
                      <div className="ec-drop-empty">
                        <div className="ec-plus">
                          <PlusIcon className="icon" />
                        </div>
                        <div className="ec-drop-hint">Upload</div>
                        <div className="ec-drop-sub">(1:1)</div>
                      </div>
                    )}
                  </label>

                  {employeePhotoUrl ? (
                    <button
                      type="button"
                      className="ec-btn ec-btn--sm ec-btn--ghost"
                      disabled={saving}
                      onClick={() => clearPicked(setEmployeePhotoPath, setEmployeePhotoUrl)}
                      style={{ marginTop: 8 }}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>

                <div className="ec-block">
                  <div className="ec-block-upper partblock">
                    <div>
                      <label>
                        Full Name <span>*</span>
                      </label>
                      <input
                        className="ec-input fullName"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Ahmed Ali"
                        {...inputProps}
                      />
                    </div>

                    <div>
                      <label>
                        Phone Number <span>*</span>
                      </label>
                      <div className="ec-phone-container">
                        <span className="ec-prefix">+964</span>
                        <input
                          className="ec-input phoneNumber"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value.replace(/[^\d]/g, ""))}
                          placeholder="e.g. 7xxxxxxxxx"
                          inputMode="numeric"
                          {...inputProps}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="ec-block-lower partblock">
                    <div>
                      <label>Personal Email</label>
                      <input
                        className="ec-input personalEmail"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. ahmed@example.com"
                        {...inputProps}
                      />
                    </div>

                    <div>
                      <label>National ID</label>
                      <input
                        className="ec-input nationalID"
                        value={nationalId}
                        onChange={(e) => setNationalId(e.target.value)}
                        placeholder="e.g. 1234567890"
                        {...inputProps}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="spacing">
                <span />
              </div>

              <div className="ec-sub_card">
                <div className="ec-upload-block">
                  <div className="ec-upload-title">National ID (Front)</div>
                  <label
                    className="ec-drop"
                    onClick={(e) => {
                      e.preventDefault();
                      if (!saving) pickImage(setNidFrontPath, setNidFrontUrl);
                    }}
                  >
                    {nidFrontUrl ? (
                      <img className="ec-preview" src={nidFrontUrl} alt="nid front" />
                    ) : (
                      <div className="ec-drop-empty">
                        <div className="ec-drop-hint">Upload front side</div>
                      </div>
                    )}
                  </label>
                  {nidFrontUrl ? (
                    <button
                      type="button"
                      className="ec-btn ec-btn--sm ec-btn--ghost"
                      disabled={saving}
                      onClick={() => clearPicked(setNidFrontPath, setNidFrontUrl)}
                      style={{ marginTop: 8 }}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>

                <div className="ec-upload-block">
                  <div className="ec-upload-title">National ID (Back)</div>
                  <label
                    className="ec-drop"
                    onClick={(e) => {
                      e.preventDefault();
                      if (!saving) pickImage(setNidBackPath, setNidBackUrl);
                    }}
                  >
                    {nidBackUrl ? (
                      <img className="ec-preview" src={nidBackUrl} alt="nid back" />
                    ) : (
                      <div className="ec-drop-empty">
                        <div className="ec-drop-hint">Upload back side</div>
                      </div>
                    )}
                  </label>
                  {nidBackUrl ? (
                    <button
                      type="button"
                      className="ec-btn ec-btn--sm ec-btn--ghost"
                      disabled={saving}
                      onClick={() => clearPicked(setNidBackPath, setNidBackUrl)}
                      style={{ marginTop: 8 }}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>

                <div className="ec-upload-block">
                  <div className="ec-upload-title">Housing Card (Front)</div>
                  <label
                    className="ec-drop"
                    onClick={(e) => {
                      e.preventDefault();
                      if (!saving) pickImage(setHCidFrontPath, setHCidFrontUrl);
                    }}
                  >
                    {hcidFrontUrl ? (
                      <img className="ec-preview" src={hcidFrontUrl} alt="hcid front" />
                    ) : (
                      <div className="ec-drop-empty">
                        <div className="ec-drop-hint">Upload front side</div>
                      </div>
                    )}
                  </label>
                  {hcidFrontUrl ? (
                    <button
                      type="button"
                      className="ec-btn ec-btn--sm ec-btn--ghost"
                      disabled={saving}
                      onClick={() => clearPicked(setHCidFrontPath, setHCidFrontUrl)}
                      style={{ marginTop: 8 }}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>

                <div className="ec-upload-block">
                  <div className="ec-upload-title">Housing Card (Back)</div>
                  <label
                    className="ec-drop"
                    onClick={(e) => {
                      e.preventDefault();
                      if (!saving) pickImage(setHCidBackPath, setHCidBackUrl);
                    }}
                  >
                    {hcidBackUrl ? (
                      <img className="ec-preview" src={hcidBackUrl} alt="hcid back" />
                    ) : (
                      <div className="ec-drop-empty">
                        <div className="ec-drop-hint">Upload back side</div>
                      </div>
                    )}
                  </label>
                  {hcidBackUrl ? (
                    <button
                      type="button"
                      className="ec-btn ec-btn--sm ec-btn--ghost"
                      disabled={saving}
                      onClick={() => clearPicked(setHCidBackPath, setHCidBackUrl)}
                      style={{ marginTop: 8 }}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="spacing">
                <span />
              </div>

              <div className="ec-sub_card warping-sub_card">
                <div className="ec-block warping-block">
                  <div>
                    <label>Date of Birth</label>
                    <input
                      className="ec-input dateOfBirth"
                      type="date"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      placeholder="YYYY-MM-DD"
                      {...inputProps}
                    />
                  </div>

                  <div>
                    <label>
                      Department <span>*</span>
                    </label>
                    <input
                      className="ec-input"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="e.g. Engineering"
                      {...inputProps}
                    />
                  </div>

                  <div className="ec-salary-rating-wrap">
                    {(!isEdit || canViewSalary) && (
                      <div>
                        <label>
                          Salary <span>*</span>
                        </label>
                        <input
                          className="ec-input salary"
                          value={salary}
                          onChange={(e) =>
                            setSalary((prev) =>
                              sanitizeSalaryInput(e.target.value, prev, notify, salaryWarnLock)
                            )
                          }
                          inputMode="numeric"
                          placeholder="e.g. 1,250,000"
                          {...inputProps}
                        />
                      </div>
                    )}
                    {canRate && (
                      <div>
                        <label>Rating</label>
                        <EcSelect
                          className="ec-input ratingSelect"
                          value={rating}
                          onChange={setRating}
                          options={[
                            { value: "", label: "No rating" },
                            ...Array.from({ length: 10 }, (_, i) => {
                              const v = (i + 1) * 0.5;
                              return { value: String(v), label: `${v} ★` };
                            }),
                          ]}
                          disabled={saving}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="ec-block warping-block">
                  <div>
                    <label>Address</label>
                    <input
                      className="ec-input address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="e.g. Baghdad, Iraq"
                      {...inputProps}
                    />
                  </div>

                  <div>
                    <label>Employment Type</label>
                    <EcSelect
                      className="ec-input employmentType"
                      value={employmentType}
                      onChange={setEmploymentType}
                      options={[
                        { value: "full_time", label: "Full-time" },
                        { value: "part_time", label: "Part-time" },
                        { value: "contract", label: "Contract" },
                        { value: "intern", label: "Intern" },
                      ]}
                      disabled={saving}
                    />
                  </div>

                  {(!isEdit || canViewSalary) && (
                    <div>
                      <label>Salary Type</label>
                      <EcSelect
                        className="ec-input salaryType"
                        value={salaryType}
                        onChange={setSalaryType}
                        options={[
                          { value: "monthly", label: "Monthly" },
                          { value: "semi-monthly", label: "Semi-Monthly" },
                          { value: "hourly", label: "Hourly" },
                          { value: "commission", label: "Commission" },
                        ]}
                        disabled={saving}
                      />
                    </div>
                  )}
                </div>

                <div className="ec-block warping-block">
                  <div>
                    <label>
                      Job Title <span>*</span>
                    </label>
                    <input
                      className="ec-input"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      placeholder="e.g. Software Engineer"
                      {...inputProps}
                    />
                  </div>

                  <div>
                    <label>
                      Start Date <span>*</span>
                    </label>
                    <input
                      className="ec-input startDate"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      placeholder="YYYY-MM-DD"
                      {...inputProps}
                    />
                  </div>
                </div>
              </div>

              <div className="ec-notes">
                <div>
                  <label>Notes</label>
                  <textarea
                    className="ec-input notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional notes about the employee..."
                    {...inputProps}
                  />
                </div>
              </div>

              <div className="spacing">
                <span />
              </div>

              <div className="ec-sub_card">
                <div className="ec-third-card">
                  <div className="ec-block row-block">
                    <div>
                      <label>
                        Work Email <span>*</span>
                      </label>
                      <input
                        className="ec-input workEmail"
                        value={workEmail}
                        onChange={(e) => setWorkEmail(e.target.value)}
                        placeholder="name@yammak.shop"
                        {...inputProps}
                      />
                    </div>

                    <div>
                      <PasswordInput
                        label={isEdit ? "New Password" : "Password"}
                        required={!isEdit}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        inputProps={inputProps}
                      />
                    </div>

                    <div>
                      <PasswordInput
                        label="Confirm Password"
                        required={!isEdit}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        inputProps={inputProps}
                      />
                    </div>
                  </div>

                  <div className="ec-block row-block">
                    <div>
                      <label>
                        Role <span>*</span>
                      </label>
                      <select
                        ref={roleSelectRef}
                        className="ec-input ec-chosen"
                        value={roleId}
                        onChange={(e) => setRoleId(e.target.value)}
                        disabled={loadingRoles}
                      >
                        {loadingRoles && <option value="">Loading roles…</option>}
                        {!loadingRoles && rolesSorted.length === 0 ? (
                          <option value="">No roles found</option>
                        ) : null}
                        {!loadingRoles &&
                          rolesSorted.map((r) => (
                            <option key={r._id} value={String(r._id)}>
                              {r.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="ec-actions">
                <button className="ec-btn ec-btn--sm" disabled={saving} type="submit">
                  {saving ? (isEdit ? "Updating..." : "Creating...") : isEdit ? "Update" : "Create Employee"}
                </button>

                <button
                  className="ec-btn ec-btn--sm ec-btn--ghost"
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    if (isEdit) onNavigate?.("employees:list");
                    else resetAll();
                  }}
                >
                  {isEdit ? "Cancel" : "Reset"}
                </button>
              </div>
            </section>
          </form>
        </div>
      </main>

      <ConfirmEmployeeActionModal
        open={confirmOpen}
        mode={isEdit ? "update" : "create"}
        employeeName={fullName || editingEmployee?.name || ""}
        loading={saving}
        summary={[
          { label: "Phone", value: phoneNumber ? `+964${phoneNumber}` : "—" },
          { label: "Work Email", value: workEmail || "—" },
          {
            label: "Role",
            value:
              rolesSorted.find((r) => String(r._id) === String(getEffectiveRoleId()))?.name || "—",
          },
          { label: "Job Title", value: jobTitle || "—" },
          { label: "Department", value: department || "—" },
          { label: "Start Date", value: startDate || "—" },
          ...((!isEdit || canViewSalary) ? [{ label: "Salary", value: salary ? `${salary} (${salaryType})` : "—" }] : []),
          ...(password ? [{ label: "Password", value: isEdit ? "Will be updated" : "Will be set" }] : []),
        ]}
        onClose={() => {
          if (!saving) setConfirmOpen(false);
        }}
        onConfirm={() => void performSubmit()}
      />
    </div>
  );
}
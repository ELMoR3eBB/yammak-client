// EmployeeProfileModal — view employee profile (photo, name, rating, details). Requires employees.view or users.view or *
import React, { useCallback, useEffect, useRef, useState } from "react";
import { User, Star, Mail, Phone, Briefcase, MapPin, Calendar } from "lucide-react";
import "../../styles/modals/employeeProfileModal.css";

export default function EmployeeProfileModal({ open, employee, onClose, onEdit, canViewSalary = false }) {
  const dialogRef = useRef(null);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const closingRef = useRef(false);

  const beginClose = useCallback(() => {
    closingRef.current = true;
    setVisible(false);
  }, []);

  useEffect(() => {
    if (open && employee) {
      closingRef.current = false;
      setMounted(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!closingRef.current) setVisible(true);
        });
      });
      return;
    }
    if (mounted) beginClose();
  }, [open, employee, mounted]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") beginClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, beginClose]);

  const onTransitionEnd = useCallback(
    (e) => {
      if (e.target !== e.currentTarget) return;
      if (!visible) {
        setMounted(false);
        closingRef.current = false;
        onClose?.();
      }
    },
    [visible, onClose]
  );

  if (!mounted || !employee) return null;

  const photoUrl =
    employee?.uploads?.employeePhotoUrl ?? employee?.uploads?.employeePhoto ?? null;
  const hasPhoto = photoUrl && typeof photoUrl === "string";
  const initial = (employee?.name || "?").charAt(0).toUpperCase();
  const rating = employee?.rating != null && Number(employee.rating) >= 0.5 ? Number(employee.rating) : null;
  const roleName = employee?.roleId?.name ?? employee?.role?.name ?? "—";
  const fmtMoney = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString() : "—");
  const salaryType =
    String(employee?.salaryType || "").toLowerCase().includes("month")
      ? "Monthly"
      : String(employee?.salaryType || "").toLowerCase().includes("hour")
      ? "Hourly"
      : employee?.salaryType || "—";

  return (
    <div
      className={`epmodal-backdrop ${visible ? "is-open" : ""}`}
      onMouseDown={beginClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className={`epmodal ${visible ? "is-open" : ""}`}
        onMouseDown={(e) => e.stopPropagation()}
        onTransitionEnd={onTransitionEnd}
        role="dialog"
        aria-modal="true"
        aria-labelledby="epmodal-title"
      >
        <div className="epmodal-header">
          <div className="epmodal-avatar-wrap">
            {hasPhoto ? (
              <img
                src={photoUrl}
                alt=""
                className="epmodal-avatar"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  const fb = e.currentTarget.nextElementSibling;
                  if (fb) fb.removeAttribute("aria-hidden");
                }}
              />
            ) : null}
            <span className="epmodal-avatar-initial" aria-hidden={!!hasPhoto}>
              {initial}
            </span>
          </div>
          <h2 className="epmodal-title" id="epmodal-title">
            {employee?.name || "—"}
          </h2>
          <p className="epmodal-role">{roleName}</p>
          {rating != null && (
            <div className="epmodal-rating">
              <Star size={16} className="epmodal-star" fill="currentColor" />
              <span>{rating} / 5</span>
            </div>
          )}
        </div>

        <div className="epmodal-body">
          <div className="epmodal-grid">
            {employee?.jobTitle && (
              <div className="epmodal-item">
                <Briefcase size={16} className="epmodal-item-icon" />
                <div>
                  <span className="epmodal-item-label">Job Title</span>
                  <span className="epmodal-item-value">{employee.jobTitle}</span>
                </div>
              </div>
            )}
            {employee?.department && (
              <div className="epmodal-item">
                <Briefcase size={16} className="epmodal-item-icon" />
                <div>
                  <span className="epmodal-item-label">Department</span>
                  <span className="epmodal-item-value">{employee.department}</span>
                </div>
              </div>
            )}
            {employee?.workEmail && (
              <div className="epmodal-item">
                <Mail size={16} className="epmodal-item-icon" />
                <div>
                  <span className="epmodal-item-label">Work Email</span>
                  <span className="epmodal-item-value">{employee.workEmail}</span>
                </div>
              </div>
            )}
            {employee?.phone != null && employee.phone !== "" && (
              <div className="epmodal-item">
                <Phone size={16} className="epmodal-item-icon" />
                <div>
                  <span className="epmodal-item-label">Phone</span>
                  <span className="epmodal-item-value">
                    +964 {String(employee.phone).replace(/\D/g, "")}
                  </span>
                </div>
              </div>
            )}
            {employee?.email && (
              <div className="epmodal-item">
                <Mail size={16} className="epmodal-item-icon" />
                <div>
                  <span className="epmodal-item-label">Personal Email</span>
                  <span className="epmodal-item-value">{employee.email}</span>
                </div>
              </div>
            )}
            {employee?.address && (
              <div className="epmodal-item">
                <MapPin size={16} className="epmodal-item-icon" />
                <div>
                  <span className="epmodal-item-label">Address</span>
                  <span className="epmodal-item-value">{employee.address}</span>
                </div>
              </div>
            )}
            {employee?.startDate && (
              <div className="epmodal-item">
                <Calendar size={16} className="epmodal-item-icon" />
                <div>
                  <span className="epmodal-item-label">Start Date</span>
                  <span className="epmodal-item-value">{employee.startDate}</span>
                </div>
              </div>
            )}
            {employee?.employmentType && (
              <div className="epmodal-item">
                <User size={16} className="epmodal-item-icon" />
                <div>
                  <span className="epmodal-item-label">Employment</span>
                  <span className="epmodal-item-value">
                    {String(employee.employmentType).replace("_", "-")}
                  </span>
                </div>
              </div>
            )}
            {canViewSalary && employee?.salary != null && (
              <div className="epmodal-item">
                <Briefcase size={16} className="epmodal-item-icon" />
                <div>
                  <span className="epmodal-item-label">Salary</span>
                  <span className="epmodal-item-value">
                    {fmtMoney(employee.salary)} ({salaryType})
                  </span>
                </div>
              </div>
            )}
          </div>
          {employee?.notes && (
            <div className="epmodal-notes">
              <span className="epmodal-item-label">Notes</span>
              <p className="epmodal-notes-text">{employee.notes}</p>
            </div>
          )}
        </div>

        <div className="epmodal-actions">
          <button type="button" className="epmodal-btn epmodal-btn--ghost" onClick={beginClose}>
            Close
          </button>
          {onEdit && (
            <button
              type="button"
              className="epmodal-btn epmodal-btn--primary"
              onClick={() => {
                beginClose();
                onEdit(employee);
              }}
            >
              Edit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

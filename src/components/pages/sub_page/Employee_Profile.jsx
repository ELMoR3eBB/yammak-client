import React, { useEffect, useRef, useState } from "react";
import {
  User,
  Star,
  Mail,
  Phone,
  Briefcase,
  MapPin,
  Calendar,
  ArrowLeft,
  Pencil,
  Building2,
  Wallet,
  FileText,
  BadgeCheck,
  MessageSquare,
  CalendarDays,
} from "lucide-react";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";
import "tippy.js/animations/shift-away.css";
import Skeleton from "../../ui/Skeleton";
import "../../../styles/pages/employees/employee_profile.css";

function FactRow({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="employeeProfileFactRow">
      <div className="employeeProfileFactIconWrap">
        <Icon size={16} className="employeeProfileFactIcon" />
      </div>
      <div className="employeeProfileFactContent">
        <span className="employeeProfileFactLabel">{label}</span>
        <span className="employeeProfileFactValue">{value}</span>
      </div>
    </div>
  );
}

function pickCount(obj, keys) {
  if (!obj || !Array.isArray(keys)) return null;
  for (const key of keys) {
    const value = obj?.[key];
    if (value === null || value === undefined || value === "") continue;
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export default function EmployeeProfile({ employee, account, onNavigate }) {
  const [showProfileSkeleton, setShowProfileSkeleton] = useState(false);
  const timerRef = useRef(null);
  const employeeKey = employee?._id ?? employee?.id ?? employee?.email ?? employee?.name ?? null;

  useEffect(() => {
    if (!employeeKey) {
      setShowProfileSkeleton(false);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    setShowProfileSkeleton(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setShowProfileSkeleton(false);
      timerRef.current = null;
    }, 320);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [employeeKey]);

  if (!employee) {
    return (
      <div className="employeeProfilePage">
        <header className="employeeProfileHeader">
          <h1 className="employeeProfileTitle">Profile</h1>
          <p className="employeeProfileSubtitle">No employee selected</p>
        </header>
        <main className="employeeProfileMain">
          <div className="employeeProfileContent employeeProfileContent--empty">
            <p className="employeeProfileEmpty">Select an employee from the list to view their profile.</p>
            <button
              type="button"
              className="employeeProfileBtn employeeProfileBtn--primary"
              onClick={() => onNavigate?.("employees:list")}
            >
              <ArrowLeft size={18} />
              Back to list
            </button>
          </div>
        </main>
      </div>
    );
  }

  const photoUrl = employee?.uploads?.employeePhotoUrl ?? employee?.uploads?.employeePhoto ?? null;
  const hasPhoto = photoUrl && typeof photoUrl === "string";
  const initial = (employee?.name || "?").charAt(0).toUpperCase();

  const rating = employee?.rating != null && Number(employee.rating) >= 0.5 ? Number(employee.rating) : null;

  const roleName = employee?.roleId?.name ?? employee?.role?.name ?? "-";
  const salaryType =
    String(employee?.salaryType || "").toLowerCase().includes("month")
      ? "Monthly"
      : String(employee?.salaryType || "").toLowerCase().includes("hour")
        ? "Hourly"
        : employee?.salaryType || "-";

  const fmtMoney = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString() : "-");
  const fmtCount = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString() : "-");

  const suggestCount = pickCount(employee, [
    "suggestCount",
    "suggestsCount",
    "suggestionsCount",
    "totalSuggests",
    "totalSuggestions",
  ]);

  const holidayRequestedCount = pickCount(employee, [
    "holidayRequestedCount",
    "holidaysRequestedCount",
    "holidayRequestsCount",
    "requestedHolidayCount",
    "totalHolidayRequests",
  ]);

  const perms = account?.role?.permissions || [];
  const canEdit = perms.includes("*") || perms.includes("employees.update") || perms.includes("users.update");
  const canViewSalary = perms.includes("*") || perms.includes("cashout.create.employee");

  const phoneRaw = employee?.phone != null && employee?.phone !== "" ? String(employee.phone).replace(/\D/g, "") : "";
  const phoneDisplay = phoneRaw ? `+964 ${phoneRaw}` : "";

  if (showProfileSkeleton) {
    return (
      <div className="employeeProfilePage">
        <header className="employeeProfileHeader">
          <button
            type="button"
            className="employeeProfileBack"
            onClick={() => onNavigate?.("employees:list")}
            aria-label="Back to list"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="employeeProfileHeaderIcon">
            <User size={22} />
          </div>
          <div className="employeeProfileHeaderText">
            <h1 className="employeeProfileTitle">Employee Profile</h1>
            <p className="employeeProfileSubtitle">Loading employee data...</p>
          </div>
        </header>

        <main className="employeeProfileMain">
          <div className="employeeProfileContent employeeProfileContent--loading">
            <section className="employeeProfileHeroCard">
              <div className="employeeProfileHeroLeft">
                <Skeleton style={{ width: 108, height: 108, borderRadius: 22 }} />
                <div className="employeeProfileIdentity">
                  <Skeleton style={{ width: 220, height: 30, borderRadius: 10 }} />
                  <Skeleton style={{ width: 140, height: 16, borderRadius: 8, marginTop: 8 }} />
                  <div className="employeeProfileTagRow">
                    <Skeleton style={{ width: 96, height: 26, borderRadius: 999 }} />
                    <Skeleton style={{ width: 88, height: 26, borderRadius: 999 }} />
                  </div>
                  <div className="employeeProfileActions">
                    <Skeleton style={{ width: 110, height: 34, borderRadius: 9 }} />
                    <Skeleton style={{ width: 82, height: 34, borderRadius: 9 }} />
                  </div>
                </div>
              </div>
            </section>

            <section className="employeeProfileKpiStrip">
              <div className="employeeProfileKpiGrid">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div className="employeeProfileKpiCard" key={`kpi-sk-${i}`}>
                    <Skeleton style={{ width: 44, height: 44, borderRadius: 8 }} />
                    <div className="employeeProfileKpiBody">
                      <Skeleton style={{ width: 64, height: 24, borderRadius: 8 }} />
                      <Skeleton style={{ width: 110, height: 12, borderRadius: 6 }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="employeeProfilePanelGrid">
              <aside className="employeeProfilePanel employeeProfilePanel--left">
                <Skeleton style={{ width: 140, height: 12, borderRadius: 6, marginBottom: 12 }} />
                <div className="employeeProfileFacts">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div className="employeeProfileFactRow" key={`left-sk-${i}`}>
                      <Skeleton style={{ width: 28, height: 28, borderRadius: 8 }} />
                      <div className="employeeProfileFactContent">
                        <Skeleton style={{ width: 86, height: 10, borderRadius: 6 }} />
                        <Skeleton style={{ width: 150, height: 14, borderRadius: 6, marginTop: 6 }} />
                      </div>
                    </div>
                  ))}
                </div>
              </aside>

              <div className="employeeProfilePanel employeeProfilePanel--main">
                <Skeleton style={{ width: 180, height: 12, borderRadius: 6, marginBottom: 12 }} />
                <div className="employeeProfileFacts employeeProfileFacts--twoCol">
                  {[0, 1, 2, 3].map((i) => (
                    <div className="employeeProfileFactRow" key={`main-sk-${i}`}>
                      <Skeleton style={{ width: 28, height: 28, borderRadius: 8 }} />
                      <div className="employeeProfileFactContent">
                        <Skeleton style={{ width: 96, height: 10, borderRadius: 6 }} />
                        <Skeleton style={{ width: 170, height: 14, borderRadius: 6, marginTop: 6 }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="employeeProfilePage">
      <header className="employeeProfileHeader">
        <button
          type="button"
          className="employeeProfileBack"
          onClick={() => onNavigate?.("employees:list")}
          aria-label="Back to list"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="employeeProfileHeaderIcon">
          <User size={22} />
        </div>
        <div className="employeeProfileHeaderText">
          <h1 className="employeeProfileTitle">Employee Profile</h1>
          <p className="employeeProfileSubtitle">Modern overview of employee data</p>
        </div>
        {canEdit && (
          <button
            type="button"
            className="employeeProfileEditBtn"
            onClick={() => onNavigate?.("employees:edit", employee)}
          >
            <Pencil size={16} />
            Edit profile
          </button>
        )}
      </header>

      <main className="employeeProfileMain">
        <div className="employeeProfileContent">
          <section className="employeeProfileHeroCard">
            <div className="employeeProfileHeroLeft">
              <div className="employeeProfileAvatarWrap">
                {hasPhoto ? (
                  <img
                    src={photoUrl}
                    alt=""
                    className="employeeProfileAvatar"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      const fb = e.currentTarget.nextElementSibling;
                      if (fb) fb.removeAttribute("aria-hidden");
                    }}
                  />
                ) : null}
                <span className="employeeProfileAvatarInitial" aria-hidden={!!hasPhoto}>
                  {initial}
                </span>
              </div>

              <div className="employeeProfileIdentity">
                <h2 className="employeeProfileName">{employee?.name || "-"}</h2>
                <p className="employeeProfileRole">{roleName}</p>

                <div className="employeeProfileTagRow">
                  {employee?.jobTitle ? <span className="employeeProfileTag">{employee.jobTitle}</span> : null}
                  {employee?.department ? <span className="employeeProfileTag">{employee.department}</span> : null}
                  {employee?.employmentType ? (
                    <span className="employeeProfileTag">{String(employee.employmentType).replace("_", "-")}</span>
                  ) : null}
                </div>

                <div className="employeeProfileActions">
                  {employee?.workEmail ? (
                    <a className="employeeProfileActionBtn" href={`mailto:${employee.workEmail}`}>
                      <Mail size={14} />
                      Work email
                    </a>
                  ) : null}
                  {phoneRaw ? (
                    <a className="employeeProfileActionBtn" href={`tel:${phoneRaw}`}>
                      <Phone size={14} />
                      Call
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          <section className="employeeProfileKpiStrip">
            <div className="employeeProfileKpiGrid">
              {canViewSalary && (
                <div className="employeeProfileKpiCard">
                  <span className="employeeProfileKpiIconWrap" aria-hidden>
                    <Wallet size={16} />
                  </span>
                  <div className="employeeProfileKpiBody">
                    <span className="employeeProfileKpiValue">
                      {fmtMoney(employee?.salary)}
                    </span>
                    <span className="employeeProfileKpiLabel">
                      Salary <small>{salaryType}</small>
                    </span>
                  </div>
                </div>
              )}

              <div className="employeeProfileKpiCard">
                <span className="employeeProfileKpiIconWrap" aria-hidden>
                  <Star size={16} />
                </span>
                <div className="employeeProfileKpiBody">
                  {rating != null ? (
                    <Tippy content={`${rating} out of 5`} animation="shift-away" placement="top" delay={[150, 0]}>
                      <span className="employeeProfileKpiValue">{rating}</span>
                    </Tippy>
                  ) : (
                    <span className="employeeProfileKpiValue">-</span>
                  )}
                  <span className="employeeProfileKpiLabel">Rating</span>
                </div>
              </div>

              <div className="employeeProfileKpiCard">
                <span className="employeeProfileKpiIconWrap" aria-hidden>
                  <BadgeCheck size={16} />
                </span>
                <div className="employeeProfileKpiBody">
                  <span className="employeeProfileKpiValue employeeProfileKpiValue--status">Active</span>
                  <span className="employeeProfileKpiLabel">Profile Status</span>
                </div>
              </div>

              <div className="employeeProfileKpiCard">
                <span className="employeeProfileKpiIconWrap" aria-hidden>
                  <MessageSquare size={16} />
                </span>
                <div className="employeeProfileKpiBody">
                  <span className="employeeProfileKpiValue employeeProfileKpiValue--metric">{fmtCount(suggestCount)}</span>
                  <span className="employeeProfileKpiLabel">Suggest Count</span>
                </div>
              </div>

              <div className="employeeProfileKpiCard">
                <span className="employeeProfileKpiIconWrap" aria-hidden>
                  <CalendarDays size={16} />
                </span>
                <div className="employeeProfileKpiBody">
                  <span className="employeeProfileKpiValue employeeProfileKpiValue--metric">{fmtCount(holidayRequestedCount)}</span>
                  <span className="employeeProfileKpiLabel">Holiday Requested</span>
                </div>
              </div>
            </div>
          </section>

          <section className="employeeProfilePanelGrid">
            <aside className="employeeProfilePanel employeeProfilePanel--left">
              <h3 className="employeeProfileSectionTitle">Work Snapshot</h3>
              <div className="employeeProfileFacts">
                <FactRow icon={Briefcase} label="Role" value={roleName} />
                <FactRow icon={Briefcase} label="Job Title" value={employee?.jobTitle} />
                <FactRow icon={Building2} label="Department" value={employee?.department} />
                <FactRow
                  icon={User}
                  label="Employment"
                  value={employee?.employmentType ? String(employee.employmentType).replace("_", "-") : ""}
                />
                <FactRow icon={Calendar} label="Start Date" value={employee?.startDate} />
              </div>
            </aside>

            <div className="employeeProfilePanel employeeProfilePanel--main">
              <h3 className="employeeProfileSectionTitle">Contact Information</h3>
              <div className="employeeProfileFacts employeeProfileFacts--twoCol">
                <FactRow icon={Mail} label="Work Email" value={employee?.workEmail} />
                <FactRow icon={Mail} label="Personal Email" value={employee?.email} />
                <FactRow icon={Phone} label="Phone" value={phoneDisplay} />
                <FactRow icon={MapPin} label="Address" value={employee?.address} />
              </div>

              {canViewSalary && (
                <>
                  <div className="employeeProfileDivider" />
                  <h3 className="employeeProfileSectionTitle">Compensation</h3>
                  <div className="employeeProfileFacts employeeProfileFacts--twoCol">
                    <FactRow icon={Wallet} label="Salary" value={fmtMoney(employee?.salary)} />
                    <FactRow icon={Wallet} label="Salary Type" value={salaryType} />
                  </div>
                </>
              )}

              {employee?.notes ? (
                <>
                  <div className="employeeProfileDivider" />
                  <h3 className="employeeProfileSectionTitle">
                    <FileText size={16} className="employeeProfileFactIcon" /> Notes
                  </h3>
                  <p className="employeeProfileNotes">{employee.notes}</p>
                </>
              ) : null}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

// Create_Cashout — category tabs (Employee, Driver, Store, Other) and embedded list/card content
import React, { useEffect, useMemo, useState } from "react";
import { Wallet, UsersRound, Truck, Store, ArrowDownToLine } from "lucide-react";
import { hasPermission } from "../../../helpers/permissions";
import EmployeesList from "./Employee_List";
import Drivers from "./Drivers";
import Stores from "./Stores";
import OtherCashoutForm from "../../cashout/OtherCashoutForm";
import "../../../styles/pages/audit/audit_logs.css";
import "../../../styles/pages/cashout/cashout.css";
import "../../../styles/pages/cashout/create_cashout.css";

const CATEGORIES = [
  { id: "employee", label: "Employee", sub: "Enter employee data, salary, and date", icon: UsersRound, permissionKey: "cashout.create.employee" },
  { id: "driver", label: "Driver", sub: "Select driver then fill out payment modal", icon: Truck, permissionKey: "cashout.create.driver" },
  { id: "store", label: "Store", sub: "Select store", icon: Store, permissionKey: "cashout.create.store" },
  { id: "other", label: "Other", sub: "Sources like rent / internet / maintenance ..", icon: ArrowDownToLine, permissionKey: "cashout.create.other" },
];

export default function CreateCashout({ account, onNavigate, initialCategory = "employee", embeddedInModal = false, onClose, onOpenStoreCashoutModal }) {
  const [category, setCategory] = useState(initialCategory);

  useEffect(() => {
    setCategory(initialCategory);
  }, [initialCategory]);

  const allowedCategories = useMemo(() => {
    return CATEGORIES.filter((c) => hasPermission(account, c.permissionKey));
  }, [account]);

  const storeDisabled = false;
  const activeCategory = allowedCategories.some((c) => c.id === category) ? category : (allowedCategories[0]?.id ?? null);

  useEffect(() => {
    if (allowedCategories.length && !allowedCategories.some((c) => c.id === category)) {
      setCategory(allowedCategories[0].id);
    }
  }, [allowedCategories, category]);

  const setCategoryOnly = (id) => setCategory(id);

  return (
    <div className={`createCashoutPage ${embeddedInModal ? "createCashoutPage--modal" : "auditLogsPage cashoutListPage"}`}>
      {!embeddedInModal && (
        <header className="auditLogsHeader">
          <div className="auditLogsHeaderIcon">
            <Wallet size={24} />
          </div>
          <div className="auditLogsHeaderText">
            <h1 className="auditLogsTitle">Create Cashout</h1>
            <p className="auditLogsSubtitle">Choose a category and complete the cashout flow</p>
          </div>
        </header>
      )}

      <main className={embeddedInModal ? "createCashoutModalMain" : "auditLogsMain"}>
        <div className={embeddedInModal ? "createCashoutModalContent" : "auditLogsContent"}>
          <section className="auditLogsSection createCashoutSection">
            {/* Category header buttons */}
            <div className="createCashoutTabs" role="tablist" aria-label="Cashout category">
              {CATEGORIES.map((c) => {
                const allowed = allowedCategories.some((x) => x.id === c.id);
                const disabled = c.id === "store" && storeDisabled;
                const active = activeCategory === c.id;
                const Icon = c.icon;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-disabled={disabled || !allowed}
                    disabled={disabled || !allowed}
                    className={`createCashoutTab ${active ? "createCashoutTab--active" : ""} ${disabled ? "createCashoutTab--disabled" : ""}`}
                    onClick={() => !disabled && allowed && setCategoryOnly(c.id)}
                  >
                    <span className="createCashoutTabIcon">
                      <Icon size={20} />
                    </span>
                    <span className="createCashoutTabText">
                      <span className="createCashoutTabLabel">{c.label}</span>
                      <span className="createCashoutTabSub">{c.sub}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Content */}
            <div className="createCashoutContent">
              {!activeCategory && (
                <div className="createCashoutPanel createCashoutPanel--disabled">
                  <p className="createCashoutDisabledText">You don&apos;t have permission to create any type of cashout.</p>
                </div>
              )}
              {activeCategory === "employee" && (
                <div className="createCashoutPanel">
                  <EmployeesList account={account} onNavigate={onNavigate} />
                </div>
              )}
              {activeCategory === "driver" && (
                <div className="createCashoutPanel">
                  <Drivers account={account} onNavigate={onNavigate} />
                </div>
              )}
              {activeCategory === "store" && (
                <div className="createCashoutPanel">
                  <div className="createCashoutStorePanel">
                    <Stores account={account} onNavigate={onNavigate} />
                    <div className="createCashoutStoreAction">
                      <button
                        type="button"
                        className="createCashoutOtherBtn createCashoutStoreCashoutBtn"
                        onClick={() => onOpenStoreCashoutModal?.()}
                      >
                        <Store size={18} />
                        Create store cashout
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {activeCategory === "other" && (
                <div className="createCashoutPanel">
                  <OtherCashoutForm account={account} onClose={undefined} />
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

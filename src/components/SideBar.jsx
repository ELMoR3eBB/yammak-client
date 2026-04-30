import React, { useEffect, useMemo, useState } from "react";
import {
  Home as HomeIcon,
  UsersRound,
  Shield as ShieldIcon,
  ChevronDown,
  PlusCircle,
  List,
  LogOut,
  LogIn,
  Settings,
  ScrollText,
  CalendarDays,
  Calendar,
  Bell,
  Zap,
  FileText,
  Inbox,
  Monitor,
  BarChart3,
  Activity,
  MessageSquare,
  MessageCircle,
  Power,
  Truck,
  Wallet,
  Store,
  ArrowDownToLine,
  ArrowDownCircle,
  Clock,
  RefreshCw,
  Database,
  Package,
  Gamepad2,
  Mic,
  KeyRound,
} from "lucide-react";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";
import "tippy.js/animations/shift-away.css";
import { hasPermission } from "../helpers/permissions";
import { getAssetUrl } from "../utils/publicUrl";
import YammakBrandLogo from "./icons/YammakBrandLogo";
import { useLanguage } from "../contexts/LanguageContext";
import { isSectionDisabled } from "../config/sections";
import "../styles/sidebar.css";

function SidebarItem({ active, icon, label, onClick, indent = false, badge, badgeCircle = false, disabled = false, tooltip = "" }) {
  const button = (
    <button className={`sb2-item ${active ? "active" : ""} ${indent ? "indent" : ""}`} onClick={onClick}>
      <span className="sb2-ic">{icon}</span>
      <span className="sb2-label">{label}</span>
      {badge != null && (
        <span className={`sb2-badge ${badgeCircle ? "sb2-badge--circle" : ""}`}>{badge}</span>
      )}
    </button>
  );
  if (!disabled) return button;
  return (
    <Tippy content={tooltip} animation="shift-away" placement="right" delay={[120, 0]}>
      <div className="sb2-disabledWrap">{button}</div>
    </Tippy>
  );
}

function SidebarGroupButton({ children, onClick, disabled = false, tooltip = "", className = "" }) {
  const button = (
    <button className={className} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
  if (!disabled) return button;
  return (
    <Tippy content={tooltip} animation="shift-away" placement="right" delay={[120, 0]}>
      <div className="sb2-disabledWrap">{button}</div>
    </Tippy>
  );
}

export default function SidebarNew({
  account,
  activePage,
  onNavigate,
  disabledSectionKeys = [],
  canOverrideDisabledSections = false,
  unreadNotificationCount = 0,
  pendingCashoutCount = 0,
  chatUnreadCount = 0,
  onOpenCreateCashoutModal,
  onOpenCashInModal,
  onOpenWalletAdjustModal,
}) {
  const { t } = useLanguage();
  const [rolesOpen, setRolesOpen] = useState(false);
  const [employeesOpen, setEmployeesOpen] = useState(false);
  const [holidaysOpen, setHolidaysOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [suggestsOpen, setSuggestsOpen] = useState(false);
  const [cashoutOpen, setCashoutOpen] = useState(false);
  const [createCashoutOpen, setCreateCashoutOpen] = useState(false);
  const [cashinOpen, setCashinOpen] = useState(false);
  const [addMoneyOpen, setAddMoneyOpen] = useState(false);
  const [deductMoneyOpen, setDeductMoneyOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
  const [dataEntryOpen, setDataEntryOpen] = useState(false);

  const FALLBACK_AVATAR = getAssetUrl("assets/avatar-fallback.webp");
  const [avatarSrc, setAvatarSrc] = useState(FALLBACK_AVATAR);
  const sectionSettings = useMemo(() => ({ sections: { disabled: disabledSectionKeys } }), [disabledSectionKeys]);
  const sectionEnabled = useMemo(
    () => (sectionKey) => canOverrideDisabledSections || !isSectionDisabled(sectionSettings, sectionKey),
    [canOverrideDisabledSections, sectionSettings]
  );
  const canAccessPage = useMemo(() => {
    const allowedPages = Array.isArray(account?.allowedPages) ? account.allowedPages : null;
    return (pageId) => {
      if (!pageId || !allowedPages) return true;
      return allowedPages.includes(pageId);
    };
  }, [account]);
  const disabledSectionTooltip = t("settings.sectionDisabledTooltip");

  useEffect(() => {
    if (activePage?.startsWith("roles:")) setRolesOpen(true);
    if (activePage?.startsWith("employees:")) setEmployeesOpen(true);
    if (activePage?.startsWith("holidays:")) setHolidaysOpen(true);
    if (activePage?.startsWith("reports:")) setReportsOpen(true);
    if (activePage?.startsWith("suggests:")) setSuggestsOpen(true);
    if (activePage?.startsWith("cashout:")) setCashoutOpen(true);
    if (activePage === "sync") setDataOpen(true);
    if (activePage?.startsWith("dataentry:")) setDataEntryOpen(true);
  }, [activePage]);

  useEffect(() => {
    const maybePhoto =
      account?.photo ||
      account?.avatar ||
      account?.photoUrl ||
      account?.avatarUrl ||
      account?.uploads?.employeePhotoUrl ||
      "";

    setAvatarSrc(maybePhoto ? maybePhoto : FALLBACK_AVATAR);
  }, [account, FALLBACK_AVATAR]);

  const showRoles = useMemo(() => (canAccessPage("roles:list") || canAccessPage("roles:create")) && hasPermission(account, ["roles.view", "roles.create"]), [account, canAccessPage]);
  const showEmployees = useMemo(() => (canAccessPage("employees:list") || canAccessPage("employees:create")) && hasPermission(account, ["employees.view", "employees.create"]), [account, canAccessPage]);
  const showSettings = useMemo(() => canAccessPage("settings:home") && hasPermission(account, "settings.*"), [account, canAccessPage]);
  const showAuditLogs = useMemo(() => canAccessPage("audit:list") && hasPermission(account, "audit.view"), [account, canAccessPage]);
  const showHotSend = useMemo(() => canAccessPage("hot:send") && hasPermission(account, "hot.send"), [account, canAccessPage]);
  const showReportsView = useMemo(() => canAccessPage("reports:list") && hasPermission(account, "reports.view"), [account, canAccessPage]);
  const showSuggests = useMemo(() => canAccessPage("suggests:list") && hasPermission(account, "suggests.view"), [account, canAccessPage]);
  const showHeatmap = useMemo(() => canAccessPage("heatmap") && hasPermission(account, "analytics.heatmap"), [account, canAccessPage]);
  const showDevices = useMemo(() => canAccessPage("devices") && hasPermission(account, "devices.view"), [account, canAccessPage]);
  const showDrivers = useMemo(() => canAccessPage("drivers") && hasPermission(account, "drivers.view"), [account, canAccessPage]);
  const showStores = useMemo(() => canAccessPage("stores") && hasPermission(account, "stores.view"), [account, canAccessPage]);
  const showSync = useMemo(() => canAccessPage("sync") && hasPermission(account, "sync.request"), [account, canAccessPage]);
  const showDataEntry = useMemo(() => (canAccessPage("dataentry:list") || canAccessPage("dataentry:create")) && hasPermission(account, ["dataentry.view", "dataentry.create", "dataentry.manage"]), [account, canAccessPage]);
  const showDocuments = useMemo(() => canAccessPage("documents") && hasPermission(account, ["documents.create", "documents.use"]), [account, canAccessPage]);
  const showStorage = useMemo(() => canAccessPage("storage") && hasPermission(account, ["storage.view", "storage.manage"]), [account, canAccessPage]);
  const showRecordings = useMemo(() => canAccessPage("recordings") && hasPermission(account, "calls.recordings"), [account, canAccessPage]);
  const showCashoutList = useMemo(
    () =>
      hasPermission(account, [
        "cashout.request",
        "cashout.viewAll",
        "cashout.manage",
        "transactions.view",
        "transactions.reject",
      ]),
    [account, canAccessPage]
  );
  const showCashoutPending = useMemo(
    () => canAccessPage("cashout:pending") && hasPermission(account, ["cashout.viewPending", "transactions.reject"]),
    [account, canAccessPage]
  );
  const showTransactions = useMemo(() => {
    if (!canAccessPage("transactions")) return false;
    const perms = account?.role?.permissions || [];
    return (
      perms.includes("*") ||
      perms.includes("transactions.view") ||
      perms.includes("transactions.reject") ||
      perms.includes("cashout.viewAll") ||
      perms.includes("cashout.manage")
    );
  }, [account, canAccessPage]);
  const showCashoutCreate = useMemo(() => canAccessPage("cashout:list") && hasPermission(account, ["cashout.create.employee", "cashout.create.driver", "cashout.create.store", "cashout.create.other"]), [account, canAccessPage]);
  const showCashIn = useMemo(() => hasPermission(account, "cashin.create"), [account]);
  const showWalletAdjust = useMemo(() => hasPermission(account, "cashout.manage"), [account]);
  const showSuggestCreate = useMemo(() => canAccessPage("suggests:new") && hasPermission(account, "suggest.create"), [account, canAccessPage]);
  const showHolidays = useMemo(() => (canAccessPage("holidays:ask") || canAccessPage("holidays:list") || canAccessPage("holidays:calendar")) && hasPermission(account, ["holiday.request", "holiday.manage"]), [account, canAccessPage]);
  const showReportsSubmit = useMemo(() => canAccessPage("reports:submit"), [canAccessPage]);
  const showNotificationsSection = canAccessPage("notifications");
  const showSecurityAuditSection = showAuditLogs;
  const showAnalyticsSection = showHeatmap || showAuditLogs;
  const showToolsSection = showHotSend || showDevices;

  return (
    <aside className="sidebar2">
      {/* Top / Brand */}
      <div className="sb2-top">
        <button className="sb2-brand" onClick={() => onNavigate("dashboard")}>
          <div className="sb2-logo-bg">
            <YammakBrandLogo className="sb2-logo-svg" aria-hidden />
          </div>
          <span className="sb2-brandText">
            <span className="sb2-app">Yammak</span>
            <span className="sb2-sub">{t("sidebar.controlPanel")}</span>
          </span>
        </button>

        <div className="sb2-divider" />
      </div>

      {/* Nav */}
      <nav className="sb2-nav">
        <div className="sb2-sectionTitle">{t("sidebar.main")}</div>

        <SidebarItem
          active={activePage === "dashboard"}
          icon={<HomeIcon size={18} />}
          label={t("sidebar.dashboard")}
          onClick={() => onNavigate("dashboard")}
        />

        <SidebarItem
          active={activePage === "chat"}
          icon={<MessageCircle size={18} />}
          label={t("sidebar.chat")}
          onClick={canAccessPage("chat") && sectionEnabled("chat") ? () => onNavigate("chat") : undefined}
          badge={chatUnreadCount > 0 ? (chatUnreadCount > 99 ? "99+" : chatUnreadCount) : null}
          badgeCircle
          disabled={!canAccessPage("chat") || !sectionEnabled("chat")}
          tooltip={disabledSectionTooltip}
        />

        <SidebarItem
          active={activePage === "gaming"}
          icon={<Gamepad2 size={18} />}
          label={t("sidebar.gaming")}
          onClick={sectionEnabled("gaming") ? () => onNavigate("gaming") : undefined}
          disabled={!sectionEnabled("gaming")}
          tooltip={disabledSectionTooltip}
        />

        {showRecordings && (
          <SidebarItem
            active={activePage === "recordings"}
            icon={<Mic size={18} />}
            label={t("sidebar.recordings")}
            onClick={sectionEnabled("recordings") ? () => onNavigate("recordings") : undefined}
            disabled={!sectionEnabled("recordings")}
            tooltip={disabledSectionTooltip}
          />
        )}

        {showEmployees && (
          <div className={`sb2-group ${employeesOpen ? "open" : ""}`}>
            <SidebarGroupButton
              className="sb2-groupBtn"
              onClick={sectionEnabled("employees") ? () => setEmployeesOpen((v) => !v) : undefined}
              disabled={!sectionEnabled("employees")}
              tooltip={disabledSectionTooltip}
            >
              <span className="sb2-groupLeft">
                <span className="sb2-ic"><UsersRound size={18} /></span>
                <span>{t("sidebar.employees")}</span>
              </span>
              <ChevronDown size={18} className={`sb2-chev ${employeesOpen ? "open" : ""}`} />
            </SidebarGroupButton>

            <div className="sb2-groupBody" aria-hidden={!employeesOpen}>
              {hasPermission(account, "employees.create") && (
                <SidebarItem
                  indent
                  active={activePage === "employees:create"}
                  icon={<PlusCircle size={16} />}
                  label={t("sidebar.createEmployee")}
                  onClick={sectionEnabled("employees") ? () => onNavigate("employees:create") : undefined}
                  disabled={!sectionEnabled("employees")}
                  tooltip={disabledSectionTooltip}
                />
              )}

              {hasPermission(account, ["employees.view", "employees.create"]) && (
                <SidebarItem
                  indent
                  active={activePage === "employees:list"}
                  icon={<List size={16} />}
                  label={t("sidebar.employeesList")}
                  onClick={sectionEnabled("employees") ? () => onNavigate("employees:list") : undefined}
                  disabled={!sectionEnabled("employees")}
                  tooltip={disabledSectionTooltip}
                />
              )}
            </div>
          </div>
        )}

        {showRoles && (
          <div className={`sb2-group ${rolesOpen ? "open" : ""}`}>
            <SidebarGroupButton
              className="sb2-groupBtn"
              onClick={sectionEnabled("roles") ? () => setRolesOpen((v) => !v) : undefined}
              disabled={!sectionEnabled("roles")}
              tooltip={disabledSectionTooltip}
            >
              <span className="sb2-groupLeft">
                <span className="sb2-ic"><ShieldIcon size={18} /></span>
                <span>{t("sidebar.roles")}</span>
              </span>
              <ChevronDown size={18} className={`sb2-chev ${rolesOpen ? "open" : ""}`} />
            </SidebarGroupButton>

            <div className="sb2-groupBody" aria-hidden={!rolesOpen}>
              {hasPermission(account, "roles.create") && (
                <SidebarItem
                  indent
                  active={activePage === "roles:create"}
                  icon={<PlusCircle size={16} />}
                  label={t("sidebar.createRole")}
                  onClick={sectionEnabled("roles") ? () => onNavigate("roles:create") : undefined}
                  disabled={!sectionEnabled("roles")}
                  tooltip={disabledSectionTooltip}
                />
              )}

              {hasPermission(account, ["roles.view", "roles.create"]) && (
                <SidebarItem
                  indent
                  active={activePage === "roles:list"}
                  icon={<List size={16} />}
                  label={t("sidebar.roleList")}
                  onClick={sectionEnabled("roles") ? () => onNavigate("roles:list") : undefined}
                  disabled={!sectionEnabled("roles")}
                  tooltip={disabledSectionTooltip}
                />
              )}
            </div>
          </div>
        )}

        {showHolidays && (
          <div className={`sb2-group ${holidaysOpen ? "open" : ""}`}>
            <SidebarGroupButton
              className="sb2-groupBtn"
              onClick={sectionEnabled("holidays") ? () => setHolidaysOpen((v) => !v) : undefined}
              disabled={!sectionEnabled("holidays")}
              tooltip={disabledSectionTooltip}
            >
              <span className="sb2-groupLeft">
                <span className="sb2-ic"><CalendarDays size={18} /></span>
                <span>{t("sidebar.holidays")}</span>
              </span>
              <ChevronDown size={18} className={`sb2-chev ${holidaysOpen ? "open" : ""}`} />
            </SidebarGroupButton>

            <div className="sb2-groupBody" aria-hidden={!holidaysOpen}>
              {hasPermission(account, "holiday.request") && (
                <SidebarItem
                  indent
                  active={activePage === "holidays:ask"}
                  icon={<PlusCircle size={16} />}
                  label={t("holidays.request")}
                  onClick={sectionEnabled("holidays") ? () => onNavigate("holidays:ask") : undefined}
                  disabled={!sectionEnabled("holidays")}
                  tooltip={disabledSectionTooltip}
                />
              )}

              {hasPermission(account, "holiday.manage") && (
                <SidebarItem
                  indent
                  active={activePage === "holidays:list"}
                  icon={<List size={16} />}
                  label={t("sidebar.holidayList")}
                  onClick={sectionEnabled("holidays") ? () => onNavigate("holidays:list") : undefined}
                  disabled={!sectionEnabled("holidays")}
                  tooltip={disabledSectionTooltip}
                />
              )}
              {(hasPermission(account, "holiday.request") || hasPermission(account, "holiday.manage")) && (
                <SidebarItem
                  indent
                  active={activePage === "holidays:calendar"}
                  icon={<Calendar size={16} />}
                  label={t("holidays.calendar")}
                  onClick={sectionEnabled("holidays") ? () => onNavigate("holidays:calendar") : undefined}
                  disabled={!sectionEnabled("holidays")}
                  tooltip={disabledSectionTooltip}
                />
              )}
            </div>
          </div>
        )}

        {(showReportsSubmit || showReportsView) &&
          <div className={`sb2-group ${reportsOpen ? "open" : ""}`}>
            <SidebarGroupButton
              className="sb2-groupBtn"
              onClick={sectionEnabled("reports") ? () => setReportsOpen((v) => !v) : undefined}
              disabled={!sectionEnabled("reports")}
              tooltip={disabledSectionTooltip}
            >
              <span className="sb2-groupLeft">
                <span className="sb2-ic"><FileText size={18} /></span>
                <span>{t("sidebar.reports")}</span>
              </span>
              <ChevronDown size={18} className={`sb2-chev ${reportsOpen ? "open" : ""}`} />
            </SidebarGroupButton>

            <div className="sb2-groupBody" aria-hidden={!reportsOpen}>
              <SidebarItem
                indent
                active={activePage === "reports:submit"}
                icon={<PlusCircle size={16} />}
                label={t("reports.submit")}
                onClick={showReportsSubmit && sectionEnabled("reports") ? () => onNavigate("reports:submit") : undefined}
                disabled={!showReportsSubmit || !sectionEnabled("reports")}
                tooltip={disabledSectionTooltip}
              />
              {showReportsView && (
                <SidebarItem
                  indent
                  active={activePage === "reports:list"}
                  icon={<List size={16} />}
                  label={t("reports.list")}
                  onClick={sectionEnabled("reports") ? () => onNavigate("reports:list") : undefined}
                  disabled={!sectionEnabled("reports")}
                  tooltip={disabledSectionTooltip}
                />
              )}
            </div>
          </div>
        }

        {(showSuggests || showSuggestCreate) && (
          <div className={`sb2-group ${suggestsOpen ? "open" : ""}`}>
            <SidebarGroupButton
              className="sb2-groupBtn"
              onClick={sectionEnabled("suggests") ? () => setSuggestsOpen((v) => !v) : undefined}
              disabled={!sectionEnabled("suggests")}
              tooltip={disabledSectionTooltip}
            >
              <span className="sb2-groupLeft">
                <span className="sb2-ic"><MessageSquare size={18} /></span>
                <span>{t("sidebar.suggests")}</span>
              </span>
              <ChevronDown size={18} className={`sb2-chev ${suggestsOpen ? "open" : ""}`} />
            </SidebarGroupButton>

            <div className="sb2-groupBody" aria-hidden={!suggestsOpen}>
              {showSuggestCreate && (
                <SidebarItem
                  indent
                  active={activePage === "suggests:new"}
                  icon={<PlusCircle size={16} />}
                  label={t("sidebar.newSuggest")}
                  onClick={sectionEnabled("suggests") ? () => onNavigate("suggests:new") : undefined}
                  disabled={!sectionEnabled("suggests")}
                  tooltip={disabledSectionTooltip}
                />
              )}
              {showSuggests && (
                <SidebarItem
                  indent
                  active={activePage === "suggests:list"}
                  icon={<List size={16} />}
                  label={t("sidebar.suggestList")}
                  onClick={sectionEnabled("suggests") ? () => onNavigate("suggests:list") : undefined}
                  disabled={!sectionEnabled("suggests")}
                  tooltip={disabledSectionTooltip}
                />
              )}
            </div>
          </div>
        )}

        {showDrivers && (
          <SidebarItem
            active={activePage === "drivers" || activePage === "drivers:profile"}
            icon={<Truck size={18} />}
            label={t("sidebar.drivers")}
            onClick={sectionEnabled("drivers") ? () => onNavigate("drivers") : undefined}
            disabled={!sectionEnabled("drivers")}
            tooltip={disabledSectionTooltip}
          />
        )}

        {showStores && (
          <SidebarItem
            active={activePage === "stores" || activePage === "stores:profile"}
            icon={<Store size={18} />}
            label={t("sidebar.stores")}
            onClick={sectionEnabled("stores") ? () => onNavigate("stores") : undefined}
            disabled={!sectionEnabled("stores")}
            tooltip={disabledSectionTooltip}
          />
        )}

        {showCashIn && (
          <div className={`sb2-group ${cashinOpen ? "open" : ""}`}>
            <SidebarGroupButton
              className="sb2-groupBtn"
              onClick={sectionEnabled("cashIn") ? () => setCashinOpen((v) => !v) : undefined}
              disabled={!sectionEnabled("cashIn")}
              tooltip={disabledSectionTooltip}
            >
              <span className="sb2-groupLeft">
                <span className="sb2-ic"><ArrowDownCircle size={18} /></span>
                <span>{t("sidebar.cashIn")}</span>
              </span>
              <ChevronDown size={18} className={`sb2-chev ${cashinOpen ? "open" : ""}`} />
            </SidebarGroupButton>
            <div className="sb2-groupBody" aria-hidden={!cashinOpen}>
              {showDrivers && (
                <SidebarItem
                  indent
                  icon={<Truck size={16} />}
                  label={t("sidebar.driver")}
                  onClick={sectionEnabled("cashIn") ? () => onOpenCashInModal?.("driver") : undefined}
                  disabled={!sectionEnabled("cashIn")}
                  tooltip={disabledSectionTooltip}
                />
              )}
              <SidebarItem
                indent
                icon={<ArrowDownToLine size={16} />}
                label={t("sidebar.others")}
                onClick={sectionEnabled("cashIn") ? () => onOpenCashInModal?.("other") : undefined}
                disabled={!sectionEnabled("cashIn")}
                tooltip={disabledSectionTooltip}
              />
            </div>
          </div>
        )}

        {showWalletAdjust && (
          <div className={`sb2-group ${addMoneyOpen ? "open" : ""}`}>
            <SidebarGroupButton
              className="sb2-groupBtn"
              onClick={sectionEnabled("walletAdjust") ? () => setAddMoneyOpen((v) => !v) : undefined}
              disabled={!sectionEnabled("walletAdjust")}
              tooltip={disabledSectionTooltip}
            >
              <span className="sb2-groupLeft">
                <span className="sb2-ic"><PlusCircle size={18} /></span>
                <span>{t("sidebar.addMoney")}</span>
              </span>
              <ChevronDown size={18} className={`sb2-chev ${addMoneyOpen ? "open" : ""}`} />
            </SidebarGroupButton>
            <div className="sb2-groupBody" aria-hidden={!addMoneyOpen}>
              {showDrivers && (
                <SidebarItem
                  indent
                  icon={<Truck size={16} />}
                  label={t("sidebar.driver")}
                  onClick={sectionEnabled("walletAdjust") ? () => onOpenWalletAdjustModal?.("add", "driver") : undefined}
                  disabled={!sectionEnabled("walletAdjust")}
                  tooltip={disabledSectionTooltip}
                />
              )}
              {showStores && (
                <SidebarItem
                  indent
                  icon={<Store size={16} />}
                  label={t("sidebar.store")}
                  onClick={sectionEnabled("walletAdjust") ? () => onOpenWalletAdjustModal?.("add", "store") : undefined}
                  disabled={!sectionEnabled("walletAdjust")}
                  tooltip={disabledSectionTooltip}
                />
              )}
            </div>
          </div>
        )}

        {showWalletAdjust && (
          <div className={`sb2-group ${deductMoneyOpen ? "open" : ""}`}>
            <SidebarGroupButton
              className="sb2-groupBtn"
              onClick={sectionEnabled("walletAdjust") ? () => setDeductMoneyOpen((v) => !v) : undefined}
              disabled={!sectionEnabled("walletAdjust")}
              tooltip={disabledSectionTooltip}
            >
              <span className="sb2-groupLeft">
                <span className="sb2-ic"><ArrowDownCircle size={18} /></span>
                <span>{t("sidebar.deductMoney")}</span>
              </span>
              <ChevronDown size={18} className={`sb2-chev ${deductMoneyOpen ? "open" : ""}`} />
            </SidebarGroupButton>
            <div className="sb2-groupBody" aria-hidden={!deductMoneyOpen}>
              {showDrivers && (
                <SidebarItem
                  indent
                  icon={<Truck size={16} />}
                  label={t("sidebar.driver")}
                  onClick={sectionEnabled("walletAdjust") ? () => onOpenWalletAdjustModal?.("deduct", "driver") : undefined}
                  disabled={!sectionEnabled("walletAdjust")}
                  tooltip={disabledSectionTooltip}
                />
              )}
              {showStores && (
                <SidebarItem
                  indent
                  icon={<Store size={16} />}
                  label={t("sidebar.store")}
                  onClick={sectionEnabled("walletAdjust") ? () => onOpenWalletAdjustModal?.("deduct", "store") : undefined}
                  disabled={!sectionEnabled("walletAdjust")}
                  tooltip={disabledSectionTooltip}
                />
              )}
            </div>
          </div>
        )}

        {(showCashoutList || showCashoutCreate) && (
          <div className={`sb2-group ${cashoutOpen ? "open" : ""}`}>
            <SidebarGroupButton
              className="sb2-groupBtn"
              onClick={sectionEnabled("cashout") ? () => setCashoutOpen((v) => !v) : undefined}
              disabled={!sectionEnabled("cashout")}
              tooltip={disabledSectionTooltip}
            >
              <span className="sb2-groupLeft">
                <span className="sb2-ic"><Wallet size={18} /></span>
                <span>{t("sidebar.cashout")}</span>
              </span>
              <ChevronDown size={18} className={`sb2-chev ${cashoutOpen ? "open" : ""}`} />
            </SidebarGroupButton>
            <div className="sb2-groupBody" aria-hidden={!cashoutOpen}>
              {showCashoutCreate && (
                <div className={`sb2-group sb2-group--nested ${createCashoutOpen ? "open" : ""}`}>
                  <SidebarGroupButton
                    className="sb2-groupBtn"
                    onClick={sectionEnabled("cashout") ? (e) => {
                      e.stopPropagation();
                      setCreateCashoutOpen((v) => !v);
                    } : undefined}
                    disabled={!sectionEnabled("cashout")}
                    tooltip={disabledSectionTooltip}
                  >
                    <span className="sb2-groupLeft">
                      <span className="sb2-ic"><PlusCircle size={16} /></span>
                      <span>{t("sidebar.createCashout")}</span>
                    </span>
                    <ChevronDown size={18} className={`sb2-chev ${createCashoutOpen ? "open" : ""}`} />
                  </SidebarGroupButton>
                  <div className="sb2-groupBody" aria-hidden={!createCashoutOpen}>
                    {hasPermission(account, "cashout.create.employee") && (
                      <SidebarItem
                        indent
                        icon={<UsersRound size={16} />}
                        label={t("sidebar.employee")}
                        onClick={sectionEnabled("cashout") ? () => onOpenCreateCashoutModal?.("employee") : undefined}
                        disabled={!sectionEnabled("cashout")}
                        tooltip={disabledSectionTooltip}
                      />
                    )}
                    {hasPermission(account, "cashout.create.driver") && (
                      <SidebarItem
                        indent
                        icon={<Truck size={16} />}
                        label={t("sidebar.driver")}
                        onClick={sectionEnabled("cashout") ? () => onOpenCreateCashoutModal?.("driver") : undefined}
                        disabled={!sectionEnabled("cashout")}
                        tooltip={disabledSectionTooltip}
                      />
                    )}
                    {hasPermission(account, "cashout.create.store") && (
                      <SidebarItem
                        indent
                        icon={<Store size={16} />}
                        label={t("sidebar.store")}
                        onClick={sectionEnabled("cashout") ? () => onOpenCreateCashoutModal?.("store") : undefined}
                        disabled={!sectionEnabled("cashout")}
                        tooltip={disabledSectionTooltip}
                      />
                    )}
                    {hasPermission(account, "cashout.create.other") && (
                      <SidebarItem
                        indent
                        icon={<ArrowDownToLine size={16} />}
                        label={t("sidebar.other")}
                        onClick={sectionEnabled("cashout") ? () => onOpenCreateCashoutModal?.("other") : undefined}
                        disabled={!sectionEnabled("cashout")}
                        tooltip={disabledSectionTooltip}
                      />
                    )}
                  </div>
                </div>
              )}
              {showCashoutList && (
                <SidebarItem
                  indent
                  active={activePage === "cashout:list"}
                  icon={<List size={16} />}
                  label={t("sidebar.cashoutList")}
                  onClick={sectionEnabled("cashout") ? () => onNavigate("cashout:list") : undefined}
                  disabled={!sectionEnabled("cashout")}
                  tooltip={disabledSectionTooltip}
                />
              )}
              {showCashoutPending && (
                <SidebarItem
                  indent
                  active={activePage === "cashout:pending"}
                  icon={<Clock size={16} />}
                  label={t("sidebar.pendingCashout")}
                  onClick={sectionEnabled("cashout") ? () => onNavigate("cashout:pending") : undefined}
                  disabled={!sectionEnabled("cashout")}
                  tooltip={disabledSectionTooltip}
                  badge={pendingCashoutCount > 0 ? (pendingCashoutCount > 99 ? "99+" : pendingCashoutCount) : null}
                  badgeCircle
                />
              )}
            </div>
          </div>
        )}

        {showTransactions && (
          <SidebarItem
            active={activePage === "transactions"}
            icon={<BarChart3 size={18} />}
            label={t("sidebar.transactions")}
            onClick={sectionEnabled("transactions") ? () => onNavigate("transactions") : undefined}
            disabled={!sectionEnabled("transactions")}
            tooltip={disabledSectionTooltip}
          />
        )}

        {showSync && (
          <div className={`sb2-group ${dataOpen ? "open" : ""}`}>
            <SidebarGroupButton
              className="sb2-groupBtn"
              onClick={sectionEnabled("sync") ? () => setDataOpen((v) => !v) : undefined}
              disabled={!sectionEnabled("sync")}
              tooltip={disabledSectionTooltip}
            >
              <span className="sb2-groupLeft">
                <span className="sb2-ic"><Database size={18} /></span>
                <span>{t("sidebar.data")}</span>
              </span>
              <ChevronDown size={18} className={`sb2-chev ${dataOpen ? "open" : ""}`} />
            </SidebarGroupButton>
            <div className="sb2-groupBody" aria-hidden={!dataOpen}>
              <SidebarItem
                indent
                active={activePage === "sync"}
                icon={<RefreshCw size={16} />}
                label={t("sidebar.sync")}
                onClick={sectionEnabled("sync") ? () => onNavigate("sync") : undefined}
                disabled={!sectionEnabled("sync")}
                tooltip={disabledSectionTooltip}
              />
            </div>
          </div>
        )}

        {showDataEntry && (
          <div className={`sb2-group ${dataEntryOpen ? "open" : ""}`}>
            <SidebarGroupButton
              className="sb2-groupBtn"
              onClick={sectionEnabled("dataEntry") ? () => setDataEntryOpen((v) => !v) : undefined}
              disabled={!sectionEnabled("dataEntry")}
              tooltip={disabledSectionTooltip}
            >
              <span className="sb2-groupLeft">
                <span className="sb2-ic"><Inbox size={18} /></span>
                <span>{t("sidebar.dataEntry")}</span>
              </span>
              <ChevronDown size={18} className={`sb2-chev ${dataEntryOpen ? "open" : ""}`} />
            </SidebarGroupButton>
            <div className="sb2-groupBody" aria-hidden={!dataEntryOpen}>
              {hasPermission(account, ["dataentry.create", "dataentry.manage"]) && (
                <SidebarItem
                  indent
                  active={activePage === "dataentry:create"}
                  icon={<PlusCircle size={16} />}
                  label={t("sidebar.create")}
                  onClick={sectionEnabled("dataEntry") ? () => onNavigate("dataentry:create") : undefined}
                  disabled={!sectionEnabled("dataEntry")}
                  tooltip={disabledSectionTooltip}
                />
              )}
              {hasPermission(account, ["dataentry.view", "dataentry.create", "dataentry.manage"]) && (
                <SidebarItem
                  indent
                  active={activePage === "dataentry:list"}
                  icon={<List size={16} />}
                  label={t("sidebar.list")}
                  onClick={sectionEnabled("dataEntry") ? () => onNavigate("dataentry:list") : undefined}
                  disabled={!sectionEnabled("dataEntry")}
                  tooltip={disabledSectionTooltip}
                />
              )}
            </div>
          </div>
        )}

        {showDocuments && (
          <SidebarItem
            active={activePage === "documents"}
            icon={<FileText size={18} />}
            label={t("sidebar.documents")}
            onClick={sectionEnabled("documents") ? () => onNavigate("documents") : undefined}
            disabled={!sectionEnabled("documents")}
            tooltip={disabledSectionTooltip}
          />
        )}

        {showStorage && (
          <SidebarItem
            active={activePage === "storage"}
            icon={<Package size={18} />}
            label={t("sidebar.storage")}
            onClick={sectionEnabled("storage") ? () => onNavigate("storage") : undefined}
            disabled={!sectionEnabled("storage")}
            tooltip={disabledSectionTooltip}
          />
        )}

        <SidebarItem
          active={activePage === "vaults"}
          icon={<KeyRound size={18} />}
          label={t("settings.sectionsVaults")}
          onClick={sectionEnabled("vaults") ? () => onNavigate("vaults") : undefined}
          disabled={!sectionEnabled("vaults")}
          tooltip={disabledSectionTooltip}
        />

        <>
          {showNotificationsSection && <div className="sb2-sectionTitle">{t("sidebar.sectionNotifications")}</div>}
          {showNotificationsSection && (
            <SidebarItem
              active={activePage === "notifications"}
              icon={<Bell size={18} />}
              label={t("sidebar.notifications")}
              onClick={sectionEnabled("notifications") ? () => onNavigate("notifications") : undefined}
              disabled={!sectionEnabled("notifications")}
              tooltip={disabledSectionTooltip}
              badge={unreadNotificationCount > 0 ? (unreadNotificationCount > 99 ? "99+" : unreadNotificationCount) : null}
              badgeCircle
            />
          )}

          {showSettings && (
            <>
              <div className="sb2-sectionTitle">{t("sidebar.sectionSettings")}</div>
              <SidebarItem
                active={activePage === "settings:home"}
                icon={<Settings size={18} />}
                label={t("sidebar.settings")}
                onClick={() => onNavigate("settings:home")}
              />
            </>
          )}

          {showSecurityAuditSection && (
            <>
              <div className="sb2-sectionTitle">{t("sidebar.sectionSecurityAudit")}</div>
              <SidebarItem
                active={activePage === "audit:list"}
                icon={<ScrollText size={18} />}
                label={t("sidebar.auditLogs")}
                onClick={sectionEnabled("auditLogs") ? () => onNavigate("audit:list") : undefined}
                disabled={!sectionEnabled("auditLogs")}
                tooltip={disabledSectionTooltip}
              />
              <SidebarItem
                active={activePage === "loginAttempts"}
                icon={<LogIn size={18} />}
                label={t("sidebar.loginAttempts")}
                onClick={sectionEnabled("loginAttempts") ? () => onNavigate("loginAttempts") : undefined}
                disabled={!sectionEnabled("loginAttempts")}
                tooltip={disabledSectionTooltip}
              />
            </>
          )}

          {showAnalyticsSection && (
            <>
              <div className="sb2-sectionTitle">{t("sidebar.sectionAnalytics")}</div>
              {showHeatmap && (
                <SidebarItem
                  active={activePage === "heatmap"}
                  icon={<BarChart3 size={18} />}
                  label={t("sidebar.actionHeatmap")}
                  onClick={sectionEnabled("heatmap") ? () => onNavigate("heatmap") : undefined}
                  disabled={!sectionEnabled("heatmap")}
                  tooltip={disabledSectionTooltip}
                />
              )}
              {showAuditLogs && (
                <SidebarItem
                  active={activePage === "performance"}
                  icon={<Activity size={18} />}
                  label={t("sidebar.performance")}
                  onClick={sectionEnabled("performance") ? () => onNavigate("performance") : undefined}
                  disabled={!sectionEnabled("performance")}
                  tooltip={disabledSectionTooltip}
                />
              )}
            </>
          )}

          {showToolsSection && (
            <>
              <div className="sb2-sectionTitle">{t("sidebar.sectionTools")}</div>
              {showHotSend && (
                <SidebarItem
                  active={activePage === "hot:send"}
                  icon={<Zap size={18} />}
                  label={t("sidebar.hotNotification")}
                  onClick={sectionEnabled("hotSend") ? () => onNavigate("hot:send") : undefined}
                  disabled={!sectionEnabled("hotSend")}
                  tooltip={disabledSectionTooltip}
                />
              )}
              {showDevices && (
                <SidebarItem
                  active={activePage === "devices"}
                  icon={<Monitor size={18} />}
                  label={t("sidebar.deviceManagement")}
                  onClick={sectionEnabled("devices") ? () => onNavigate("devices") : undefined}
                  disabled={!sectionEnabled("devices")}
                  tooltip={disabledSectionTooltip}
                />
              )}
            </>
          )}
        </>
      </nav>

      {/* Footer / Profile — click to view own profile */}
      <div className="sb2-footer">
        <Tippy content={t("sidebar.clickProfile")} animation="shift-away" placement="right" delay={[200, 0]}>
          <button
            type="button"
            className="sb2-profile sb2-profile--clickable"
            onClick={() => onNavigate("employees:profile", { viewMe: true })}
          >
            <img
              className="sb2-avatar"
              src={avatarSrc}
              alt="User avatar"
              onError={() => setAvatarSrc(FALLBACK_AVATAR)}
            />
            <div className="sb2-userText">
              <div className="sb2-name">
                {account?.name || "—"}
              </div>
              <div className="sb2-role">
                {account?.role?.name || "—"}
              </div>
            </div>
          </button>
        </Tippy>

        <button
          className="sb2-logout"
          onClick={() => window.api?.authLogout?.()}
          aria-label={t("sidebar.logout")}
        >
          <LogOut size={18} />
          <span>{t("sidebar.logout")}</span>
        </button>

        <button
          type="button"
          className="sb2-exit"
          onClick={() => window.api?.exitApp?.()}
          aria-label={t("sidebar.exitApp")}
        >
          <Power size={18} />
          <span>{t("sidebar.exitApp")}</span>
        </button>
      </div>
    </aside>
  );
}

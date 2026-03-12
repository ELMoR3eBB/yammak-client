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
} from "lucide-react";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";
import "tippy.js/animations/shift-away.css";
import { hasPermission } from "../helpers/permissions";
import { getAssetUrl } from "../utils/publicUrl";
import YammakBrandLogo from "./icons/YammakBrandLogo";
import { useLanguage } from "../contexts/LanguageContext";
import "../styles/sidebar.css";

function SidebarItem({ active, icon, label, onClick, indent = false, badge, badgeCircle = false }) {
  return (
    <button className={`sb2-item ${active ? "active" : ""} ${indent ? "indent" : ""}`} onClick={onClick}>
      <span className="sb2-ic">{icon}</span>
      <span className="sb2-label">{label}</span>
      {badge != null && (
        <span className={`sb2-badge ${badgeCircle ? "sb2-badge--circle" : ""}`}>{badge}</span>
      )}
    </button>
  );
}

export default function SidebarNew({
  account,
  activePage,
  onNavigate,
  unreadNotificationCount = 0,
  pendingCashoutCount = 0,
  chatUnreadCount = 0,
  onOpenCreateCashoutModal,
  onOpenCashInModal,
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
  const [dataOpen, setDataOpen] = useState(false);

  const FALLBACK_AVATAR = getAssetUrl("assets/avatar-fallback.webp");
  const [avatarSrc, setAvatarSrc] = useState(FALLBACK_AVATAR);

  useEffect(() => {
    if (activePage?.startsWith("roles:")) setRolesOpen(true);
    if (activePage?.startsWith("employees:")) setEmployeesOpen(true);
    if (activePage?.startsWith("holidays:")) setHolidaysOpen(true);
    if (activePage?.startsWith("reports:")) setReportsOpen(true);
    if (activePage?.startsWith("suggests:")) setSuggestsOpen(true);
    if (activePage?.startsWith("cashout:")) setCashoutOpen(true);
    if (activePage === "sync") setDataOpen(true);
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
  }, [account]);

  const showRoles = useMemo(() => hasPermission(account, ["roles.view", "roles.create"]), [account]);
  const showEmployees = useMemo(() => hasPermission(account, ["employees.view", "employees.create"]), [account]);
  const showSettings = useMemo(() => hasPermission(account, "settings.*"), [account]);
  const showAuditLogs = useMemo(() => hasPermission(account, "audit.view"), [account]);
  const showHotSend = useMemo(() => hasPermission(account, "hot.send"), [account]);
  const showReportsView = useMemo(() => hasPermission(account, "reports.view"), [account]);
  const showSuggests = useMemo(() => hasPermission(account, "suggests.view"), [account]);
  const showHeatmap = useMemo(() => hasPermission(account, "analytics.heatmap"), [account]);
  const showDevices = useMemo(() => hasPermission(account, "devices.view"), [account]);
  const showDrivers = useMemo(() => hasPermission(account, "drivers.view"), [account]);
  const showStores = useMemo(() => hasPermission(account, "stores.view"), [account]);
  const showSync = useMemo(() => hasPermission(account, "sync.request"), [account]);
  const showDocuments = useMemo(() => hasPermission(account, ["documents.create", "documents.use"]), [account]);
  const showStorage = useMemo(() => hasPermission(account, ["storage.view", "storage.manage"]), [account]);
  const showCashoutList = useMemo(
    () =>
      hasPermission(account, [
        "cashout.request",
        "cashout.viewAll",
        "cashout.manage",
        "transactions.view",
        "transactions.reject",
      ]),
    [account]
  );
  const showCashoutPending = useMemo(
    () => hasPermission(account, ["cashout.viewPending", "transactions.reject"]),
    [account]
  );
  const showTransactions = useMemo(() => {
    const perms = account?.role?.permissions || [];
    return (
      perms.includes("*") ||
      perms.includes("transactions.view") ||
      perms.includes("transactions.reject") ||
      perms.includes("cashout.viewAll") ||
      perms.includes("cashout.manage")
    );
  }, [account]);
  const showCashoutCreate = useMemo(() => hasPermission(account, ["cashout.create.employee", "cashout.create.driver", "cashout.create.store", "cashout.create.other"]), [account]);
  const showCashIn = useMemo(() => hasPermission(account, "cashin.create"), [account]);
  const showSuggestCreate = useMemo(() => hasPermission(account, "suggest.create"), [account]);
  const showHolidays = useMemo(() => hasPermission(account, ["holiday.request", "holiday.manage"]), [account]);

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
          onClick={() => onNavigate("chat")}
          badge={chatUnreadCount > 0 ? (chatUnreadCount > 99 ? "99+" : chatUnreadCount) : null}
          badgeCircle
        />

        <SidebarItem
          active={activePage === "gaming"}
          icon={<Gamepad2 size={18} />}
          label={t("sidebar.gaming")}
          onClick={() => onNavigate("gaming")}
        />

        {showEmployees && (
          <div className={`sb2-group ${employeesOpen ? "open" : ""}`}>
            <button className="sb2-groupBtn" onClick={() => setEmployeesOpen((v) => !v)}>
              <span className="sb2-groupLeft">
                <span className="sb2-ic"><UsersRound size={18} /></span>
                <span>{t("sidebar.employees")}</span>
              </span>
              <ChevronDown size={18} className={`sb2-chev ${employeesOpen ? "open" : ""}`} />
            </button>

            <div className="sb2-groupBody" aria-hidden={!employeesOpen}>
              {hasPermission(account, "employees.create") && (
                <SidebarItem
                  indent
                  active={activePage === "employees:create"}
                  icon={<PlusCircle size={16} />}
                  label={t("sidebar.createEmployee")}
                  onClick={() => onNavigate("employees:create")}
                />
              )}

              {hasPermission(account, ["employees.view", "employees.create"]) && (
                <SidebarItem
                  indent
                  active={activePage === "employees:list"}
                  icon={<List size={16} />}
                  label={t("sidebar.employeesList")}
                  onClick={() => onNavigate("employees:list")}
                />
              )}
            </div>
          </div>
        )}

        {showRoles && (
          <div className={`sb2-group ${rolesOpen ? "open" : ""}`}>
            <button className="sb2-groupBtn" onClick={() => setRolesOpen((v) => !v)}>
              <span className="sb2-groupLeft">
                <span className="sb2-ic"><ShieldIcon size={18} /></span>
                <span>{t("sidebar.roles")}</span>
              </span>
              <ChevronDown size={18} className={`sb2-chev ${rolesOpen ? "open" : ""}`} />
            </button>

            <div className="sb2-groupBody" aria-hidden={!rolesOpen}>
              {hasPermission(account, "roles.create") && (
                <SidebarItem
                  indent
                  active={activePage === "roles:create"}
                  icon={<PlusCircle size={16} />}
                  label={t("sidebar.createRole")}
                  onClick={() => onNavigate("roles:create")}
                />
              )}

              {hasPermission(account, ["roles.view", "roles.create"]) && (
                <SidebarItem
                  indent
                  active={activePage === "roles:list"}
                  icon={<List size={16} />}
                  label={t("sidebar.roleList")}
                  onClick={() => onNavigate("roles:list")}
                />
              )}
            </div>
          </div>
        )}

        {showHolidays && (
          <div className={`sb2-group ${holidaysOpen ? "open" : ""}`}>
            <button className="sb2-groupBtn" onClick={() => setHolidaysOpen((v) => !v)}>
              <span className="sb2-groupLeft">
                <span className="sb2-ic"><CalendarDays size={18} /></span>
                <span>{t("sidebar.holidays")}</span>
              </span>
              <ChevronDown size={18} className={`sb2-chev ${holidaysOpen ? "open" : ""}`} />
            </button>

            <div className="sb2-groupBody" aria-hidden={!holidaysOpen}>
              {hasPermission(account, "holiday.request") && (
                <SidebarItem
                  indent
                  active={activePage === "holidays:ask"}
                  icon={<PlusCircle size={16} />}
                  label={t("holidays.request")}
                  onClick={() => onNavigate("holidays:ask")}
                />
              )}

              {hasPermission(account, "holiday.manage") && (
                <SidebarItem
                  indent
                  active={activePage === "holidays:list"}
                  icon={<List size={16} />}
                  label={t("sidebar.holidayList")}
                  onClick={() => onNavigate("holidays:list")}
                />
              )}
              {(hasPermission(account, "holiday.request") || hasPermission(account, "holiday.manage")) && (
                <SidebarItem
                  indent
                  active={activePage === "holidays:calendar"}
                  icon={<Calendar size={16} />}
                  label={t("holidays.calendar")}
                  onClick={() => onNavigate("holidays:calendar")}
                />
              )}
            </div>
          </div>
        )}

        <div className={`sb2-group ${reportsOpen ? "open" : ""}`}>
          <button className="sb2-groupBtn" onClick={() => setReportsOpen((v) => !v)}>
            <span className="sb2-groupLeft">
              <span className="sb2-ic"><FileText size={18} /></span>
              <span>{t("sidebar.reports")}</span>
            </span>
            <ChevronDown size={18} className={`sb2-chev ${reportsOpen ? "open" : ""}`} />
          </button>

          <div className="sb2-groupBody" aria-hidden={!reportsOpen}>
            <SidebarItem
              indent
              active={activePage === "reports:submit"}
              icon={<PlusCircle size={16} />}
              label={t("reports.submit")}
              onClick={() => onNavigate("reports:submit")}
            />
            {showReportsView && (
              <SidebarItem
                indent
                active={activePage === "reports:list"}
                icon={<List size={16} />}
                label={t("reports.list")}
                onClick={() => onNavigate("reports:list")}
              />
            )}
          </div>
        </div>

        {(showSuggests || showSuggestCreate) && (
          <div className={`sb2-group ${suggestsOpen ? "open" : ""}`}>
            <button className="sb2-groupBtn" onClick={() => setSuggestsOpen((v) => !v)}>
              <span className="sb2-groupLeft">
                <span className="sb2-ic"><MessageSquare size={18} /></span>
                <span>{t("sidebar.suggests")}</span>
              </span>
              <ChevronDown size={18} className={`sb2-chev ${suggestsOpen ? "open" : ""}`} />
            </button>

            <div className="sb2-groupBody" aria-hidden={!suggestsOpen}>
              {showSuggestCreate && (
                <SidebarItem
                  indent
                  active={activePage === "suggests:new"}
                  icon={<PlusCircle size={16} />}
                  label={t("sidebar.newSuggest")}
                  onClick={() => onNavigate("suggests:new")}
                />
              )}
              {showSuggests && (
                <SidebarItem
                  indent
                  active={activePage === "suggests:list"}
                  icon={<List size={16} />}
                  label={t("sidebar.suggestList")}
                  onClick={() => onNavigate("suggests:list")}
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
            onClick={() => onNavigate("drivers")}
          />
        )}

        {showStores && (
          <SidebarItem
            active={activePage === "stores" || activePage === "stores:profile"}
            icon={<Store size={18} />}
            label={t("sidebar.stores")}
            onClick={() => onNavigate("stores")}
          />
        )}

        {showCashIn && (
          <div className={`sb2-group ${cashinOpen ? "open" : ""}`}>
            <button className="sb2-groupBtn" onClick={() => setCashinOpen((v) => !v)}>
              <span className="sb2-groupLeft">
                <span className="sb2-ic"><ArrowDownCircle size={18} /></span>
                <span>{t("sidebar.cashIn")}</span>
              </span>
              <ChevronDown size={18} className={`sb2-chev ${cashinOpen ? "open" : ""}`} />
            </button>
            <div className="sb2-groupBody" aria-hidden={!cashinOpen}>
              {showDrivers && (
                <SidebarItem
                  indent
                  icon={<Truck size={16} />}
                  label={t("sidebar.driver")}
                  onClick={() => onOpenCashInModal?.("driver")}
                />
              )}
              <SidebarItem
                indent
                icon={<ArrowDownToLine size={16} />}
                label={t("sidebar.others")}
                onClick={() => onOpenCashInModal?.("other")}
              />
            </div>
          </div>
        )}

        {(showCashoutList || showCashoutCreate) && (
          <div className={`sb2-group ${cashoutOpen ? "open" : ""}`}>
            <button className="sb2-groupBtn" onClick={() => setCashoutOpen((v) => !v)}>
              <span className="sb2-groupLeft">
                <span className="sb2-ic"><Wallet size={18} /></span>
                <span>{t("sidebar.cashout")}</span>
              </span>
              <ChevronDown size={18} className={`sb2-chev ${cashoutOpen ? "open" : ""}`} />
            </button>
            <div className="sb2-groupBody" aria-hidden={!cashoutOpen}>
              {showCashoutCreate && (
                <div className={`sb2-group sb2-group--nested ${createCashoutOpen ? "open" : ""}`}>
                  <button
                    type="button"
                    className="sb2-groupBtn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCreateCashoutOpen((v) => !v);
                    }}
                  >
                    <span className="sb2-groupLeft">
                      <span className="sb2-ic"><PlusCircle size={16} /></span>
                      <span>{t("sidebar.createCashout")}</span>
                    </span>
                    <ChevronDown size={18} className={`sb2-chev ${createCashoutOpen ? "open" : ""}`} />
                  </button>
                  <div className="sb2-groupBody" aria-hidden={!createCashoutOpen}>
                    {hasPermission(account, "cashout.create.employee") && (
                      <SidebarItem
                        indent
                        icon={<UsersRound size={16} />}
                        label={t("sidebar.employee")}
                        onClick={() => onOpenCreateCashoutModal?.("employee")}
                      />
                    )}
                    {hasPermission(account, "cashout.create.driver") && (
                      <SidebarItem
                        indent
                        icon={<Truck size={16} />}
                        label={t("sidebar.driver")}
                        onClick={() => onOpenCreateCashoutModal?.("driver")}
                      />
                    )}
                    {hasPermission(account, "cashout.create.store") && (
                      <SidebarItem
                        indent
                        icon={<Store size={16} />}
                        label={t("sidebar.store")}
                        onClick={() => onOpenCreateCashoutModal?.("store")}
                      />
                    )}
                    {hasPermission(account, "cashout.create.other") && (
                      <SidebarItem
                        indent
                        icon={<ArrowDownToLine size={16} />}
                        label={t("sidebar.other")}
                        onClick={() => onOpenCreateCashoutModal?.("other")}
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
                  onClick={() => onNavigate("cashout:list")}
                />
              )}
              {showCashoutPending && (
                <SidebarItem
                  indent
                  active={activePage === "cashout:pending"}
                  icon={<Clock size={16} />}
                  label={t("sidebar.pendingCashout")}
                  onClick={() => onNavigate("cashout:pending")}
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
            onClick={() => onNavigate("transactions")}
          />
        )}

        {showSync && (
          <div className={`sb2-group ${dataOpen ? "open" : ""}`}>
            <button className="sb2-groupBtn" onClick={() => setDataOpen((v) => !v)}>
              <span className="sb2-groupLeft">
                <span className="sb2-ic"><Database size={18} /></span>
                <span>{t("sidebar.data")}</span>
              </span>
              <ChevronDown size={18} className={`sb2-chev ${dataOpen ? "open" : ""}`} />
            </button>
            <div className="sb2-groupBody" aria-hidden={!dataOpen}>
              <SidebarItem
                indent
                active={activePage === "sync"}
                icon={<RefreshCw size={16} />}
                label={t("sidebar.sync")}
                onClick={() => onNavigate("sync")}
              />
            </div>
          </div>
        )}

        {showDocuments && (
          <SidebarItem
            active={activePage === "documents"}
            icon={<FileText size={18} />}
            label={t("sidebar.documents")}
            onClick={() => onNavigate("documents")}
          />
        )}

        {showStorage && (
          <SidebarItem
            active={activePage === "storage"}
            icon={<Package size={18} />}
            label={t("sidebar.storage")}
            onClick={() => onNavigate("storage")}
          />
        )}

        <>
          <div className="sb2-sectionTitle">{t("sidebar.sectionNotifications")}</div>
          <SidebarItem
            active={activePage === "notifications"}
            icon={<Bell size={18} />}
            label={t("sidebar.notifications")}
            onClick={() => onNavigate("notifications")}
            badge={unreadNotificationCount > 0 ? (unreadNotificationCount > 99 ? "99+" : unreadNotificationCount) : null}
            badgeCircle
          />

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

          {showAuditLogs && (
            <>
              <div className="sb2-sectionTitle">{t("sidebar.sectionSecurityAudit")}</div>
              <SidebarItem
                active={activePage === "audit:list"}
                icon={<ScrollText size={18} />}
                label={t("sidebar.auditLogs")}
                onClick={() => onNavigate("audit:list")}
              />
              <SidebarItem
                active={activePage === "loginAttempts"}
                icon={<LogIn size={18} />}
                label={t("sidebar.loginAttempts")}
                onClick={() => onNavigate("loginAttempts")}
              />
            </>
          )}

          {(showHeatmap || showAuditLogs) && (
            <>
              <div className="sb2-sectionTitle">{t("sidebar.sectionAnalytics")}</div>
              {showHeatmap && (
                <SidebarItem
                  active={activePage === "heatmap"}
                  icon={<BarChart3 size={18} />}
                  label={t("sidebar.actionHeatmap")}
                  onClick={() => onNavigate("heatmap")}
                />
              )}
              {showAuditLogs && (
                <SidebarItem
                  active={activePage === "performance"}
                  icon={<Activity size={18} />}
                  label={t("sidebar.performance")}
                  onClick={() => onNavigate("performance")}
                />
              )}
            </>
          )}

          {(showHotSend || showDevices) && (
            <>
              <div className="sb2-sectionTitle">{t("sidebar.sectionTools")}</div>
              {showHotSend && (
                <SidebarItem
                  active={activePage === "hot:send"}
                  icon={<Zap size={18} />}
                  label={t("sidebar.hotNotification")}
                  onClick={() => onNavigate("hot:send")}
                />
              )}
              {showDevices && (
                <SidebarItem
                  active={activePage === "devices"}
                  icon={<Monitor size={18} />}
                  label={t("sidebar.deviceManagement")}
                  onClick={() => onNavigate("devices")}
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

        <Tippy content={t("sidebar.logout")} animation="shift-away" placement="right" delay={[200, 0]}>
          <button className="sb2-logout" onClick={() => window.api?.authLogout?.()} aria-label={t("sidebar.logout")}>
            <LogOut size={18} />
            <span>{t("sidebar.logout")}</span>
          </button>
        </Tippy>
        <Tippy content={t("sidebar.exitApp")} animation="shift-away" placement="right" delay={[200, 0]}>
          <button
            type="button"
            className="sb2-exit"
            onClick={() => window.api?.exitApp?.()}
            aria-label={t("sidebar.exitApp")}
          >
            <Power size={18} />
            <span>{t("sidebar.exitApp")}</span>
          </button>
        </Tippy>
      </div>
    </aside>
  );
}

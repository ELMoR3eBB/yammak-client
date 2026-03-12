import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Settings as SettingsIcon,
  Mail,
  ChevronRight,
  User,
  Construction,
  MessageCircle,
  Shield,
  Wallet,
  Plus,
  Trash2,
  Globe,
  FileText,
  Clock,
} from "lucide-react";
import { hasPermission } from "../../../helpers/permissions";
import Switch from "../../ui/Switch";
import PaginatorSelect from "../../ui/PaginatorSelect";
import "../../../styles/ui/paginator_select.css";
import "../../../styles/pages/settings/settings.css";
import { useNotification } from "../../NotificationProvider";
import { useLanguage } from "../../../contexts/LanguageContext";
import enLocale from "../../../locales/en.json";
import arLocale from "../../../locales/ar.json";

const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function formatMoneyWithCommas(val) {
  return String(val).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function parseMoneyToNumber(formatted) {
  return Number(String(formatted).replace(/[^\d]/g, "")) || 0;
}

// Section config: permKey for visibility; titleKey/categoryKey for i18n
const SECTION_CONFIG = [
  { key: "mailer", titleKey: "settings.mailer", category: "App Settings", categoryKey: "settings.appSettings", icon: Mail, permKey: "settings.mailer" },
  { key: "maintenance", titleKey: "settings.maintenance", category: "App Settings", categoryKey: "settings.appSettings", icon: Construction, permKey: "maintenance.manage" },
  { key: "aiAssistant", titleKey: "settings.aiAssistant", category: "App Settings", categoryKey: "settings.appSettings", icon: MessageCircle, permKey: "settings.aiAssistant" },
  { key: "security", titleKey: "settings.security", category: "App Settings", categoryKey: "settings.appSettings", icon: Shield, permKey: "settings.*" },
  { key: "cashoutExtraCharges", titleKey: "settings.extraCharges", category: "App Settings", categoryKey: "settings.appSettings", icon: Wallet, permKey: ["settings.extraCharges.view", "settings.extraCharges.manage"], permKeyManage: "settings.extraCharges.manage" },
  { key: "language", titleKey: "settings.language", category: "App Settings", categoryKey: "settings.appSettings", icon: Globe, permKey: "settings.*" },
  { key: "translations", titleKey: "settings.translations", category: "App Settings", categoryKey: "settings.appSettings", icon: FileText, permKey: "settings.*" },
  { key: "scheduledReports", titleKey: "settings.scheduledReports", category: "App Settings", categoryKey: "settings.appSettings", icon: Clock, permKey: ["settings.*", "reports.view"] },
];

function getCategoryIcon(category) {
  if (category === "User Settings") return User;
  return SettingsIcon;
}

export default function SettingsHome({ account }) {
  const [settings, setSettings] = useState(null);
  const [initialSettings, setInitialSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [activeKey, setActiveKey] = useState("");
  const pending = useRef(new Map());
  const notify = useNotification();
  const { language, setLanguage, t, setServerTranslationsFromSettings } = useLanguage();
  const tRef = useRef(t);
  tRef.current = t;

  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);

  const sections = useMemo(() => {
    return SECTION_CONFIG.filter((s) => hasPermission(account, s.permKey))
      .map((s) => ({
        ...s,
        icon: s.icon,
      }))
      .sort((a, b) => {
        const catOrder = { "App Settings": 0, "User Settings": 1 };
        const ca = catOrder[a.category] ?? 99;
        const cb = catOrder[b.category] ?? 99;
        if (ca !== cb) return ca - cb;
        return (a.titleKey || "").localeCompare(b.titleKey || "");
      });
  }, [account]);

  const sectionsByCategory = useMemo(() => {
    const map = new Map();
    for (const s of sections) {
      if (!map.has(s.category)) map.set(s.category, []);
      map.get(s.category).push(s);
    }
    return map;
  }, [sections]);

  useEffect(() => {
    setActiveKey(sections?.[0]?.key || "");
  }, [sections]);

  const waitResult = useCallback((requestId, timeoutMs = 8000) => {
    return new Promise((resolve) => {
      pending.current.set(requestId, resolve);
      setTimeout(() => {
        if (pending.current.has(requestId)) {
          pending.current.delete(requestId);
          resolve({ ok: false, error: "timeout" });
        }
      }, timeoutMs);
    });
  }, []);

  const load = useCallback(async () => {
    if (!window.api) {
      setLoading(false);
      notify?.error?.(tRef.current("settings.apiNotAvailable"));
      return;
    }

    setLoading(true);
    try {
      await window.api.wsConnect();
      const requestId = rid();
      const wait = waitResult(requestId);
      await window.api.wsSend({ type: "settings:get", requestId });
      const res = await wait;

      if (!res?.ok) {
        setLoading(false);
        notify?.error?.(res?.error || tRef.current("settings.loadFailed"), tRef.current("settings.title"));
        return;
      }

      const s = res.settings || {};
      setSettings(s);
      setInitialSettings(JSON.parse(JSON.stringify(s)));
      setServerTranslationsFromSettings(s);
    } catch {
      setLoading(false);
      notify?.error?.("WebSocket not connected", "Connection");
    } finally {
      setLoading(false);
    }
  }, [notify, waitResult, setServerTranslationsFromSettings]);

  useEffect(() => {
    const unsub = window.api?.onWsMessage?.((msg) => {
      if (msg?.requestId && pending.current.has(msg.requestId)) {
        const resolve = pending.current.get(msg.requestId);
        pending.current.delete(msg.requestId);
        resolve(msg);
      }
      if (msg?.type === "settings:changed") void load();
      if (msg?.type === "settings:get:result" && msg?.ok && msg?.settings) setServerTranslationsFromSettings(msg.settings);
      if (msg?.type === "maintenance:changed") setMaintenanceEnabled(msg.enabled === true);
    });
    return () => unsub?.();
  }, [load]);

  useEffect(() => {
    void load();
  }, [load]);

  const canManageMaintenance = useMemo(() => hasPermission(account, "maintenance.manage"), [account]);

  useEffect(() => {
    if (activeKey !== "maintenance" || !canManageMaintenance || !window.api?.wsSend) return;
    let cancelled = false;
    setMaintenanceLoading(true);
    const reqId = rid();
    const wait = waitResult(reqId);
    window.api.wsSend({ type: "maintenance:get", requestId: reqId });
    wait.then((res) => {
      if (!cancelled) {
        setMaintenanceEnabled(res?.enabled === true);
      }
    }).finally(() => {
      if (!cancelled) setMaintenanceLoading(false);
    });
    return () => { cancelled = true; };
  }, [activeKey, canManageMaintenance, waitResult]);

  const updateSettings = useCallback((updater) => {
    setSettings((prev) => {
      const next = typeof updater === "function" ? updater(prev || {}) : updater;
      return next ? { ...prev, ...next } : prev;
    });
  }, []);

  const dirty = useMemo(() => {
    if (!settings || !initialSettings) return false;
    return JSON.stringify(settings) !== JSON.stringify(initialSettings);
  }, [settings, initialSettings]);

  const saveAll = useCallback(async () => {
    if (!window.api) {
      notify?.error?.(tRef.current("settings.apiNotAvailable"), tRef.current("settings.title"));
      return;
    }

    setSaving(true);
    try {
      const requestId = rid();
      const wait = waitResult(requestId);

      const mailer = settings?.mailer ?? {};
      const security = settings?.security ?? {};
      const payload = {
        features: settings?.features ?? {},
        mailer: {
          ...mailer,
          fromEmail: mailer?.fromEmail?.trim?.()
            ? mailer.fromEmail.trim()
            : null,
        },
        security: {
          lockAfterFailedAttemptsEnabled: !!security.lockAfterFailedAttemptsEnabled,
          lockAfterFailedAttemptsCount: Math.min(50, Math.max(1, Number(security.lockAfterFailedAttemptsCount) || 5)),
          unlockPermission: (security.unlockPermission || "account.unlock").trim(),
          loginOutsideRegionAlertEnabled: !!security.loginOutsideRegionAlertEnabled,
          allowedCountryCode: (security.allowedCountryCode || "IQ").trim(),
          notifyPermission: (security.notifyPermission || "security.alert").trim(),
        },
        cashoutExtraCharges: Array.isArray(settings?.cashoutExtraCharges)
          ? settings.cashoutExtraCharges
              .filter((c) => c && (c.name || "").trim() !== "")
              .map((c) => ({ name: String(c.name).trim(), amount: Number(c.amount) || 0 }))
          : [],
        translations: {
          en: { ...enLocale, ...(settings?.translations?.en || {}) },
          ar: { ...arLocale, ...(settings?.translations?.ar || {}) },
        },
        scheduledReports: settings?.scheduledReports && typeof settings.scheduledReports === "object"
          ? {
              enabled: !!settings.scheduledReports.enabled,
              frequency: settings.scheduledReports.frequency === "weekly" ? "weekly" : "daily",
              time: /^\d{1,2}:\d{2}$/.test(String(settings.scheduledReports.time || "").trim()) ? String(settings.scheduledReports.time).trim() : "09:00",
              dayOfWeek: Math.min(6, Math.max(0, Number(settings.scheduledReports.dayOfWeek) || 0)),
              recipients: Array.isArray(settings.scheduledReports.recipients) ? settings.scheduledReports.recipients.filter((e) => String(e).trim()) : [],
            }
          : undefined,
      };

      await window.api.wsSend({ type: "settings:update", requestId, payload });
      const res = await wait;

      if (!res?.ok) {
        notify?.error?.(res?.error || tRef.current("settings.saveFailed"), tRef.current("settings.title"));
        setSaving(false);
        return;
      }

      const s = res.settings || {};
      setSettings(s);
      setInitialSettings(JSON.parse(JSON.stringify(s)));
      setServerTranslationsFromSettings(s);
      notify?.success?.(tRef.current("settings.allSettingsSaved"), tRef.current("settings.title"));
    } catch {
      notify?.error?.(tRef.current("settings.sendFailed"), tRef.current("settings.title"));
    } finally {
      setSaving(false);
    }
  }, [settings, notify, waitResult]);

  if (!sections.length) {
    return (
      <div className="settingsPage">
        <div className="settingsSidebar">
          <div className="settingsHeader">
            <div className="settingsHeaderIcon">
              <SettingsIcon size={24} />
            </div>
            <div>
              <h1 className="settingsTitle">{t("settings.title")}</h1>
              <p className="settingsSubtitle">{t("settings.subtitle")}</p>
            </div>
          </div>
          <div className="settingsEmpty">
            <SettingsIcon size={40} strokeWidth={1.5} />
            <p>{t("settings.noPermission")}</p>
          </div>
        </div>
      </div>
    );
  }

  const activeSection = sections.find((s) => s.key === activeKey);

  return (
    <div className="settingsPage">
      <aside className="settingsSidebar">
        <div className="settingsHeader">
          <div className="settingsHeaderIcon">
            <SettingsIcon size={24} />
          </div>
          <div>
            <h1 className="settingsTitle">{t("settings.title")}</h1>
            <p className="settingsSubtitle">{t("settings.subtitle")}</p>
          </div>
        </div>

        <nav className="settingsNav">
          {Array.from(sectionsByCategory.entries()).map(([category, items]) => (
            <div key={category} className="settingsNavGroup">
              <div className="settingsNavGroupTitle">
                {React.createElement(getCategoryIcon(category), {
                  size: 16,
                  className: "settingsNavGroupIcon",
                })}
                {t(items[0]?.categoryKey || "settings.appSettings")}
              </div>
              {items.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  className={`settingsNavItem ${activeKey === s.key ? "active" : ""}`}
                  onClick={() => setActiveKey(s.key)}
                >
                  <s.icon size={18} className="settingsNavItemIcon" />
                  <span>{t(s.titleKey)}</span>
                  <ChevronRight size={16} className="settingsNavItemChevron" />
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <main className="settingsMain">
        <div className="settingsContent">
          {activeSection && (
            <section key={activeKey} className="settingsSection">
              <div className="settingsSectionHeader">
                <h2 className="settingsSectionTitle">{t(activeSection.titleKey)}</h2>
              </div>

              <div className="settingsSectionBody">
                {activeSection.key === "mailer" && (
                  <MailerSection
                    settings={settings}
                    initialSettings={initialSettings}
                    onUpdate={updateSettings}
                    loading={loading}
                    disabled={saving}
                    t={t}
                  />
                )}
                {activeSection.key === "aiAssistant" && (
                  <AIAssistantSection
                    settings={settings}
                    onUpdate={updateSettings}
                    loading={loading}
                    disabled={saving}
                    t={t}
                  />
                )}
                {activeSection.key === "security" && (
                  <SecuritySection
                    settings={settings}
                    onUpdate={updateSettings}
                    loading={loading}
                    disabled={saving}
                    t={t}
                  />
                )}
                {activeSection.key === "cashoutExtraCharges" && (
                  <CashoutExtraChargesSection
                    settings={settings}
                    onUpdate={updateSettings}
                    loading={loading}
                    disabled={saving}
                    canManage={hasPermission(account, activeSection.permKeyManage || activeSection.permKey)}
                    t={t}
                  />
                )}
                {activeSection.key === "language" && (
                  <LanguageSection
                    language={language}
                    onLanguageChange={setLanguage}
                    t={t}
                  />
                )}
                {activeSection.key === "translations" && (
                  <TranslationsSection
                    settings={settings}
                    onUpdate={updateSettings}
                    language={language}
                    loading={loading}
                    disabled={saving}
                    t={t}
                  />
                )}
                {activeSection.key === "scheduledReports" && (
                  <ScheduledReportsSection
                    settings={settings}
                    onUpdate={updateSettings}
                    loading={loading}
                    disabled={saving}
                    t={t}
                  />
                )}
                {activeSection.key === "maintenance" && (
                  <MaintenanceSection
                    enabled={maintenanceEnabled}
                    loading={maintenanceLoading}
                    saving={maintenanceSaving}
                    t={t}
                    onToggle={async (checked) => {
                      if (!window.api?.wsSend) return;
                      setMaintenanceSaving(true);
                      const reqId = rid();
                      const wait = waitResult(reqId);
                      window.api.wsSend({ type: "maintenance:set", requestId: reqId, payload: { enabled: checked } });
                      const res = await wait;
                      setMaintenanceSaving(false);
                      if (res?.ok) {
                        setMaintenanceEnabled(res.enabled === true);
                        notify?.success?.(res.enabled ? t("settings.maintenanceOn") : t("settings.maintenanceOff"), t("settings.maintenance"));
                      } else {
                        setMaintenanceEnabled((prev) => !checked);
                        notify?.error?.(res?.error || t("settings.maintenanceFailed"), t("settings.maintenance"));
                      }
                    }}
                  />
                )}
              </div>

              {activeSection.key !== "maintenance" && (
                <div className="settingsActions">
                  <button
                    type="button"
                    className="settingsBtn"
                    disabled={saving || !dirty}
                    onClick={saveAll}
                  >
                    {saving ? t("common.saving") : dirty ? t("settings.saveChanges") : t("common.saved")}
                  </button>
                </div>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

function CashoutExtraChargesSection({ settings, onUpdate, loading, disabled, canManage = true, t }) {
  const charges = Array.isArray(settings?.cashoutExtraCharges) ? [...settings.cashoutExtraCharges] : [];
  const [exitingChargeIndex, setExitingChargeIndex] = useState(null);
  const exitingChargeRowRef = useRef(null);

  useEffect(() => {
    if (exitingChargeIndex === null || !exitingChargeRowRef.current) return;
    const el = exitingChargeRowRef.current;
    const onEnd = (e) => {
      if (e.target !== el || e.animationName !== "stExtraChargesItemOut") return;
      onUpdate((prev) => {
        const list = (prev?.cashoutExtraCharges ?? []).filter((_, i) => i !== exitingChargeIndex);
        return { ...prev, cashoutExtraCharges: list };
      });
      setExitingChargeIndex(null);
    };
    el.addEventListener("animationend", onEnd, { once: true });
    return () => el.removeEventListener("animationend", onEnd);
  }, [exitingChargeIndex, onUpdate]);

  const addCharge = () => {
    onUpdate((prev) => ({
      ...prev,
      cashoutExtraCharges: [...(prev?.cashoutExtraCharges ?? []), { name: "", amount: 0 }],
    }));
  };

  const updateCharge = (index, field, value) => {
    onUpdate((prev) => {
      const list = [...(prev?.cashoutExtraCharges ?? [])];
      if (!list[index]) return prev;
      list[index] = {
        ...list[index],
        [field]: field === "amount" ? (value === "" ? "" : (Number(value) || 0)) : value,
      };
      return { ...prev, cashoutExtraCharges: list };
    });
  };

  const handleAmountChange = (index, rawInput) => {
    const trimmed = String(rawInput ?? "").trim();
    if (trimmed === "") {
      updateCharge(index, "amount", "");
      return;
    }
    const parsed = parseMoneyToNumber(rawInput);
    updateCharge(index, "amount", parsed);
  };

  const amountDisplay = (c) =>
    c.amount === "" || c.amount == null ? "" : formatMoneyWithCommas(String(c.amount));

  const startRemoveCharge = (index) => {
    setExitingChargeIndex(index);
  };

  if (loading) {
    return (
      <div className="settingsFormRow settingsLoading">
        <div className="settingsFormGroup">
          <span className="settingsLabel">{t("settings.extraChargesLoading")}</span>
          <span className="settingsHint">{t("common.loading")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="settingsForm">
      <div className="settingsFormBlock stExtraChargesBlock">
        <p className="stExtraChargesDesc">
          {t("settings.extraChargesDesc")}
        </p>
        <div className="stExtraChargesList">
          {charges.map((c, i) => (
            <div
              key={i}
              ref={i === exitingChargeIndex ? exitingChargeRowRef : null}
              className={`stExtraChargesItem stExtraChargesItem--in ${i === exitingChargeIndex ? "stExtraChargesItem--exiting" : ""}`}
            >
              <span className="stExtraChargesItemIndex">{i + 1}</span>
              <input
                className="stExtraChargesInput stExtraChargesInput--name"
                type="text"
                value={c.name || ""}
                onChange={(e) => updateCharge(i, "name", e.target.value)}
                disabled={disabled || i === exitingChargeIndex}
                readOnly={!canManage}
                spellCheck="false"
                placeholder={t("settings.chargeName")}
                aria-label={`${t("settings.chargeName")} ${i + 1}`}
              />
              <div className="stExtraChargesAmountWrap">
                <input
                  className="stExtraChargesInput stExtraChargesInput--amount"
                  type="text"
                  inputMode="numeric"
                  value={amountDisplay(c)}
                  onChange={(e) => handleAmountChange(i, e.target.value)}
                  disabled={disabled || i === exitingChargeIndex}
                  readOnly={!canManage}
                  placeholder="0"
                  aria-label={`${t("settings.chargeName")} ${i + 1} amount`}
                />
                <span className="stExtraChargesCurrency">{t("settings.iqd")}</span>
              </div>
              {canManage && (
              <button
                type="button"
                className="stExtraChargesRemove"
                onClick={() => startRemoveCharge(i)}
                disabled={disabled || i === exitingChargeIndex}
                title={t("settings.removeCharge")}
                aria-label={t("settings.removeCharge")}
              >
                <Trash2 size={14} strokeWidth={2} />
              </button>
            )}
            </div>
          ))}
        </div>
        {canManage && (
        <button
          type="button"
          className="stExtraChargesAdd"
          onClick={addCharge}
          disabled={disabled}
        >
          <Plus size={18} strokeWidth={2} />
          <span>{t("settings.addExtraCharge")}</span>
        </button>
        )}
      </div>
    </div>
  );
}

function SecuritySection({ settings, onUpdate, loading, disabled, t }) {
  const sec = settings?.security ?? {};
  const lockEnabled = sec.lockAfterFailedAttemptsEnabled === true;
  const lockCountFromSettings = Math.min(50, Math.max(1, Number(sec.lockAfterFailedAttemptsCount) || 5));
  const outsideRegionEnabled = sec.loginOutsideRegionAlertEnabled === true;
  const allowedCountry = (sec.allowedCountryCode || "IQ").trim();

  const [lockCountInput, setLockCountInput] = useState("");

  useEffect(() => {
    if (lockEnabled) {
      setLockCountInput(String(lockCountFromSettings));
    }
  }, [lockEnabled, lockCountFromSettings]);

  const handleLockCountBlur = () => {
    const raw = lockCountInput.trim();
    if (raw === "") {
      onUpdate((prev) => ({
        ...prev,
        security: { ...prev?.security, lockAfterFailedAttemptsCount: 5 },
      }));
      setLockCountInput("5");
      return;
    }
    const num = parseInt(raw, 10);
    if (Number.isNaN(num)) {
      setLockCountInput(String(lockCountFromSettings));
      return;
    }
    const clamped = Math.min(50, Math.max(1, num));
    onUpdate((prev) => ({
      ...prev,
      security: { ...prev?.security, lockAfterFailedAttemptsCount: clamped },
    }));
    setLockCountInput(String(clamped));
  };

  if (loading) {
    return (
      <div className="settingsFormRow settingsLoading">
        <div className="settingsFormGroup">
          <span className="settingsLabel">{t("settings.security")}</span>
          <span className="settingsHint">{t("common.loading")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="settingsForm">
      <div className="settingsFormBlock">
        <h3 className="settingsBlockTitle">{t("settings.accountLockTitle")}</h3>
        <div className="settingsFormRow settingsFormRowSwitch">
          <div className="settingsFormGroup">
            <span className="settingsLabel">{t("settings.lockAfterFailedAttempts")}</span>
            <span className="settingsHint">
              {t("settings.lockAfterFailedAttemptsHint")}
            </span>
          </div>
          <Switch
            checked={lockEnabled}
            onChange={(checked) =>
              onUpdate((prev) => ({
                ...prev,
                security: {
                  ...prev?.security,
                  lockAfterFailedAttemptsEnabled: checked,
                },
              }))
            }
            disabled={disabled}
          />
        </div>
        {lockEnabled && (
          <>
            <div className="settingsField">
              <label className="settingsLabel">{t("settings.numberOfTriesBeforeLock")}</label>
              <input
                className="settingsInput"
                type="number"
                min={1}
                max={50}
                value={lockCountInput}
                onChange={(e) => setLockCountInput(e.target.value)}
                onBlur={handleLockCountBlur}
                disabled={disabled}
              />
            </div>
          </>
        )}
      </div>

      <div className="settingsFormBlock">
        <h3 className="settingsBlockTitle">{t("settings.loginFromOutsideRegion")}</h3>
        <div className="settingsFormRow settingsFormRowSwitch">
          <div className="settingsFormGroup">
            <span className="settingsLabel">{t("settings.notifyOutsideCountry")}</span>
            <span className="settingsHint">
              {t("settings.notifyOutsideCountryHint")}
            </span>
          </div>
          <Switch
            checked={outsideRegionEnabled}
            onChange={(checked) =>
              onUpdate((prev) => ({
                ...prev,
                security: {
                  ...prev?.security,
                  loginOutsideRegionAlertEnabled: checked,
                },
              }))
            }
            disabled={disabled}
          />
        </div>
        {outsideRegionEnabled && (
          <>
            <div className="settingsField">
              <label className="settingsLabel">{t("settings.allowedCountryCode")}</label>
              <input
                className="settingsInput"
                type="text"
                value={allowedCountry}
                onChange={(e) =>
                  onUpdate((prev) => ({
                    ...prev,
                    security: { ...prev?.security, allowedCountryCode: e.target.value },
                  }))
                }
                disabled={disabled}
                placeholder={t("settings.allowedCountryPlaceholder")}
                maxLength={10}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AIAssistantSection({ settings, onUpdate, loading, disabled, t }) {
  const enabled = settings?.features?.aiAssistantEnabled !== false;
  const handleToggle = (checked) => {
    onUpdate((prev) => ({
      ...prev,
      features: { ...prev?.features, aiAssistantEnabled: checked },
    }));
  };
  if (loading) {
    return (
      <div className="settingsFormRow settingsLoading">
        <div className="settingsFormGroup">
          <span className="settingsLabel">{t("settings.aiAssistant")}</span>
          <span className="settingsHint">{t("common.loading")}</span>
        </div>
      </div>
    );
  }
  return (
    <div className="settingsForm">
      <div className="settingsFormRow settingsFormRowSwitch">
        <div className="settingsFormGroup">
          <span className="settingsLabel">{t("settings.enableAIAssistant")}</span>
          <span className="settingsHint">
            {t("settings.aiAssistantHint")}
          </span>
        </div>
        <Switch
          checked={enabled}
          onChange={handleToggle}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

function MaintenanceSection({ enabled, loading, saving, onToggle, t }) {
  if (loading) {
    return (
      <div className="settingsFormRow settingsLoading">
        <div className="settingsFormGroup">
          <span className="settingsLabel">{t("settings.maintenanceMode")}</span>
          <span className="settingsHint">{t("common.loading")}</span>
        </div>
      </div>
    );
  }
  return (
    <div className="settingsForm">
      <div className="settingsFormRow settingsFormRowSwitch">
        <div className="settingsFormGroup">
          <span className="settingsLabel">{t("settings.maintenanceMode")}</span>
          <span className="settingsHint">
            {t("settings.maintenanceHint")}
          </span>
        </div>
        <Switch
          checked={enabled}
          onChange={onToggle}
          disabled={saving}
        />
      </div>
    </div>
  );
}

function LanguageSection({ language, onLanguageChange, t }) {
  const languageOptions = useMemo(
    () => [
      { value: "en", label: t("settings.english") },
      { value: "ar", label: t("settings.arabic") },
    ],
    [t]
  );
  return (
    <div className="settingsForm">
      <div className="settingsFormBlock">
        <p className="settingsHint" style={{ marginBottom: 12 }}>
          {t("settings.translationsHint")}
        </p>
        <div className="settingsField">
          <PaginatorSelect
            label={t("settings.language")}
            value={language}
            onChange={onLanguageChange}
            options={languageOptions}
            className="settingsLanguageSelect"
          />
        </div>
      </div>
    </div>
  );
}

function TranslationsSection({ settings, onUpdate, language, loading, disabled, t }) {
  const [editLanguage, setEditLanguage] = useState(language);
  const [filter, setFilter] = useState("");
  const translationKeys = useMemo(() => Object.keys(enLocale).sort(), []);
  const serverTrans = settings?.translations || {};
  const langTrans = serverTrans[editLanguage] || {};

  useEffect(() => {
    setEditLanguage((prev) => (language === prev ? prev : language));
  }, [language]);

  const filteredKeys = useMemo(() => {
    if (!filter.trim()) return translationKeys;
    const q = filter.trim().toLowerCase();
    return translationKeys.filter((k) => k.toLowerCase().includes(q));
  }, [translationKeys, filter]);

  const updateKey = (key, value) => {
    onUpdate((prev) => ({
      ...prev,
      translations: {
        ...(prev?.translations || {}),
        [editLanguage]: {
          ...((prev?.translations || {})[editLanguage] || {}),
          [key]: value,
        },
      },
    }));
  };

  if (loading) {
    return (
      <div className="settingsFormRow settingsLoading">
        <div className="settingsFormGroup">
          <span className="settingsLabel">{t("settings.translations")}</span>
          <span className="settingsHint">{t("common.loading")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="settingsForm">
      <p className="settingsHint stTranslationsHint">{t("settings.translationsHint")}</p>
      <div className="settingsFormBlock" style={{ marginBottom: 16 }}>
        <div className="settingsField" style={{ marginBottom: 8 }}>
          <PaginatorSelect
            label={t("settings.editTranslationsFor")}
            value={editLanguage}
            onChange={setEditLanguage}
            options={[
              { value: "en", label: t("settings.english") },
              { value: "ar", label: t("settings.arabic") },
            ]}
            className="settingsLanguageSelect"
          />
        </div>
        <div className="settingsField">
          <label className="settingsLabel">{t("settings.filterKeys")}</label>
          <input
            className="settingsInput"
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t("settings.filterKeysPlaceholder")}
            aria-label={t("settings.filterKeys")}
          />
        </div>
      </div>
      <p className="settingsHint" style={{ marginBottom: 8 }}>
        {t("settings.translationsKeysHint")}
      </p>
      <div className="stTranslationsList">
        {filteredKeys.map((key) => (
          <div key={key} className="stTranslationsRow">
            <label className="stTranslationsKey" title={key}>{key}</label>
            <input
              className="settingsInput stTranslationsInput"
              type="text"
              value={langTrans[key] ?? (editLanguage === "ar" ? (arLocale[key] ?? enLocale[key] ?? "") : (enLocale[key] ?? ""))}
              onChange={(e) => updateKey(key, e.target.value)}
              disabled={disabled}
              placeholder={enLocale[key] ?? ""}
              aria-label={key}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function ScheduledReportsSection({ settings, onUpdate, loading, disabled, t }) {
  const sr = settings?.scheduledReports || {};
  const enabled = !!sr.enabled;
  const frequency = sr.frequency === "weekly" ? "weekly" : "daily";
  const time = sr.time || "09:00";
  const dayOfWeek = typeof sr.dayOfWeek === "number" ? sr.dayOfWeek : 0;
  const recipients = Array.isArray(sr.recipients) ? sr.recipients : [];
  const recipientsText = recipients.join("\n");

  const update = (field, value) => {
    onUpdate((prev) => ({
      ...prev,
      scheduledReports: {
        ...(prev?.scheduledReports || {}),
        [field]: value,
      },
    }));
  };

  const handleRecipientsChange = (e) => {
    const text = e.target.value || "";
    const list = text.split(/\n/).map((s) => s.trim()).filter(Boolean);
    update("recipients", list);
  };

  if (loading) {
    return (
      <div className="settingsFormRow settingsLoading">
        <div className="settingsFormGroup">
          <span className="settingsLabel">{t("settings.scheduledReports")}</span>
          <span className="settingsHint">{t("common.loading")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="settingsForm">
      <p className="settingsHint" style={{ marginBottom: 16 }}>{t("settings.scheduledReportsHint")}</p>
      <div className="settingsFormRow settingsFormRowSwitch">
        <div className="settingsFormGroup">
          <span className="settingsLabel">{t("settings.enableScheduledReports")}</span>
        </div>
        <Switch checked={enabled} onChange={(v) => update("enabled", v)} disabled={disabled} />
      </div>
      <div className={`settingsFormBlock ${!enabled ? "disabled" : ""}`}>
        <div className="settingsField">
          <label className="settingsLabel">{t("settings.frequency")}</label>
          <select
            className="settingsInput"
            value={frequency}
            onChange={(e) => update("frequency", e.target.value)}
            disabled={disabled || !enabled}
          >
            <option value="daily">{t("settings.daily")}</option>
            <option value="weekly">{t("settings.weekly")}</option>
          </select>
        </div>
        <div className="settingsField">
          <label className="settingsLabel">{t("settings.time")}</label>
          <input
            className="settingsInput"
            type="text"
            value={time}
            onChange={(e) => update("time", e.target.value)}
            placeholder="09:00"
            disabled={disabled || !enabled}
          />
          <span className="settingsHint">{t("settings.timeFormatHint")}</span>
        </div>
        {frequency === "weekly" && (
          <div className="settingsField">
            <label className="settingsLabel">{t("settings.dayOfWeek")}</label>
            <input
              className="settingsInput"
              type="number"
              min={0}
              max={6}
              value={dayOfWeek}
              onChange={(e) => update("dayOfWeek", parseInt(e.target.value, 10) || 0)}
              disabled={disabled || !enabled}
            />
          </div>
        )}
        <div className="settingsField">
          <label className="settingsLabel">{t("settings.recipients")}</label>
          <textarea
            className="settingsInput"
            rows={4}
            value={recipientsText}
            onChange={handleRecipientsChange}
            placeholder={t("settings.recipientsPlaceholder")}
            disabled={disabled || !enabled}
            style={{ resize: "vertical" }}
          />
        </div>
      </div>
    </div>
  );
}

function MailerSection({ settings, initialSettings, onUpdate, loading, disabled, t }) {
  const s = settings || {};
  const mailerEnabled = s?.features?.mailerEnabled !== false;
  const fromName = s?.mailer?.fromName ?? t("settings.fromNamePlaceholder");
  const fromEmail = s?.mailer?.fromEmail ?? "";

  const handleMailerEnabled = (checked) => {
    onUpdate((prev) => ({
      ...prev,
      features: { ...prev?.features, mailerEnabled: checked },
    }));
  };

  const handleFromName = (e) => {
    onUpdate((prev) => ({
      ...prev,
      mailer: { ...prev?.mailer, fromName: e.target.value },
    }));
  };

  const handleFromEmail = (e) => {
    onUpdate((prev) => ({
      ...prev,
      mailer: { ...prev?.mailer, fromEmail: e.target.value },
    }));
  };

  if (loading) {
    return (
      <div className="settingsFormRow settingsLoading">
        <div className="settingsFormGroup">
          <span className="settingsLabel">{t("settings.mailer")}</span>
          <span className="settingsHint">{t("common.loading")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="settingsForm">
      <div className="settingsFormRow settingsFormRowSwitch">
        <div className="settingsFormGroup">
          <span className="settingsLabel">{t("settings.enableMailSending")}</span>
          <span className="settingsHint">
            {t("settings.mailSendingHint")}
          </span>
        </div>

        <Switch
          checked={mailerEnabled}
          onChange={handleMailerEnabled}
          disabled={disabled}
        />
      </div>

      <div className={`settingsFormBlock ${!mailerEnabled ? "disabled" : ""}`}>
        <div className="settingsField">
          <label className="settingsLabel">{t("settings.fromName")}</label>
          <input
            className="settingsInput"
            value={fromName}
            onChange={handleFromName}
            disabled={disabled || !mailerEnabled}
            placeholder={t("settings.fromNamePlaceholder")}
          />
        </div>

        <div className="settingsField">
          <label className="settingsLabel">{t("settings.fromEmailOptional")}</label>
          <input
            className="settingsInput"
            type="email"
            value={fromEmail}
            onChange={handleFromEmail}
            disabled={disabled || !mailerEnabled}
            placeholder={t("settings.fromEmailPlaceholder")}
          />
          <span className="settingsHint">
            {t("settings.transportDefaultHint")}
          </span>
        </div>
      </div>
    </div>
  );
}

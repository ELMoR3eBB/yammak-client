import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Settings as SettingsIcon,
  Mail,
  ChevronRight,
  User,
  Construction,
  MessageCircle,
  Lock,
  Shield,
  Wallet,
  Globe,
  FileText,
  Clock,
  SunMoon,
} from "lucide-react";
import { hasPermission } from "../../helpers/permissions";
import "../../styles/ui/paginator_select.css";
import "../../styles/pages/settings/settings.css";
import { useNotification } from "../../components/NotificationProvider";
import { useLanguage } from "../../contexts/LanguageContext";
import enLocale from "../../locales/en.json";
import arLocale from "../../locales/ar.json";

import { normalizeDisabledSections } from "../../config/sections";

import AppearanceSection from "./Sections/AppearanceSection";
import SectionsSection from "./Sections/SectionsSection";
import CashoutExtraChargesSection from "./Sections/CashoutExtraChargesSection";
import SecuritySection from "./Sections/SecuritySection";
import AIAssistantSection from "./Sections/AIAssistantSection";
import ChatControlsSection from "./Sections/ChatControlsSection";
import MaintenanceSection from "./Sections/MaintenanceSection";
import LanguageSection from "./Sections/LanguageSection";
import TranslationsSection from "./Sections/TranslationsSection";
import ScheduledReportsSection from "./Sections/ScheduledReportsSection";
import MailerSection from "./Sections/MailerSection";
import ArqamSection from "./Sections/ArqamSection";

const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);


const SECTION_CONFIG = [
  { key: "mailer", titleKey: "settings.mailer", category: "App Settings", categoryKey: "settings.appSettings", icon: Mail, permKey: "settings.mailer" },
  { key: "maintenance", titleKey: "settings.maintenance", category: "App Settings", categoryKey: "settings.appSettings", icon: Construction, permKey: "maintenance.manage" },
  { key: "aiAssistant", titleKey: "settings.aiAssistant", category: "App Settings", categoryKey: "settings.appSettings", icon: MessageCircle, permKey: "settings.aiAssistant" },
  { key: "chatControls", titleKey: "settings.chatControls", category: "App Settings", categoryKey: "settings.appSettings", icon: Lock, permKey: "settings.chat.manage" },
  { key: "security", titleKey: "settings.security", category: "App Settings", categoryKey: "settings.appSettings", icon: Shield, permKey: "settings.*" },
  { key: "cashoutExtraCharges", titleKey: "settings.extraCharges", category: "App Settings", categoryKey: "settings.appSettings", icon: Wallet, permKey: ["settings.extraCharges.view", "settings.extraCharges.manage"], permKeyManage: "settings.extraCharges.manage" },
  // Always visible. Global defaults inside are permission-gated.
  { key: "appearance", titleKey: "settings.appearance", category: "User Settings", categoryKey: "settings.userSettings", icon: SunMoon, permKey: null },
  { key: "language", titleKey: "settings.language", category: "User Settings", categoryKey: "settings.userSettings", icon: Globe, permKey: null },
  { key: "sections", titleKey: "settings.sections", category: "App Settings", categoryKey: "settings.appSettings", icon: SettingsIcon, permKey: "settings.*" },
  { key: "translations", titleKey: "settings.translations", category: "App Settings", categoryKey: "settings.appSettings", icon: FileText, permKey: "settings.*" },
  { key: "scheduledReports", titleKey: "settings.scheduledReports", category: "App Settings", categoryKey: "settings.appSettings", icon: Clock, permKey: ["settings.*", "reports.view"] },
  { key: "arqam", titleKey: "settings.arqam", category: "App Settings", categoryKey: "settings.appSettings", icon: Wallet, permKey: "settings.*" },
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
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [userPrefs, setUserPrefs] = useState({ theme: null, language: null });

  const [activeKey, setActiveKey] = useState("");
  const pending = useRef(new Map());
  const notify = useNotification();
  const { language, setLanguage, t, setServerTranslationsFromSettings } = useLanguage();
  const tRef = useRef(t);
  tRef.current = t;

  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);
  const [arqamStatus, setArqamStatus] = useState({ fetchedAt: null, lastError: null });
  const arqamStatusReqIdRef = useRef(null);

  const syncIncomingSettings = useCallback((nextSettings, options = {}) => {
    const normalized = nextSettings || {};
    setSettings(normalized);
    setInitialSettings(JSON.parse(JSON.stringify(normalized)));
    if (options.applyTranslations !== false) {
      setServerTranslationsFromSettings(normalized);
    }
  }, [setServerTranslationsFromSettings]);

  const sections = useMemo(() => {
    return SECTION_CONFIG.filter((s) => (s.permKey ? hasPermission(account, s.permKey) : true))
      .map((s) => ({
        ...s,
        icon: s.icon,
      }))
      .sort((a, b) => {
        const catOrder = { "User Settings": 0, "App Settings": 1 };
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

  const canManageGlobalSettings = hasPermission(account, "settings.*");

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
    setPrefsLoading(true);
    try {
      await window.api.wsConnect();
      const settingsReqId = rid();
      const prefsReqId = rid();
      const waitSettings = waitResult(settingsReqId);
      const waitPrefs = waitResult(prefsReqId);
      await Promise.all([
        window.api.wsSend({ type: "settings:get", requestId: settingsReqId }),
        window.api.wsSend({ type: "user:preferences:get", requestId: prefsReqId }),
      ]);
      const [res, prefsRes] = await Promise.all([waitSettings, waitPrefs]);

      if (!res?.ok) {
        notify?.error?.(res?.error || tRef.current("settings.loadFailed"), tRef.current("settings.title"));
      } else {
        const s = res.settings || {};
        syncIncomingSettings(s);
      }

      if (prefsRes?.ok) {
        setUserPrefs({
          theme: prefsRes?.preferences?.theme ?? null,
          language: prefsRes?.preferences?.language ?? null,
        });
      }
    } catch {
      notify?.error?.("WebSocket not connected", "Connection");
    } finally {
      setLoading(false);
      setPrefsLoading(false);
    }
  }, [notify, syncIncomingSettings, waitResult]);

  useEffect(() => {
    const unsub = window.api?.onWsMessage?.((msg) => {
      if (msg?.requestId && pending.current.has(msg.requestId)) {
        const resolve = pending.current.get(msg.requestId);
        pending.current.delete(msg.requestId);
        resolve(msg);
      }
      if (msg?.type === "settings:changed" && msg?.settings) {
        syncIncomingSettings(msg.settings);
      }
      if (msg?.type === "settings:get:result" && msg?.ok && msg?.settings) setServerTranslationsFromSettings(msg.settings);
      if (msg?.type === "maintenance:changed") setMaintenanceEnabled(msg.enabled === true);
      if (msg?.type === "arqam:credit:get:result" && msg?.requestId === arqamStatusReqIdRef.current) {
        setArqamStatus({
          fetchedAt: msg?.ok ? (msg.fetchedAt || null) : null,
          lastError: msg?.ok ? (msg.lastError || null) : (msg?.error || "forbidden"),
        });
      }
    });
    return () => unsub?.();
  }, [setServerTranslationsFromSettings, syncIncomingSettings]);

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

  useEffect(() => {
    if (activeKey !== "arqam" || !window.api?.wsSend) return;
    arqamStatusReqIdRef.current = rid();
    window.api.wsSend({ type: "arqam:credit:get", requestId: arqamStatusReqIdRef.current });
  }, [activeKey]);

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
        // appearance/language are user-side preferences (saved separately)
        arqam: {
          lowCreditAlertEnabled: !!settings?.arqam?.lowCreditAlertEnabled,
          lowCreditThreshold: Math.max(0, Number(settings?.arqam?.lowCreditThreshold) || 0),
          viewPermission: String(settings?.arqam?.viewPermission || "arqam.view").trim() || "arqam.view",
        },
        sections: {
          disabled: normalizeDisabledSections(settings?.sections?.disabled),
        },
      };

      await window.api.wsSend({ type: "settings:update", requestId, payload });
      const res = await wait;

      if (!res?.ok) {
        notify?.error?.(res?.error || tRef.current("settings.saveFailed"), tRef.current("settings.title"));
        setSaving(false);
        return;
      }

      const s = res.settings || {};
      syncIncomingSettings(s);
      notify?.success?.(tRef.current("settings.allSettingsSaved"), tRef.current("settings.title"));
    } catch {
      notify?.error?.(tRef.current("settings.sendFailed"), tRef.current("settings.title"));
    } finally {
      setSaving(false);
    }
  }, [settings, notify, syncIncomingSettings, waitResult]);

  const saveUserPrefs = useCallback(async (next) => {
    if (!window.api?.wsSend) return;
    setPrefsSaving(true);
    try {
      const requestId = rid();
      const wait = waitResult(requestId);
      await window.api.wsSend({ type: "user:preferences:update", requestId, payload: next });
      const res = await wait;
      if (!res?.ok) {
        notify?.error?.(res?.error || tRef.current("settings.saveFailed"), tRef.current("settings.title"));
        return;
      }
      setUserPrefs({
        theme: res?.preferences?.theme ?? null,
        language: res?.preferences?.language ?? null,
      });
      notify?.success?.(tRef.current("common.saved"), tRef.current("settings.title"));
    } catch {
      notify?.error?.(tRef.current("settings.sendFailed"), tRef.current("settings.title"));
    } finally {
      setPrefsSaving(false);
    }
  }, [notify, waitResult]);

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
                {activeSection.key === "appearance" && (
                  <AppearanceSection
                    settings={settings}
                    disabled={saving || loading}
                    t={t}
                    userPreferences={userPrefs}
                    savingPreference={prefsSaving || prefsLoading}
                    onSavePreference={(theme) => saveUserPrefs({ theme })}
                  />
                )}
                {activeSection.key === "language" && (
                  <LanguageSection
                    t={t}
                    language={language}
                    onLanguageChange={(lang) => {
                      setLanguage(lang);
                      void saveUserPrefs({ language: lang });
                    }}
                  />
                )}
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
                {activeSection.key === "chatControls" && (
                  <ChatControlsSection
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
                {activeSection.key === "sections" && (
                  <SectionsSection
                    settings={settings}
                    onUpdate={updateSettings}
                    loading={loading}
                    disabled={saving}
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
                {activeSection.key === "arqam" && (
                  <ArqamSection
                    settings={settings}
                    onUpdate={updateSettings}
                    loading={loading}
                    disabled={saving}
                    arqamStatus={arqamStatus}
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

              {activeSection.key !== "maintenance" &&
                (activeSection.key !== "appearance" || canManageGlobalSettings) &&
                (activeSection.key !== "language" || canManageGlobalSettings) && (
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

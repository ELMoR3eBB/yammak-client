import { useState, useMemo, useEffect } from "react";
import PaginatorSelect from "../../../components/ui/PaginatorSelect";

import enLocale from "../../../locales/en.json";
import arLocale from "../../../locales/ar.json";

export default function TranslationsSection({ settings, onUpdate, language, loading, disabled, t }) {
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
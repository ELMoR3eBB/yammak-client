import { useMemo } from "react";
import PaginatorSelect from "../../../components/ui/PaginatorSelect";

export default function LanguageSection({
  language,
  onLanguageChange,
  t,
}) {
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
import { applyAppTheme } from "../../../utils/theme";

export default function AppearanceSection({
  settings,
  disabled,
  t,
  userPreferences,
  savingPreference,
  onSavePreference,
}) {
  const globalTheme = settings?.appearance?.theme === "light" ? "light" : "dark";
  const userTheme = userPreferences?.theme === "light" ? "light" : userPreferences?.theme === "dark" ? "dark" : null;
  const effectiveTheme = userTheme || globalTheme;

  const setUserTheme = async (theme) => {
    const next = theme === "light" ? "light" : theme === "dark" ? "dark" : null;
    // Instant preview.
    applyAppTheme(next || globalTheme);
    await onSavePreference?.(next);
  };

  return (
    <div className="settingsForm">
      <div className="settingsFormBlock">
        <h3 className="settingsBlockTitle">{t("settings.appearanceTitle")}</h3>
        <p className="settingsHint">{t("settings.yourPreferenceHint")}</p>
        <div className="settingsThemeRow">
          <button
            type="button"
            className={`settingsThemeOption ${userTheme === "dark" ? "active" : ""}`}
            onClick={() => setUserTheme("dark")}
            disabled={disabled || savingPreference}
          >
            <span className="settingsThemeOptionTitle">{t("settings.themeDark")}</span>
            <span className="settingsThemeOptionSub">{t("settings.themeDarkSub")}</span>
          </button>
          <button
            type="button"
            className={`settingsThemeOption ${userTheme === "light" ? "active" : ""}`}
            onClick={() => setUserTheme("light")}
            disabled={disabled || savingPreference}
          >
            <span className="settingsThemeOptionTitle">{t("settings.themeLight")}</span>
            <span className="settingsThemeOptionSub">{t("settings.themeLightSub")}</span>
          </button>
        </div>
        <div className="settingsHint" style={{ marginTop: 10 }}>
          {t("settings.effectiveTheme")}: <b>{effectiveTheme === "light" ? t("settings.themeLight") : t("settings.themeDark")}</b>
        </div>
      </div>
    </div>
  );
}
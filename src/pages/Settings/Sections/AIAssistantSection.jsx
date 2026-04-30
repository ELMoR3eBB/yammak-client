import Switch from "../../../components/ui/Switch";


export default function AIAssistantSection({ settings, onUpdate, loading, disabled, t }) {
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
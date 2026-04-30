import Switch from "../../../components/ui/Switch";

export default function MaintenanceSection({ enabled, loading, saving, onToggle, t }) {
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
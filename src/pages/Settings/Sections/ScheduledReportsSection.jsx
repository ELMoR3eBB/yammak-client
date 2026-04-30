import Switch from "../../../components/ui/Switch";

export default function ScheduledReportsSection({ settings, onUpdate, loading, disabled, t }) {
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
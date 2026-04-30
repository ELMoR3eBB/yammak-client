import Switch from "../../../components/ui/Switch";

export default function MailerSection({ settings, initialSettings, onUpdate, loading, disabled, t }) {
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
            spellCheck={false}
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
            spellCheck={false}
          />
          <span className="settingsHint">
            {t("settings.transportDefaultHint")}
          </span>
        </div>
      </div>
    </div>
  );
}

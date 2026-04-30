import Switch from "../../../components/ui/Switch";

const DEFAULT_ARQAM_PERMISSION = "arqam.view";

export default function ArqamSection({ settings, onUpdate, loading, disabled, arqamStatus, t }) {
  const arqam = settings?.arqam || {};
  const lowCreditAlertEnabled = arqam.lowCreditAlertEnabled === true;
  const lowCreditThreshold =
    typeof arqam.lowCreditThreshold === "number" && Number.isFinite(arqam.lowCreditThreshold)
      ? arqam.lowCreditThreshold
      : 0;
  const viewPermission = String(arqam.viewPermission || "").trim() || DEFAULT_ARQAM_PERMISSION;

  const statusFetchedAt = arqamStatus?.fetchedAt ? new Date(arqamStatus.fetchedAt) : null;
  const statusFetchedLabel =
    statusFetchedAt && !Number.isNaN(statusFetchedAt.getTime())
      ? statusFetchedAt.toLocaleString()
      : "—";
  const statusErrorLabel = arqamStatus?.lastError || "none";

  if (loading) {
    return (
      <div className="settingsFormRow settingsLoading">
        <div className="settingsFormGroup">
          <span className="settingsLabel">{t("settings.arqam")}</span>
          <span className="settingsHint">{t("common.loading")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="settingsForm">
      <div className="settingsFormRow settingsFormRowSwitch">
        <div className="settingsFormGroup">
          <span className="settingsLabel">{t("settings.arqamLowCreditAlertTitle")}</span>
          <span className="settingsHint">{t("settings.arqamLowCreditAlertHint")}</span>
        </div>
        <Switch
          checked={lowCreditAlertEnabled}
          onChange={(checked) =>
            onUpdate((prev) => ({
              ...prev,
              arqam: { ...prev?.arqam, lowCreditAlertEnabled: checked },
            }))
          }
          disabled={disabled}
        />
      </div>

      <div className="settingsFormRow">
        <div className="settingsFormGroup">
          <span className="settingsLabel">{t("settings.arqamLowCreditThresholdTitle")}</span>
          <span className="settingsHint">{t("settings.arqamLowCreditThresholdHint")}</span>
        </div>
        <input
          type="number"
          min={0}
          step="1"
          className="settingsInput"
          value={lowCreditThreshold}
          onChange={(event) => {
            const n = Number(event.target.value);
            onUpdate((prev) => ({
              ...prev,
              arqam: { ...prev?.arqam, lowCreditThreshold: Number.isFinite(n) ? Math.max(0, n) : 0 },
            }));
          }}
          disabled={disabled}
        />
      </div>

      <div className="settingsFormRow">
        <div className="settingsFormGroup">
          <span className="settingsLabel">{t("settings.arqamViewPermissionTitle")}</span>
          <span className="settingsHint">{t("settings.arqamViewPermissionHint")}</span>
        </div>
        <input
          className="settingsInput"
          value={viewPermission}
          onChange={(event) =>
            onUpdate((prev) => ({
              ...prev,
              arqam: { ...prev?.arqam, viewPermission: event.target.value },
            }))
          }
          placeholder={DEFAULT_ARQAM_PERMISSION}
          disabled={disabled}
        />
      </div>

      <div className="settingsFormRow">
        <div className="settingsFormGroup">
          <span className="settingsLabel">{t("settings.arqamStatusTitle")}</span>
          <span className="settingsHint">
            {t("settings.arqamLastFetch").replace("{{time}}", statusFetchedLabel)}
            {" • "}
            {t("settings.arqamLastError").replace("{{error}}", statusErrorLabel)}
          </span>
        </div>
      </div>
    </div>
  );
}

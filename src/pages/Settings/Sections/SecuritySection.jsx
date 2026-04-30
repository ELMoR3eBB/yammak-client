import { useState, useEffect } from "react";
import Switch from "../../../components/ui/Switch";


export default function SecuritySection({ settings, onUpdate, loading, disabled, t }) {
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
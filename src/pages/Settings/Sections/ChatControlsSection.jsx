import Switch from "../../../components/ui/Switch";

const DEFAULT_LOCK_PERMISSION = "chat.global.locked.send";

export default function ChatControlsSection({ settings, onUpdate, loading, disabled, t }) {
  const locked = settings?.features?.globalChatLocked === true;
  const lockPermission = String(settings?.features?.globalChatLockedPermission || "").trim() || DEFAULT_LOCK_PERMISSION;

  const handleLockToggle = (checked) => {
    onUpdate((prev) => ({
      ...prev,
      features: {
        ...prev?.features,
        globalChatLocked: checked,
      },
    }));
  };

  const handlePermissionChange = (value) => {
    onUpdate((prev) => ({
      ...prev,
      features: {
        ...prev?.features,
        globalChatLockedPermission: value,
      },
    }));
  };

  if (loading) {
    return (
      <div className="settingsFormRow settingsLoading">
        <div className="settingsFormGroup">
          <span className="settingsLabel">{t("settings.chatControls")}</span>
          <span className="settingsHint">{t("common.loading")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="settingsForm">
      <div className="settingsFormRow settingsFormRowSwitch">
        <div className="settingsFormGroup">
          <span className="settingsLabel">{t("settings.globalChatLockTitle")}</span>
          <span className="settingsHint">{t("settings.globalChatLockHint")}</span>
        </div>
        <Switch checked={locked} onChange={handleLockToggle} disabled={disabled} />
      </div>

      <div className="settingsFormRow">
        <div className="settingsFormGroup">
          <span className="settingsLabel">{t("settings.globalChatPermissionTitle")}</span>
          <span className="settingsHint">{t("settings.globalChatPermissionHint")}</span>
        </div>
        <input
          className="settingsInput"
          value={lockPermission}
          onChange={(e) => handlePermissionChange(e.target.value)}
          placeholder={DEFAULT_LOCK_PERMISSION}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

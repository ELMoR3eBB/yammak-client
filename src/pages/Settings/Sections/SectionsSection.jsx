import React, { useCallback, useMemo } from "react";
import { SECTION_TOGGLE_DEFINITIONS, getDisabledSectionKeys, normalizeDisabledSections } from "../../../config/sections";
import Switch from "../../../components/ui/Switch";

const SectionToggleRow = React.memo(function SectionToggleRow({
  section,
  enabled,
  disabled,
  onToggle,
  t,
}) {
  const handleChange = useCallback((checked) => {
    onToggle(section.key, checked);
  }, [onToggle, section.key]);

  return (
    <div className="settingsFormRow settingsFormRowSwitch settingsSectionsRow">
      <div className="settingsFormGroup">
        <span className="settingsLabel">{t(section.titleKey)}</span>
        <span className="settingsHint">
          {enabled ? t("settings.sectionEnabledHint") : t("settings.sectionDisabledHint")}
        </span>
      </div>
      <Switch
        checked={enabled}
        onChange={handleChange}
        disabled={disabled}
      />
    </div>
  );
});

export default function SectionsSection({ settings, onUpdate, loading, disabled, t }) {
  const disabledSections = getDisabledSectionKeys(settings);
  const disabledSectionSet = useMemo(() => new Set(disabledSections), [disabledSections]);
  const toggleSection = useCallback((sectionKey, enabled) => {
    onUpdate((prev) => {
      const current = getDisabledSectionKeys(prev);
      const next = enabled
        ? current.filter((key) => key !== sectionKey)
        : [...current, sectionKey];
      return {
        ...prev,
        sections: {
          ...(prev?.sections || {}),
          disabled: normalizeDisabledSections(next),
        },
      };
    });
  }, [onUpdate]);

  if (loading) {
    return (
      <div className="settingsFormRow settingsLoading">
        <div className="settingsFormGroup">
          <span className="settingsLabel">{t("settings.sections")}</span>
          <span className="settingsHint">{t("common.loading")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="settingsForm">
      <div className="settingsFormBlock">
        <h3 className="settingsBlockTitle">{t("settings.sectionsTitle")}</h3>
        <p className="settingsHint">{t("settings.sectionsHint")}</p>

        <div className="settingsSectionsList">
          {SECTION_TOGGLE_DEFINITIONS.map((section) => {
            const enabled = !disabledSectionSet.has(section.key);
            return (
              <SectionToggleRow
                key={section.key}
                section={section}
                enabled={enabled}
                disabled={disabled}
                onToggle={toggleSection}
                t={t}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
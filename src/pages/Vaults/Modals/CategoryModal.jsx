import React from "react";
import { motion } from "framer-motion";
import { X, FolderPlus } from "lucide-react";
import { ColorPicker } from "primereact/colorpicker";
import { useLanguage } from "../../../contexts/LanguageContext";

export const CATEGORY_COLOR_PRESETS = [
  "#f59e0b",
  "#ef4444",
  "#22c55e",
  "#38bdf8",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#64748b",
];

export default function CategoryModal({
  setCategoryModalOpen,
  categoryDraft,
  setCategoryDraft,
  handleCreateCategory,
  creatingCategory,
  categories,
}) {
  const { t } = useLanguage();
  return (
    <motion.div
      className="vaultModalBackdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(event) => {
        if (event.target === event.currentTarget) setCategoryModalOpen(false);
      }}
    >
      <motion.div
        className="vaultModal vaultModal--compact"
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.98 }}
      >
        <header className="vaultModalHeader vaultModalHeader--requestLike">
          <div className="vaultModalIconWrap">
            <FolderPlus size={28} />
          </div>
          <h2 className="vaultModalTitle">{t("vault.createCategory")}</h2>
          <button
            type="button"
            className="vaultModalClose"
            onClick={() => setCategoryModalOpen(false)}
            aria-label={t("common.close")}
          >
            <X size={20} />
          </button>
        </header>

        <div className="vaultModalBody">
          <div className="vaultFormField">
            <label className="vaultFormLabel">{t("vault.categoryName")}</label>
            <input
              type="text"
              className="vaultFormInput"
              value={categoryDraft.name}
              onChange={(event) =>
                setCategoryDraft((current) => ({ ...current, name: event.target.value }))
              }
              placeholder={t("vault.categoryNamePlaceholder")}
            />
          </div>

          <div className="vaultFormField vaultColorField">
            <label className="vaultFormLabel">{t("vault.color")}</label>
            <div className="vaultColorLayout">
              <div className="vaultColorGrid">
                {CATEGORY_COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`vaultColorSwatch ${
                      categoryDraft.color === color ? "is-active" : ""
                    }`}
                    style={{ background: color }}
                    onClick={() => setCategoryDraft((current) => ({ ...current, color }))}
                    aria-label={t("vault.chooseColor").replace("{{color}}", color)}
                  />
                ))}
              </div>

              <div className="vaultColorPickerRow">
                <ColorPicker
                  value={(categoryDraft.color || CATEGORY_COLOR_PRESETS[0]).replace("#", "")}
                  onChange={(event) =>
                    setCategoryDraft((current) => ({
                      ...current,
                      color: `#${event.value}`,
                    }))
                  }
                />
              </div>
            </div>
          </div>

          <div className="vaultExistingCategories">
            <h3>{t("vault.currentCategories")}</h3>
            <div className="vaultExistingCategoryList">
              {categories.map((category) => (
                <span
                  key={category.id}
                  className="vaultCategoryBadge"
                  style={{ "--vault-category-color": category.color || "#f59e0b" }}
                >
                  <span className="vaultCategoryDot" />
                  {category.name}
                </span>
              ))}
            </div>
          </div>
        </div>

        <footer className="vaultModalFooter">
          <button
            type="button"
            className="vaultGhostButton"
            onClick={() => setCategoryModalOpen(false)}
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="vaultCategorySubmitButton"
            onClick={handleCreateCategory}
            disabled={creatingCategory}
          >
            {creatingCategory ? t("vault.saving") : t("vault.createCategory")}
          </button>
        </footer>
      </motion.div>
    </motion.div>
  );
}

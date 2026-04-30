import React, { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, KeyRound, Trash2, FolderPlus, Eye, EyeOff, Sparkles, Search, Shield, ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import { createPortal } from "react-dom";
import { useLanguage } from "../../../contexts/LanguageContext";

export const CUSTOM_FIELD_TYPES = [
  { value: "text", labelKey: "vault.fieldType.text", label: "Text" },
  { value: "password", labelKey: "vault.fieldType.password", label: "Password" },
  { value: "email", labelKey: "vault.fieldType.email", label: "Email" },
  { value: "url", labelKey: "vault.fieldType.url", label: "URL" },
  { value: "number", labelKey: "vault.fieldType.number", label: "Number" },
  { value: "textarea", labelKey: "vault.fieldType.textarea", label: "Textarea" },
];

function calculatePasswordStrength(password) {
  if (!password) {
    // Keep a small neutral fill so the bar is visible in light mode.
    return { labelKey: "vault.strengthNone", score: 0, fillPercent: 10, color: "#94a3b8" };
  }
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  const lengthFactor = Math.min(password.length / 14, 1);
  const scoreFactor = score / 5;
  const fillPercent = Math.round(100 * Math.min(1, 0.38 * lengthFactor + 0.62 * scoreFactor));

  if (score < 2) return { labelKey: "vault.strengthWeak", score, fillPercent, color: "#f87171" };
  if (score < 4) return { labelKey: "vault.strengthFair", score, fillPercent, color: "#fbbf24" };
  return { labelKey: "vault.strengthStrong", score, fillPercent, color: "#34d399" };
}

function generatePassword(length = 16) {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=";
  let retVal = "";
  for (let i = 0, n = charset.length; i < length; ++i) {
    retVal += charset.charAt(Math.floor(Math.random() * n));
  }
  return retVal;
}

export default function EditorModal({
  editor,
  setEditor,
  saving,
  handleSave,
  categories,
  setCategoryModalOpen,
  updateEditorForm,
  addCustomField,
  updateCustomField,
  removeCustomField,
}) {
  const { t } = useLanguage();
  const [showPassword, setShowPassword] = useState(false);
  const [catDropdownOpen, setCatDropdownOpen] = useState(false);
  const [catSearch, setCatSearch] = useState("");
  const catTriggerRef = useRef(null);
  const catMenuRef = useRef(null);
  const [catDropStyle, setCatDropStyle] = useState({});

  const strength = useMemo(() => calculatePasswordStrength(editor.form.password), [editor.form.password]);

  const filteredCategories = useMemo(() => {
    const q = catSearch.toLowerCase().trim();
    if (!q) return categories;
    return categories.filter(c => c.name.toLowerCase().includes(q));
  }, [categories, catSearch]);

  const selectedCategory = useMemo(() => {
    return categories.find(c => c.id === editor.form.categoryId);
  }, [categories, editor.form.categoryId]);

  const isEmailValid = useMemo(() => {
    const email = editor.form.username || "";
    if (!email) return true; // valid if empty (optional)
    return email.includes("@") && email.includes(".");
  }, [editor.form.username]);

  const handleGenPassword = () => {
    const pwd = generatePassword();
    updateEditorForm(f => ({ ...f, password: pwd }));
  };

  const toggleCatDropdown = () => {
    if (catDropdownOpen) {
      setCatDropdownOpen(false);
    } else {
      const rect = catTriggerRef.current?.getBoundingClientRect();
      if (rect) {
        setCatDropStyle({
          position: "fixed",
          top: `${rect.bottom + 5}px`,
          left: `${rect.left}px`,
          width: `${rect.width}px`,
          zIndex: 10000,
        });
      }
      setCatDropdownOpen(true);
      setCatSearch("");
    }
  };

  useEffect(() => {
    if (!catDropdownOpen) return undefined;

    const handleOutsideClick = (event) => {
      const target = event.target;
      if (catTriggerRef.current?.contains(target)) return;
      if (catMenuRef.current?.contains(target)) return;
      setCatDropdownOpen(false);
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") setCatDropdownOpen(false);
    };

    window.addEventListener("mousedown", handleOutsideClick, true);
    window.addEventListener("keydown", handleEscape, true);

    return () => {
      window.removeEventListener("mousedown", handleOutsideClick, true);
      window.removeEventListener("keydown", handleEscape, true);
    };
  }, [catDropdownOpen]);

  return (
    <motion.div
      className="vaultModalBackdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(event) => {
        if (event.target === event.currentTarget) setEditor(null);
      }}
    >
      <motion.div
        className="vaultModal vaultModal--wide"
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.98 }}
      >
        <header className="vaultModalHeader vaultModalHeader--requestLike">
          <div className="vaultModalIconWrap">
            <ShieldCheck size={28} />
          </div>
          <h2 className="vaultModalTitle">
            {editor.mode === "create" ? t("vault.createVaultEntry") : t("vault.updateAccount")}
          </h2>
          <button
            type="button"
            className="vaultModalClose"
            onClick={() => setEditor(null)}
            aria-label={t("common.close")}
          >
            <X size={20} />
          </button>
        </header>

        <div className="vaultModalBody">
          <div className="vaultFormGrid">
            <div className="vaultFormField">
              <label className="vaultFormLabel">{t("vault.platform")}</label>
              <input
                type="text"
                className="vaultFormInput"
                value={editor.form.platform}
                onChange={(event) =>
                  updateEditorForm((form) => ({ ...form, platform: event.target.value }))
                }
                placeholder={t("vault.platformPlaceholder")}
              />
            </div>

            <div className="vaultFormField">
              <label className="vaultFormLabel">{t("vault.category")}</label>
              <div className="vaultInlineField">
                <div className="vaultCustomSelectWrap" ref={catTriggerRef}>
                  <button
                    type="button"
                    className="vaultFormInput vaultCategorySelectTrigger"
                    onClick={toggleCatDropdown}
                  >
                    <span>{selectedCategory?.name || t("vault.uncategorized")}</span>
                    <Search size={14} className="vaultCategorySelectTriggerIcon" />
                  </button>
                  {typeof document !== "undefined" && document.body
                    ? createPortal(
                      <AnimatePresence>
                        {catDropdownOpen ? (
                          <motion.div
                            ref={catMenuRef}
                            className="vaultCustomSelectPortal"
                            style={catDropStyle}
                            onClick={(e) => e.stopPropagation()}
                            initial={{ opacity: 0, y: -6, scale: 0.985 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -6, scale: 0.985 }}
                            transition={{ duration: 0.16, ease: [0.2, 0.8, 0.2, 1] }}
                          >
                            <div className="vaultCustomSelectHeader">
                              <Search size={14} className="vaultCustomSelectSearchIcon" />
                              <input
                                autoFocus
                                type="text"
                                className="vaultCustomSelectSearch"
                                placeholder={t("vault.searchCategories")}
                                value={catSearch}
                                onChange={(e) => setCatSearch(e.target.value)}
                              />
                            </div>
                            <div className="vaultCustomSelectList">
                              <button
                                className={`vaultCustomSelectOption ${!editor.form.categoryId ? "is-selected" : ""}`}
                                onClick={() => { updateEditorForm(f => ({ ...f, categoryId: "" })); setCatDropdownOpen(false); }}
                              >
                                {t("vault.uncategorized")}
                              </button>
                              {filteredCategories.map(cat => (
                                <button
                                  key={cat.id}
                                  className={`vaultCustomSelectOption ${editor.form.categoryId === cat.id ? "is-selected" : ""}`}
                                  onClick={() => { updateEditorForm(f => ({ ...f, categoryId: cat.id })); setCatDropdownOpen(false); }}
                                >
                                  <span className="vaultCategoryDot" style={{ marginRight: "4px", backgroundColor: cat.color }} />
                                  {cat.name}
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>,
                      document.body
                    )
                    : null}
                </div>
                <button
                  type="button"
                  className="vaultInlineButton vaultInlineButton--accent vaultInlineButton--addCategory"
                  onClick={() => setCategoryModalOpen(true)}
                >
                  <FolderPlus size={16} />
                </button>
              </div>
            </div>

            <div className="vaultFormField">
              <label className="vaultFormLabel" style={{ display: "flex", justifyContent: "space-between" }}>
                {t("vault.usernameOrEmail")}
                {!isEmailValid && editor.form.username && <span style={{ color: "#f87171", fontSize: "10px", textTransform: "none" }}>{t("vault.invalidEmailFormat")}</span>}
              </label>
              <input
                type="text"
                className={`vaultFormInput ${!isEmailValid && editor.form.username ? "is-invalid" : ""}`}
                value={editor.form.username}
                onChange={(event) =>
                  updateEditorForm((form) => ({ ...form, username: event.target.value }))
                }
                placeholder={t("vault.usernamePlaceholder")}
              />
            </div>

            <div className="vaultFormField">
              <label className="vaultFormLabel">{t("vault.password")}</label>
              <div className="vaultPasswordControl">
                <div className="vaultPasswordField">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="vaultFormInput"
                    value={editor.form.password}
                    onChange={(event) =>
                      updateEditorForm((form) => ({ ...form, password: event.target.value }))
                    }
                    placeholder={t("vault.passwordPlaceholder")}
                    style={{ paddingRight: "46px" }}
                  />
                  <button
                    type="button"
                    className={`vaultPasswordToggle ${showPassword ? "is-on" : "is-off"}`}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    <span className="eye-swap">
                      {showPassword ? <EyeOff size={16} className="eye-icon" /> : <Eye size={16} className="eye-icon" />}
                    </span>
                  </button>
                </div>
                <button type="button" className="vaultPasswordGeneratorBtn" onClick={handleGenPassword}>
                  {t("vault.generate")}
                </button>
              </div>
              <div className="vaultPasswordStrength">
                <div className="vaultStrengthBar">
                  <div 
                    className="vaultStrengthFill" 
                    style={{ width: `${strength.fillPercent}%`, backgroundColor: strength.color }}
                  />
                </div>
                <span className="vaultStrengthLabel">{t("vault.strength")}: {t(strength.labelKey)}</span>
              </div>
            </div>

            <div className="vaultFormField vaultFormField--full">
              <label className="vaultFormLabel">{t("vault.notes")}</label>
              <textarea
                className="vaultFormInput vaultFormTextarea"
                value={editor.form.notes}
                onChange={(event) =>
                  updateEditorForm((form) => ({ ...form, notes: event.target.value }))
                }
                placeholder={t("vault.notesPlaceholder")}
              />
            </div>
          </div>

          <AnimatePresence initial={false}>
            {editor.form.platform.trim() ? (
              <motion.section
                className="vaultCustomFieldsCard"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
              >
                <div className="vaultCustomFieldsHeader">
                  <div>
                    <span className="vaultModalEyebrow">{t("vault.customFields")}</span>
                    <h3>{t("vault.customFieldsFor").replace("{{platform}}", editor.form.platform.trim())}</h3>
                  </div>
                  <button type="button" className="vaultSecondaryButton" onClick={addCustomField}>
                    <Plus size={16} />
                    {t("vault.addField")}
                  </button>
                </div>

                {editor.form.customFields.length === 0 ? (
                  <div className="vaultCustomFieldsEmpty">
                    <KeyRound size={18} />
                    <p>{t("vault.customFieldsHint")}</p>
                  </div>
                ) : (
                  <div className="vaultCustomFieldList">
                    {editor.form.customFields.map((field) => (
                      <div key={field.fieldId} className="vaultBuilderRow">
                        <div className="vaultBuilderTopRow">
                          <select
                            className="vaultFormInput"
                            value={field.type}
                            onChange={(event) =>
                              updateCustomField(field.fieldId, { type: event.target.value })
                            }
                          >
                            {CUSTOM_FIELD_TYPES.map((typeOption) => (
                              <option key={typeOption.value} value={typeOption.value}>
                                {t(typeOption.labelKey) || typeOption.label}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            className="vaultFormInput"
                            value={field.label}
                            onChange={(event) =>
                              updateCustomField(field.fieldId, { label: event.target.value })
                            }
                            placeholder={t("vault.fieldTitle")}
                          />
                          <button
                            type="button"
                            className="vaultIconButton vaultIconButton--danger"
                            onClick={() => removeCustomField(field.fieldId)}
                            aria-label={t("vault.removeField").replace("{{field}}", field.label || t("vault.customField"))}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                        <div className="vaultBuilderBottomRow">
                          <input
                            type="text"
                            className="vaultFormInput"
                            value={field.placeholder}
                            onChange={(event) =>
                              updateCustomField(field.fieldId, { placeholder: event.target.value })
                            }
                            placeholder={t("vault.inputPlaceholder")}
                          />
                          {field.type === "textarea" ? (
                            <textarea
                              className="vaultFormInput vaultFormTextarea vaultFormTextarea--compact"
                              value={field.value}
                              onChange={(event) =>
                                updateCustomField(field.fieldId, { value: event.target.value })
                              }
                              placeholder={field.placeholder || t("vault.fieldValue")}
                            />
                          ) : (
                            <input
                              type={field.type === "password" ? "text" : field.type}
                              className="vaultFormInput"
                              value={field.value}
                              onChange={(event) =>
                                updateCustomField(field.fieldId, { value: event.target.value })
                              }
                              placeholder={field.placeholder || t("vault.fieldValue")}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.section>
            ) : null}
          </AnimatePresence>
        </div>

        <footer className="vaultModalFooter">
          <button type="button" className="vaultGhostButton" onClick={() => setEditor(null)}>
            {t("common.cancel")}
          </button>
          <button 
            type="button" 
            className="vaultCategorySubmitButton" 
            onClick={handleSave} 
            disabled={saving || !isEmailValid}
          >
            {saving ? t("vault.saving") : editor.mode === "create" ? t("vault.createAccount") : t("vault.saveChanges")}
          </button>
        </footer>
      </motion.div>
    </motion.div>
  );
}

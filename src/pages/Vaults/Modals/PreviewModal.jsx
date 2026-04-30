import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { X, Pencil, Eye, Copy, EyeOff, Shield } from "lucide-react";
import { useLanguage } from "../../../contexts/LanguageContext";
import { formatDate, secretMask } from "../Vaults.jsx";

function VaultPreviewField({ label, value, notify, isSecret = false, actions = true, t }) {
  const [revealed, setRevealed] = useState(!isSecret);

  const handleCopy = useCallback(async (e) => {
    e?.stopPropagation();
    const textToCopy = value || "";
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(textToCopy);
        notify?.success?.(t("vault.copiedToClipboard").replace("{{label}}", label), t("vault.sectionTitle"));
      } else {
        throw new Error(t("vault.clipboardApiNotFound"));
      }
    } catch (err) {
      console.warn("Modern copy failed in preview, trying fallback...", err);
      try {
        const textArea = document.createElement("textarea");
        textArea.value = textToCopy;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand("copy");
        document.body.removeChild(textArea);
        if (successful) {
          notify?.success?.(t("vault.copiedToClipboard").replace("{{label}}", label), t("vault.sectionTitle"));
        }
      } catch (fallbackErr) {
        notify?.error?.(t("vault.unableToCopy").replace("{{label}}", label.toLowerCase()), t("vault.sectionTitle"));
      }
    }
  }, [label, notify, t, value]);

  return (
    <div className="vaultPreviewField">
      <label>{label}</label>
      <div className="vaultPreviewBox">
        <div className="vaultPreviewValue">
          {isSecret && !revealed ? secretMask(value) : value || "-"}
        </div>
        {actions && (
          <div className="vaultPreviewActions">
            {isSecret && (
              <button
                type="button"
                onClick={() => setRevealed((v) => !v)}
              >
                {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            )}
            <button type="button" onClick={handleCopy}>
              <Copy size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PreviewModal({ previewItem, setPreviewItem, notify, openEditModal }) {
  const { t } = useLanguage();
  return (
    <motion.div
      className="vaultModalBackdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => e.target === e.currentTarget && setPreviewItem(null)}
    >
      <motion.div
        className="vaultModal"
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.98 }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="vaultModalHeader vaultModalHeader--requestLike">
          <div className="vaultModalIconWrap vaultModalIconWrap--info">
            <Shield size={28} />
          </div>
          <h2 className="vaultModalTitle">
            {previewItem.platform}
          </h2>
          <button
            type="button"
            className="vaultModalClose"
            onClick={() => setPreviewItem(null)}
          >
            <X size={20} />
          </button>
        </header>

        <div className="vaultModalBody">
          <div className="vaultPreviewGrid">
            <VaultPreviewField
              label="Username / Email"
              value={previewItem.username}
              notify={notify}
              t={t}
            />
            <VaultPreviewField
              label={t("vault.password")}
              value={previewItem.password}
              notify={notify}
              isSecret
              t={t}
            />
            <VaultPreviewField
              label={t("vault.category")}
              value={previewItem.categoryName || t("vault.uncategorized")}
              notify={notify}
              actions={false}
              t={t}
            />
          </div>

          <div className="vaultPreviewNotes">
            <label className="vaultFormLabel">{t("vault.notes")}</label>
            <div className="vaultPreviewBox" style={{ minHeight: "80px", alignItems: "flex-start", paddingTop: "12px" }}>
              <p style={{ margin: 0, fontSize: "14px", lineHeight: "1.6", color: "var(--st-text)" }}>
                {previewItem.notes || t("vault.noNotesSaved")}
              </p>
            </div>
          </div>

          {previewItem.customFields?.length > 0 && (
            <div className="vaultAdditionalInfo">
              <h3>{t("vault.additionalInfo")}</h3>
              <div className="vaultInfoBlockList">
                {previewItem.customFields.map((field) => (
                  <div key={field.fieldId} className="vaultInfoBlock">
                    <div className="vaultInfoBlockLabel">
                      <strong>{field.label}:</strong>
                    </div>
                    <VaultPreviewField
                      label=""
                      value={field.value}
                      notify={notify}
                      isSecret={field.type === "password"}
                      t={t}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <footer className="vaultModalFooter">
          <div className="vaultModalTimestamps">
            <span>{t("vault.createdAt")}: {formatDate(previewItem.createdAt)}</span>
            <span>{t("vault.updatedAt")}: {formatDate(previewItem.updatedAt)}</span>
          </div>
          <div className="vaultModalFooterActions">
            <button type="button" className="vaultGhostButton" onClick={() => setPreviewItem(null)}>
              {t("common.close")}
            </button>
            <button
              type="button"
              className="vaultSecondaryButton"
              onClick={() => openEditModal(previewItem)}
            >
              <Pencil size={16} />
              {t("vault.editItem")}
            </button>
          </div>
        </footer>
      </motion.div>
    </motion.div>
  );
}

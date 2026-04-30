import React from "react";
import { motion } from "framer-motion";
import { X, AlertTriangle } from "lucide-react";
import { useLanguage } from "../../../contexts/LanguageContext";

export default function DeleteModal({ deleteItem, setDeleteItem, handleDelete, deleting }) {
  const { t } = useLanguage();
  return (
    <motion.div
      className="vaultModalBackdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(event) => {
        if (event.target === event.currentTarget) setDeleteItem(null);
      }}
    >
      <motion.div
        className="vaultModal vaultModal--compact"
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.98 }}
      >
        <header className="vaultModalHeader vaultModalHeader--requestLike">
          <div className="vaultModalIconWrap vaultModalIconWrap--danger">
            <AlertTriangle size={28} />
          </div>
          <h2 className="vaultModalTitle">
            {t("vault.removePlatform").replace("{{platform}}", deleteItem.platform)}
          </h2>
          <button
            type="button"
            className="vaultModalClose"
            onClick={() => setDeleteItem(null)}
            aria-label={t("common.close")}
          >
            <X size={20} />
          </button>
        </header>

        <div className="vaultModalBody">
          <p className="vaultDeleteCopy">
            {t("vault.deleteWarning")}
          </p>
        </div>

        <footer className="vaultModalFooter">
          <button type="button" className="vaultGhostButton" onClick={() => setDeleteItem(null)}>
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="vaultDangerButton"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? t("vault.deleting") : t("vault.deleteAccount")}
          </button>
        </footer>
      </motion.div>
    </motion.div>
  );
}

import { motion } from "framer-motion";

export default function VaultModalWrapper({ children, onClose, compact, wide }) {
  return (
    <motion.div
      className="vaultModalBackdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        className={`vaultModal ${compact ? "vaultModal--compact" : ""} ${wide ? "vaultModal--wide" : ""}`}
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.98 }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
export const SECTION_TOGGLE_DEFINITIONS = [
  { key: "chat", titleKey: "sidebar.chat", pageIds: ["chat"] },
  { key: "gaming", titleKey: "sidebar.gaming", pageIds: ["gaming"] },
  { key: "recordings", titleKey: "sidebar.recordings", pageIds: ["recordings"] },
  { key: "employees", titleKey: "sidebar.employees", pageIds: ["employees:list", "employees:create", "employees:edit", "employees:profile"] },
  { key: "roles", titleKey: "sidebar.roles", pageIds: ["roles:list", "roles:create", "roles:edit"] },
  { key: "holidays", titleKey: "sidebar.holidays", pageIds: ["holidays:ask", "holidays:list", "holidays:calendar"] },
  { key: "reports", titleKey: "sidebar.reports", pageIds: ["reports:submit", "reports:list"] },
  { key: "suggests", titleKey: "sidebar.suggests", pageIds: ["suggests:new", "suggests:list"] },
  { key: "drivers", titleKey: "sidebar.drivers", pageIds: ["drivers", "drivers:profile"] },
  { key: "stores", titleKey: "sidebar.stores", pageIds: ["stores", "stores:profile"] },
  { key: "cashIn", titleKey: "sidebar.cashIn", pageIds: [] },
  { key: "walletAdjust", titleKey: "settings.sectionsWalletAdjust", pageIds: [] },
  { key: "cashout", titleKey: "sidebar.cashout", pageIds: ["cashout:list", "cashout:pending"] },
  { key: "transactions", titleKey: "sidebar.transactions", pageIds: ["transactions"] },
  { key: "sync", titleKey: "sidebar.sync", pageIds: ["sync"] },
  { key: "dataEntry", titleKey: "sidebar.dataEntry", pageIds: ["dataentry:list", "dataentry:create"] },
  { key: "documents", titleKey: "sidebar.documents", pageIds: ["documents"] },
  { key: "storage", titleKey: "sidebar.storage", pageIds: ["storage"] },
  { key: "vaults", titleKey: "settings.sectionsVaults", pageIds: ["vaults"] },
  { key: "notifications", titleKey: "sidebar.notifications", pageIds: ["notifications"] },
  { key: "auditLogs", titleKey: "sidebar.auditLogs", pageIds: ["audit:list"] },
  { key: "loginAttempts", titleKey: "sidebar.loginAttempts", pageIds: ["loginAttempts"] },
  { key: "heatmap", titleKey: "sidebar.actionHeatmap", pageIds: ["heatmap"] },
  { key: "performance", titleKey: "sidebar.performance", pageIds: ["performance"] },
  { key: "hotSend", titleKey: "sidebar.hotNotification", pageIds: ["hot:send"] },
  { key: "devices", titleKey: "sidebar.deviceManagement", pageIds: ["devices"] },
];

const SECTION_KEYS = new Set(SECTION_TOGGLE_DEFINITIONS.map((section) => section.key));

export function normalizeDisabledSections(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item || "").trim()).filter((item) => SECTION_KEYS.has(item)))];
}

export function getDisabledSectionKeys(settings) {
  return normalizeDisabledSections(settings?.sections?.disabled);
}

export function isSectionDisabled(settings, sectionKey) {
  return getDisabledSectionKeys(settings).includes(sectionKey);
}

export function isSectionEnabled(settings, sectionKey) {
  return !isSectionDisabled(settings, sectionKey);
}

export function getSectionDefinition(sectionKey) {
  return SECTION_TOGGLE_DEFINITIONS.find((section) => section.key === sectionKey) || null;
}

export function getSectionKeyForPage(pageId) {
  const page = String(pageId || "").trim();
  if (!page || page === "dashboard" || page === "settings:home") return null;
  const match = SECTION_TOGGLE_DEFINITIONS.find((section) => section.pageIds.includes(page));
  return match?.key || null;
}

export function isPageDisabledBySections(settings, pageId) {
  const sectionKey = getSectionKeyForPage(pageId);
  if (!sectionKey) return false;
  return isSectionDisabled(settings, sectionKey);
}

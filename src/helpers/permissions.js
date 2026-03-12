/**
 * Permission checks using account.role.permissions from backend.
 * No frontend permission list; backend decides and sends allowedPages/sidebar.
 */

/**
 * @param {object} account - user object with account.role.permissions (string[])
 * @param {string|string[]} keyOrKeys - permission key(s); user needs at least one
 * @returns {boolean}
 */
export function hasPermission(account, keyOrKeys) {
  const perms = account?.role?.permissions || [];
  if (perms.includes("*")) return true;

  const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];

  return keys.some((need) => {
    if (!need) return false;
    if (perms.includes(need)) return true;
    const parts = String(need).split(".");
    for (let i = parts.length; i >= 1; i--) {
      const prefix = parts.slice(0, i).join(".");
      if (perms.includes(`${prefix}.*`)) return true;
    }
    return false;
  });
}

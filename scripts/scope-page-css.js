/**
 * Scopes page CSS so every selector is under the page root class.
 * Prevents CSS from one page affecting others (Option 1: scoped CSS, no split).
 * Run: node scripts/scope-page-css.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "src", "styles", "pages");

const SCOPE_MAP = {
  "dashboard/dashboard.css": ".dashboardPage",
  "audit/audit_logs.css": ".auditLogsPage",
  "suggests/suggests.css": ".suggestListPage, .newSuggestPage, .reportsListPage",
  "reports/reports_list.css": ".reportsListPage",
  "holidays/holidays.css": ".holidaysPage",
  "employees/employee_list.css": ".employeesPage",
  "employees/create_employee.css": ".createEmployeePage",
  "employees/employee_profile.css": ".employeeProfilePage",
  "roles/role_list.css": ".rolesPage",
  "roles/role_create.css": ".createRolePage",
  "settings/settings.css": ".settingsPage",
  "hot_send/hot_send.css": ".hotSendPage",
  "reports/reports_submit.css": ".reportSubmitPage",
  "devices/devices.css": ".devicesPage",
  "devices/login_attempts.css": ".devicesPage.la-page",
  "notifications/notifications.css": ".notificationsPage",
  "drivers/drivers.css": ".driversPage",
};

function scopeFileSimple(filePath, root) {
  const roots = root.split(",").map((r) => r.trim());
  const scope = roots[0];
  const multiScope = roots.length > 1;

  let css = fs.readFileSync(filePath, "utf8");
  const rootEsc = roots.map((r) => r.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const skipRegex = new RegExp(
    `^(\\s*)(${rootEsc}(\\s|::|,|\\{)|@keyframes|@media|@supports|\\.content:has)`,
    "m"
  );

  const lines = css.split("\n");
  const result = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trimStart();
    const ind = line.match(/^\s*/)[0];

    if (trimmed.startsWith("@keyframes") || trimmed.startsWith("@media") || trimmed.startsWith("@supports")) {
      result.push(line);
      i++;
      while (i < lines.length && (lines[i].includes("{") || !lines[i].trim().startsWith("}"))) {
        result.push(lines[i]);
        i++;
      }
      if (i < lines.length) result.push(lines[i]);
      i++;
      continue;
    }

    const scopeSel = (sel) => {
      const t = sel.trim();
      const alreadyScoped = roots.some((r) => t === r || t.startsWith(r + " ") || t.startsWith(r + ".") || t.startsWith(r + "::"));
      if (alreadyScoped) return t;
      if (multiScope) return roots.map((r) => r + " " + t).join(", ");
      return scope + " " + t;
    };

    if (trimmed.startsWith(".") && trimmed.includes("{") && !skipRegex.test(line)) {
      const selEnd = line.indexOf("{");
      const selector = line.slice(0, selEnd);
      const rest = line.slice(selEnd);
      const parts = selector.split(",").map((p) => p.trim()).filter(Boolean);
      const scopedParts = parts.map(scopeSel);
      result.push(ind + scopedParts.join(", ") + rest);
      i++;
      continue;
    }

    if (trimmed.startsWith(".") && !trimmed.startsWith("/*") && trimmed.includes("{") && skipRegex.test(line)) {
      result.push(line);
      i++;
      continue;
    }

    if (trimmed.startsWith(".") && !trimmed.startsWith("/*") && !trimmed.includes("{")) {
      const nextLine = lines[i + 1];
      if (nextLine && nextLine.trim().startsWith("{")) {
        const selector = line.trim();
        const parts = selector.split(",").map((p) => p.trim()).filter(Boolean);
        const scopedParts = parts.map(scopeSel);
        result.push(ind + scopedParts.join(", "));
        i++;
        result.push(lines[i]);
        i++;
        continue;
      }
    }

    result.push(line);
    i++;
  }
  return result.join("\n");
}

Object.entries(SCOPE_MAP).forEach(([relPath, root]) => {
  const fullPath = path.join(ROOT, relPath);
  if (!fs.existsSync(fullPath)) {
    console.warn("Skip (not found):", fullPath);
    return;
  }
  const scoped = scopeFileSimple(fullPath, root);
  fs.writeFileSync(fullPath, scoped, "utf8");
  console.log("Scoped:", relPath);
});

console.log("Done. If anything broke, revert with: git checkout -- src/styles/pages/");

# Backup / Revert: CSS scoping (Option 1)

This folder uses **Option 1: scoped CSS** to prevent one page’s styles from affecting others. All page CSS stays in the bundle; selectors are scoped under a page root class so they only apply when that page is mounted.

## How to revert

If scoping causes layout/visual issues and you want to go back to unscoped CSS:

1. **Using Git**  
   Restore the previous version of the `pages` (and optionally `ui`) CSS:
   ```bash
   git checkout -- Client/src/styles/pages/
   git checkout -- Client/src/styles/ui/paginator_select.css
   ```

2. **Without Git**  
   If you made a copy of `src/styles/pages/` before these changes, copy that folder back over `src/styles/pages/`.

## Scoping map

Each page CSS file is scoped under one (or more) root classes that match the page component’s root element:

| File | Scope root(s) |
|------|----------------|
| dashboard.css | `.dashboardPage` |
| audit_logs.css | `.auditLogsPage` |
| suggests.css | `.suggestListPage`, `.newSuggestPage`, `.reportsListPage` |
| reports_list.css | `.reportsListPage` |
| holidays.css | `.holidaysPage` |
| employee_list.css | `.employeesPage` |
| create_employee.css | `.createEmployeePage` |
| employee_profile.css | `.employeeProfilePage` |
| role_list.css | `.rolesPage` |
| role_create.css | `.createRolePage` |
| settings.css | `.settingsPage` |
| hot_send.css | `.hotSendPage` |
| reports_submit.css | `.reportSubmitPage` |
| devices.css | `.devicesPage` |
| login_attempts.css | `.devicesPage.la-page` |
| notifications.css | `.notificationsPage` |
| drivers.css | `.driversPage` |

`paginator_select.css` uses unique class names (e.g. `paginatorSelect*`) and is only rendered inside scoped pages, so it was left as-is.

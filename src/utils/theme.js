const THEME_KEY = "yammak_theme";

export function normalizeTheme(value) {
  return value === "light" ? "light" : "dark";
}

export function getStoredTheme() {
  try {
    return normalizeTheme(localStorage.getItem(THEME_KEY));
  } catch {
    return "dark";
  }
}

export function applyAppTheme(theme) {
  const next = normalizeTheme(theme);
  if (typeof document !== "undefined" && document.documentElement) {
    document.documentElement.setAttribute("data-theme", next);
  }
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {}
  return next;
}

export function applyThemeFromSettings(settings) {
  const theme = settings?.appearance?.theme;
  return applyAppTheme(theme);
}


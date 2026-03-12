/**
 * Base URL for public assets and variables in dev (/) and built Electron (.).
 * Use for img src, fetch(), etc. so assets load in both dev and production build.
 */
const PUBLIC_URL = process.env.PUBLIC_URL || "";

export function getAssetUrl(path) {
  const base = PUBLIC_URL ? `${PUBLIC_URL}/` : "/";
  const p = path.startsWith("/") ? path.slice(1) : path;
  return `${base}${p}`;
}

export function getVariablesUrl(path) {
  const base = PUBLIC_URL ? `${PUBLIC_URL}/` : "/";
  const p = path.startsWith("/") ? path.slice(1) : path;
  return `${base}variables/${p}`;
}

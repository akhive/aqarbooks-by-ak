/** Bump this when you deploy a notable code change. */
export const APP_VERSION = "1.31.08";
export const APP_VERSION_LABEL = "Colourful dashboard";
export const APP_NAME = "Aqar Books";

export const VERSION_META_KEY = "aqar_version_meta";

export type VersionMeta = {
  lastBackupAt?: string;
  lastBackupLabel?: string;
  lastRestoreAt?: string;
  lastRestoreLabel?: string;
  snapshotCount?: number;
};

export function loadVersionMeta(): VersionMeta {
  try {
    return JSON.parse(localStorage.getItem(VERSION_META_KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveVersionMeta(patch: VersionMeta) {
  const next = { ...loadVersionMeta(), ...patch };
  localStorage.setItem(VERSION_META_KEY, JSON.stringify(next));
  return next;
}

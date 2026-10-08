/**
 * Browser storage that never throws. Even touching `window.localStorage` can throw when site data
 * is blocked, so the area is resolved inside the try: failures read as "nothing stored".
 */
type Area = 'local' | 'session';

const resolve = (area: Area) => (area === 'local' ? window.localStorage : window.sessionStorage);

export function readStorage(key: string, area: Area = 'local'): string | null {
  try {
    return resolve(area).getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string | null, area: Area = 'local') {
  try {
    if (value == null) resolve(area).removeItem(key);
    else resolve(area).setItem(key, value);
  } catch {
    // storage unavailable
  }
}

/** JSON value from storage, or null when missing, unreadable or malformed. */
export function readJson<T>(key: string, area: Area = 'local'): T | null {
  const raw = readStorage(key, area);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown, area: Area = 'local') {
  writeStorage(key, value == null ? null : JSON.stringify(value), area);
}

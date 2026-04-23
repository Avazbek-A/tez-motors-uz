const STORAGE_KEY = "tez-motors:favorites";

function readStorage(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

function writeStorage(ids: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(new Set(ids))));
  window.dispatchEvent(new Event("tez-motors:favorites"));
}

export function getFavoriteIds(): string[] {
  return readStorage();
}

export function hasFavorite(id: string): boolean {
  return readStorage().includes(id);
}

export function toggleFavorite(id: string): string[] {
  const current = readStorage();
  const next = current.includes(id)
    ? current.filter((item) => item !== id)
    : [...current, id];
  writeStorage(next);
  return next;
}

export function setFavorites(ids: string[]) {
  writeStorage(ids);
}

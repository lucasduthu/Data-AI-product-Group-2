export type RecentItemType = "WORK" | "HOLDER" | "CONTRACT" | "GROUP";

export interface RecentItem {
  id: string;
  type: RecentItemType;
  title: string;
  subtitle?: string | null;
  badge?: string | null;
  url: string;
  timestamp: number;
}

const STORAGE_KEY_ITEMS = "korom_recent_items";
const STORAGE_KEY_SEARCHES = "korom_recent_searches";
const MAX_RECENT_ITEMS = 6;
const MAX_RECENT_SEARCHES = 5;

export function getRecentItems(): RecentItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ITEMS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.slice(0, MAX_RECENT_ITEMS);
    }
  } catch (err) {
    console.error("Erreur lecture historique récent:", err);
  }
  return [];
}

export function addRecentItem(item: Omit<RecentItem, "timestamp">): void {
  if (typeof window === "undefined") return;
  try {
    const current = getRecentItems();
    // Dédoublonner par id
    const filtered = current.filter((it) => it.id !== item.id);
    const updated: RecentItem[] = [
      {
        ...item,
        timestamp: Date.now(),
      },
      ...filtered,
    ].slice(0, MAX_RECENT_ITEMS);

    localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(updated));
  } catch (err) {
    console.error("Erreur enregistrement élément récent:", err);
  }
}

export function clearRecentItems(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY_ITEMS);
  } catch (err) {
    console.error("Erreur nettoyage historique:", err);
  }
}

export function getRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SEARCHES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.slice(0, MAX_RECENT_SEARCHES);
    }
  } catch (err) {
    console.error("Erreur lecture recherches récentes:", err);
  }
  return [];
}

export function addRecentSearch(query: string): void {
  if (typeof window === "undefined") return;
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return;
  try {
    const current = getRecentSearches();
    const filtered = current.filter((q) => q.toLowerCase() !== trimmed.toLowerCase());
    const updated = [trimmed, ...filtered].slice(0, MAX_RECENT_SEARCHES);
    localStorage.setItem(STORAGE_KEY_SEARCHES, JSON.stringify(updated));
  } catch (err) {
    console.error("Erreur enregistrement recherche récente:", err);
  }
}

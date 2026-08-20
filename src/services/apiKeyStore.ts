/**
 * Simple localStorage wrapper for persisting the OpenRouter API key client-side.
 * No server or backend required — key lives in the user's browser only.
 */


const STORAGE_KEY = "openrouter_api_key";

export const apiKeyStore = {
  get(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  },

  set(key: string): void {
    try {
      localStorage.setItem(STORAGE_KEY, key.trim());
    } catch {
      // Storage unavailable (e.g. private browsing with restrictions)
    }
  },

  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch { }
  },

  has(): boolean {
    const key = apiKeyStore.get();
    return key !== null && key.length > 0;
  },
};

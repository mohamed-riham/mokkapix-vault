/**
 * MokkaPix Vault Cache Storage Manager
 * Utilizing the official browser Cache Storage API to store favorites, API responses, and preload assets.
 */

const CACHE_NAME = 'mokkapix-vault-cache-v1';
const FAVORITES_KEY = 'https://mokkapix-vault.local/api/favorites.json';

/**
 * Open the custom MokkaPix Vault cache
 */
async function getCache(): Promise<Cache | null> {
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      return await window.caches.open(CACHE_NAME);
    } catch (e) {
      console.warn('Cache Storage is not accessible or denied:', e);
    }
  }
  return null;
}

/**
 * Save user favorite ids into Cache Storage & LocalStorage
 */
export async function saveFavoritesCache(favorites: string[]): Promise<void> {
  // Sync to localStorage as fallback
  localStorage.setItem('prompt_vault_favorites', JSON.stringify(favorites));

  const cache = await getCache();
  if (cache) {
    try {
      const response = new Response(JSON.stringify(favorites), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=31536000'
        }
      });
      await cache.put(FAVORITES_KEY, response);
    } catch (e) {
      console.warn('Could not write favorites to Cache Storage:', e);
    }
  }
}

/**
 * Load user favorites from Cache Storage, falling back to LocalStorage
 */
export async function getFavoritesCache(): Promise<string[]> {
  const cache = await getCache();
  if (cache) {
    try {
      const response = await cache.match(FAVORITES_KEY);
      if (response) {
        const data = await response.json();
        if (Array.isArray(data)) {
          return data;
        }
      }
    } catch (e) {
      console.warn('Could not read favorites from Cache Storage, falling back:', e);
    }
  }

  // Fallback to LocalStorage
  const localSaves = localStorage.getItem('prompt_vault_favorites');
  if (localSaves) {
    try {
      return JSON.parse(localSaves);
    } catch (e) {
      return [];
    }
  }
  return [];
}

/**
 * Save an API response into the Cache Storage
 */
export async function cacheApiResponse(url: string, data: any): Promise<void> {
  const cache = await getCache();
  if (cache) {
    try {
      const response = new Response(JSON.stringify(data), {
        headers: {
          'Content-Type': 'application/json',
          'X-Cached-At': new Date().toISOString()
        }
      });
      await cache.put(url, response);
    } catch (e) {
      console.warn(`Failed to cache API response for URL ${url}:`, e);
    }
  }
}

/**
 * Retrieve cached API response if available
 */
export async function getCachedApiResponse<T>(url: string): Promise<T | null> {
  const cache = await getCache();
  if (cache) {
    try {
      const response = await cache.match(url);
      if (response) {
        return await response.json() as T;
      }
    } catch (e) {
      console.warn(`Failed to read cached API response for URL ${url}:`, e);
    }
  }
  return null;
}

/**
 * Preload and cache prompt preview images in the background to ensure instantaneous layout display
 */
export async function preloadImagesInCache(imageUrls: string[]): Promise<void> {
  const cache = await getCache();
  if (!cache) return;

  // We fetch each url with low priority so it doesn't block main UI thread
  imageUrls.forEach(async (url) => {
    if (!url) return;
    try {
      // Check if already cached
      const existing = await cache.match(url);
      if (!existing) {
        const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
        if (response.ok) {
          await cache.put(url, response);
        }
      }
    } catch (e) {
      // Ignore network errors/CORS blocks during background preloading
    }
  });
}

const CACHE_PREFIX = 'biotrack-v5-';

export async function repairCachedAppFiles(): Promise<void> {
  if ('caches' in window) {
    const cacheKeys = await window.caches.keys();
    await Promise.all(
      cacheKeys
        .filter((key) => key.startsWith(CACHE_PREFIX))
        .map((key) => window.caches.delete(key)),
    );
  }

  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations.map((registration) => registration.unregister()),
    );
  }
}

import { storage } from './storage'

export const CACHE_KEYS = {
  PLACES: 'cache_places',
  EVENTS: 'cache_events',
  PROFILE: 'cache_profile',
  BOOKMARKS: 'cache_bookmarks',
  RECENT_SEARCHES: 'cache_recent_searches',
  LAST_SYNC: 'cache_last_sync',
}

const CACHE_TTL = 1000 * 60 * 30 // 30 phút

interface CacheItem<T> {
  data: T
  timestamp: number
}

export async function setCache<T>(key: string, data: T): Promise<void> {
  try {
    const item: CacheItem<T> = { data, timestamp: Date.now() }
    await storage.setItem(key, JSON.stringify(item))
  } catch (e) {
    console.warn('Cache set error:', e)
  }
}

export async function getCache<T>(key: string, ttl = CACHE_TTL): Promise<T | null> {
  try {
    const raw = await storage.getItem(key)
    if (!raw) return null

    const item: CacheItem<T> = JSON.parse(raw)
    if (Date.now() - item.timestamp > ttl) {
      await storage.removeItem(key)
      return null
    }

    return item.data
  } catch (e) {
    console.warn('Cache get error:', e)
    return null
  }
}

export async function removeCache(key: string): Promise<void> {
  try {
    await storage.removeItem(key)
  } catch (e) {
    console.warn('Cache remove error:', e)
  }
}

export async function clearAllCache(): Promise<void> {
  try {
    await Promise.all(Object.values(CACHE_KEYS).map(k => storage.removeItem(k)))
  } catch (e) {
    console.warn('Cache clear error:', e)
  }
}

export async function saveRecentSearch(query: string): Promise<void> {
  try {
    const cached = await getCache<string[]>(CACHE_KEYS.RECENT_SEARCHES, Infinity)
    const updated = [query, ...(cached ?? []).filter(s => s !== query)].slice(0, 10)
    await setCache(CACHE_KEYS.RECENT_SEARCHES, updated)
  } catch (e) {
    console.warn('Save search error:', e)
  }
}

export async function getRecentSearches(): Promise<string[]> {
  return (await getCache<string[]>(CACHE_KEYS.RECENT_SEARCHES, Infinity)) ?? []
}

export async function setLastSync(): Promise<void> {
  await storage.setItem(CACHE_KEYS.LAST_SYNC, Date.now().toString())
}

export async function getLastSync(): Promise<number> {
  const raw = await storage.getItem(CACHE_KEYS.LAST_SYNC)
  return raw ? parseInt(raw) : 0
}

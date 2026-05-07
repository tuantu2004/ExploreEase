import { useState, useEffect } from 'react'
import { getCache, setCache } from '../services/cacheService'
import { useOffline } from './useOffline'

interface UseCachedDataProps<T> {
  cacheKey: string
  fetchFn: () => Promise<T>
  ttl?: number
}

export function useCachedData<T>({
  cacheKey, fetchFn, ttl,
}: UseCachedDataProps<T>) {
  const { isOnline } = useOffline()
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fromCache, setFromCache] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)

      // Thử load từ cache trước
      const cached = await getCache<T>(cacheKey, ttl)
      if (cached) {
        setData(cached)
        setFromCache(true)
        setLoading(false)
      }

      // Nếu online → fetch fresh data
      if (isOnline) {
        try {
          const fresh = await fetchFn()
          setData(fresh)
          setFromCache(false)
          await setCache(cacheKey, fresh)
        } catch (e: any) {
          if (!cached) setError(e.message)
        }
      } else if (!cached) {
        setError('Không có kết nối mạng và không có dữ liệu offline')
      }

      setLoading(false)
    }

    load()
  }, [cacheKey, isOnline])

  return { data, loading, error, fromCache }
}
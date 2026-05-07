import { useState, useCallback } from 'react'

interface UsePaginationProps<T> {
  fetchFn: (page: number, limit: number) => Promise<T[]>
  limit?: number
}

export function usePagination<T>({ fetchFn, limit = 10 }: UsePaginationProps<T>) {
  const [data, setData] = useState<T[]>([])
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchFirst = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchFn(0, limit)
      setData(result)
      setPage(1)
      setHasMore(result.length === limit)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [fetchFn, limit])

  const fetchMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const result = await fetchFn(page, limit)
      setData(prev => [...prev, ...result])
      setPage(p => p + 1)
      setHasMore(result.length === limit)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoadingMore(false)
    }
  }, [page, limit, loadingMore, hasMore, fetchFn])

  const refresh = useCallback(async () => {
    setPage(0)
    setHasMore(true)
    setData([])
    await fetchFirst()
  }, [fetchFirst])

  return {
    data, loading, loadingMore,
    hasMore, error,
    fetchFirst, fetchMore, refresh,
  }
}
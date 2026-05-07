import { supabase } from './supabase'
import { setCache, getCache, CACHE_KEYS } from './cacheService'
import { isOnline } from './offlineService'

export interface Place {
  id: string
  name: string
  category: string
  description: string
  address: string
  lat: number
  lng: number
  images: string[]
  rating: number
  rating_count: number
  price_range: string
  opening_hours: string
  is_active: boolean
  created_at: string
}

// Lấy tất cả places — cache-first khi offline
export async function getPlaces(params?: {
  category?: string
  search?: string
  limit?: number
  offset?: number
  sortBy?: 'rating' | 'popular' | 'az'
}) {
  const online = await isOnline()

  if (online) {
    let query = supabase
      .from('places')
      .select('*')
      .eq('is_active', true)

    if (params?.category) query = query.eq('category', params.category)
    if (params?.search) query = query.ilike('name', `%${params.search}%`)

    if (params?.sortBy === 'popular') {
      query = query.order('rating_count', { ascending: false })
    } else if (params?.sortBy === 'az') {
      query = query.order('name', { ascending: true })
    } else {
      query = query.order('rating', { ascending: false })
    }

    const limit = params?.limit ?? 10
    const offset = params?.offset ?? 0
    if (params?.offset) {
      query = query.range(offset, offset + limit - 1)
    } else {
      query = query.limit(limit)
    }

    const { data, error } = await query
    if (error) throw error

    // Cache kết quả khi không có filter (trang chủ)
    if (!params?.category && !params?.search && !params?.offset) {
      await setCache(CACHE_KEYS.PLACES, data)
    }
    return data as Place[]
  }

  // Offline — trả cache
  const cached = await getCache<Place[]>(CACHE_KEYS.PLACES, Infinity)
  if (cached) return cached
  throw new Error('Không có kết nối mạng và chưa có dữ liệu cache')
}

// Lấy 1 place theo ID — cache theo ID riêng
export async function getPlaceById(id: string) {
  const cacheKey = `${CACHE_KEYS.PLACES}_${id}`
  const online = await isOnline()

  if (online) {
    const { data, error } = await supabase
      .from('places')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw error
    await setCache(cacheKey, data)
    return data as Place
  }

  const cached = await getCache<Place>(cacheKey, Infinity)
  if (cached) return cached

  // Thử tìm trong cache danh sách
  const list = await getCache<Place[]>(CACHE_KEYS.PLACES, Infinity)
  const found = list?.find(p => p.id === id)
  if (found) return found

  throw new Error('Không có kết nối mạng')
}

// Lấy places gần đây
export async function getNearbyPlaces(lat: number, lng: number, limit = 10) {
  const online = await isOnline()

  if (online) {
    const { data, error } = await supabase
      .from('places')
      .select('*')
      .eq('is_active', true)
      .limit(limit)
    if (error) throw error
    return data as Place[]
  }

  const cached = await getCache<Place[]>(CACHE_KEYS.PLACES, Infinity)
  return (cached ?? []).slice(0, limit)
}

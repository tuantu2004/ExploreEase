import { supabase } from './supabase'
import { setCache, getCache, CACHE_KEYS } from './cacheService'
import { isOnline } from './offlineService'

export interface Event {
  id: string
  title: string
  category: string
  description: string
  location: string
  lat: number
  lng: number
  start_date: string
  end_date: string
  price: number
  image: string
  status: string
  is_approved: boolean
  creator_id: string
  attendee_count: number
  max_attendees: number
  rating?: number
  rating_count?: number
  created_at: string
}

// Lấy tất cả events — cache-first khi offline
export async function getEvents(params?: {
  category?: string
  status?: string
  search?: string
  limit?: number
  offset?: number
}) {
  const online = await isOnline()

  if (online) {
    let query = supabase
      .from('events')
      .select('*')
      .eq('is_approved', true)
      .order('start_date', { ascending: true })

    if (params?.category && params.category !== 'Tất cả') {
      query = query.eq('category', params.category)
    }
    if (params?.status) query = query.eq('status', params.status)
    if (params?.search) query = query.ilike('title', `%${params.search}%`)
    if (params?.limit) query = query.limit(params.limit)

    const { data, error } = await query
    if (error) throw error

    if (!params?.category && !params?.search) {
      await setCache(CACHE_KEYS.EVENTS, data)
    }
    return data as Event[]
  }

  const cached = await getCache<Event[]>(CACHE_KEYS.EVENTS, Infinity)
  if (cached) return cached
  throw new Error('Không có kết nối mạng và chưa có dữ liệu cache')
}

// Lấy 1 event theo ID
export async function getEventById(id: string) {
  const cacheKey = `${CACHE_KEYS.EVENTS}_${id}`
  const online = await isOnline()

  if (online) {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw error
    await setCache(cacheKey, data)
    return data as Event
  }

  const cached = await getCache<Event>(cacheKey, Infinity)
  if (cached) return cached

  const list = await getCache<Event[]>(CACHE_KEYS.EVENTS, Infinity)
  const found = list?.find(e => e.id === id)
  if (found) return found

  throw new Error('Không có kết nối mạng')
}

// Đếm số người tham gia thật từ DB
export async function getAttendeeCount(eventId: string): Promise<number> {
  const { count, error } = await supabase
    .from('event_attendees')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId)
  if (error) throw error
  return count ?? 0
}

// Lấy danh sách events kèm số người thật từ event_attendees
export async function getEventsWithCount(params?: {
  category?: string
  limit?: number
  offset?: number
}) {
  let query = supabase
    .from('events')
    .select(`*, event_attendees(count)`)
    .eq('is_approved', true)
    .order('start_date', { ascending: true })

  if (params?.category) query = query.eq('category', params.category)
  if (params?.limit) query = query.limit(params.limit)

  const { data, error } = await query
  if (error) throw error

  return data.map((e: any) => ({
    ...e,
    attendee_count: e.event_attendees?.[0]?.count ?? 0,
  })) as Event[]
}

// Tạo event mới
export async function createEvent(event: Partial<Event>) {
  const { data, error } = await supabase
    .from('events')
    .insert(event)
    .select()
    .single()
  if (error) throw error
  return data as Event
}

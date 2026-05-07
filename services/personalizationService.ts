import { supabase } from './supabase'
import { getPlaces, Place } from './placeService'
import { calculateDistance } from '../utils/distance'
import { Coordinates } from './locationService'
import { getSuggestions } from './gemini'

/* ─── Time context ───────────────────────────────────────────────────────── */

const TIME_BOOST_MAP: Record<string, string[]> = {
  breakfast: ['Ẩm thực'],
  lunch:     ['Ẩm thực'],
  afternoon: ['Văn hóa', 'Mua sắm'],
  dinner:    ['Ẩm thực', 'Về đêm'],
  night:     ['Về đêm'],
}

function getTimeKey(hour: number): string {
  if (hour >= 6 && hour < 10) return 'breakfast'
  if (hour >= 10 && hour < 14) return 'lunch'
  if (hour >= 14 && hour < 18) return 'afternoon'
  if (hour >= 18 && hour < 21) return 'dinner'
  return 'night'
}

export function getContextLabel(hour: number): string {
  if (hour >= 6 && hour < 10) return 'buổi sáng'
  if (hour >= 10 && hour < 14) return 'buổi trưa'
  if (hour >= 14 && hour < 18) return 'buổi chiều'
  if (hour >= 18 && hour < 21) return 'buổi tối'
  return 'ban đêm'
}

/* ─── Travel style ───────────────────────────────────────────────────────── */

type TravelStyle = 'solo' | 'couple' | 'family' | 'group'

const STYLE_BOOST: Record<TravelStyle, string[]> = {
  solo:   [],
  family: ['Thiên nhiên', 'Văn hóa'],
  couple: ['Ẩm thực', 'Văn hóa'],
  group:  ['Ẩm thực', 'Phiêu lưu'],
}

const STYLE_EXCLUDE: Record<TravelStyle, string[]> = {
  solo:   [],
  couple: [],
  family: ['Về đêm'],
  group:  [],
}

/* ─── Types ──────────────────────────────────────────────────────────────── */

export interface PersonalizedResult {
  place: Place
  score: number
  reason: string
}

export interface AIRecommendation {
  places: Array<{ name: string; category: string; reason: string }>
  reason: string
}

export interface ActivityAction {
  type: 'view' | 'bookmark' | 'review' | 'search'
  targetId: string
  targetType: 'place' | 'event'
  metadata?: Record<string, unknown>
}

/* ─── getPersonalizedPlaces ──────────────────────────────────────────────── */

export async function getPersonalizedPlaces(
  userId: string | null,
  location: Coordinates | null,
  limit = 10,
): Promise<PersonalizedResult[]> {
  const places = await getPlaces({ limit: 50 })

  let interests: string[] = []
  let travelStyle: TravelStyle = 'solo'

  if (userId) {
    const { data: pref } = await supabase
      .from('user_preferences')
      .select('interests')
      .eq('user_id', userId)
      .maybeSingle()
    if (Array.isArray(pref?.interests)) interests = pref.interests as string[]

    const { data: profile } = await supabase
      .from('profiles')
      .select('travel_style')
      .eq('id', userId)
      .maybeSingle()
    if (profile?.travel_style) travelStyle = profile.travel_style as TravelStyle
  }

  const hour = new Date().getHours()
  const timeBoost = TIME_BOOST_MAP[getTimeKey(hour)] ?? []
  const styleBoost = STYLE_BOOST[travelStyle]
  const styleExclude = STYLE_EXCLUDE[travelStyle]

  const results: PersonalizedResult[] = places
    .filter(p => !styleExclude.includes(p.category))
    .map(place => {
      const dist = location
        ? calculateDistance(location, { latitude: place.lat || 0, longitude: place.lng || 0 })
        : 5
      const distScore = dist > 0 ? 1 / dist : 1

      let score = place.rating * 0.6 + distScore * 0.4
      let reason = ''

      if (interests.length > 0) {
        const matched = interests.find(i =>
          place.category.toLowerCase().includes(i.toLowerCase()) ||
          place.name.toLowerCase().includes(i.toLowerCase())
        )
        if (matched) {
          score += 0.5
          reason = matched
        }
      }

      if (timeBoost.includes(place.category)) score += 0.3
      if (styleBoost.includes(place.category)) score += 0.2

      return { place, score, reason }
    })

  return results.sort((a, b) => b.score - a.score).slice(0, limit)
}

/* ─── getSimilarPlaces ───────────────────────────────────────────────────── */

export async function getSimilarPlaces(placeId: string, limit = 5): Promise<Place[]> {
  const { data: current } = await supabase
    .from('places')
    .select('category')
    .eq('id', placeId)
    .maybeSingle()

  if (!current) return []

  const { data } = await supabase
    .from('places')
    .select('*')
    .eq('category', current.category as string)
    .eq('is_active', true)
    .neq('id', placeId)
    .order('rating', { ascending: false })
    .limit(limit)

  return (data as Place[]) ?? []
}

/* ─── trackUserActivity ──────────────────────────────────────────────────── */

export async function trackUserActivity(
  userId: string,
  action: ActivityAction,
): Promise<void> {
  try {
    await supabase.from('user_activity').insert({
      user_id: userId,
      action_type: action.type,
      target_id: action.targetId,
      target_type: action.targetType,
      metadata: action.metadata ?? {},
    })
  } catch (e) {
    console.error('trackUserActivity error:', e)
  }
}

/* ─── getAIRecommendations ───────────────────────────────────────────────── */

interface WeatherResponse {
  current_weather?: { weathercode: number }
}


export async function getAIRecommendations(
  userId: string | null,
  location: Coordinates | null,
): Promise<AIRecommendation> {
  let interests: string[] = []
  let travelStyle = 'solo'

  if (userId) {
    const { data: pref } = await supabase
      .from('user_preferences')
      .select('interests')
      .eq('user_id', userId)
      .maybeSingle()
    if (Array.isArray(pref?.interests)) interests = pref.interests as string[]

    const { data: profile } = await supabase
      .from('profiles')
      .select('travel_style')
      .eq('id', userId)
      .maybeSingle()
    if (profile?.travel_style) travelStyle = profile.travel_style as string
  }

  const hour = new Date().getHours()
  const timeLabel = getContextLabel(hour)

  let weatherDesc = 'không xác định'
  if (location) {
    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?` +
        `latitude=${location.latitude}&longitude=${location.longitude}` +
        `&current_weather=true&timezone=Asia/Ho_Chi_Minh`
      )
      const data = (await res.json()) as WeatherResponse
      const code = data.current_weather?.weathercode ?? -1
      if (code <= 1) weatherDesc = 'trời đẹp'
      else if (code <= 48) weatherDesc = 'có mây'
      else if (code <= 67) weatherDesc = 'mưa nhỏ'
      else weatherDesc = 'mưa lớn'
    } catch { /* ignore */ }
  }

  try {
    const result = await getSuggestions({
      interests: interests.length > 0 ? interests : ['Ẩm thực'],
      travelStyle,
      location: location ? `${location.latitude},${location.longitude}` : 'TP. Hồ Chí Minh',
    })
    return {
      places: (result.places ?? []).slice(0, 3).map((p: any) => ({
        name: p.name,
        category: p.category,
        reason: p.reason ?? p.description ?? '',
      })),
      reason: `Gợi ý ${timeLabel} • thời tiết ${weatherDesc}`,
    }
  } catch {
    return { places: [], reason: `Gợi ý ${timeLabel} dành cho bạn` }
  }
}

/* ─── getContextualGreeting ──────────────────────────────────────────────── */

export function getContextualGreeting(travelStyle: TravelStyle, hour: number): string {
  const styleMap: Record<TravelStyle, string> = {
    solo:   'Khám phá một mình',
    couple: 'Hẹn hò đôi',
    family: 'Gia đình vui vẻ',
    group:  'Nhóm bạn thân',
  }
  return `${styleMap[travelStyle]} • ${getContextLabel(hour)}`
}

/* ─── Vector similarity (TF-IDF cosine) ──────────────────────────────────── */

function buildTF(text: string): Record<string, number> {
  const tokens = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1)
  const freq: Record<string, number> = {}
  tokens.forEach(t => { freq[t] = (freq[t] || 0) + 1 })
  return freq
}

function cosineSim(a: Record<string, number>, b: Record<string, number>): number {
  let dot = 0, magA = 0, magB = 0
  for (const k of Object.keys(a)) { dot += (a[k] || 0) * (b[k] || 0); magA += a[k] ** 2 }
  for (const k of Object.keys(b)) magB += b[k] ** 2
  return magA === 0 || magB === 0 ? 0 : dot / (Math.sqrt(magA) * Math.sqrt(magB))
}

export async function getPlacesSimilarToLiked(
  userId: string,
  location: Coordinates | null,
  limit = 8,
): Promise<{ places: Place[]; basedOn: string[] }> {
  const { data: bookmarks } = await supabase
    .from('bookmarks')
    .select('target_id')
    .eq('user_id', userId)
    .eq('target_type', 'place')
    .limit(10)

  if (!bookmarks?.length) return { places: [], basedOn: [] }

  const ids = bookmarks.map((b: any) => b.target_id)

  const { data: likedPlaces } = await supabase
    .from('places')
    .select('id, name, category, description')
    .in('id', ids)

  if (!likedPlaces?.length) return { places: [], basedOn: [] }

  // Build combined vector from all liked places
  const likedText = likedPlaces
    .map((p: any) => `${p.name} ${p.category} ${p.description ?? ''}`)
    .join(' ')
  const likedVec = buildTF(likedText)

  // Fetch candidates (exclude already liked)
  const { data: candidates } = await supabase
    .from('places')
    .select('*')
    .eq('is_active', true)
    .not('id', 'in', `(${ids.join(',')})`)
    .order('rating', { ascending: false })
    .limit(60)

  if (!candidates) return { places: [], basedOn: [] }

  const scored = (candidates as Place[]).map(p => {
    const placeVec = buildTF(`${p.name} ${p.category} ${p.description ?? ''}`)
    const textSim = cosineSim(likedVec, placeVec)
    const distScore = location
      ? 1 / (1 + calculateDistance(location, { latitude: p.lat || 0, longitude: p.lng || 0 }))
      : 0
    return { place: p, score: textSim * 0.6 + (p.rating / 5) * 0.3 + distScore * 0.1 }
  })

  scored.sort((a, b) => b.score - a.score)

  return {
    places: scored.slice(0, limit).map(s => s.place),
    basedOn: (likedPlaces as any[]).slice(0, 3).map((p: any) => p.name),
  }
}

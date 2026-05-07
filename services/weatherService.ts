export type WeatherCondition = 'sunny' | 'cloudy' | 'rainy' | 'stormy' | 'unknown'
export type TimeSlot = 'morning' | 'afternoon' | 'evening' | 'night'
export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

export interface WeatherContext {
  condition: WeatherCondition
  temperature: number
  emoji: string
  label: string
}

// WMO weather codes → condition
function codeToCondition(code: number): WeatherCondition {
  if (code <= 2)  return 'sunny'
  if (code <= 48) return 'cloudy'
  if (code <= 82) return 'rainy'
  if (code >= 95) return 'stormy'
  return 'cloudy'
}

const WEATHER_META: Record<WeatherCondition, { emoji: string; label: string }> = {
  sunny:   { emoji: '☀️', label: 'Nắng đẹp' },
  cloudy:  { emoji: '⛅', label: 'Có mây' },
  rainy:   { emoji: '🌧️', label: 'Có mưa' },
  stormy:  { emoji: '⛈️', label: 'Giông bão' },
  unknown: { emoji: '🌡️', label: 'Thời tiết' },
}

// Category score boost by weather condition
export const WEATHER_BOOST: Record<WeatherCondition, Record<string, number>> = {
  sunny:   { 'Thiên nhiên': 1.2, 'Phiêu lưu': 1.0, 'Mua sắm': 0.2 },
  cloudy:  { 'Văn hóa': 0.4, 'Ẩm thực': 0.3, 'Thiên nhiên': 0.3 },
  rainy:   { 'Ẩm thực': 1.2, 'Văn hóa': 1.0, 'Mua sắm': 0.8 },
  stormy:  { 'Ẩm thực': 1.2, 'Văn hóa': 1.0 },
  unknown: {},
}

// Category score boost by time slot
export const TIME_BOOST: Record<TimeSlot, Record<string, number>> = {
  morning:   { 'Ẩm thực': 1.0, 'Thiên nhiên': 0.8 },
  afternoon: { 'Mua sắm': 1.0, 'Văn hóa': 0.8, 'Phiêu lưu': 0.5 },
  evening:   { 'Ẩm thực': 1.0, 'Về đêm': 0.8 },
  night:     { 'Về đêm': 1.2, 'Ẩm thực': 0.5 },
}

// Vietnam seasonal boost
export const SEASON_BOOST: Record<Season, Record<string, number>> = {
  spring:  { 'Văn hóa': 1.0, 'Thiên nhiên': 0.8 },   // Feb-Apr: lễ hội, hoa nở
  summer:  { 'Phiêu lưu': 1.0, 'Thiên nhiên': 0.8 },  // May-Aug: biển, ngoài trời
  autumn:  { 'Văn hóa': 0.8, 'Ẩm thực': 1.0 },        // Sep-Nov: du lịch cao điểm
  winter:  { 'Ẩm thực': 1.0, 'Mua sắm': 0.8, 'Văn hóa': 0.6 }, // Dec-Jan: Tết
}

export const TIME_META: Record<TimeSlot, { emoji: string; label: string }> = {
  morning:   { emoji: '🌅', label: 'Buổi sáng' },
  afternoon: { emoji: '☀️', label: 'Buổi chiều' },
  evening:   { emoji: '🌆', label: 'Buổi tối' },
  night:     { emoji: '🌙', label: 'Ban đêm' },
}

export const SEASON_META: Record<Season, { emoji: string; label: string }> = {
  spring: { emoji: '🌸', label: 'Mùa Xuân' },
  summer: { emoji: '🌞', label: 'Mùa Hè' },
  autumn: { emoji: '🍂', label: 'Mùa Thu' },
  winter: { emoji: '❄️', label: 'Mùa Đông' },
}

export function getTimeSlot(hour = new Date().getHours()): TimeSlot {
  if (hour >= 6  && hour < 11) return 'morning'
  if (hour >= 11 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 22) return 'evening'
  return 'night'
}

// Vietnam climate: 2 main seasons but mapped to 4
export function getCurrentSeason(month = new Date().getMonth() + 1): Season {
  if (month >= 2 && month <= 4) return 'spring'
  if (month >= 5 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'autumn'
  return 'winter' // Dec, Jan
}

export async function fetchWeather(lat: number, lng: number): Promise<WeatherContext> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 6000)

    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lng}` +
      `&current=weathercode,temperature_2m` +
      `&timezone=Asia%2FHo_Chi_Minh`,
      { signal: controller.signal }
    )
    clearTimeout(timeoutId)

    const data = await res.json()
    const code: number = data.current?.weathercode ?? -1
    const temp: number = Math.round(data.current?.temperature_2m ?? 30)
    const condition: WeatherCondition = code >= 0 ? codeToCondition(code) : 'unknown'

    return {
      condition,
      temperature: temp,
      emoji: WEATHER_META[condition].emoji,
      label: `${WEATHER_META[condition].label} ${temp}°C`,
    }
  } catch {
    return { condition: 'unknown', temperature: 30, emoji: '🌡️', label: 'Thời tiết' }
  }
}

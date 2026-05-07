import { useState, useEffect } from 'react'
import { Place } from '../services/placeService'
import {
  fetchWeather, getTimeSlot, getCurrentSeason,
  WEATHER_BOOST, TIME_BOOST, SEASON_BOOST,
  TIME_META, SEASON_META,
  WeatherContext, TimeSlot, Season,
} from '../services/weatherService'

export interface ContextState {
  timeSlot: TimeSlot
  season: Season
  weather: WeatherContext | null
  weatherLoading: boolean
  // active toggles (user can turn off each)
  timeActive: boolean
  weatherActive: boolean
  seasonActive: boolean
}

export function useContextFilter(lat?: number | null, lng?: number | null) {
  const [timeSlot] = useState<TimeSlot>(() => getTimeSlot())
  const [season] = useState<Season>(() => getCurrentSeason())
  const [weather, setWeather] = useState<WeatherContext | null>(null)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [timeActive, setTimeActive] = useState(true)
  const [weatherActive, setWeatherActive] = useState(true)
  const [seasonActive, setSeasonActive] = useState(true)

  // Fetch real weather khi có location
  useEffect(() => {
    if (!lat || !lng) return
    setWeatherLoading(true)
    fetchWeather(lat, lng)
      .then(setWeather)
      .finally(() => setWeatherLoading(false))
  }, [lat, lng])

  // Tính context score boost cho một place
  const getContextScore = (category: string): number => {
    let boost = 0
    if (timeActive) {
      boost += TIME_BOOST[timeSlot][category] ?? 0
    }
    if (weatherActive && weather && weather.condition !== 'unknown') {
      boost += WEATHER_BOOST[weather.condition][category] ?? 0
    }
    if (seasonActive) {
      boost += SEASON_BOOST[season][category] ?? 0
    }
    return boost
  }

  // Sort places theo context score (kết hợp với rating gốc)
  const applyContextFilter = (places: Place[]): Place[] => {
    if (!timeActive && !weatherActive && !seasonActive) return places
    return [...places].sort((a, b) => {
      const scoreA = a.rating + getContextScore(a.category)
      const scoreB = b.rating + getContextScore(b.category)
      return scoreB - scoreA
    })
  }

  // Badge text cho từng chip
  const timeMeta  = TIME_META[timeSlot]
  const seasonMeta = SEASON_META[season]
  const weatherMeta = weather ?? { emoji: '🌡️', label: 'Đang tải...' }

  return {
    // context state
    timeSlot, season, weather, weatherLoading,
    // chip meta
    timeMeta, seasonMeta, weatherMeta,
    // toggles
    timeActive, setTimeActive,
    weatherActive, setWeatherActive,
    seasonActive, setSeasonActive,
    // filter fn
    applyContextFilter,
    getContextScore,
    // whether any context is active
    hasActiveContext: timeActive || weatherActive || seasonActive,
  }
}

import { useState, useEffect, useCallback } from 'react'
import {
  getPersonalizedPlaces,
  getSimilarPlaces as fetchSimilarPlaces,
  getAIRecommendations,
  getContextLabel,
  PersonalizedResult,
  AIRecommendation,
} from '../services/personalizationService'
import { Place } from '../services/placeService'
import { useAuthStore } from '../stores/useAuthStore'
import { useLocation } from './useLocation'

interface UsePersonalizationReturn {
  personalizedPlaces: PersonalizedResult[]
  similarPlaces: (placeId: string) => Promise<Place[]>
  aiRecommendations: AIRecommendation | null
  loading: boolean
  contextLabel: string
}

export function usePersonalization(): UsePersonalizationReturn {
  const [personalizedPlaces, setPersonalizedPlaces] = useState<PersonalizedResult[]>([])
  const [aiRecommendations, setAiRecommendations] = useState<AIRecommendation | null>(null)
  const [loading, setLoading] = useState(true)

  const user = useAuthStore(s => s.user)
  const { location } = useLocation()

  const contextLabel = `Gợi ý ${getContextLabel(new Date().getHours())} cho bạn`

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const coords = location
          ? { latitude: location.latitude, longitude: location.longitude }
          : null

        const [places, ai] = await Promise.all([
          getPersonalizedPlaces(user?.id ?? null, coords, 10),
          getAIRecommendations(user?.id ?? null, coords),
        ])

        if (!cancelled) {
          setPersonalizedPlaces(places)
          setAiRecommendations(ai)
        }
      } catch (e) {
        console.error('usePersonalization error:', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [user?.id, location?.latitude, location?.longitude])

  const similarPlaces = useCallback(
    (placeId: string): Promise<Place[]> => fetchSimilarPlaces(placeId),
    []
  )

  return { personalizedPlaces, similarPlaces, aiRecommendations, loading, contextLabel }
}

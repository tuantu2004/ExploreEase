import { useState } from 'react'
import { getSuggestions } from '@/services/gemini'

export function useGemini() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const suggest = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getSuggestions({
        interests: ['ẩm thực', 'văn hóa'],
        travelStyle: 'solo',
        location: 'TP. Hồ Chí Minh',
      })
      return result
    } catch (err) {
      setError('Không thể kết nối Gemini')
      return null
    } finally {
      setLoading(false)
    }
  }

  return { suggest, loading, error }
}
import React, { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { getSimilarPlaces } from '../../services/personalizationService'
import { Place } from '../../services/placeService'

const CAT_COLOR: Record<string, string> = {
  'Ẩm thực': '#F97316', 'Văn hóa': '#8B5CF6',
  'Mua sắm': '#EC4899', 'Thiên nhiên': '#22C55E',
  'Phiêu lưu': '#EF4444',
}
const CAT_EMOJI: Record<string, string> = {
  'Ẩm thực': '🍜', 'Văn hóa': '🏛️',
  'Mua sắm': '🛍️', 'Thiên nhiên': '🌿',
  'Phiêu lưu': '🧗',
}

interface Props {
  placeId: string
}

export default function SimilarPlaces({ placeId }: Props) {
  const [places, setPlaces] = useState<Place[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!placeId) { setLoading(false); return }
    getSimilarPlaces(placeId, 6)
      .then(setPlaces)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [placeId])

  if (loading) {
    return (
      <View style={s.section}>
        <Text style={s.title}>🔍 Bạn cũng có thể thích</Text>
        <ActivityIndicator size="small" color="#2563EB" style={{ marginTop: 16 }} />
      </View>
    )
  }

  if (places.length === 0) return null

  return (
    <View style={s.section}>
      <Text style={s.title}>🔍 Bạn cũng có thể thích</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.list}
      >
        {places.map(place => {
          const color = CAT_COLOR[place.category] ?? '#2563EB'
          const emoji = CAT_EMOJI[place.category] ?? '🗺️'
          return (
            <TouchableOpacity
              key={place.id}
              style={s.card}
              onPress={() => router.push(`/place/${place.id}`)}
              activeOpacity={0.85}
            >
              <View style={[s.cardImage, { backgroundColor: color + '1A' }]}>
                <Text style={s.cardEmoji}>{emoji}</Text>
              </View>
              <Text style={s.cardName} numberOfLines={2}>{place.name}</Text>
              <Text style={s.cardRating}>⭐ {place.rating?.toFixed(1)}</Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  section: { marginBottom: 16 },
  title: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 12 },
  list: { gap: 12, paddingTop: 4 },
  card: {
    width: 120, backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  cardImage: { height: 80, justifyContent: 'center', alignItems: 'center' },
  cardEmoji: { fontSize: 28 },
  cardName: {
    fontSize: 12, fontWeight: '600', color: '#0F172A',
    padding: 8, paddingBottom: 2, lineHeight: 16,
  },
  cardRating: { fontSize: 11, color: '#F59E0B', paddingHorizontal: 8, paddingBottom: 8 },
})

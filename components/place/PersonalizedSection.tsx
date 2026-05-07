import React from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native'
import { router } from 'expo-router'
import { PersonalizedResult } from '../../services/personalizationService'

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
  results: PersonalizedResult[]
  contextLabel: string
  loading: boolean
}

export default function PersonalizedSection({ results, contextLabel, loading }: Props) {
  return (
    <View style={s.section}>
      <View style={s.header}>
        <View>
          <Text style={s.title}>✨ Gợi ý cho bạn</Text>
          <Text style={s.subtitle}>{contextLabel}</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/search')}>
          <Text style={s.seeAll}>Xem tất cả →</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.list}>
          {[1, 2, 3].map(i => (
            <View key={i} style={s.shimmerCard}>
              <View style={s.shimmerBanner} />
              <View style={s.shimmerBody}>
                <View style={s.shimmerLine} />
                <View style={[s.shimmerLine, { width: 64 }]} />
              </View>
            </View>
          ))}
        </ScrollView>
      ) : results.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>✨</Text>
          <Text style={s.emptyText}>Chưa có gợi ý cá nhân hóa</Text>
          <Text style={s.emptyHint}>Thêm sở thích trong hồ sơ để nhận gợi ý tốt hơn</Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.list}
        >
          {results.map(({ place, reason }) => {
            const color = CAT_COLOR[place.category] ?? '#2563EB'
            const emoji = CAT_EMOJI[place.category] ?? '🗺️'
            return (
              <TouchableOpacity
                key={place.id}
                style={s.card}
                onPress={() => router.push(`/place/${place.id}`)}
                activeOpacity={0.85}
              >
                <View style={[s.cardBanner, { backgroundColor: color + '1A' }]}>
                  <Text style={s.cardEmoji}>{emoji}</Text>
                </View>
                <View style={s.cardBody}>
                  <Text style={s.cardName} numberOfLines={2}>{place.name}</Text>
                  <View style={[s.catBadge, { backgroundColor: color + '1A' }]}>
                    <Text style={[s.catText, { color }]}>{place.category}</Text>
                  </View>
                  <Text style={s.cardRating}>⭐ {place.rating?.toFixed(1)}</Text>
                  {reason ? (
                    <Text style={s.reasonLabel} numberOfLines={1}>
                      Vì bạn thích {reason}
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  section: { marginTop: 20 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', paddingHorizontal: 16, marginBottom: 12,
  },
  title: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  subtitle: { fontSize: 12, color: '#64748B', marginTop: 2 },
  seeAll: { fontSize: 13, color: '#2563EB', fontWeight: '600' },

  list: { paddingHorizontal: 16, gap: 12 },

  card: {
    width: 148, backgroundColor: '#fff', borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  cardBanner: { height: 88, justifyContent: 'center', alignItems: 'center' },
  cardEmoji: { fontSize: 36 },
  cardBody: { padding: 10 },
  cardName: {
    fontSize: 13, fontWeight: '700', color: '#0F172A',
    marginBottom: 6, lineHeight: 18,
  },
  catBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 6, marginBottom: 5,
  },
  catText: { fontSize: 10, fontWeight: '600' },
  cardRating: { fontSize: 11, color: '#F59E0B', fontWeight: '600' },
  reasonLabel: {
    fontSize: 10, color: '#7C3AED', fontWeight: '500',
    marginTop: 5, fontStyle: 'italic',
  },

  // Shimmer
  shimmerCard: {
    width: 148, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  shimmerBanner: { height: 88, backgroundColor: '#F1F5F9' },
  shimmerBody: { padding: 10, gap: 8 },
  shimmerLine: { height: 10, borderRadius: 5, backgroundColor: '#F1F5F9', width: '80%' },

  // Empty
  empty: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24 },
  emptyIcon: { fontSize: 36, marginBottom: 8 },
  emptyText: { fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 4 },
  emptyHint: { fontSize: 12, color: '#94A3B8', textAlign: 'center', lineHeight: 18 },
})

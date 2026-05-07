import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { getRecentSearches, removeCache, CACHE_KEYS } from '../services/cacheService'

export default function HistoryScreen() {
  const router = useRouter()
  const [history, setHistory] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const loadHistory = async () => {
    setLoading(true)
    try {
      const recent = await getRecentSearches()
      setHistory(recent)
    } catch (error) {
      console.error('Load history error:', error)
    } finally {
      setLoading(false)
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadHistory()
    }, [])
  )

  const clearHistory = async () => {
    await removeCache(CACHE_KEYS.RECENT_SEARCHES)
    setHistory([])
  }

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>Lịch sử khám phá</Text>
        <TouchableOpacity onPress={clearHistory} disabled={history.length === 0}>
          <Text style={[s.clearBtn, history.length === 0 && s.clearDisabled]}>Xóa</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : history.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyIcon}>🕒</Text>
          <Text style={s.emptyTitle}>Chưa có lịch sử khám phá</Text>
          <Text style={s.emptyDesc}>Tìm kiếm địa điểm hoặc sự kiện để bắt đầu.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
          {history.map((item, index) => (
            <TouchableOpacity key={`${item}-${index}`} style={s.item} activeOpacity={0.8}>
              <Text style={s.itemText}>{item}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 4,
  },
  backBtn: { fontSize: 22, color: '#2563EB', fontWeight: '700', width: 32 },
  title: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
  clearBtn: { fontSize: 14, fontWeight: '700', color: '#EF4444' },
  clearDisabled: { color: '#CBD5E1' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  emptyIcon: { fontSize: 52 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  emptyDesc: { fontSize: 14, color: '#64748B', textAlign: 'center', maxWidth: 260 },
  list: { padding: 16, gap: 12, paddingBottom: 40 },
  item: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
  },
  itemText: { fontSize: 15, color: '#0F172A' },
})
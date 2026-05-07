import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { useAuthStore } from '../stores/useAuthStore'
import { supabase } from '../services/supabase'
import { getPlaceById, Place } from '../services/placeService'
import { setCache, getCache, CACHE_KEYS } from '../services/cacheService'
import { isOnline } from '../services/offlineService'
import CacheBadge from '../components/ui/CacheBadge'

interface BookmarkItem {
  id: string
  target_id: string
  created_at: string
  place: Place | null
}

export default function BookmarksScreen() {
  const user = useAuthStore((s) => s.user)
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([])
  const [loading, setLoading] = useState(true)
  const [fromCache, setFromCache] = useState(false)
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    if (!user) {
      setBookmarks([])
      setLoading(false)
      return
    }
    loadBookmarks()
  }, [user])

  const loadBookmarks = async () => {
    setLoading(true)
    const online = await isOnline()
    setOffline(!online)

    if (!online) {
      const cached = await getCache<BookmarkItem[]>(CACHE_KEYS.BOOKMARKS, Infinity)
      if (cached) {
        setBookmarks(cached)
        setFromCache(true)
      } else {
        setBookmarks([])
      }
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('bookmarks')
        .select('id, target_id, created_at')
        .eq('user_id', user!.id)
        .eq('target_type', 'place')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error

      const rows = data ?? []
      const enriched = await Promise.all(
        rows.map(async (item: any) => {
          let place: Place | null = null
          try { place = await getPlaceById(item.target_id) } catch {}
          return { ...item, place }
        })
      )

      const result = enriched.filter((item) => item.place !== null)
      setBookmarks(result)
      setFromCache(false)
      await setCache(CACHE_KEYS.BOOKMARKS, result)
    } catch {
      // Fall back to cache on error
      const cached = await getCache<BookmarkItem[]>(CACHE_KEYS.BOOKMARKS, Infinity)
      if (cached) {
        setBookmarks(cached)
        setFromCache(true)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>Địa điểm yêu thích</Text>
        <View style={{ width: 32 }} />
      </View>

      {offline && (
        <View style={s.offlineBanner}>
          <Text style={s.offlineText}>📡 Ngoại tuyến — hiển thị dữ liệu đã lưu</Text>
        </View>
      )}

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : bookmarks.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyIcon}>❤️</Text>
          <Text style={s.emptyTitle}>
            {offline ? 'Chưa có dữ liệu offline' : 'Chưa có địa điểm yêu thích'}
          </Text>
          <Text style={s.emptyDesc}>
            {offline
              ? 'Kết nối mạng để tải danh sách yêu thích.'
              : 'Lưu lại địa điểm để xem lại nhanh hơn.'}
          </Text>
        </View>
      ) : (
        <>
          {fromCache && (
            <View style={s.badgeWrap}>
              <CacheBadge />
            </View>
          )}
          <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
            {bookmarks.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={s.card}
                onPress={() => item.place && router.push(`/place/${item.place.id}`)}
                activeOpacity={0.8}
              >
                <Text style={s.cardTitle}>{item.place?.name}</Text>
                <Text style={s.cardMeta}>{item.place?.category} · {item.place?.address}</Text>
                <Text style={s.cardTime}>Đã lưu {new Date(item.created_at).toLocaleDateString('vi-VN')}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 4,
  },
  backBtn: { fontSize: 22, color: '#2563EB', fontWeight: '700', width: 32 },
  title: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
  offlineBanner: {
    backgroundColor: '#FEF3C7', paddingVertical: 8, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#FDE68A',
  },
  offlineText: { fontSize: 13, color: '#92400E', textAlign: 'center' },
  badgeWrap: { paddingHorizontal: 16, paddingTop: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  emptyIcon: { fontSize: 52 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  emptyDesc: { fontSize: 14, color: '#64748B', textAlign: 'center', maxWidth: 260 },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  cardMeta: { marginTop: 6, fontSize: 13, color: '#475569' },
  cardTime: { marginTop: 8, fontSize: 12, color: '#94A3B8' },
})

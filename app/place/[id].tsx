import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Share, Alert,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { getPlaceById, Place } from '../../services/placeService'
import { useAuthStore } from '../../stores/useAuthStore'
import { supabase } from '../../services/supabase'
import ReviewSection from '../../components/place/ReviewSection'
import { getSimilarPlaces } from '../../services/personalizationService'
import { getRatingDistribution } from '../../services/reviewService'
import { calculateDistance, formatDistance } from '../../utils/distance'
import { useLocation } from '../../hooks/useLocation'
import { trackUserActivity } from '../../services/personalizationService'

const PRICE_LABELS: Record<string, string> = {
  free: '🎁 Miễn phí vào cửa',
  cheap: '💰 Giá rẻ (< 100k)',
  medium: '💰💰 Giá vừa (100-300k)',
  expensive: '💰💰💰 Cao cấp (> 300k)',
}

const getCategoryColor = (cat: string) => {
  const map: Record<string, string> = {
    'Ẩm thực': '#F97316', 'Văn hóa': '#8B5CF6',
    'Mua sắm': '#EC4899', 'Thiên nhiên': '#22C55E',
    'Phiêu lưu': '#EF4444',
  }
  return map[cat] ?? '#2563EB'
}

const getCategoryEmoji = (cat: string) => {
  const map: Record<string, string> = {
    'Ẩm thực': '🍜', 'Văn hóa': '🏛️',
    'Mua sắm': '🛍️', 'Thiên nhiên': '🌿',
    'Phiêu lưu': '🧗',
  }
  return map[cat] ?? '🗺️'
}

const getOpenStatus = (hours?: string | null) => {
  if (!hours) return null
  const now = new Date()
  const currentTime = now.getHours() * 60 + now.getMinutes()
  const timeMatch = hours.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/)
  if (!timeMatch) return null
  const openTime = parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2])
  const closeTime = parseInt(timeMatch[3]) * 60 + parseInt(timeMatch[4])
  const isOpen = currentTime >= openTime && currentTime < closeTime
  let timeLeft = ''
  if (isOpen) {
    const minsLeft = closeTime - currentTime
    timeLeft = minsLeft < 60
      ? `Đóng sau ${minsLeft} phút`
      : `Đóng lúc ${timeMatch[3]}:${timeMatch[4]}`
  } else {
    timeLeft = currentTime < openTime
      ? `Mở lúc ${timeMatch[1]}:${timeMatch[2]}`
      : `Mở lúc ${timeMatch[1]}:${timeMatch[2]} ngày mai`
  }
  return { isOpen, timeLeft }
}

export default function PlaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const user = useAuthStore((s) => s.user)
  const { location } = useLocation()
  const [place, setPlace] = useState<Place | null>(null)
  const [loading, setLoading] = useState(true)
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [bookmarkLoading, setBookmarkLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [similarPlaces, setSimilarPlaces] = useState<Place[]>([])
  const [reviewCount, setReviewCount] = useState(0)
  const [ratingDist, setRatingDist] = useState<Record<number, number>>({
    1: 0, 2: 0, 3: 0, 4: 0, 5: 0,
  })

  useEffect(() => {
    if (!id) return
    loadData()
  }, [id, user])

  const loadData = async () => {
    setLoading(true)
    try {
      // Critical: load place first
      const p = await getPlaceById(id!)
      setPlace(p)
    } catch (e) {
      console.error('Place load error:', e)
      setLoading(false)
      return
    }

    setLoading(false)

    // Non-critical: run all supplementary data in parallel, each failure is isolated
    const results = await Promise.allSettled([
      getSimilarPlaces(id!, 4),
      supabase.from('reviews')
        .select('*', { count: 'exact', head: true })
        .eq('target_id', id).eq('target_type', 'place').eq('is_flagged', false),
      getRatingDistribution(id!, 'place'),
      user
        ? supabase.from('bookmarks').select('id')
            .eq('user_id', user.id).eq('target_id', id).eq('target_type', 'place')
            .maybeSingle()
        : Promise.resolve(null),
      user
        ? trackUserActivity(user.id, { type: 'view', targetId: id!, targetType: 'place' })
        : Promise.resolve(),
    ])

    if (results[0].status === 'fulfilled') setSimilarPlaces(results[0].value as any)
    if (results[1].status === 'fulfilled') setReviewCount((results[1].value as any).count ?? 0)
    if (results[2].status === 'fulfilled') setRatingDist(results[2].value as any)
    if (results[3].status === 'fulfilled' && results[3].value) {
      setIsBookmarked(!!(results[3].value as any).data)
    }
  }

  const handleShare = async () => {
    if (!place) return
    await Share.share({
      message: `${place.name}\n📍 ${place.address}\n⭐ ${place.rating}/5\n🕐 ${place.opening_hours ?? 'Liên hệ'}`,
      title: place.name,
    })
  }

  const handleBookmark = async () => {
    if (!user) {
      Alert.alert('Cần đăng nhập', 'Vui lòng đăng nhập để lưu địa điểm')
      return
    }
    if (!place) return
    setBookmarkLoading(true)
    try {
      if (isBookmarked) {
        await supabase.from('bookmarks').delete()
          .eq('user_id', user.id)
          .eq('target_id', place.id)
        setIsBookmarked(false)
      } else {
        await supabase.from('bookmarks').insert({
          user_id: user.id,
          target_id: place.id,
          target_type: 'place',
        })
        setIsBookmarked(true)
        // Track activity
        await trackUserActivity(user.id, {
          type: 'bookmark',
          targetId: place.id,
          targetType: 'place',
        })
      }
    } catch (e: any) {
      Alert.alert('Lỗi', e.message)
    } finally {
      setBookmarkLoading(false)
    }
  }

  const handleDirections = () => {
  if (!place?.lat || !place?.lng) {
    Alert.alert('Lỗi', 'Không có tọa độ địa điểm')
    return
  }
  // Navigate sang tab Map và focus vào địa điểm này
  router.push({
    pathname: '/(tabs)/map',
    params: {
      lat: place.lat.toString(),
      lng: place.lng.toString(),
      name: place.name,
      placeId: place.id,
    },
  })
}

  if (loading) {
    return (
      <View style={s.loadingScreen}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={s.loadingText}>Đang tải...</Text>
      </View>
    )
  }

  if (!place) {
    return (
      <View style={s.loadingScreen}>
        <Text style={s.notFound}>Không tìm thấy địa điểm</Text>
        <TouchableOpacity onPress={() => router.back()} style={s.backLinkBtn}>
          <Text style={s.backLink}>← Quay lại</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const catColor = getCategoryColor(place.category)
  const catEmoji = getCategoryEmoji(place.category)
  const openStatus = getOpenStatus(place.opening_hours)
  const distance = location && place.lat && place.lng
    ? formatDistance(calculateDistance(
        { latitude: location.latitude, longitude: location.longitude },
        { latitude: place.lat, longitude: place.lng }
      ))
    : null

  return (
    <View style={s.screen}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={[s.hero, { backgroundColor: catColor + '18' }]}>
          <Text style={s.heroEmoji}>{catEmoji}</Text>

          <View style={s.heroTop}>
            <TouchableOpacity style={s.heroBtn} onPress={() => router.back()}>
              <Text style={s.heroBtnIcon}>←</Text>
            </TouchableOpacity>
            <View style={s.heroRight}>
              <TouchableOpacity style={s.heroBtn} onPress={handleShare}>
                <Text style={s.heroBtnIcon}>↗</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.heroBtn, isBookmarked && s.heroBtnActive]}
                onPress={handleBookmark}
                disabled={bookmarkLoading}
              >
                {bookmarkLoading
                  ? <ActivityIndicator size="small" color="#2563EB" />
                  : <Text style={s.heroBtnIcon}>{isBookmarked ? '❤️' : '🤍'}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>

          <View style={[s.heroCatBadge, { backgroundColor: catColor }]}>
            <Text style={s.heroCatText}>{place.category}</Text>
          </View>
        </View>

        <View style={s.content}>
          {/* Title + Rating */}
          <View style={s.titleRow}>
            <Text style={s.placeName}>{place.name}</Text>
            <View style={s.ratingBox}>
              <Text style={s.ratingStar}>⭐</Text>
              {reviewCount > 0 ? (
                <>
                  <Text style={s.ratingValue}>{place.rating}</Text>
                  <Text style={s.ratingCount}>({reviewCount})</Text>
                </>
              ) : (
                <Text style={s.ratingNoReview}>Chưa có</Text>
              )}
            </View>
          </View>

          {/* Distance */}
          {distance && (
            <View style={s.distanceRow}>
              <Text style={s.distanceIcon}>📍</Text>
              <Text style={s.distanceText}>{distance} từ vị trí của bạn</Text>
            </View>
          )}

          {/* Info Cards */}
          <View style={s.infoRow}>
            <View style={s.infoCard}>
              <Text style={s.infoCardIcon}>📍</Text>
              <Text style={s.infoCardLabel}>ĐỊA CHỈ</Text>
              <Text style={s.infoCardValue} numberOfLines={3}>{place.address}</Text>
            </View>
            <View style={s.infoCard}>
              <Text style={s.infoCardIcon}>🕐</Text>
              <Text style={s.infoCardLabel}>GIỜ MỞ CỬA</Text>
              <Text style={s.infoCardValue}>{place.opening_hours ?? 'Liên hệ'}</Text>
            </View>
            <View style={s.infoCard}>
              <Text style={s.infoCardIcon}>💰</Text>
              <Text style={s.infoCardLabel}>GIÁ VÉ</Text>
              <Text style={s.infoCardValue}>
                {PRICE_LABELS[place.price_range ?? 'free'] ?? 'Miễn phí'}
              </Text>
            </View>
          </View>

          {/* Open Status */}
          {openStatus && (
            <View style={[
              s.openStatusRow,
              { backgroundColor: openStatus.isOpen ? '#F0FDF4' : '#FEF2F2' }
            ]}>
              <View style={[
                s.openDot,
                { backgroundColor: openStatus.isOpen ? '#16A34A' : '#EF4444' }
              ]} />
              <Text style={[
                s.openStatusText,
                { color: openStatus.isOpen ? '#16A34A' : '#EF4444' }
              ]}>
                {openStatus.isOpen ? 'Đang mở cửa' : 'Đã đóng cửa'}
              </Text>
              <Text style={s.openTimeLeft}> · {openStatus.timeLeft}</Text>
            </View>
          )}

          {/* Description */}
          <View style={s.descBox}>
            <Text style={s.descTitle}>📋 Giới thiệu</Text>
            <Text style={s.descText} numberOfLines={expanded ? undefined : 4}>
              {place.description}
            </Text>
            {(place.description?.length ?? 0) > 200 && (
              <TouchableOpacity onPress={() => setExpanded(!expanded)}>
                <Text style={s.expandBtn}>
                  {expanded ? 'Thu gọn ↑' : 'Xem thêm ↓'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

         {/* Rating Breakdown */}
<View style={s.ratingBreakdown}>
  <Text style={s.sectionTitle}>⭐ Đánh giá</Text>

  {reviewCount === 0 ? (
    // Chưa có review
    <View style={s.noRatingBox}>
      <Text style={s.noRatingIcon}>📝</Text>
      <Text style={s.noRatingTitle}>Chưa có đánh giá nào</Text>
      <Text style={s.noRatingDesc}>
        Hãy là người đầu tiên đánh giá địa điểm này!
      </Text>
    </View>
  ) : (
    // Có review → hiện rating thật
    <View style={s.ratingOverview}>
      <View style={s.ratingBig}>
        <Text style={s.ratingBigValue}>{place.rating}</Text>
        <Text style={s.ratingBigStars}>
          {'★'.repeat(Math.round(place.rating))}
          {'☆'.repeat(5 - Math.round(place.rating))}
        </Text>
        <Text style={s.ratingBigCount}>{reviewCount} đánh giá</Text>
      </View>
      <View style={s.ratingBars}>
        {[5, 4, 3, 2, 1].map((star) => {
          const count = ratingDist[star] ?? 0
          const pct = reviewCount > 0
            ? Math.round((count / reviewCount) * 100)
            : 0
          return (
            <View key={star} style={s.ratingBarRow}>
              <Text style={s.ratingBarLabel}>{star}★</Text>
              <View style={s.ratingBarBg}>
                <View style={[
                  s.ratingBarFill,
                  {
                    width: `${pct}%` as any,
                    backgroundColor: star >= 4 ? '#22C55E' :
                                     star === 3 ? '#F59E0B' : '#EF4444',
                  },
                ]} />
              </View>
              <Text style={s.ratingBarPct}>{pct}%</Text>
            </View>
          )
        })}
      </View>
    </View>
  )}
</View>

          {/* Review Section — data thật từ DB */}
          <ReviewSection targetId={id!} targetType="place" />

          {/* Similar Places */}
          {similarPlaces.length > 0 && (
            <View style={s.similarSection}>
              <Text style={s.sectionTitle}>🔍 Địa điểm tương tự</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 12, paddingTop: 10 }}
              >
                {similarPlaces.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={s.similarCard}
                    onPress={() => router.push(`/place/${p.id}`)}
                  >
                    <View style={[
                      s.similarImage,
                      { backgroundColor: getCategoryColor(p.category) + '18' }
                    ]}>
                      <Text style={{ fontSize: 28 }}>{getCategoryEmoji(p.category)}</Text>
                    </View>
                    <View style={s.similarInfo}>
                      <Text style={s.similarName} numberOfLines={2}>{p.name}</Text>
                      <Text style={s.similarRating}>⭐ {p.rating}</Text>
                      {p.opening_hours && (() => {
                        const st = getOpenStatus(p.opening_hours)
                        if (!st) return null
                        return (
                          <Text style={[
                            s.similarOpen,
                            { color: st.isOpen ? '#16A34A' : '#EF4444' }
                          ]}>
                            {st.isOpen ? '● Mở' : '● Đóng'}
                          </Text>
                        )
                      })()}
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      {/* Bottom Actions */}
      <View style={s.bottomBar}>
        <TouchableOpacity style={s.directionBtn} onPress={handleDirections}>
          <Text style={s.directionIcon}>🧭</Text>
          <Text style={s.directionText}>Chỉ đường</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.bookmarkBtn, isBookmarked && s.bookmarkBtnActive]}
          onPress={handleBookmark}
          disabled={bookmarkLoading}
        >
          {bookmarkLoading
            ? <ActivityIndicator color="#2563EB" size="small" />
            : <>
                <Text style={s.bookmarkIcon}>{isBookmarked ? '❤️' : '🤍'}</Text>
                <Text style={[
                  s.bookmarkText,
                  isBookmarked && s.bookmarkTextActive
                ]}>
                  {isBookmarked ? 'Đã lưu' : 'Lưu lại'}
                </Text>
              </>
          }
        </TouchableOpacity>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  loadingScreen: {
    flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12,
  },
  loadingText: { color: '#64748B', fontSize: 14 },
  notFound: { fontSize: 16, color: '#64748B' },
  backLinkBtn: { marginTop: 8 },
  backLink: { color: '#2563EB', fontSize: 15, fontWeight: '600' },

  // Hero
  hero: {
    height: 220, justifyContent: 'center', alignItems: 'center',
  },
  heroEmoji: { fontSize: 80 },
  heroTop: {
    position: 'absolute', top: 52, left: 16, right: 16,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  heroRight: { flexDirection: 'row', gap: 10 },
  heroBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.1,
    shadowRadius: 4, elevation: 3,
  },
  heroBtnActive: { backgroundColor: '#FEF2F2' },
  heroBtnIcon: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  heroCatBadge: {
    position: 'absolute', bottom: 16, left: 16,
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8,
  },
  heroCatText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // Content
  content: { padding: 16 },
  titleRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 8,
  },
  placeName: {
    fontSize: 22, fontWeight: '900', color: '#0F172A',
    flex: 1, marginRight: 12, lineHeight: 30,
  },
  ratingBox: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#FEF3C7', paddingHorizontal: 10,
    paddingVertical: 6, borderRadius: 10,
  },
  ratingStar: { fontSize: 14 },
  ratingValue: { fontSize: 15, fontWeight: '800', color: '#B45309' },
  ratingCount: { fontSize: 11, color: '#B45309' },
  ratingNoReview: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
  distanceRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 4, marginBottom: 14,
  },
  distanceIcon: { fontSize: 14 },
  distanceText: { fontSize: 13, color: '#2563EB', fontWeight: '600' },

  // Info Cards
  infoRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  infoCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 14,
    padding: 10, alignItems: 'center', gap: 4,
    shadowColor: '#000', shadowOpacity: 0.05,
    shadowRadius: 6, elevation: 2,
  },
  infoCardIcon: { fontSize: 20 },
  infoCardLabel: {
    fontSize: 9, color: '#94A3B8', fontWeight: '700',
    textTransform: 'uppercase', textAlign: 'center',
  },
  infoCardValue: { fontSize: 11, color: '#0F172A', fontWeight: '600', textAlign: 'center' },

  // Open Status
  openStatusRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, gap: 6, marginBottom: 14,
  },
  openDot: { width: 8, height: 8, borderRadius: 4 },
  openStatusText: { fontSize: 13, fontWeight: '700' },
  openTimeLeft: { fontSize: 12, color: '#64748B' },

  // Description
  descBox: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.05,
    shadowRadius: 8, elevation: 2,
  },
  descTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 10 },
  descText: { fontSize: 14, color: '#475569', lineHeight: 22 },
  expandBtn: { color: '#2563EB', fontSize: 13, fontWeight: '600', marginTop: 8 },

  // Rating Breakdown
  ratingBreakdown: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.05,
    shadowRadius: 8, elevation: 2,
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 12 },
  ratingOverview: { flexDirection: 'row', gap: 16 },
  ratingBig: { alignItems: 'center', justifyContent: 'center', width: 80 },
  ratingBigValue: { fontSize: 40, fontWeight: '900', color: '#0F172A', lineHeight: 48 },
  ratingBigStars: { fontSize: 14, color: '#F59E0B', marginVertical: 2 },
  ratingBigCount: { fontSize: 10, color: '#94A3B8', textAlign: 'center' },
  ratingBars: { flex: 1, gap: 5 },
  ratingBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ratingBarLabel: { fontSize: 11, color: '#64748B', width: 20 },
  ratingBarBg: {
    flex: 1, height: 6, backgroundColor: '#F1F5F9',
    borderRadius: 3, overflow: 'hidden',
  },
  ratingBarFill: { height: '100%', borderRadius: 3 },
  ratingBarPct: { fontSize: 10, color: '#94A3B8', width: 28, textAlign: 'right' },
  noRatingBox: { alignItems: 'center', paddingVertical: 20, gap: 6 },
  noRatingIcon: { fontSize: 32 },
  noRatingTitle: { fontSize: 14, fontWeight: '700', color: '#64748B' },
  noRatingDesc: { fontSize: 12, color: '#94A3B8', textAlign: 'center' },

  // Similar
  similarSection: { marginBottom: 16 },
  similarCard: {
    width: 130, backgroundColor: '#fff',
    borderRadius: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.06,
    shadowRadius: 6, elevation: 2,
  },
  similarImage: {
    height: 80, justifyContent: 'center', alignItems: 'center',
  },
  similarInfo: { padding: 8 },
  similarName: { fontSize: 12, fontWeight: '600', color: '#0F172A', marginBottom: 3 },
  similarRating: { fontSize: 11, color: '#F59E0B', marginBottom: 2 },
  similarOpen: { fontSize: 10, fontWeight: '700' },

  // Bottom Bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', padding: 16,
    flexDirection: 'row', gap: 12,
    borderTopWidth: 1, borderTopColor: '#F1F5F9',
    shadowColor: '#000', shadowOpacity: 0.1,
    shadowRadius: 8, elevation: 8,
  },
  directionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
    backgroundColor: '#2563EB', borderRadius: 14,
    paddingVertical: 14, minHeight: 44,
    shadowColor: '#2563EB', shadowOpacity: 0.4,
    shadowRadius: 8, elevation: 5,
  },
  directionIcon: { fontSize: 18 },
  directionText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  bookmarkBtn: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
    backgroundColor: '#F1F5F9', borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 20,
    borderWidth: 1.5, borderColor: '#E2E8F0',
    minHeight: 44,
  },
  bookmarkBtnActive: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  bookmarkIcon: { fontSize: 18 },
  bookmarkText: { color: '#64748B', fontSize: 15, fontWeight: '700' },
  bookmarkTextActive: { color: '#DC2626' },
})
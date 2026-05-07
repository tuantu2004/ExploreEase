import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Dimensions,
} from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useState, useEffect, useCallback } from 'react'
import { getPlaces, Place } from '../../services/placeService'
import { getEvents, Event } from '../../services/eventService'
import { useAuthStore } from '../../stores/useAuthStore'
import { useCachedData } from '../../hooks/useCachedData'
import { CACHE_KEYS } from '../../services/cacheService'
import { useOffline } from '../../hooks/useOffline'
import CacheBadge from '../../components/ui/CacheBadge'
import { usePersonalization } from '../../hooks/usePersonalization'
import PersonalizedSection from '../../components/place/PersonalizedSection'
import SimilarPlaces from '../../components/place/SimilarPlaces'
import { getContextualGreeting } from '../../services/personalizationService'
import { useLocation } from '../../hooks/useLocation'
import { calculateDistance } from '../../utils/distance'
import { checkAndNotifyNearby } from '../../services/notificationService'
import { useContextFilter } from '../../hooks/useContextFilter'

const { width } = Dimensions.get('window')

const CATEGORIES = [
  { id: 'all', label: 'Tất cả', icon: '🗺️', color: '#2563EB' },
  { id: 'Ẩm thực', label: 'Ẩm thực', icon: '🍜', color: '#F97316' },
  { id: 'Văn hóa', label: 'Văn hóa', icon: '🏛️', color: '#8B5CF6' },
  { id: 'Mua sắm', label: 'Mua sắm', icon: '🛍️', color: '#EC4899' },
  { id: 'Thiên nhiên', label: 'Thiên nhiên', icon: '🌿', color: '#22C55E' },
  { id: 'Phiêu lưu', label: 'Phiêu lưu', icon: '🧗', color: '#EF4444' },
]

const PRICE_LABELS: Record<string, string> = {
  free: 'Miễn phí',
  cheap: 'Rẻ',
  medium: 'Vừa',
  expensive: 'Cao cấp',
}

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user)
  const { isOnline } = useOffline()
  const { location } = useLocation()
  const [activeCategory, setActiveCategory] = useState('all')
  const [sortBy, setSortBy] = useState<'default' | 'rating' | 'az' | 'distance'>('default')
  const [filterRating, setFilterRating] = useState(0)
  const [filterPrice, setFilterPrice] = useState('all')

  const { personalizedPlaces, loading: personalizedLoading, contextLabel } = usePersonalization()

  const {
    timeMeta, seasonMeta, weatherMeta,
    timeActive, setTimeActive,
    weatherActive, setWeatherActive,
    seasonActive, setSeasonActive,
    applyContextFilter,
    weatherLoading,
  } = useContextFilter(location?.latitude, location?.longitude)

  const { data: placesData, loading, fromCache } = useCachedData<Place[]>({
    cacheKey: CACHE_KEYS.PLACES + '_' + activeCategory,
    fetchFn: () => getPlaces({
      category: activeCategory === 'all' ? undefined : activeCategory,
      limit: 10,
    }),
  })
  const places = placesData ?? []

  const [homePlaces, setHomePlaces] = useState<Place[]>(places)

  const { data: eventsData } = useCachedData<Event[]>({
    cacheKey: CACHE_KEYS.EVENTS,
    fetchFn: () => getEvents({ limit: 5 }),
  })
  const events = eventsData ?? []
  const [homeEvents, setHomeEvents] = useState<Event[]>(events)

  const getFilteredPlaces = (raw: Place[]) => {
    let result = [...raw]
    if (filterRating > 0) result = result.filter(p => p.rating >= filterRating)
    if (filterPrice !== 'all') result = result.filter(p => p.price_range === filterPrice)
    if (sortBy === 'default') result = applyContextFilter(result)
    else if (sortBy === 'rating') result.sort((a, b) => b.rating - a.rating)
    else if (sortBy === 'az') result.sort((a, b) => a.name.localeCompare(b.name, 'vi'))
    else if (sortBy === 'distance' && location) {
      result.sort((a, b) => {
        const dA = calculateDistance(
          { latitude: location.latitude, longitude: location.longitude },
          { latitude: a.lat || 0, longitude: a.lng || 0 }
        )
        const dB = calculateDistance(
          { latitude: location.latitude, longitude: location.longitude },
          { latitude: b.lat || 0, longitude: b.lng || 0 }
        )
        return dA - dB
      })
    }
    return result
  }

  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Chào buổi sáng'
    if (h < 18) return 'Chào buổi chiều'
    return 'Chào buổi tối'
  }

  const hour = new Date().getHours()
  const contextGreeting = user?.travel_style
    ? getContextualGreeting(user.travel_style, hour)
    : getGreeting() + ' 👋'

  useEffect(() => {
    setHomePlaces(places)
  }, [places])

  useEffect(() => {
    if (!location || places.length === 0) return
    checkAndNotifyNearby(places, location.latitude, location.longitude)
  }, [location, places.length])

  useEffect(() => {
    setHomeEvents(events)
  }, [events])

  useFocusEffect(
    useCallback(() => {
      let active = true
      const refresh = async () => {
        try {
          const freshPlaces = await getPlaces({
            category: activeCategory === 'all' ? undefined : activeCategory,
            limit: 10,
          })
          const freshEvents = await getEvents({ limit: 5 })
          if (active) {
            setHomePlaces(freshPlaces)
            setHomeEvents(freshEvents)
          }
        } catch (error) {
          console.error('Refresh on focus failed', error)
        }
      }
      refresh()
      return () => {
        active = false
      }
    }, [activeCategory])
  )

  const getCategoryIcon = (cat: string) => {
    const found = CATEGORIES.find(c => c.id === cat)
    return found?.icon ?? '🗺️'
  }

  return (
    <ScrollView
      style={s.screen}
      showsVerticalScrollIndicator={false}
      stickyHeaderIndices={[0]}
    >
      {/* Sticky Header */}
      <View style={s.header}>
        <View style={s.headerTop}>
          <View>
            <Text style={s.greeting}>{contextGreeting}</Text>
            <Text style={s.userName}>
              {user?.name ?? 'Khách'}
            </Text>
          </View>
          <TouchableOpacity
            style={s.avatarBtn}
            onPress={() => router.push('/profile')}
          >
            <Text style={s.avatarText}>
              {user?.name?.[0]?.toUpperCase() ?? 'K'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <TouchableOpacity
          style={s.searchBar}
          onPress={() => router.push('/search')}
          activeOpacity={0.8}
        >
          <Text style={s.searchIcon}>🔍</Text>
          <Text style={s.searchPlaceholder}>
            Tìm địa điểm, sự kiện...
          </Text>
          <View style={s.voiceBtn}>
            <Text style={s.voiceIcon}>🎙️</Text>
          </View>
        </TouchableOpacity>


        {/* Location */}
        <View style={s.locationRow}>
          <Text style={s.locationIcon}>📍</Text>
          <Text style={s.locationText}>TP. Hồ Chí Minh, Việt Nam</Text>
          <TouchableOpacity>
            <Text style={s.changeLocation}>Đổi</Text>
          </TouchableOpacity>
        </View>
      </View>

      <CacheBadge visible={fromCache} />

      {/* Categories */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Danh mục</Text>
          <TouchableOpacity onPress={() => router.push('/search')}>
            <Text style={s.seeAll}>Xem tất cả →</Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.catList}
        >
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={s.catItem}
              onPress={() => setActiveCategory(cat.id)}
            >
              <View style={[
                s.catIconBox,
                { backgroundColor: cat.color + '18' },
                activeCategory === cat.id && {
                  backgroundColor: cat.color,
                  shadowColor: cat.color,
                  shadowOpacity: 0.4,
                  shadowRadius: 8,
                  elevation: 4,
                },
              ]}>
                <Text style={s.catEmoji}>{cat.icon}</Text>
              </View>
              <Text style={[
                s.catLabel,
                activeCategory === cat.id && { color: cat.color, fontWeight: '700' },
              ]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Sort + Filter Bar */}
      <View style={s.sortBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.sortList}>
          {[
            { id: 'default', label: '🎯 Gợi ý' },
            { id: 'rating',  label: '⭐ Đánh giá' },
            { id: 'distance', label: '📍 Gần nhất' },
            { id: 'az',     label: '🔤 A-Z' },
          ].map((sort) => (
            <TouchableOpacity
              key={sort.id}
              style={[s.sortChip, sortBy === sort.id && s.sortChipActive]}
              onPress={() => setSortBy(sort.id as any)}
            >
              <Text style={[s.sortChipText, sortBy === sort.id && s.sortChipTextActive]}>
                {sort.label}
              </Text>
            </TouchableOpacity>
          ))}

          <View style={s.filterDivider} />

          {[
            { id: 'all',    label: 'Tất cả' },
            { id: 'free',   label: '🎁 Miễn phí' },
            { id: 'cheap',  label: '💰 Rẻ' },
            { id: 'medium', label: '💰💰 Vừa' },
          ].map((price) => (
            <TouchableOpacity
              key={price.id}
              style={[s.sortChip, filterPrice === price.id && s.sortChipGreen]}
              onPress={() => setFilterPrice(price.id)}
            >
              <Text style={[s.sortChipText, filterPrice === price.id && s.sortChipTextActive]}>
                {price.label}
              </Text>
            </TouchableOpacity>
          ))}

          <View style={s.filterDivider} />

          {[
            { id: 0,   label: 'Tất cả' },
            { id: 4.5, label: '⭐4.5+' },
            { id: 4.0, label: '⭐4.0+' },
          ].map((r) => (
            <TouchableOpacity
              key={r.id}
              style={[s.sortChip, filterRating === r.id && s.sortChipYellow]}
              onPress={() => setFilterRating(r.id)}
            >
              <Text style={[s.sortChipText, filterRating === r.id && s.sortChipTextActive]}>
                {r.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Context Filter: Thời gian / Thời tiết / Mùa */}
      <View style={s.contextBar}>
        <Text style={s.contextBarLabel}>Lọc theo hoàn cảnh</Text>
        <View style={s.contextChips}>
          {/* Time chip */}
          <TouchableOpacity
            style={[s.contextChip, timeActive && s.contextChipActive]}
            onPress={() => setTimeActive(!timeActive)}
          >
            <Text style={s.contextChipEmoji}>{timeMeta.emoji}</Text>
            <Text style={[s.contextChipText, timeActive && s.contextChipTextActive]}>
              {timeMeta.label}
            </Text>
          </TouchableOpacity>

          {/* Weather chip */}
          <TouchableOpacity
            style={[s.contextChip, weatherActive && s.contextChipActive]}
            onPress={() => setWeatherActive(!weatherActive)}
          >
            <Text style={s.contextChipEmoji}>{weatherMeta.emoji}</Text>
            <Text style={[s.contextChipText, weatherActive && s.contextChipTextActive]}>
              {weatherLoading ? 'Đang tải...' : weatherMeta.label}
            </Text>
          </TouchableOpacity>

          {/* Season chip */}
          <TouchableOpacity
            style={[s.contextChip, seasonActive && s.contextChipActive]}
            onPress={() => setSeasonActive(!seasonActive)}
          >
            <Text style={s.contextChipEmoji}>{seasonMeta.emoji}</Text>
            <Text style={[s.contextChipText, seasonActive && s.contextChipTextActive]}>
              {seasonMeta.label}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* AI Banner */}
      <TouchableOpacity
        style={s.aiBanner}
        onPress={() => router.push('/plan')}
        activeOpacity={0.9}
      >
        <View style={s.aiBannerLeft}>
          <View style={s.aiBadge}>
            <Text style={s.aiBadgeText}>AI</Text>
          </View>
          <View>
            <Text style={s.aiBannerTitle}>Lên kế hoạch thông minh</Text>
            <Text style={s.aiBannerSub}>
              AI tạo lịch trình cho bạn trong 30 giây
            </Text>
          </View>
        </View>
        <View style={s.aiBannerArrow}>
          <Text style={s.aiBannerArrowText}>→</Text>
        </View>
      </TouchableOpacity>

      {/* Trending Events */}
      {homeEvents.length > 0 && (
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>🔥 Sự kiện nổi bật</Text>
            <TouchableOpacity onPress={() => router.push('/events')}>
              <Text style={s.seeAll}>Xem tất cả →</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
          >
            {homeEvents.map((event) => (
              <TouchableOpacity
                key={event.id}
                style={s.eventCard}
                onPress={() => router.push(`/event/${event.id}`)}
              >
                <View style={s.eventCardBanner}>
                  <Text style={{ fontSize: 32 }}>
                    {event.category === 'Âm nhạc' ? '🎵' :
                     event.category === 'Ẩm thực' ? '🍔' :
                     event.category === 'Thể thao' ? '🏃' : '🎨'}
                  </Text>
                  <View style={[
                    s.eventPriceBadge,
                    { backgroundColor: event.price === 0 ? '#22C55E' : '#F97316' },
                  ]}>
                    <Text style={s.eventPriceText}>
                      {event.price === 0 ? 'Miễn phí' :
                       event.price.toLocaleString('vi-VN') + 'đ'}
                    </Text>
                  </View>
                </View>
                <View style={s.eventCardBody}>
                  <Text style={s.eventCardTitle} numberOfLines={2}>
                    {event.title}
                  </Text>
                  <Text style={s.eventCardDate}>
                    📅 {new Date(event.start_date).toLocaleDateString('vi-VN', {
                      day: '2-digit', month: '2-digit',
                    })}
                  </Text>
                  <Text style={s.eventCardLocation} numberOfLines={1}>
                    📍 {event.location}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Personalized / Category Section */}
      {activeCategory === 'all' ? (
        <PersonalizedSection
          results={personalizedPlaces}
          contextLabel={contextLabel}
          loading={personalizedLoading}
        />
      ) : (
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>
              {`${getCategoryIcon(activeCategory)} ${activeCategory}`}
            </Text>
            <TouchableOpacity onPress={() => router.push('/search')}>
              <Text style={s.seeAll}>Xem tất cả →</Text>
            </TouchableOpacity>
          </View>
          {loading ? (
            <View style={s.loadingBox}>
              {[1, 2, 3].map((i) => (
                <View key={i} style={s.shimmerCard}>
                  <View style={s.shimmerImage} />
                  <View style={s.shimmerContent}>
                    <View style={s.shimmerLine} />
                    <View style={[s.shimmerLine, { width: '60%' }]} />
                  </View>
                </View>
              ))}
            </View>
          ) : homePlaces.length === 0 ? (
            <View style={s.emptyBox}>
              <Text style={s.emptyIcon}>🔍</Text>
              <Text style={s.emptyText}>Không có địa điểm nào</Text>
            </View>
          ) : (
            <>
              {getFilteredPlaces(homePlaces).map((place) => (
                <TouchableOpacity
                  key={place.id}
                  style={s.placeCard}
                  onPress={() => router.push(`/place/${place.id}`)}
                  activeOpacity={0.8}
                >
                  <View style={s.placeImageBox}>
                    <Text style={s.placeImageEmoji}>
                      {place.category === 'Ẩm thực' ? '🍜' :
                       place.category === 'Văn hóa' ? '🏛️' :
                       place.category === 'Mua sắm' ? '🛍️' :
                       place.category === 'Thiên nhiên' ? '🌿' : '🗺️'}
                    </Text>
                  </View>
                  <View style={s.placeInfo}>
                    <Text style={s.placeName} numberOfLines={1}>{place.name}</Text>
                    <View style={s.placeCatRow}>
                      <View style={[
                        s.placeCatBadge,
                        { backgroundColor: (CATEGORIES.find(c => c.id === place.category)?.color ?? '#64748B') + '18' },
                      ]}>
                        <Text style={[
                          s.placeCatText,
                          { color: CATEGORIES.find(c => c.id === place.category)?.color ?? '#64748B' },
                        ]}>
                          {place.category}
                        </Text>
                      </View>
                      <Text style={s.placePrice}>{PRICE_LABELS[place.price_range] ?? 'Miễn phí'}</Text>
                    </View>
                    <View style={s.placeFooter}>
                      <Text style={s.placeRating}>⭐ {place.rating}</Text>
                      <Text style={s.placeDot}>·</Text>
                      <Text style={s.placeAddress} numberOfLines={1}>
                        {place.address?.split(',').slice(-2).join(',').trim()}
                      </Text>
                    </View>
                  </View>
                  <Text style={s.placeArrow}>›</Text>
                </TouchableOpacity>
              ))}
            </>
          )}
        </View>
      )}

      {/* Similar Places */}
      {(personalizedPlaces[0]?.place.id ?? homePlaces[0]?.id) ? (
        <View style={[s.section, { paddingBottom: 24, paddingHorizontal: 16 }]}>
          <SimilarPlaces placeId={personalizedPlaces[0]?.place.id ?? homePlaces[0]!.id} />
        </View>
      ) : null}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },

  // Header
  header: {
    backgroundColor: '#fff',
    paddingTop: 52, paddingHorizontal: 16,
    paddingBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.06,
    shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  headerTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  greeting: { fontSize: 13, color: '#64748B', fontWeight: '400' },
  userName: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  avatarBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#2563EB',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#2563EB', shadowOpacity: 0.4,
    shadowRadius: 8, elevation: 4,
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '800' },

  // Search
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F1F5F9', borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 10, gap: 10,
    borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  searchIcon: { fontSize: 18 },
  searchPlaceholder: { flex: 1, color: '#94A3B8', fontSize: 14 },
  voiceBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#2563EB',
    justifyContent: 'center', alignItems: 'center',
  },
  voiceIcon: { fontSize: 14 },

  // Location
  locationRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 4,
  },
  locationIcon: { fontSize: 14 },
  locationText: { flex: 1, fontSize: 13, color: '#475569', fontWeight: '500' },
  changeLocation: { fontSize: 12, color: '#2563EB', fontWeight: '600' },

  // Section
  section: { marginTop: 20 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 16, marginBottom: 12,
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  seeAll: { fontSize: 13, color: '#2563EB', fontWeight: '600' },

  // Categories
  catList: { paddingHorizontal: 16, gap: 16 },
  catItem: { alignItems: 'center', gap: 6 },
  catIconBox: {
    width: 56, height: 56, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  catEmoji: { fontSize: 24 },
  catLabel: { fontSize: 11, color: '#64748B', fontWeight: '500' },

  // AI Banner
  aiBanner: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16, marginTop: 20,
    borderRadius: 20, padding: 16,
    backgroundColor: '#1E40AF',
    shadowColor: '#2563EB', shadowOpacity: 0.4,
    shadowRadius: 12, elevation: 6,
  },
  aiBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  aiBadge: {
    backgroundColor: '#F97316',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6,
  },
  aiBadgeText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  aiBannerTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  aiBannerSub: { color: '#93C5FD', fontSize: 12, marginTop: 2 },
  aiBannerArrow: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  aiBannerArrowText: { color: '#fff', fontSize: 18, fontWeight: '700' },

  // Event Cards (horizontal)
  eventCard: {
    width: 200, backgroundColor: '#fff',
    borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.08,
    shadowRadius: 8, elevation: 3,
  },
  eventCardBanner: {
    height: 90, backgroundColor: '#EFF6FF',
    justifyContent: 'center', alignItems: 'center',
  },
  eventPriceBadge: {
    position: 'absolute', top: 8, right: 8,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6,
  },
  eventPriceText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  eventCardBody: { padding: 12 },
  eventCardTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A', marginBottom: 6 },
  eventCardDate: { fontSize: 11, color: '#64748B', marginBottom: 2 },
  eventCardLocation: { fontSize: 11, color: '#94A3B8' },

  // Place Cards
  placeCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', marginHorizontal: 16,
    marginBottom: 10, borderRadius: 16, padding: 12,
    shadowColor: '#000', shadowOpacity: 0.06,
    shadowRadius: 8, elevation: 2, gap: 12,
  },
  placeImageBox: {
    width: 64, height: 64, borderRadius: 14,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center', alignItems: 'center',
  },
  placeImageEmoji: { fontSize: 28 },
  placeInfo: { flex: 1 },
  placeName: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 4 },
  placeCatRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  placeCatBadge: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6,
  },
  placeCatText: { fontSize: 11, fontWeight: '600' },
  placePrice: { fontSize: 11, color: '#94A3B8' },
  placeFooter: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  placeRating: { fontSize: 12, color: '#F59E0B', fontWeight: '600' },
  placeDot: { color: '#CBD5E1' },
  placeAddress: { fontSize: 12, color: '#94A3B8', flex: 1 },
  placeArrow: { fontSize: 22, color: '#CBD5E1' },

  // Loading shimmer
  loadingBox: { paddingHorizontal: 16 },
  shimmerCard: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderRadius: 16, padding: 12, marginBottom: 10,
    gap: 12,
  },
  shimmerImage: {
    width: 64, height: 64, borderRadius: 14,
    backgroundColor: '#F1F5F9',
  },
  shimmerContent: { flex: 1, gap: 8, justifyContent: 'center' },
  shimmerLine: {
    height: 12, borderRadius: 6,
    backgroundColor: '#F1F5F9', width: '80%',
  },

  // Empty
  emptyBox: { alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { color: '#94A3B8', fontSize: 14 },

  // You might also like
  likeCard: {
    width: 130, backgroundColor: '#fff',
    borderRadius: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.06,
    shadowRadius: 6, elevation: 2,
  },
  likeImageBox: {
    height: 80, backgroundColor: '#EFF6FF',
    justifyContent: 'center', alignItems: 'center',
  },
  likeName: {
    fontSize: 12, fontWeight: '600', color: '#0F172A',
    padding: 8, paddingBottom: 4,
  },
  likeRating: { fontSize: 11, color: '#F59E0B', paddingHorizontal: 8, paddingBottom: 8 },

  loadMoreBtn: {
    marginHorizontal: 16, marginTop: 4, marginBottom: 8,
    backgroundColor: '#EFF6FF', borderRadius: 12,
    paddingVertical: 12, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#BFDBFE',
  },
  loadMoreText: { color: '#2563EB', fontSize: 13, fontWeight: '700' },

  // Search suggestions
  suggestionsBox: {
    backgroundColor: '#fff', borderRadius: 14, marginTop: 4,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 6,
    borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  suggestionEmoji: { fontSize: 20, width: 28, textAlign: 'center' },
  suggestionName: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  suggestionMeta: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  suggestionMore: {
    alignItems: 'center', paddingVertical: 10,
    backgroundColor: '#F8FAFC',
  },
  suggestionMoreText: { color: '#2563EB', fontSize: 13, fontWeight: '700' },

  // Sort / Filter bar
  sortBar: {
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  sortList: { paddingHorizontal: 16, paddingVertical: 8, gap: 8, alignItems: 'center' },
  sortChip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 16, backgroundColor: '#F1F5F9',
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  sortChipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  sortChipGreen:  { backgroundColor: '#16A34A', borderColor: '#16A34A' },
  sortChipYellow: { backgroundColor: '#F59E0B', borderColor: '#F59E0B' },
  sortChipText: { fontSize: 12, color: '#475569', fontWeight: '600' },
  sortChipTextActive: { color: '#fff' },
  filterDivider: { width: 1, height: 20, backgroundColor: '#E2E8F0', marginHorizontal: 4 },

  contextBar: {
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  contextBarLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  contextChips: { flexDirection: 'row' as const, gap: 8 },
  contextChip: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, backgroundColor: '#F8FAFC',
    borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  contextChipActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  contextChipEmoji: { fontSize: 15 },
  contextChipText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  contextChipTextActive: { color: '#2563EB' },
})
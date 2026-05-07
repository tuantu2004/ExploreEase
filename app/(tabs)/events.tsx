import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, TextInput, Alert, Image,
} from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useEffect, useState, useCallback } from 'react'
import { getEvents, Event } from '../../services/eventService'
import { useAuthStore } from '../../stores/useAuthStore'
import { supabase } from '../../services/supabase'
import { useLocation } from '../../hooks/useLocation'
import { calculateDistance, formatDistance } from '../../utils/distance'

const CATEGORIES = ['Tất cả', 'Âm nhạc', 'Ẩm thực', 'Thể thao', 'Văn hóa', 'Miễn phí']
const STATUS_FILTERS = ['Tất cả', 'Sắp diễn ra', 'Đang diễn ra']
const DATE_FILTERS = ['Tất cả', 'Hôm nay', 'Tuần này', 'Tháng này']

const getEventStatus = (startDate: string) => {
  const now = Date.now()
  const start = new Date(startDate).getTime()
  if (now < start) {
    const diff = start - now
    const days = Math.floor(diff / 86400000)
    const hours = Math.floor((diff % 86400000) / 3600000)
    const mins = Math.floor((diff % 3600000) / 60000)
    let countdown = ''
    if (days > 0) countdown = `${days} ngày nữa`
    else if (hours > 0) countdown = `${hours} giờ nữa`
    else if (mins > 0) countdown = `${mins} phút nữa`
    else countdown = 'Sắp bắt đầu'
    return { status: 'upcoming', label: 'Sắp diễn ra', countdown }
  }
  return { status: 'ongoing', label: 'Đang diễn ra', countdown: null }
}

const STATUS_COLORS = {
  upcoming: { label: 'Sắp diễn ra', color: '#2563EB', bg: '#EFF6FF' },
  ongoing: { label: 'Đang diễn ra', color: '#16A34A', bg: '#F0FDF4' },
  completed: { label: 'Đã kết thúc', color: '#64748B', bg: '#F1F5F9' },
}

const getCategoryEmoji = (cat: string) => {
  const map: Record<string, string> = {
    'Âm nhạc': '🎵', 'Ẩm thực': '🍔',
    'Thể thao': '🏃', 'Văn hóa': '🎨',
    'Nghệ thuật': '🖼️', 'Khác': '🎪',
  }
  return map[cat] ?? '🎪'
}

const isRenderableEventImage = (uri?: string) => {
  if (!uri) return false
  const normalized = uri.toLowerCase()
  return !normalized.includes('placeholder.com') && !normalized.includes('via.placeholder.com')
}

const getSafeImageUri = (uri: string) => {
  try {
    return encodeURI(uri)
  } catch {
    return uri
  }
}

export default function EventsScreen() {
  const user = useAuthStore((s) => s.user)
  const { location } = useLocation()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set())
  const [activeCategory, setActiveCategory] = useState('Tất cả')
  const [activeStatus, setActiveStatus] = useState('Tất cả')
  const [activeDateFilter, setActiveDateFilter] = useState('Tất cả')
  const [search, setSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [joinedEvents, setJoinedEvents] = useState<Set<string>>(new Set())
  const [joinLoading, setJoinLoading] = useState<Set<string>>(new Set())
  const [myEventsOnly, setMyEventsOnly] = useState(false)

  const loadEvents = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getEvents({ limit: 50 })
      let filtered = data

      // Filter category
      if (activeCategory === 'Miễn phí') {
        filtered = filtered.filter(e => e.price === 0)
      } else if (activeCategory !== 'Tất cả') {
        filtered = filtered.filter(e => e.category === activeCategory)
      }

      // Filter search
      if (search.trim()) {
        filtered = filtered.filter(e =>
          e.title.toLowerCase().includes(search.toLowerCase()) ||
          e.location.toLowerCase().includes(search.toLowerCase())
        )
      }

      // Filter status
      if (activeStatus !== 'Tất cả') {
        filtered = filtered.filter(e => {
          const s = getEventStatus(e.start_date).status
          if (activeStatus === 'Sắp diễn ra') return s === 'upcoming'
          if (activeStatus === 'Đang diễn ra') return s === 'ongoing'
          return true
        })
      }

      // Filter date
      if (activeDateFilter !== 'Tất cả') {
        const now = new Date()
        filtered = filtered.filter(e => {
          const start = new Date(e.start_date)
          if (activeDateFilter === 'Hôm nay') {
            return start.toDateString() === now.toDateString()
          }
          if (activeDateFilter === 'Tuần này') {
            const weekEnd = new Date(now)
            weekEnd.setDate(now.getDate() + 7)
            return start >= now && start <= weekEnd
          }
          if (activeDateFilter === 'Tháng này') {
            return start.getMonth() === now.getMonth() &&
                   start.getFullYear() === now.getFullYear()
          }
          return true
        })
      }

      // Filter my events
      if (myEventsOnly && user) {
        filtered = filtered.filter(e => (e as any).creator_id === user.id)
      }

      // Ẩn events đã kết thúc
      filtered = filtered.filter(e => {
        const s = getEventStatus(e.start_date).status
        return s !== 'completed'
      })

      // Sort: ongoing first
      filtered.sort((a, b) => {
        const sa = getEventStatus(a.start_date).status
        const sb = getEventStatus(b.start_date).status
        if (sa === 'ongoing' && sb !== 'ongoing') return -1
        if (sb === 'ongoing' && sa !== 'ongoing') return 1
        return new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
      })

      setEvents(filtered)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [activeCategory, search, activeStatus, activeDateFilter, myEventsOnly, user])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  useFocusEffect(
    useCallback(() => {
      loadEvents()
    }, [])
  )

  useEffect(() => {
    if (!user) return
    supabase
      .from('event_attendees')
      .select('event_id')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (data) setJoinedEvents(new Set(data.map(r => r.event_id)))
      })
  }, [user])

  const handleJoin = async (event: Event) => {
    if (!user) {
      Alert.alert('Cần đăng nhập', 'Vui lòng đăng nhập để tham gia')
      return
    }
    const isJoined = joinedEvents.has(event.id)
    setJoinLoading(prev => new Set(prev).add(event.id))
    try {
      if (isJoined) {
        await supabase.from('event_attendees')
          .delete().eq('event_id', event.id).eq('user_id', user.id)
        setJoinedEvents(prev => { const n = new Set(prev); n.delete(event.id); return n })
        setEvents(prev => prev.map(e =>
          e.id === event.id ? { ...e, attendee_count: Math.max(0, e.attendee_count - 1) } : e
        ))
      } else {
        if (event.max_attendees && event.attendee_count >= event.max_attendees) {
          Alert.alert('Hết chỗ', 'Sự kiện đã đủ người')
          return
        }
        await supabase.from('event_attendees')
          .insert({ event_id: event.id, user_id: user.id })
        setJoinedEvents(prev => new Set(prev).add(event.id))
        setEvents(prev => prev.map(e =>
          e.id === event.id ? { ...e, attendee_count: e.attendee_count + 1 } : e
        ))
        Alert.alert('✅ Đã đăng ký!', event.title)
      }
    } catch (e: any) {
      Alert.alert('Lỗi', e.message)
    } finally {
      setJoinLoading(prev => { const n = new Set(prev); n.delete(event.id); return n })
    }
  }

  const handleDeleteMyEvent = async (eventId: string) => {
    if (typeof window !== 'undefined') {
      const ok = window.confirm('Xóa sự kiện này?')
      if (!ok) return
    }
    await supabase.from('events').delete().eq('id', eventId)
    setEvents(prev => prev.filter(e => e.id !== eventId))
  }

  return (
    <View style={s.screen}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerTop}>
          <Text style={s.title}>Sự kiện</Text>
          <View style={s.headerActions}>
            <TouchableOpacity
              style={s.iconBtn}
              onPress={() => setShowSearch(!showSearch)}
            >
              <Text style={s.iconBtnText}>🔍</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.iconBtn, showFilters && s.iconBtnActive]}
              onPress={() => setShowFilters(!showFilters)}
            >
              <Text style={s.iconBtnText}>⚙️</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.createBtn}
              onPress={() => router.push('/event/create')}
            >
              <Text style={s.createBtnText}>+ Tạo mới</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search */}
        {showSearch && (
          <View style={s.searchBox}>
            <Text style={s.searchIcon}>🔍</Text>
            <TextInput
              style={s.searchInput}
              placeholder="Tìm tên sự kiện, địa điểm..."
              placeholderTextColor="#94A3B8"
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Text style={s.clearBtn}>✕</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        {/* Advanced Filters */}
        {showFilters && (
          <View style={s.filtersBox}>
            {/* Status */}
            <Text style={s.filterLabel}>Trạng thái</Text>
            <View style={s.filterRow}>
              {STATUS_FILTERS.map(f => (
                <TouchableOpacity
                  key={f}
                  style={[s.filterChip, activeStatus === f && s.filterChipActive]}
                  onPress={() => setActiveStatus(f)}
                >
                  <Text style={[s.filterChipText, activeStatus === f && s.filterChipTextActive]}>
                    {f}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Date */}
            <Text style={s.filterLabel}>Thời gian</Text>
            <View style={s.filterRow}>
              {DATE_FILTERS.map(f => (
                <TouchableOpacity
                  key={f}
                  style={[s.filterChip, activeDateFilter === f && s.filterChipOrange]}
                  onPress={() => setActiveDateFilter(f)}
                >
                  <Text style={[s.filterChipText, activeDateFilter === f && s.filterChipTextActive]}>
                    {f}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* My Events */}
            {user && (
              <TouchableOpacity
                style={[s.myEventsToggle, myEventsOnly && s.myEventsToggleActive]}
                onPress={() => setMyEventsOnly(!myEventsOnly)}
              >
                <Text style={s.myEventsIcon}>👤</Text>
                <Text style={[
                  s.myEventsText,
                  myEventsOnly && s.myEventsTextActive,
                ]}>
                  Sự kiện của tôi
                </Text>
                {myEventsOnly && <Text style={s.myEventsCheck}>✓</Text>}
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Category Filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filterList}
        >
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[s.chip, activeCategory === cat && s.chipActive]}
              onPress={() => setActiveCategory(cat)}
            >
              <Text style={[s.chipText, activeCategory === cat && s.chipTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Events List */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.list}>
        {loading ? (
          <View style={s.center}>
            <ActivityIndicator color="#2563EB" size="large" />
            <Text style={s.loadingText}>Đang tải sự kiện...</Text>
          </View>
        ) : events.length === 0 ? (
          <View style={s.center}>
            <Text style={{ fontSize: 48 }}>📭</Text>
            <Text style={s.emptyTitle}>Không có sự kiện</Text>
            <Text style={s.emptyDesc}>Thử thay đổi bộ lọc hoặc tạo sự kiện mới</Text>
            <TouchableOpacity
              style={s.createEventBtn}
              onPress={() => router.push('/event/create')}
            >
              <Text style={s.createEventBtnText}>+ Tạo sự kiện</Text>
            </TouchableOpacity>
          </View>
        ) : (
          events.map((event) => {
            const eventStatus = getEventStatus(event.start_date)
            const statusColor = STATUS_COLORS[eventStatus.status as keyof typeof STATUS_COLORS]
              ?? STATUS_COLORS.upcoming
            const isJoined = joinedEvents.has(event.id)
            const isLoading = joinLoading.has(event.id)
            const isMyEvent = (event as any).creator_id === user?.id
            const dist = location && (event as any).lat && (event as any).lng
              ? formatDistance(calculateDistance(
                  { latitude: location.latitude, longitude: location.longitude },
                  { latitude: (event as any).lat, longitude: (event as any).lng }
                ))
              : null

            return (
              <TouchableOpacity
                key={event.id}
                style={s.card}
                onPress={() => router.push(`/event/${event.id}`)}
                activeOpacity={0.85}
              >
                {/* Banner */}
                <View style={s.cardBanner}>
                  {isRenderableEventImage(event.image) && !brokenImages.has(event.id) ? (
                    <Image
                      source={{ uri: getSafeImageUri(event.image) }}
                      style={s.cardImage}
                      resizeMode="cover"
                      onError={() => setBrokenImages(prev => new Set(prev).add(event.id))}
                    />
                  ) : (
                    <Text style={s.cardEmoji}>{getCategoryEmoji(event.category)}</Text>
                  )}
                  <View style={[s.priceBadge, {
                    backgroundColor: event.price === 0 ? '#16A34A' : '#F97316'
                  }]}>
                    <Text style={s.priceText}>
                      {event.price === 0 ? 'Miễn phí' : event.price.toLocaleString('vi-VN') + 'đ'}
                    </Text>
                  </View>
                  <View style={[s.statusBadge, { backgroundColor: statusColor.bg }]}>
                    <Text style={[s.statusText, { color: statusColor.color }]}>
                      {statusColor.label}
                    </Text>
                  </View>

                  {/* My event actions */}
                  {isMyEvent && (
                    <View style={s.myEventActions}>
                      <TouchableOpacity
                        style={s.editBtn}
                        onPress={(e) => {
                          e.stopPropagation?.()
                          router.push(`/event/${event.id}`)
                        }}
                      >
                        <Text style={s.editBtnText}>✏️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={s.deleteBtn}
                        onPress={(e) => {
                          e.stopPropagation?.()
                          handleDeleteMyEvent(event.id)
                        }}
                      >
                        <Text style={s.deleteBtnText}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Content */}
                <View style={s.cardBody}>
                  <Text style={s.cardCategory}>
                    {getCategoryEmoji(event.category)} {event.category}
                  </Text>
                  <Text style={s.cardTitle} numberOfLines={2}>{event.title}</Text>

                  <View style={s.infoRow}>
                    <View style={s.infoItem}>
                      <Text style={s.infoIcon}>📅</Text>
                      <Text style={s.infoText}>
                        {new Date(event.start_date).toLocaleDateString('vi-VN', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          timeZone: 'Asia/Ho_Chi_Minh',
                        })}
                      </Text>
                    </View>
                    <View style={s.infoItem}>
                      <Text style={s.infoIcon}>🕐</Text>
                      <Text style={s.infoText}>
                        {new Date(event.start_date).toLocaleTimeString('vi-VN', {
                          hour: '2-digit', minute: '2-digit',
                          timeZone: 'Asia/Ho_Chi_Minh',
                        })}
                      </Text>
                    </View>
                  </View>

                  <View style={s.infoRow}>
                    <View style={s.infoItem}>
                      <Text style={s.infoIcon}>📍</Text>
                      <Text style={s.infoText} numberOfLines={1}>{event.location}</Text>
                    </View>
                    {dist && (
                      <Text style={s.distText}>📡 {dist}</Text>
                    )}
                  </View>

                  {/* Footer */}
                  <View style={s.cardFooter}>
                    <View style={s.attendeeRow}>
                      <Text style={s.attendeeIcon}>👥</Text>
                      <Text style={s.attendeeText}>{event.attendee_count} người</Text>
                    </View>
                    <View style={s.cardActions}>
                      {eventStatus.countdown && (
                        <View style={s.countdownBadge}>
                          <Text style={s.countdownText}>⏰ {eventStatus.countdown}</Text>
                        </View>
                      )}
                      <TouchableOpacity
                        style={[s.joinBtn, isJoined && s.joinBtnJoined]}
                        onPress={(e) => {
                          e.stopPropagation?.()
                          handleJoin(event)
                        }}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <ActivityIndicator size="small" color="#2563EB" />
                        ) : (
                          <Text style={[s.joinBtnText, isJoined && s.joinBtnTextJoined]}>
                            {isJoined ? '✓ Đã tham gia' : 'Tham gia'}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            )
          })
        )}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    backgroundColor: '#fff', paddingTop: 52,
    shadowColor: '#000', shadowOpacity: 0.06,
    shadowRadius: 8, elevation: 4,
  },
  headerTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 16, marginBottom: 12,
  },
  title: { fontSize: 26, fontWeight: '900', color: '#0F172A' },
  headerActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  iconBtn: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center', alignItems: 'center',
  },
  iconBtnActive: { backgroundColor: '#EFF6FF', borderWidth: 1.5, borderColor: '#2563EB' },
  iconBtnText: { fontSize: 16 },
  createBtn: {
    backgroundColor: '#2563EB', paddingHorizontal: 14,
    paddingVertical: 8, borderRadius: 10,
  },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F1F5F9', marginHorizontal: 16,
    marginBottom: 12, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10, gap: 8,
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, fontSize: 14, color: '#0F172A' },
  clearBtn: { color: '#94A3B8', fontSize: 16 },

  // Filters
  filtersBox: {
    paddingHorizontal: 16, paddingBottom: 12,
    borderTopWidth: 1, borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  filterLabel: {
    fontSize: 11, color: '#94A3B8', fontWeight: '700',
    marginBottom: 6, textTransform: 'uppercase',
  },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 16, backgroundColor: '#F1F5F9',
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  filterChipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  filterChipOrange: { backgroundColor: '#F97316', borderColor: '#F97316' },
  filterChipText: { fontSize: 12, color: '#475569', fontWeight: '600' },
  filterChipTextActive: { color: '#fff' },
  myEventsToggle: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, backgroundColor: '#F1F5F9',
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 10, alignSelf: 'flex-start',
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  myEventsToggleActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  myEventsIcon: { fontSize: 14 },
  myEventsText: { fontSize: 13, color: '#475569', fontWeight: '600' },
  myEventsTextActive: { color: '#2563EB' },
  myEventsCheck: { color: '#2563EB', fontWeight: '800', fontSize: 14 },

  // Category chips
  filterList: { paddingHorizontal: 16, gap: 8, paddingBottom: 12 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 7,
    borderRadius: 20, backgroundColor: '#F1F5F9',
    borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  chipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipText: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  chipTextActive: { color: '#fff' },

  // List
  list: { padding: 16, gap: 14 },
  center: { alignItems: 'center', paddingTop: 60, gap: 8 },
  loadingText: { color: '#64748B', fontSize: 14 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  emptyDesc: { fontSize: 14, color: '#64748B', textAlign: 'center' },
  createEventBtn: {
    marginTop: 8, backgroundColor: '#2563EB',
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12,
  },
  createEventBtnText: { color: '#fff', fontWeight: '700' },

  // Card
  card: {
    backgroundColor: '#fff', borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.08,
    shadowRadius: 10, elevation: 3,
  },
  cardBanner: {
    height: 110, backgroundColor: '#EFF6FF',
    justifyContent: 'center', alignItems: 'center',
  },
  cardImage: { width: '100%', height: 110 },
  cardEmoji: { fontSize: 44 },
  priceBadge: {
    position: 'absolute', top: 10, right: 10,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  priceText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  statusBadge: {
    position: 'absolute', top: 10, left: 10,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  statusText: { fontSize: 11, fontWeight: '700' },
  myEventActions: {
    position: 'absolute', bottom: 8, right: 8,
    flexDirection: 'row', gap: 6,
  },
  editBtn: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center', alignItems: 'center',
  },
  editBtnText: { fontSize: 14 },
  deleteBtn: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center', alignItems: 'center',
  },
  deleteBtnText: { fontSize: 14 },
  cardBody: { padding: 16 },
  cardCategory: { fontSize: 11, color: '#2563EB', fontWeight: '700', marginBottom: 6, textTransform: 'uppercase' },
  cardTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A', marginBottom: 12 },
  infoRow: { flexDirection: 'row', gap: 16, marginBottom: 6 },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  infoIcon: { fontSize: 13 },
  infoText: { fontSize: 13, color: '#475569', flex: 1 },
  distText: { fontSize: 12, color: '#2563EB', fontWeight: '600' },
  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginTop: 12,
    paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9',
  },
  attendeeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  attendeeIcon: { fontSize: 13 },
  attendeeText: { fontSize: 12, color: '#94A3B8' },
  cardActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  countdownBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  countdownText: { fontSize: 11, color: '#B45309', fontWeight: '600' },
  joinBtn: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 10, borderWidth: 1.5, borderColor: '#2563EB',
    minWidth: 44, minHeight: 44,
    justifyContent: 'center', alignItems: 'center',
  },
  joinBtnJoined: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  joinBtnText: { color: '#2563EB', fontSize: 13, fontWeight: '700' },
  joinBtnTextJoined: { color: '#fff' },
})
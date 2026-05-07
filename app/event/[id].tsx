import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Share, Alert, Image,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { getEventById, Event } from '../../services/eventService'
import { useAuthStore } from '../../stores/useAuthStore'
import { supabase } from '../../services/supabase'
import { scheduleEventReminder, cancelEventReminder } from '../../services/notificationService'
import ReviewSection from '../../components/place/ReviewSection'
import { getRatingDistribution } from '../../services/reviewService'

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const user = useAuthStore((s) => s.user)
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [isJoined, setIsJoined] = useState(false)
  const [joinLoading, setJoinLoading] = useState(false)
  const [attendeeCount, setAttendeeCount] = useState(0)
  const [reviewCount, setReviewCount] = useState(0)
  const [ratingDist, setRatingDist] = useState<Record<number, number>>({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 })

  useEffect(() => {
    if (!id) return
    loadEventData()
  }, [id, user])

  const loadEventData = async () => {
    setLoading(true)
    try {
      // Load event
      const eventData = await getEventById(id!)
      setEvent(eventData)

      // Load attendee count thật từ event_attendees
      const { count } = await supabase
        .from('event_attendees')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', id)
      setAttendeeCount(count ?? 0)

      // Load review count + distribution
      const { count: rCount } = await supabase
        .from('reviews')
        .select('*', { count: 'exact', head: true })
        .eq('target_id', id)
        .eq('target_type', 'event')
        .eq('is_flagged', false)
      setReviewCount(rCount ?? 0)
      const dist = await getRatingDistribution(id!, 'event')
      setRatingDist(dist)

      if (user) {
        // Kiểm tra đã join chưa
        const { data: joinData } = await supabase
          .from('event_attendees')
          .select('id')
          .eq('event_id', id)
          .eq('user_id', user.id)
          .maybeSingle()
        setIsJoined(!!joinData)

        // Kiểm tra đã bookmark chưa
        const { data: bookmarkData } = await supabase
          .from('bookmarks')
          .select('id')
          .eq('user_id', user.id)
          .eq('target_id', id)
          .eq('target_type', 'event')
          .maybeSingle()
        setIsBookmarked(!!bookmarkData)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async () => {
    if (!user) {
      Alert.alert('Cần đăng nhập', 'Vui lòng đăng nhập để tham gia')
      return
    }
    if (!event) return
    setJoinLoading(true)
    try {
      if (isJoined) {
        await supabase
          .from('event_attendees')
          .delete()
          .eq('event_id', event.id)
          .eq('user_id', user.id)
        await cancelEventReminder(event.id)
        setIsJoined(false)
        setAttendeeCount(c => Math.max(0, c - 1))
      } else {
        if (event.max_attendees && attendeeCount >= event.max_attendees) {
          Alert.alert('Hết chỗ', 'Sự kiện đã đủ người tham gia')
          return
        }
        await supabase
          .from('event_attendees')
          .insert({ event_id: event.id, user_id: user.id })
        await scheduleEventReminder({
          id: event.id,
          title: event.title,
          start_date: event.start_date,
          location: event.location,
        })
        setIsJoined(true)
        setAttendeeCount(c => c + 1)
        Alert.alert('✅ Đã đăng ký!', `Bạn đã tham gia "${event.title}"`)
      }
    } catch (e: any) {
      Alert.alert('Lỗi', e.message)
    } finally {
      setJoinLoading(false)
    }
  }

  const handleBookmark = async () => {
    if (!user || !event) return
    if (isBookmarked) {
      await supabase
        .from('bookmarks')
        .delete()
        .eq('user_id', user.id)
        .eq('target_id', event.id)
      setIsBookmarked(false)
    } else {
      await supabase
        .from('bookmarks')
        .insert({
          user_id: user.id,
          target_id: event.id,
          target_type: 'event',
        })
      setIsBookmarked(true)
    }
  }

  const handleShare = async () => {
    if (!event) return
    await Share.share({
      message: `${event.title}\n📍 ${event.location}\n📅 ${new Date(event.start_date).toLocaleDateString('vi-VN')}`,
    })
  }

  const getEventStatus = () => {
    if (!event) return { status: 'upcoming', label: 'Sắp diễn ra' }
    const now = Date.now()
    const start = new Date(event.start_date).getTime()
    if (now < start) return { status: 'upcoming', label: 'Sắp diễn ra' }
    return { status: 'ongoing', label: 'Đang diễn ra' }
  }

  const getCountdown = () => {
    if (!event) return null
    const diff = new Date(event.start_date).getTime() - Date.now()
    if (diff <= 0) return null
    const days = Math.floor(diff / 86400000)
    const hours = Math.floor((diff % 86400000) / 3600000)
    const mins = Math.floor((diff % 3600000) / 60000)
    return { days, hours, mins }
  }

  if (loading) {
    return (
      <View style={s.loadingScreen}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    )
  }

  if (!event) {
    return (
      <View style={s.loadingScreen}>
        <Text style={s.notFoundText}>Không tìm thấy sự kiện</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.backLink}>← Quay lại</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const countdown = getCountdown()
  const eventStatus = getEventStatus()
  const capacity = event.max_attendees
    ? Math.round((attendeeCount / event.max_attendees) * 100)
    : 0

  const getCategoryEmoji = (cat: string) => {
    const map: Record<string, string> = {
      'Âm nhạc': '🎵', 'Ẩm thực': '🍔',
      'Thể thao': '🏃', 'Văn hóa': '🎨',
      'Nghệ thuật': '🖼️', 'Khác': '🎪',
    }
    return map[cat] ?? '🎪'
  }

  return (
    <View style={s.screen}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={s.hero}>
          {event.image && !event.image.includes('placeholder') ? (
            <Image source={{ uri: event.image }} style={s.heroImage} resizeMode="cover" />
          ) : (
            <View style={s.heroFallback}>
              <Text style={s.heroEmoji}>{getCategoryEmoji(event.category)}</Text>
            </View>
          )}
          <View style={s.heroOverlay} />
          <View style={s.heroTop}>
            <TouchableOpacity style={s.heroBtn} onPress={() => router.back()}>
              <Text style={s.heroBtnIcon}>←</Text>
            </TouchableOpacity>
            <View style={s.heroRight}>
              <TouchableOpacity style={s.heroBtn} onPress={handleShare}>
                <Text style={s.heroBtnIcon}>↗</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.heroBtn} onPress={handleBookmark}>
                <Text style={s.heroBtnIcon}>{isBookmarked ? '❤️' : '🤍'}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={[
            s.heroPriceBadge,
            { backgroundColor: event.price === 0 ? '#16A34A' : '#F97316' },
          ]}>
            <Text style={s.heroPriceText}>
              {event.price === 0 ? '🎁 Miễn phí' : event.price.toLocaleString('vi-VN') + 'đ'}
            </Text>
          </View>
        </View>

        <View style={s.content}>
          {/* Status + Category */}
          <View style={s.topRow}>
            <View style={s.categoryBadge}>
              <Text style={s.categoryText}>{event.category}</Text>
            </View>
            <View style={[
              s.statusBadge,
              { backgroundColor: eventStatus.status === 'ongoing' ? '#F0FDF4' : '#EFF6FF' },
            ]}>
              <View style={[
                s.statusDot,
                { backgroundColor: eventStatus.status === 'ongoing' ? '#16A34A' : '#2563EB' },
              ]} />
              <Text style={[
                s.statusText,
                { color: eventStatus.status === 'ongoing' ? '#16A34A' : '#2563EB' },
              ]}>
                {eventStatus.label}
              </Text>
            </View>
          </View>

          {/* Title */}
          <Text style={s.eventTitle}>{event.title}</Text>

          {/* Countdown */}
          {countdown && (
            <View style={s.countdownBox}>
              <Text style={s.countdownLabel}>⏰ Bắt đầu sau</Text>
              <View style={s.countdownRow}>
                {[
                  { value: countdown.days, label: 'Ngày' },
                  { value: countdown.hours, label: 'Giờ' },
                  { value: countdown.mins, label: 'Phút' },
                ].map((item) => (
                  <View key={item.label} style={s.countdownItem}>
                    <Text style={s.countdownValue}>
                      {item.value.toString().padStart(2, '0')}
                    </Text>
                    <Text style={s.countdownUnit}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Info Grid */}
          <View style={s.infoGrid}>
            {[
              {
                icon: '📅', label: 'Ngày',
                value: new Date(event.start_date).toLocaleDateString('vi-VN', {
                  weekday: 'long', day: '2-digit',
                  month: '2-digit', year: 'numeric',
                  timeZone: 'Asia/Ho_Chi_Minh',
                })
              },
              {
                icon: '🕐', label: 'Giờ bắt đầu',
                value: new Date(event.start_date).toLocaleTimeString('vi-VN', {
                  hour: '2-digit', minute: '2-digit',
                  timeZone: 'Asia/Ho_Chi_Minh',
                })
              },
              {
                icon: '📍', label: 'Địa điểm',
                value: event.location
              },
              {
                icon: '💰', label: 'Giá vé',
                value: event.price === 0
                  ? 'Miễn phí'
                  : event.price.toLocaleString('vi-VN') + 'đ'
              },
            ].map((item) => (
              <View key={item.label} style={s.infoItem}>
                <Text style={s.infoIcon}>{item.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.infoLabel}>{item.label}</Text>
                  <Text style={s.infoValue}>{item.value}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Capacity — dùng attendeeCount thật */}
          {event.max_attendees && (
            <View style={s.capacityBox}>
              <View style={s.capacityHeader}>
                <Text style={s.capacityLabel}>👥 Người tham dự</Text>
                <Text style={s.capacityCount}>
                  {attendeeCount} / {event.max_attendees}
                </Text>
              </View>
              <View style={s.progressBar}>
                <View style={[
                  s.progressFill,
                  {
                    width: `${Math.min(capacity, 100)}%` as any,
                    backgroundColor: capacity >= 90 ? '#EF4444' :
                                     capacity >= 70 ? '#F97316' : '#2563EB',
                  },
                ]} />
              </View>
              <Text style={s.capacityNote}>
                {capacity}% đã đăng ký
              </Text>
            </View>
          )}

          {/* Description */}
          <View style={s.descBox}>
            <Text style={s.descTitle}>📋 Giới thiệu</Text>
            <Text style={s.descText}>{event.description}</Text>
          </View>

          {/* Rating Breakdown */}
          <View style={s.ratingBreakdown}>
            <Text style={s.sectionLabel}>⭐ Đánh giá</Text>
            {reviewCount === 0 ? (
              <View style={s.noRatingBox}>
                <Text style={s.noRatingIcon}>📝</Text>
                <Text style={s.noRatingTitle}>Chưa có đánh giá nào</Text>
                <Text style={s.noRatingDesc}>Hãy là người đầu tiên đánh giá sự kiện này!</Text>
              </View>
            ) : (
              <View style={s.ratingOverview}>
                <View style={s.ratingBig}>
                  <Text style={s.ratingBigValue}>{event.rating ?? '—'}</Text>
                  <Text style={s.ratingBigStars}>
                    {'★'.repeat(Math.round(event.rating ?? 0))}
                    {'☆'.repeat(5 - Math.round(event.rating ?? 0))}
                  </Text>
                  <Text style={s.ratingBigCount}>{reviewCount} đánh giá</Text>
                </View>
                <View style={s.ratingBars}>
                  {[5, 4, 3, 2, 1].map(star => {
                    const cnt = ratingDist[star] ?? 0
                    const pct = reviewCount > 0 ? Math.round((cnt / reviewCount) * 100) : 0
                    return (
                      <View key={star} style={s.ratingBarRow}>
                        <Text style={s.ratingBarLabel}>{star}★</Text>
                        <View style={s.ratingBarBg}>
                          <View style={[
                            s.ratingBarFill,
                            {
                              width: `${pct}%` as any,
                              backgroundColor: star >= 4 ? '#22C55E' : star === 3 ? '#F59E0B' : '#EF4444',
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

          {/* Reviews */}
          <View style={{ marginBottom: 100 }}>
            <ReviewSection targetId={id!} targetType="event" ownerId={event.creator_id} />
          </View>
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <View style={s.bottomCTA}>
        <TouchableOpacity
          style={s.groupChatBtn}
          onPress={() => router.push(`/event/group-chat/${id}`)}
        >
          <Text style={s.groupChatBtnText}>💬</Text>
        </TouchableOpacity>
        {user && event.creator_id !== user.id && (
          <TouchableOpacity
            style={s.dmOrgBtn}
            onPress={() => router.push(`/dm/${event.creator_id}` as any)}
          >
            <Text style={s.groupChatBtnText}>✉️</Text>
          </TouchableOpacity>
        )}
        <View style={s.ctaLeft}>
          <Text style={s.ctaPrice}>
            {event.price === 0 ? 'Miễn phí' : event.price.toLocaleString('vi-VN') + 'đ'}
          </Text>
          <Text style={s.ctaAttendee}>
            {attendeeCount} người tham gia
          </Text>
        </View>
        <TouchableOpacity
          style={[s.ctaBtn, isJoined && s.ctaBtnJoined]}
          onPress={handleJoin}
          disabled={joinLoading}
        >
          {joinLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={s.ctaBtnText}>
              {isJoined ? '✓ Hủy đăng ký' : '🎟️ Đăng ký tham gia'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  loadingScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  notFoundText: { fontSize: 16, color: '#64748B' },
  backLink: { color: '#2563EB', fontSize: 15, fontWeight: '600' },
  hero: {
    height: 220, backgroundColor: '#EFF6FF',
    justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden',
  },
  heroImage: { position: 'absolute', width: '100%', height: '100%' },
  heroFallback: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  heroOverlay: {
    position: 'absolute', width: '100%', height: '100%',
    backgroundColor: 'rgba(0,0,0,0.15)',
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
  heroBtnIcon: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  heroPriceBadge: {
    position: 'absolute', bottom: 16, right: 16,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
  },
  heroPriceText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  content: { padding: 16 },
  topRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  categoryBadge: {
    backgroundColor: '#EFF6FF', paddingHorizontal: 12,
    paddingVertical: 5, borderRadius: 8,
  },
  categoryText: { color: '#2563EB', fontSize: 12, fontWeight: '700' },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '700' },
  eventTitle: {
    fontSize: 24, fontWeight: '900', color: '#0F172A',
    marginBottom: 16, lineHeight: 32,
  },
  countdownBox: {
    backgroundColor: '#FFF7ED', borderRadius: 16,
    padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: '#FED7AA',
  },
  countdownLabel: { fontSize: 13, color: '#B45309', fontWeight: '600', marginBottom: 12 },
  countdownRow: { flexDirection: 'row', gap: 16 },
  countdownItem: { alignItems: 'center', flex: 1 },
  countdownValue: { fontSize: 32, fontWeight: '900', color: '#EA580C', lineHeight: 36 },
  countdownUnit: { fontSize: 11, color: '#B45309', fontWeight: '600', marginTop: 2 },
  infoGrid: {
    backgroundColor: '#fff', borderRadius: 16,
    padding: 4, marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.06,
    shadowRadius: 8, elevation: 2,
  },
  infoItem: {
    flexDirection: 'row', alignItems: 'flex-start',
    padding: 12, gap: 12,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  infoIcon: { fontSize: 20, marginTop: 2 },
  infoLabel: { fontSize: 12, color: '#94A3B8', fontWeight: '500' },
  infoValue: { fontSize: 14, color: '#0F172A', fontWeight: '600', marginTop: 2 },
  capacityBox: {
    backgroundColor: '#fff', borderRadius: 16,
    padding: 16, marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.06,
    shadowRadius: 8, elevation: 2,
  },
  capacityHeader: {
    flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10,
  },
  capacityLabel: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  capacityCount: { fontSize: 13, color: '#64748B' },
  progressBar: {
    height: 8, backgroundColor: '#E2E8F0',
    borderRadius: 4, overflow: 'hidden', marginBottom: 6,
  },
  progressFill: { height: '100%', borderRadius: 4 },
  capacityNote: { fontSize: 12, color: '#94A3B8' },
  descBox: {
    backgroundColor: '#fff', borderRadius: 16,
    padding: 16, marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.06,
    shadowRadius: 8, elevation: 2,
  },
  descTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 10 },
  descText: { fontSize: 14, color: '#475569', lineHeight: 22 },
  bottomCTA: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderTopWidth: 1, borderTopColor: '#F1F5F9',
    shadowColor: '#000', shadowOpacity: 0.1,
    shadowRadius: 8, elevation: 8,
  },
  ctaLeft: { flex: 1 },
  ctaPrice: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
  ctaAttendee: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  ctaBtn: {
    backgroundColor: '#2563EB', paddingHorizontal: 20,
    paddingVertical: 14, borderRadius: 14,
    shadowColor: '#2563EB', shadowOpacity: 0.4,
    shadowRadius: 8, elevation: 5,
  },
  ctaBtnJoined: { backgroundColor: '#EF4444' },
  ctaBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  // Rating breakdown
  ratingBreakdown: {
    backgroundColor: '#fff', borderRadius: 16,
    padding: 16, marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.06,
    shadowRadius: 8, elevation: 2,
  },
  sectionLabel: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 12 },
  noRatingBox: { alignItems: 'center', padding: 12, gap: 6 },
  noRatingIcon: { fontSize: 32 },
  noRatingTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  noRatingDesc: { fontSize: 12, color: '#64748B', textAlign: 'center' },
  ratingOverview: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  ratingBig: { alignItems: 'center', width: 80 },
  ratingBigValue: { fontSize: 36, fontWeight: '900', color: '#0F172A' },
  ratingBigStars: { fontSize: 14, color: '#F59E0B', marginTop: 4 },
  ratingBigCount: { fontSize: 11, color: '#94A3B8', marginTop: 4, textAlign: 'center' },
  ratingBars: { flex: 1, gap: 6 },
  ratingBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ratingBarLabel: { fontSize: 12, color: '#64748B', width: 24, textAlign: 'right' },
  ratingBarBg: {
    flex: 1, height: 8, backgroundColor: '#F1F5F9',
    borderRadius: 4, overflow: 'hidden',
  },
  ratingBarFill: { height: '100%', borderRadius: 4 },
  ratingBarPct: { fontSize: 11, color: '#94A3B8', width: 30, textAlign: 'right' },
  groupChatBtn: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#BFDBFE',
  },
  dmOrgBtn: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#F0FDF4', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#BBF7D0',
  },
  groupChatBtnText: { fontSize: 20 },
})
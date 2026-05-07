import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native'
import { useRouter, useRootNavigationState } from 'expo-router'
import { useState, useEffect } from 'react'
import { useAuthStore } from '../../stores/useAuthStore'
import { supabase } from '../../services/supabase'
import { sendPushToUser } from '../../services/notificationService'

interface Stats {
  totalUsers: number
  totalPlaces: number
  totalEvents: number
  totalReviews: number
  pendingEvents: number
  flaggedReviews: number
  todayActivity: number
}

interface PendingEvent {
  id: string
  title: string
  category: string
  location: string
  start_date: string
  price: number
  creator_id: string
  profiles?: { name: string }
}

interface FlaggedReview {
  id: string
  content: string
  rating: number
  target_id: string
  target_type: string
  user_id: string
  profiles?: { name: string }
}

interface RecentUser {
  id: string
  name: string
  email: string
  created_at: string
  travel_style: string
}

const TABS = ['Tổng quan', 'Sự kiện chờ', 'Báo cáo', 'Người dùng']

export default function AdminDashboard() {
  const router = useRouter()
  const navState = useRootNavigationState()
  const user = useAuthStore((s) => s.user)
  const [activeTab, setActiveTab] = useState('Tổng quan')
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0, totalPlaces: 0, totalEvents: 0,
    totalReviews: 0, pendingEvents: 0, flaggedReviews: 0,
    todayActivity: 0,
  })
  const [pendingEvents, setPendingEvents] = useState<PendingEvent[]>([])
  const [flaggedReviews, setFlaggedReviews] = useState<FlaggedReview[]>([])
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    if (!navState?.key) return
    if (!user) return // _layout.tsx handles unauthenticated redirect
    if ((user as any).role !== 'admin') {
      Alert.alert('Không có quyền', 'Chỉ admin mới truy cập được trang này', [
        { text: 'OK', onPress: () => router.back() },
      ])
      return
    }
    loadAll()
  }, [user, navState?.key])

  const loadAll = async () => {
    setLoading(true)
    await Promise.all([
      loadStats(),
      loadPendingEvents(),
      loadFlaggedReviews(),
      loadRecentUsers(),
    ])
    setLoading(false)
  }

  const loadStats = async () => {
    const [
      { count: users },
      { count: places },
      { count: events },
      { count: reviews },
      { count: pending },
      { count: flagged },
      { count: activity },
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('places').select('*', { count: 'exact', head: true }),
      supabase.from('events').select('*', { count: 'exact', head: true }),
      supabase.from('reviews').select('*', { count: 'exact', head: true }),
      supabase.from('events').select('*', { count: 'exact', head: true }).eq('is_approved', false),
      supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('is_flagged', true),
      supabase.from('user_activity').select('*', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 86400000).toISOString()),
    ])

    setStats({
      totalUsers: users ?? 0,
      totalPlaces: places ?? 0,
      totalEvents: events ?? 0,
      totalReviews: reviews ?? 0,
      pendingEvents: pending ?? 0,
      flaggedReviews: flagged ?? 0,
      todayActivity: activity ?? 0,
    })
  }

  const loadPendingEvents = async () => {
    const { data } = await supabase
      .from('events')
      .select('*, profiles(name)')
      .eq('is_approved', false)
      .order('created_at', { ascending: false })
      .limit(20)
    setPendingEvents((data as PendingEvent[]) ?? [])
  }

  const loadFlaggedReviews = async () => {
    const { data } = await supabase
      .from('reviews')
      .select('*, profiles(name)')
      .eq('is_flagged', true)
      .order('created_at', { ascending: false })
      .limit(20)
    setFlaggedReviews((data as FlaggedReview[]) ?? [])
  }

  const loadRecentUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, name, created_at, travel_style')
      .order('created_at', { ascending: false })
      .limit(20)
    setRecentUsers((data as RecentUser[]) ?? [])
  }

const handleApproveEvent = async (eventId: string) => {
  setActionLoading(eventId)
  try {
    const { error } = await supabase.rpc('admin_approve_event', { p_event_id: eventId })
    if (error) throw error

    const event = pendingEvents.find(e => e.id === eventId)
    if (event?.creator_id) {
      await supabase.from('notifications').insert({
        user_id: event.creator_id,
        type: 'event',
        title: '✅ Sự kiện đã được duyệt!',
        message: `"${event.title}" đã được phê duyệt và hiển thị trên tab Sự kiện.`,
        target_id: eventId,
        target_type: 'event',
        is_read: false,
      })
      sendPushToUser(
        event.creator_id,
        '✅ Sự kiện đã được duyệt!',
        `"${event.title}" đã được phê duyệt và hiển thị trên tab Sự kiện.`,
        { type: 'event', targetId: eventId }
      )
    }

    // Cập nhật UI ngay lập tức
    setPendingEvents(prev => prev.filter(e => e.id !== eventId))
    setStats(s => ({
      ...s,
      pendingEvents: Math.max(0, s.pendingEvents - 1),
      totalEvents: s.totalEvents,
    }))

    Alert.alert('✅ Đã duyệt!', 'Sự kiện hiển thị trên tab Sự kiện ngay bây giờ')
  } catch (e: any) {
    Alert.alert('Lỗi', e.message)
  } finally {
    setActionLoading(null)
  }
}

const handleRejectEvent = async (eventId: string) => {
  if (typeof window !== 'undefined') {
    const reason = window.prompt('Lý do từ chối (tùy chọn):') ?? ''
    if (reason === null) return // User bấm Cancel
  }

  setActionLoading(eventId)
  try {
    const event = pendingEvents.find(e => e.id === eventId)

    if (event?.creator_id) {
      // Thông báo user bị từ chối
      await supabase.from('notifications').insert({
        user_id: event.creator_id,
        type: 'alert',
        title: '❌ Sự kiện không được duyệt',
        message: `"${event.title}" chưa đáp ứng yêu cầu. Vui lòng chỉnh sửa nội dung và gửi lại.`,
        target_id: null,
        target_type: 'event',
        is_read: false,
      })
      sendPushToUser(
        event.creator_id,
        '❌ Sự kiện không được duyệt',
        `"${event.title}" chưa đáp ứng yêu cầu. Vui lòng chỉnh sửa nội dung và gửi lại.`,
        { type: 'event', targetId: null }
      )
    }

    const { error: delError } = await supabase.rpc('admin_reject_event', { p_event_id: eventId })
    if (delError) throw delError
    setPendingEvents(prev => prev.filter(e => e.id !== eventId))
    setStats(s => ({ ...s, pendingEvents: s.pendingEvents - 1 }))
    Alert.alert('Đã từ chối', 'Người tạo đã được thông báo')
  } catch (e: any) {
    Alert.alert('Lỗi', e.message)
  } finally {
    setActionLoading(null)
  }
}

  const handleDeleteReview = async (reviewId: string) => {
    if (typeof window !== 'undefined') {
      const ok = window.confirm('Xóa đánh giá này?')
      if (!ok) return
    }
    setActionLoading(reviewId)
    try {
      const { error: delError } = await supabase.rpc('admin_delete_review', { p_review_id: reviewId })
      if (delError) throw delError
      setFlaggedReviews(prev => prev.filter(r => r.id !== reviewId))
      setStats(s => ({ ...s, flaggedReviews: s.flaggedReviews - 1 }))
    } catch (e: any) {
      Alert.alert('Lỗi', e.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleRestoreReview = async (reviewId: string) => {
    setActionLoading(reviewId)
    try {
      await supabase
        .from('reviews')
        .update({ is_flagged: false })
        .eq('id', reviewId)
      setFlaggedReviews(prev => prev.filter(r => r.id !== reviewId))
      setStats(s => ({ ...s, flaggedReviews: s.flaggedReviews - 1 }))
    } catch (e: any) {
      Alert.alert('Lỗi', e.message)
    } finally {
      setActionLoading(null)
    }
  }

  if (!user || loading) {
    return (
      <View style={s.loadingScreen}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={s.loadingText}>Đang tải dữ liệu...</Text>
      </View>
    )
  }

  return (
    <View style={s.screen}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.backBtn}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={s.title}>Admin Dashboard</Text>
          <Text style={s.subtitle}>ExploreEase Management</Text>
        </View>
        <TouchableOpacity style={s.refreshBtn} onPress={loadAll}>
          <Text style={s.refreshIcon}>🔄</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.tabBar}
        contentContainerStyle={s.tabList}
      >
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[s.tab, activeTab === tab && s.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>
              {tab}
              {tab === 'Sự kiện chờ' && stats.pendingEvents > 0 && (
                <Text style={s.tabBadge}> {stats.pendingEvents}</Text>
              )}
              {tab === 'Báo cáo' && stats.flaggedReviews > 0 && (
                <Text style={s.tabBadgeRed}> {stats.flaggedReviews}</Text>
              )}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Tab: Tổng quan */}
        {activeTab === 'Tổng quan' && (
          <View style={s.content}>
            <Text style={s.sectionTitle}>📊 Thống kê tổng quan</Text>
            <View style={s.statsGrid}>
              {[
                { icon: '👥', label: 'Người dùng', value: stats.totalUsers, color: '#EFF6FF', accent: '#2563EB' },
                { icon: '📍', label: 'Địa điểm', value: stats.totalPlaces, color: '#F0FDF4', accent: '#16A34A' },
                { icon: '🎪', label: 'Sự kiện', value: stats.totalEvents, color: '#FFF7ED', accent: '#F97316' },
                { icon: '⭐', label: 'Đánh giá', value: stats.totalReviews, color: '#FEFCE8', accent: '#CA8A04' },
                { icon: '⏳', label: 'Chờ duyệt', value: stats.pendingEvents, color: '#FEF3C7', accent: '#D97706' },
                { icon: '🚩', label: 'Báo cáo', value: stats.flaggedReviews, color: '#FEF2F2', accent: '#EF4444' },
                { icon: '📈', label: 'Hôm nay', value: stats.todayActivity, color: '#F5F3FF', accent: '#7C3AED' },
                { icon: '🌟', label: 'Đã duyệt', value: stats.totalEvents - stats.pendingEvents, color: '#F0FDF4', accent: '#16A34A' },
              ].map((stat) => (
                <View key={stat.label} style={[s.statCard, { backgroundColor: stat.color }]}>
                  <Text style={s.statIcon}>{stat.icon}</Text>
                  <Text style={[s.statValue, { color: stat.accent }]}>{stat.value}</Text>
                  <Text style={s.statLabel}>{stat.label}</Text>
                </View>
              ))}
            </View>

            {(stats.pendingEvents > 0 || stats.flaggedReviews > 0) && (
              <View style={s.alertsBox}>
                <Text style={s.sectionTitle}>🔔 Cần xử lý</Text>
                {stats.pendingEvents > 0 && (
                  <TouchableOpacity
                    style={s.alertItem}
                    onPress={() => setActiveTab('Sự kiện chờ')}
                  >
                    <Text style={s.alertIcon}>⏳</Text>
                    <Text style={s.alertText}>
                      {stats.pendingEvents} sự kiện đang chờ duyệt
                    </Text>
                    <Text style={s.alertArrow}>›</Text>
                  </TouchableOpacity>
                )}
                {stats.flaggedReviews > 0 && (
                  <TouchableOpacity
                    style={[s.alertItem, s.alertItemRed]}
                    onPress={() => setActiveTab('Báo cáo')}
                  >
                    <Text style={s.alertIcon}>🚩</Text>
                    <Text style={s.alertText}>
                      {stats.flaggedReviews} đánh giá bị báo cáo
                    </Text>
                    <Text style={s.alertArrow}>›</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <Text style={s.sectionTitle}>⚡ Thao tác nhanh</Text>
            <View style={s.quickActions}>
              {[
                { icon: '➕', label: 'Thêm địa điểm', action: () => {} },
                { icon: '🎪', label: 'Tạo sự kiện', action: () => router.push('/event/create') },
                { icon: '👤', label: 'Quản lý user', action: () => setActiveTab('Người dùng') },
                { icon: '📊', label: 'Xem báo cáo', action: () => setActiveTab('Báo cáo') },
              ].map((action) => (
                <TouchableOpacity
                  key={action.label}
                  style={s.quickActionBtn}
                  onPress={action.action}
                >
                  <Text style={s.quickActionIcon}>{action.icon}</Text>
                  <Text style={s.quickActionLabel}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Tab: Sự kiện chờ duyệt */}
        {activeTab === 'Sự kiện chờ' && (
          <View style={s.content}>
            <Text style={s.sectionTitle}>
              ⏳ Sự kiện chờ duyệt ({pendingEvents.length})
            </Text>
            {pendingEvents.length === 0 ? (
              <View style={s.emptyBox}>
                <Text style={s.emptyIcon}>✅</Text>
                <Text style={s.emptyTitle}>Không có sự kiện chờ duyệt</Text>
              </View>
            ) : (
              pendingEvents.map((event) => (
                <View key={event.id} style={s.eventCard}>
                  <View style={s.eventHeader}>
                    <View style={s.eventCatBadge}>
                      <Text style={s.eventCatText}>{event.category}</Text>
                    </View>
                    <Text style={s.eventDate}>
                      {new Date(event.start_date).toLocaleDateString('vi-VN', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        timeZone: 'Asia/Ho_Chi_Minh',
                      })}
                    </Text>
                  </View>

                  <Text style={s.eventTitle}>{event.title}</Text>
                  <Text style={s.eventMeta}>📍 {event.location}</Text>
                  <Text style={s.eventMeta}>👤 {(event as any).profiles?.name ?? 'Unknown'}</Text>
                  <Text style={s.eventMeta}>
                    💰 {event.price === 0 ? 'Miễn phí' : event.price.toLocaleString('vi-VN') + 'đ'}
                  </Text>

                  <View style={s.eventActions}>
                    <TouchableOpacity
                      style={s.rejectBtn}
                      onPress={() => handleRejectEvent(event.id)}
                      disabled={actionLoading === event.id}
                    >
                      {actionLoading === event.id
                        ? <ActivityIndicator size="small" color="#EF4444" />
                        : <Text style={s.rejectBtnText}>✕ Từ chối</Text>
                      }
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.approveBtn}
                      onPress={() => handleApproveEvent(event.id)}
                      disabled={actionLoading === event.id}
                    >
                      {actionLoading === event.id
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Text style={s.approveBtnText}>✓ Duyệt</Text>
                      }
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* Tab: Báo cáo */}
        {activeTab === 'Báo cáo' && (
          <View style={s.content}>
            <Text style={s.sectionTitle}>
              🚩 Đánh giá bị báo cáo ({flaggedReviews.length})
            </Text>
            {flaggedReviews.length === 0 ? (
              <View style={s.emptyBox}>
                <Text style={s.emptyIcon}>✅</Text>
                <Text style={s.emptyTitle}>Không có nội dung bị báo cáo</Text>
              </View>
            ) : (
              flaggedReviews.map((review) => (
                <View key={review.id} style={s.reviewCard}>
                  <View style={s.reviewHeader}>
                    <View style={s.reviewAvatar}>
                      <Text style={s.reviewAvatarText}>
                        {(review as any).profiles?.name?.[0]?.toUpperCase() ?? 'U'}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.reviewUser}>
                        {(review as any).profiles?.name ?? 'Unknown'}
                      </Text>
                      <Text style={s.reviewRating}>
                        {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                      </Text>
                    </View>
                    <View style={s.flagBadge}>
                      <Text style={s.flagBadgeText}>🚩 Báo cáo</Text>
                    </View>
                  </View>

                  <Text style={s.reviewContent}>{review.content}</Text>

                  <View style={s.reviewActions}>
                    <TouchableOpacity
                      style={s.restoreBtn}
                      onPress={() => handleRestoreReview(review.id)}
                      disabled={actionLoading === review.id}
                    >
                      {actionLoading === review.id
                        ? <ActivityIndicator size="small" color="#2563EB" />
                        : <Text style={s.restoreBtnText}>↩ Khôi phục</Text>
                      }
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.deleteBtn}
                      onPress={() => handleDeleteReview(review.id)}
                      disabled={actionLoading === review.id}
                    >
                      {actionLoading === review.id
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Text style={s.deleteBtnText}>🗑 Xóa</Text>
                      }
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* Tab: Người dùng */}
        {activeTab === 'Người dùng' && (
          <View style={s.content}>
            <Text style={s.sectionTitle}>
              👥 Người dùng gần đây ({recentUsers.length})
            </Text>
            {recentUsers.map((u) => (
              <View key={u.id} style={s.userCard}>
                <View style={s.userAvatar}>
                  <Text style={s.userAvatarText}>
                    {u.name?.[0]?.toUpperCase() ?? 'U'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.userName}>{u.name}</Text>
                  <Text style={s.userMeta}>
                    {new Date(u.created_at).toLocaleDateString('vi-VN', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                    })}
                  </Text>
                </View>
                <View style={s.styleBadge}>
                  <Text style={s.styleBadgeText}>
                    {u.travel_style === 'solo' ? '🎒 Solo' :
                     u.travel_style === 'couple' ? '💑 Đôi' :
                     u.travel_style === 'family' ? '👨‍👩‍👧 GĐ' : '👥 Nhóm'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  loadingScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: '#64748B', fontSize: 14 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: '#fff', gap: 12,
    shadowColor: '#000', shadowOpacity: 0.06,
    shadowRadius: 8, elevation: 4,
  },
  backBtn: { fontSize: 22, color: '#2563EB', fontWeight: '700' },
  title: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
  subtitle: { fontSize: 12, color: '#94A3B8' },
  refreshBtn: {
    marginLeft: 'auto' as any,
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center', alignItems: 'center',
  },
  refreshIcon: { fontSize: 16 },
  tabBar: { backgroundColor: '#fff', maxHeight: 52 },
  tabList: { paddingHorizontal: 16, gap: 8, paddingVertical: 10 },
  tab: {
    paddingHorizontal: 16, paddingVertical: 7,
    borderRadius: 20, backgroundColor: '#F1F5F9',
  },
  tabActive: { backgroundColor: '#2563EB' },
  tabText: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  tabBadge: { color: '#F97316', fontWeight: '800' },
  tabBadgeRed: { color: '#EF4444', fontWeight: '800' },
  content: { padding: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 12 },

  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  statCard: { width: '47%', borderRadius: 14, padding: 14, alignItems: 'center', gap: 4 },
  statIcon: { fontSize: 24 },
  statValue: { fontSize: 28, fontWeight: '900' },
  statLabel: { fontSize: 12, color: '#64748B', fontWeight: '500' },

  // Alerts
  alertsBox: { marginBottom: 20 },
  alertItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF7ED', borderRadius: 12,
    padding: 14, gap: 10, marginBottom: 8,
    borderWidth: 1, borderColor: '#FED7AA',
  },
  alertItemRed: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  alertIcon: { fontSize: 18 },
  alertText: { flex: 1, fontSize: 14, color: '#0F172A', fontWeight: '500' },
  alertArrow: { fontSize: 20, color: '#CBD5E1' },

  // Quick Actions
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  quickActionBtn: {
    width: '47%', backgroundColor: '#fff',
    borderRadius: 14, padding: 16,
    alignItems: 'center', gap: 8,
    shadowColor: '#000', shadowOpacity: 0.05,
    shadowRadius: 6, elevation: 2,
  },
  quickActionIcon: { fontSize: 28 },
  quickActionLabel: { fontSize: 13, color: '#374151', fontWeight: '600' },

  // Event Card
  eventCard: {
    backgroundColor: '#fff', borderRadius: 16,
    padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.06,
    shadowRadius: 8, elevation: 3,
  },
  eventHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  eventCatBadge: {
    backgroundColor: '#EFF6FF', paddingHorizontal: 10,
    paddingVertical: 4, borderRadius: 8,
  },
  eventCatText: { color: '#2563EB', fontSize: 11, fontWeight: '700' },
  eventDate: { fontSize: 12, color: '#94A3B8' },
  eventTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
  eventMeta: { fontSize: 13, color: '#64748B', marginBottom: 3 },
  eventActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  rejectBtn: {
    flex: 1, borderRadius: 10, paddingVertical: 10,
    borderWidth: 1.5, borderColor: '#EF4444',
    alignItems: 'center',
  },
  rejectBtnText: { color: '#EF4444', fontWeight: '700', fontSize: 14 },
  approveBtn: {
    flex: 1, borderRadius: 10, paddingVertical: 10,
    backgroundColor: '#2563EB', alignItems: 'center',
  },
  approveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Review Card
  reviewCard: {
    backgroundColor: '#fff', borderRadius: 16,
    padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.06,
    shadowRadius: 8, elevation: 3,
    borderLeftWidth: 3, borderLeftColor: '#EF4444',
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  reviewAvatar: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#EF4444',
    justifyContent: 'center', alignItems: 'center',
  },
  reviewAvatarText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  reviewUser: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  reviewRating: { fontSize: 13, color: '#F59E0B' },
  flagBadge: {
    backgroundColor: '#FEF2F2', paddingHorizontal: 8,
    paddingVertical: 3, borderRadius: 8,
  },
  flagBadgeText: { color: '#EF4444', fontSize: 11, fontWeight: '700' },
  reviewContent: { fontSize: 14, color: '#374151', marginBottom: 10, lineHeight: 20 },
  reviewActions: { flexDirection: 'row', gap: 10 },
  restoreBtn: {
    flex: 1, borderRadius: 10, paddingVertical: 10,
    borderWidth: 1.5, borderColor: '#2563EB',
    alignItems: 'center',
  },
  restoreBtnText: { color: '#2563EB', fontWeight: '700', fontSize: 13 },
  deleteBtn: {
    flex: 1, borderRadius: 10, paddingVertical: 10,
    backgroundColor: '#EF4444', alignItems: 'center',
  },
  deleteBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // User Card
  userCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 14,
    padding: 14, marginBottom: 8, gap: 12,
    shadowColor: '#000', shadowOpacity: 0.04,
    shadowRadius: 4, elevation: 1,
  },
  userAvatar: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: '#2563EB',
    justifyContent: 'center', alignItems: 'center',
  },
  userAvatarText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  userName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  userMeta: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  styleBadge: {
    backgroundColor: '#EFF6FF', paddingHorizontal: 10,
    paddingVertical: 4, borderRadius: 20,
  },
  styleBadgeText: { fontSize: 11, color: '#2563EB', fontWeight: '600' },

  // Empty
  emptyBox: { alignItems: 'center', paddingTop: 40, gap: 8 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
})

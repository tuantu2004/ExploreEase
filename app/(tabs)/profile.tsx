import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, Switch, Platform,
} from 'react-native'
import { router } from 'expo-router'
import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '../../stores/useAuthStore'
import { useFocusEffect } from 'expo-router'
import { logout } from '../../services/authService'
import { Image } from 'react-native'
import { supabase } from '../../services/supabase'
import { getFollowCounts } from '../../services/socialService'

const TRAVEL_STYLES = [
  { id: 'solo', label: 'Solo', icon: '🎒' },
  { id: 'couple', label: 'Cặp đôi', icon: '💑' },
  { id: 'family', label: 'Gia đình', icon: '👨‍👩‍👧' },
  { id: 'group', label: 'Nhóm bạn', icon: '👥' },
]

const INTEREST_ICONS: Record<string, string> = {
  'Ẩm thực': '🍜',
  'Văn hóa': '🏛️',
  'Mua sắm': '🛍️',
  'Thiên nhiên': '🌿',
  'Phiêu lưu': '🧗',
  'Về đêm': '🌙',
}

const SOON = () => Alert.alert('Sắp ra mắt', 'Tính năng đang được phát triển.')

const MENU_SECTIONS = [
  {
    title: 'Tài khoản',
    items: [
      { icon: '✏️', label: 'Chỉnh sửa hồ sơ', route: '/profile/edit' },
      { icon: '❤️', label: 'Địa điểm yêu thích', route: '/bookmarks' },
      { icon: '📅', label: 'Sự kiện của tôi', route: '/my-events' },
      { icon: '🗺️', label: 'Lịch sử khám phá', route: '/history' },
    ],
  },
  {
    title: 'Cài đặt',
    items: [
      { icon: '🔔', label: 'Thông báo', route: '/notifications' },
      { icon: '🌐', label: 'Ngôn ngữ', route: null, action: SOON },
      { icon: '🌙', label: 'Giao diện tối', toggle: true },
      { icon: '🔒', label: 'Bảo mật & Quyền riêng tư', route: '/security' },
    ],
  },
  {
    title: 'Hỗ trợ',
    items: [
      { icon: '❓', label: 'Trung tâm trợ giúp', route: null, action: SOON },
      { icon: '📋', label: 'Điều khoản sử dụng', route: null, action: SOON },
      { icon: '⭐', label: 'Đánh giá ứng dụng', route: null, action: SOON },
    ],
  },
]

export default function ProfileScreen() {
  const { user, logout: logoutStore, refreshUser } = useAuthStore()
  const [darkMode, setDarkMode] = useState(false)
  const [interests, setInterests] = useState<string[]>([])
  const travelStyle = TRAVEL_STYLES.find(t => t.id === user?.travel_style)
  const [stats, setStats] = useState({ trips: 0, places: 0, reviews: 0, friends: 0 })

  const loadInterests = useCallback(async () => {
    if (!user) return
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('interests')
        .eq('user_id', user.id)
        .limit(1)
      if (error) {
        console.error('Load interests error:', error)
        return
      }
      const row = Array.isArray(data) ? data[0] : data
      const rawInterests = row?.interests ?? []
      setInterests(Array.isArray(rawInterests) ? rawInterests : [])
    } catch (error) {
      console.error('Load interests exception:', error)
    }
  }, [user])

  useFocusEffect(
    useCallback(() => {
      refreshUser()
      loadInterests()
    }, [refreshUser, loadInterests])
  )

  useEffect(() => {
    if (!user) return
    const loadStats = async () => {
      try {
        const [
          { count: placesCount },
          { count: reviewsCount },
          { count: eventCount },
          followData,
        ] = await Promise.all([
          supabase.from('bookmarks').select('*', { count: 'exact', head: true })
            .eq('user_id', user.id).eq('target_type', 'place'),
          supabase.from('reviews').select('*', { count: 'exact', head: true })
            .eq('user_id', user.id),
          supabase.from('events').select('*', { count: 'exact', head: true })
            .eq('creator_id', user.id),
          getFollowCounts(user.id).catch(() => ({ followers: 0, following: 0 })),
        ])
        const friends = (followData.followers ?? 0) + (followData.following ?? 0)
        setStats({
          trips: eventCount ?? 0,
          places: placesCount ?? 0,
          reviews: reviewsCount ?? 0,
          friends,
        })
      } catch {
        // stats are non-critical; keep defaults on network error
      }
    }
    loadStats()
  }, [user])

  const handleLogout = async () => {
    const doLogout = async () => {
      try {
        await logout()
      } catch (e) {
        console.error('Logout error:', e)
      }
      logoutStore()
      router.replace('/(auth)/login')
    }

    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Bạn có chắc muốn đăng xuất?')
      if (!confirmed) return
      await doLogout()
      return
    }

    Alert.alert(
      'Đăng xuất',
      'Bạn có chắc muốn đăng xuất?',
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Đăng xuất',
          style: 'destructive',
          onPress: doLogout,
        },
      ]
    )
  }

  return (
    <ScrollView style={s.screen} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerContent}>
          {/* Avatar */}
          <View style={s.avatarWrapper}>
            {user?.avatar_url ? (
              <Image
                source={{ uri: user.avatar_url }}
                style={s.avatarImage}
              />
            ) : (
              <View style={s.avatar}>
                <Text style={s.avatarText}>
                  {user?.name?.[0]?.toUpperCase() ?? 'U'}
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={s.editAvatarBtn}
              onPress={() => router.push('/profile/edit')}
            >
              <Text style={s.editAvatarIcon}>📷</Text>
            </TouchableOpacity>
          </View>

          {/* Info */}
          <Text style={s.userName}>{user?.name ?? 'Người dùng'}</Text>
          <Text style={s.userEmail}>{user?.email ?? ''}</Text>
          <View style={s.userMetaRow}>
            {user?.age && (
              <View style={s.metaBadge}>
                <Text style={s.metaText}>🎂 {user.age} tuổi</Text>
              </View>
            )}
            {user?.gender && (
              <View style={s.metaBadge}>
                <Text style={s.metaText}>
                  {user.gender === 'male' ? '👨 Nam' :
                   user.gender === 'female' ? '👩 Nữ' : '🧑 Khác'}
                </Text>
              </View>
            )}
          </View>

          {/* Travel Style Badge */}
          {travelStyle && (
            <View style={s.travelBadge}>
              <Text style={s.travelIcon}>{travelStyle.icon}</Text>
              <Text style={s.travelLabel}>{travelStyle.label}</Text>
            </View>
          )}

          {/* Stats */}
          <View style={s.statsRow}>
            {[
              { value: stats.trips, label: 'Sự kiện', icon: '🎪' },
              { value: stats.places, label: 'Đã lưu', icon: '❤️' },
              { value: stats.reviews, label: 'Đánh giá', icon: '⭐' },
              { value: stats.friends, label: 'Bạn bè', icon: '👥' },
            ].map((stat) => (
              <View key={stat.label} style={s.statItem}>
                <Text style={s.statIcon}>{stat.icon}</Text>
                <Text style={s.statValue}>{stat.value}</Text>
                <Text style={s.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Interests */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Sở thích du lịch</Text>
          <TouchableOpacity onPress={() => router.push('/profile/edit')}>
            <Text style={s.editLink}>Chỉnh sửa</Text>
          </TouchableOpacity>
        </View>
        <View style={s.interestsRow}>
          {interests.length > 0 ? (
            interests.map((interest) => (
              <View key={interest} style={s.interestChip}>
                <Text style={s.interestIcon}>{INTEREST_ICONS[interest] ?? '⭐'}</Text>
                <Text style={s.interestLabel}>{interest}</Text>
              </View>
            ))
          ) : (
            <View style={s.emptyInterest}>
              <Text style={s.emptyInterestText}>
                Bạn chưa chọn sở thích du lịch. Cập nhật để nhận gợi ý phù hợp.
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Social + Chat Buttons */}
      <View style={s.quickBtnsRow}>
        <TouchableOpacity
          style={s.quickBtn}
          onPress={() => router.push('/social')}
        >
          <Text style={s.quickBtnIcon}>👥</Text>
          <Text style={s.quickBtnLabel}>Mạng xã hội</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.quickBtn, s.quickBtnChat]}
          onPress={() => router.push('/chat')}
        >
          <Text style={s.quickBtnIcon}>💬</Text>
          <Text style={s.quickBtnLabel}>Tin nhắn</Text>
        </TouchableOpacity>
      </View>

      {/* Admin Button — hiện cho user có role admin */}
      {(user as any)?.role === 'admin' && (
        <TouchableOpacity
          style={s.adminBtn}
          onPress={() => router.push('/admin')}
        >
          <Text style={s.adminBtnIcon}>🛡️</Text>
          <Text style={s.adminBtnText}>Admin Dashboard</Text>
          <Text style={s.menuArrow}>›</Text>
        </TouchableOpacity>
      )}

      {/* Menu Sections */}
      {MENU_SECTIONS.map((section) => (
        <View key={section.title} style={s.section}>
          <Text style={s.sectionTitle}>{section.title}</Text>
          <View style={s.menuCard}>
            {section.items.map((item, i) => (
              <TouchableOpacity
                key={item.label}
                style={[
                  s.menuItem,
                  i < section.items.length - 1 && s.menuBorder,
                ]}
                onPress={() => {
                  if (item.toggle) return
                  if ((item as any).action) { (item as any).action(); return }
                  if (item.route) router.push(item.route as any)
                }}
              >
                <View style={s.menuIconBox}>
                  <Text style={s.menuIcon}>{item.icon}</Text>
                </View>
                <Text style={s.menuLabel}>{item.label}</Text>
                {item.toggle ? (
                  <Switch
                    value={darkMode}
                    onValueChange={setDarkMode}
                    trackColor={{ false: '#E2E8F0', true: '#2563EB' }}
                    thumbColor="#fff"
                  />
                ) : (
                  <Text style={s.menuArrow}>›</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      {/* Logout */}
      <View style={s.section}>
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
          <Text style={s.logoutIcon}>🚪</Text>
          <Text style={s.logoutText}>Đăng xuất</Text>
        </TouchableOpacity>
        <Text style={s.version}>ExploreEase v1.0.0</Text>
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },

  // Header
  header: { backgroundColor: '#fff', marginBottom: 16 },
  headerContent: { alignItems: 'center', paddingTop: 52, paddingBottom: 24, paddingHorizontal: 16 },
  avatarWrapper: { position: 'relative', marginBottom: 12 },
  avatar: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: '#2563EB',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 4, borderColor: '#EFF6FF',
    shadowColor: '#2563EB', shadowOpacity: 0.4,
    shadowRadius: 12, elevation: 8,
  },
  avatarImage: {
    width: 96, height: 96, borderRadius: 48,
    borderWidth: 4, borderColor: '#EFF6FF',
  },
  avatarText: { color: '#fff', fontSize: 40, fontWeight: '900' },
  editAvatarBtn: {
    position: 'absolute', bottom: 0, right: 0,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#F97316',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  editAvatarIcon: { fontSize: 14 },
  userName: { fontSize: 22, fontWeight: '900', color: '#0F172A' },
  userEmail: { fontSize: 13, color: '#94A3B8', marginTop: 4, marginBottom: 10 },
  travelBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#EFF6FF', paddingHorizontal: 14,
    paddingVertical: 6, borderRadius: 20, marginBottom: 20,
    borderWidth: 1.5, borderColor: '#BFDBFE',
  },
  travelIcon: { fontSize: 16 },
  travelLabel: { color: '#1D4ED8', fontSize: 13, fontWeight: '600' },
  userMetaRow: {
    flexDirection: 'row', gap: 8,
    marginTop: 6, marginBottom: 10,
  },
  metaBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 10,
  },
  metaText: { fontSize: 12, color: '#475569', fontWeight: '500' },

  // Stats
  statsRow: {
    flexDirection: 'row', width: '100%',
    borderTopWidth: 1, borderTopColor: '#F1F5F9',
    paddingTop: 16,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statIcon: { fontSize: 18 },
  statValue: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
  statLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '500' },

  // Sections
  section: { paddingHorizontal: 16, marginBottom: 20 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  emptyInterest: {
    backgroundColor: '#EFF6FF',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    flex: 1,
  },
  emptyInterestText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 20,
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  editLink: { fontSize: 13, color: '#2563EB', fontWeight: '600' },

  // Interests
  interestsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  interestChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#fff', paddingHorizontal: 12,
    paddingVertical: 7, borderRadius: 20,
    borderWidth: 1.5, borderColor: '#E2E8F0',
    shadowColor: '#000', shadowOpacity: 0.04,
    shadowRadius: 4, elevation: 1,
  },
  interestIcon: { fontSize: 15 },
  interestLabel: { fontSize: 12, color: '#475569', fontWeight: '600' },

  // Menu
  menuCard: {
    backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.05,
    shadowRadius: 8, elevation: 2,
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, gap: 12,
  },
  menuBorder: { borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  menuIconBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center', alignItems: 'center',
  },
  menuIcon: { fontSize: 18 },
  menuLabel: { flex: 1, fontSize: 14, color: '#0F172A', fontWeight: '500' },
  menuArrow: { fontSize: 20, color: '#CBD5E1' },

  quickBtnsRow: {
    flexDirection: 'row', gap: 10,
    marginHorizontal: 16, marginBottom: 12,
  },
  quickBtn: {
    flex: 1, backgroundColor: '#F0FDF4',
    borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: '#BBF7D0',
  },
  quickBtnChat: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  quickBtnIcon: { fontSize: 24 },
  quickBtnLabel: { fontSize: 12, fontWeight: '700', color: '#374151' },

  // Admin
  adminBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#EFF6FF', borderRadius: 14,
    padding: 14, gap: 12, marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1.5, borderColor: '#2563EB',
  },
  adminBtnIcon: { fontSize: 20 },
  adminBtnText: { flex: 1, fontSize: 14, color: '#2563EB', fontWeight: '700' },

  // Logout
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 10,
    backgroundColor: '#FEF2F2', borderRadius: 14,
    paddingVertical: 14, marginBottom: 12,
    borderWidth: 1.5, borderColor: '#FECACA',
  },
  logoutIcon: { fontSize: 20 },
  logoutText: { color: '#DC2626', fontSize: 15, fontWeight: '700' },
  version: { textAlign: 'center', color: '#CBD5E1', fontSize: 12 },
})
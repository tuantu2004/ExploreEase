import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Image, Share, Modal,
  RefreshControl,
} from 'react-native'
import { router } from 'expo-router'
import { useState, useEffect } from 'react'
import { useAuthStore } from '../stores/useAuthStore'
import {
  getActivityFeed, getSuggestedUsers, followUser,
  getFollowCounts, activityLabel, activityIcon,
  getQRUrl, ActivityItem,
} from '../services/socialService'

export default function SocialScreen() {
  const user = useAuthStore((s) => s.user)
  const [feed, setFeed] = useState<ActivityItem[]>([])
  const [suggested, setSuggested] = useState<any[]>([])
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 })
  const [following, setFollowing] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [qrModal, setQrModal] = useState<{ type: 'user'; id: string } | null>(null)

  useEffect(() => { if (user) load() }, [user])

  const load = async () => {
    if (!user) return
    // Each call has its own fallback so one failure doesn't blank the whole screen
    const [feedData, suggestedData, counts] = await Promise.all([
      getActivityFeed(user.id).catch(() => [] as ActivityItem[]),
      getSuggestedUsers(user.id).catch(() => [] as any[]),
      getFollowCounts(user.id).catch(() => ({ followers: 0, following: 0 })),
    ])
    setFeed(feedData)
    setSuggested(suggestedData)
    setFollowCounts(counts)
    setLoading(false)
    setRefreshing(false)
  }

  const handleFollow = async (targetId: string) => {
    if (!user) return
    try {
      await followUser(user.id, targetId)
      setFollowing(prev => new Set([...prev, targetId]))
      setSuggested(prev => prev.filter(u => u.id !== targetId))
      setFollowCounts(prev => ({ ...prev, following: prev.following + 1 }))
    } catch { /* ignore */ }
  }

  const handleShareProfile = async () => {
    try {
      await Share.share({
        message: `Xem hồ sơ của tôi trên ExploreEase!\nexploreease://user/${user?.id}`,
      })
    } catch { /* cancelled */ }
  }

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime()
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    if (mins < 1) return 'Vừa xong'
    if (mins < 60) return `${mins} phút trước`
    if (hours < 24) return `${hours} giờ trước`
    return `${days} ngày trước`
  }

  return (
    <View style={s.screen}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.back}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>Mạng xã hội</Text>
        <TouchableOpacity style={s.qrBtn} onPress={() => setQrModal({ type: 'user', id: user?.id ?? '' })}>
          <Text style={s.qrBtnText}>QR</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={s.statsBar}>
        <View style={s.stat}>
          <Text style={s.statNum}>{followCounts.followers}</Text>
          <Text style={s.statLabel}>Người theo dõi</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.stat}>
          <Text style={s.statNum}>{followCounts.following}</Text>
          <Text style={s.statLabel}>Đang theo dõi</Text>
        </View>
        <TouchableOpacity style={s.shareProfileBtn} onPress={handleShareProfile}>
          <Text style={s.shareProfileText}>↗ Chia sẻ hồ sơ</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} />}
      >
        {/* Suggested Users */}
        {suggested.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>👥 Gợi ý theo dõi</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={s.suggestRow}>
                {suggested.map(u => (
                  <View key={u.id} style={s.suggestCard}>
                    <TouchableOpacity onPress={() => router.push(`/user/${u.id}`)}>
                      <View style={s.suggestAvatar}>
                        {u.avatar_url
                          ? <Image source={{ uri: u.avatar_url }} style={s.suggestAvatarImg} />
                          : <Text style={s.suggestAvatarEmoji}>👤</Text>
                        }
                      </View>
                      <Text style={s.suggestName} numberOfLines={1}>{u.name}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.followBtn, following.has(u.id) && s.followBtnDone]}
                      onPress={() => handleFollow(u.id)}
                      disabled={following.has(u.id)}
                    >
                      <Text style={[s.followBtnText, following.has(u.id) && s.followBtnDoneText]}>
                        {following.has(u.id) ? '✓ Đã theo dõi' : '+ Theo dõi'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Activity Feed */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>📢 Bảng tin hoạt động</Text>
          {loading ? (
            <ActivityIndicator color="#2563EB" style={{ marginTop: 24 }} />
          ) : feed.length === 0 ? (
            <View style={s.emptyFeed}>
              <Text style={s.emptyIcon}>📢</Text>
              <Text style={s.emptyTitle}>Chưa có hoạt động nào</Text>
              <Text style={s.emptyDesc}>Theo dõi người dùng khác để xem bảng tin của họ</Text>
            </View>
          ) : (
            feed.map(item => (
              <TouchableOpacity
                key={item.id}
                style={s.activityItem}
                onPress={() => {
                  if (item.target_type === 'place' && item.target_id) router.push(`/place/${item.target_id}`)
                  else if (item.target_type === 'event' && item.target_id) router.push(`/event/${item.target_id}`)
                  else if (item.user_id) router.push(`/user/${item.user_id}`)
                }}
              >
                <View style={s.activityIcon}>
                  <Text style={s.activityIconText}>{activityIcon(item.type)}</Text>
                </View>
                <View style={s.activityContent}>
                  <Text style={s.activityText}>{activityLabel(item)}</Text>
                  <Text style={s.activityTime}>{timeAgo(item.created_at)}</Text>
                </View>
                {item.target_type === 'place' && item.target_id && (
                  <TouchableOpacity
                    onPress={() => setQrModal({ type: 'user', id: item.target_id! })}
                    style={s.shareQrBtn}
                  >
                    <Text style={s.shareQrBtnText}>QR</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* QR Modal */}
      <Modal visible={!!qrModal} transparent animationType="fade">
        <TouchableOpacity
          style={s.qrOverlay}
          activeOpacity={1}
          onPress={() => setQrModal(null)}
        >
          <View style={s.qrSheet}>
            <Text style={s.qrTitle}>Chia sẻ qua mã QR</Text>
            {qrModal && (
              <Image
                source={{ uri: getQRUrl(qrModal.type, qrModal.id) }}
                style={s.qrImage}
                resizeMode="contain"
              />
            )}
            <Text style={s.qrHint}>Quét mã để mở trên ExploreEase</Text>
            <TouchableOpacity
              style={s.qrShareBtn}
              onPress={async () => {
                setQrModal(null)
                await Share.share({ message: `exploreease://${qrModal?.type}/${qrModal?.id}` })
              }}
            >
              <Text style={s.qrShareBtnText}>↗ Chia sẻ liên kết</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.qrCloseBtn} onPress={() => setQrModal(null)}>
              <Text style={s.qrCloseBtnText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 4,
  },
  back: { fontSize: 22, color: '#2563EB', fontWeight: '700', width: 36 },
  title: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
  qrBtn: {
    backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1.5, borderColor: '#BFDBFE',
  },
  qrBtnText: { color: '#2563EB', fontSize: 12, fontWeight: '800' },

  statsBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9', gap: 16,
  },
  stat: { alignItems: 'center' },
  statNum: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
  statLabel: { fontSize: 11, color: '#64748B', marginTop: 1 },
  statDivider: { width: 1, height: 32, backgroundColor: '#E2E8F0' },
  shareProfileBtn: {
    marginLeft: 'auto' as any, backgroundColor: '#EFF6FF',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#BFDBFE',
  },
  shareProfileText: { color: '#2563EB', fontSize: 13, fontWeight: '700' },

  section: { paddingHorizontal: 16, paddingTop: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 12 },

  suggestRow: { flexDirection: 'row', gap: 10, paddingBottom: 4 },
  suggestCard: {
    width: 110, backgroundColor: '#fff', borderRadius: 16, padding: 12,
    alignItems: 'center', gap: 6,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  suggestAvatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center', alignItems: 'center', marginBottom: 4,
  },
  suggestAvatarImg: { width: 52, height: 52, borderRadius: 26 },
  suggestAvatarEmoji: { fontSize: 26 },
  suggestName: { fontSize: 12, fontWeight: '700', color: '#0F172A', textAlign: 'center' },
  followBtn: {
    backgroundColor: '#2563EB', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8, marginTop: 2,
  },
  followBtnDone: { backgroundColor: '#F1F5F9' },
  followBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  followBtnDoneText: { color: '#64748B' },

  emptyFeed: { alignItems: 'center', paddingTop: 40, gap: 10 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  emptyDesc: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20 },

  activityItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  activityIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center',
  },
  activityIconText: { fontSize: 18 },
  activityContent: { flex: 1 },
  activityText: { fontSize: 13, color: '#0F172A', fontWeight: '500', lineHeight: 18 },
  activityTime: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  shareQrBtn: {
    backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6,
  },
  shareQrBtnText: { fontSize: 10, color: '#64748B', fontWeight: '700' },

  qrOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
  qrSheet: {
    backgroundColor: '#fff', borderRadius: 24, padding: 28,
    alignItems: 'center', gap: 12, width: 280,
  },
  qrTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  qrImage: { width: 200, height: 200 },
  qrHint: { fontSize: 13, color: '#64748B', textAlign: 'center' },
  qrShareBtn: {
    backgroundColor: '#2563EB', paddingHorizontal: 24, paddingVertical: 10,
    borderRadius: 12, width: '100%', alignItems: 'center',
  },
  qrShareBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  qrCloseBtn: {
    paddingVertical: 8, width: '100%', alignItems: 'center',
  },
  qrCloseBtnText: { color: '#94A3B8', fontSize: 14 },
})

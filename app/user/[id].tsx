import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Image, Modal, Share,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useState, useEffect } from 'react'
import { useAuthStore } from '../../stores/useAuthStore'
import { supabase } from '../../services/supabase'
import {
  followUser, unfollowUser, isFollowing,
  getFollowCounts, getUserActivity,
  getQRUrl, activityLabel, activityIcon, ActivityItem,
} from '../../services/socialService'

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const me = useAuthStore((s) => s.user)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [followed, setFollowed] = useState(false)
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 })
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [qrVisible, setQrVisible] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)

  const isMe = me?.id === id

  useEffect(() => {
    if (!id) return
    loadProfile()
  }, [id, me])

  const loadProfile = async () => {
    try {
      const [{ data: profileData }, counts, activityData] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', id).single(),
        getFollowCounts(id!),
        getUserActivity(id!, 10),
      ])
      setProfile(profileData)
      setFollowCounts(counts)
      setActivity(activityData)

      if (me && !isMe) {
        const fol = await isFollowing(me.id, id!)
        setFollowed(fol)
      }
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }

  const handleFollow = async () => {
    if (!me || !id || isMe) return
    setFollowLoading(true)
    try {
      if (followed) {
        await unfollowUser(me.id, id)
        setFollowed(false)
        setFollowCounts(prev => ({ ...prev, followers: Math.max(0, prev.followers - 1) }))
      } else {
        await followUser(me.id, id)
        setFollowed(true)
        setFollowCounts(prev => ({ ...prev, followers: prev.followers + 1 }))
      }
    } catch { /* ignore */ } finally {
      setFollowLoading(false)
    }
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

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator color="#2563EB" size="large" />
      </View>
    )
  }

  return (
    <View style={s.screen}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.back}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{profile?.name ?? 'Hồ sơ'}</Text>
        <TouchableOpacity style={s.qrBtn} onPress={() => setQrVisible(true)}>
          <Text style={s.qrBtnText}>QR</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={s.profileCard}>
          <View style={s.avatarWrap}>
            {profile?.avatar_url
              ? <Image source={{ uri: profile.avatar_url }} style={s.avatar} />
              : <View style={s.avatarFallback}><Text style={s.avatarEmoji}>👤</Text></View>
            }
          </View>
          <Text style={s.name}>{profile?.name}</Text>
          {profile?.bio && <Text style={s.bio}>{profile.bio}</Text>}

          {/* Stats */}
          <View style={s.statsRow}>
            <View style={s.stat}>
              <Text style={s.statNum}>{followCounts.followers}</Text>
              <Text style={s.statLabel}>Người theo dõi</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.stat}>
              <Text style={s.statNum}>{followCounts.following}</Text>
              <Text style={s.statLabel}>Đang theo dõi</Text>
            </View>
          </View>

          {/* Actions */}
          {!isMe && (
            <View style={s.actions}>
              <TouchableOpacity
                style={[s.followBtn, followed && s.followBtnActive]}
                onPress={handleFollow}
                disabled={followLoading}
              >
                {followLoading
                  ? <ActivityIndicator color={followed ? '#2563EB' : '#fff'} size="small" />
                  : <Text style={[s.followBtnText, followed && s.followBtnTextActive]}>
                      {followed ? '✓ Đang theo dõi' : '+ Theo dõi'}
                    </Text>
                }
              </TouchableOpacity>
              <TouchableOpacity
                style={s.msgBtn}
                onPress={() => router.push(`/dm/${id}`)}
              >
                <Text style={s.msgBtnText}>💬 Nhắn tin</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Activity */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>📢 Hoạt động gần đây</Text>
          {activity.length === 0 ? (
            <View style={s.emptyActivity}>
              <Text style={s.emptyText}>Chưa có hoạt động nào</Text>
            </View>
          ) : (
            activity.map(item => (
              <TouchableOpacity
                key={item.id}
                style={s.activityItem}
                onPress={() => {
                  if (item.target_type === 'place' && item.target_id) router.push(`/place/${item.target_id}`)
                  else if (item.target_type === 'event' && item.target_id) router.push(`/event/${item.target_id}`)
                }}
              >
                <View style={s.activityIcon}>
                  <Text style={s.activityIconText}>{activityIcon(item.type)}</Text>
                </View>
                <View style={s.activityContent}>
                  <Text style={s.activityText}>{activityLabel(item)}</Text>
                  <Text style={s.activityTime}>{timeAgo(item.created_at)}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* QR Modal */}
      <Modal visible={qrVisible} transparent animationType="fade">
        <TouchableOpacity style={s.qrOverlay} activeOpacity={1} onPress={() => setQrVisible(false)}>
          <View style={s.qrSheet}>
            <Text style={s.qrTitle}>Chia sẻ hồ sơ</Text>
            <Image
              source={{ uri: getQRUrl('user', id!) }}
              style={s.qrImage}
              resizeMode="contain"
            />
            <Text style={s.qrName}>{profile?.name}</Text>
            <TouchableOpacity
              style={s.qrShareBtn}
              onPress={async () => {
                setQrVisible(false)
                await Share.share({ message: `Xem hồ sơ ${profile?.name} trên ExploreEase!\nexploreease://user/${id}` })
              }}
            >
              <Text style={s.qrShareBtnText}>↗ Chia sẻ liên kết</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setQrVisible(false)}>
              <Text style={s.qrClose}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 4,
  },
  back: { fontSize: 22, color: '#2563EB', fontWeight: '700', width: 36 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A', flex: 1, textAlign: 'center' },
  qrBtn: {
    backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1.5, borderColor: '#BFDBFE',
  },
  qrBtnText: { color: '#2563EB', fontSize: 12, fontWeight: '800' },

  profileCard: {
    backgroundColor: '#fff', margin: 16, borderRadius: 20, padding: 24,
    alignItems: 'center', gap: 8,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 4,
  },
  avatarWrap: { marginBottom: 4 },
  avatar: { width: 80, height: 80, borderRadius: 40 },
  avatarFallback: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center',
  },
  avatarEmoji: { fontSize: 36 },
  name: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
  bio: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20 },

  statsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 24,
    paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9',
    marginTop: 4, width: '100%', justifyContent: 'center',
  },
  stat: { alignItems: 'center' },
  statNum: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
  statLabel: { fontSize: 11, color: '#64748B' },
  statDivider: { width: 1, height: 32, backgroundColor: '#E2E8F0' },

  actions: { flexDirection: 'row', gap: 10, width: '100%' },
  followBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 12,
    backgroundColor: '#2563EB', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#2563EB',
  },
  followBtnActive: { backgroundColor: '#EFF6FF' },
  followBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  followBtnTextActive: { color: '#2563EB' },
  msgBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 12,
    backgroundColor: '#F1F5F9', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  msgBtnText: { color: '#0F172A', fontSize: 14, fontWeight: '700' },

  section: { paddingHorizontal: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 10 },
  emptyActivity: { paddingVertical: 24, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#94A3B8' },
  activityItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  activityIcon: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center',
  },
  activityIconText: { fontSize: 16 },
  activityContent: { flex: 1 },
  activityText: { fontSize: 13, color: '#0F172A', fontWeight: '500' },
  activityTime: { fontSize: 11, color: '#94A3B8', marginTop: 2 },

  qrOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
  qrSheet: {
    backgroundColor: '#fff', borderRadius: 24, padding: 28,
    alignItems: 'center', gap: 10, width: 280,
  },
  qrTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  qrImage: { width: 200, height: 200 },
  qrName: { fontSize: 15, fontWeight: '700', color: '#374151' },
  qrShareBtn: {
    backgroundColor: '#2563EB', paddingHorizontal: 24, paddingVertical: 10,
    borderRadius: 12, width: '100%', alignItems: 'center',
  },
  qrShareBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  qrClose: { fontSize: 14, color: '#94A3B8', marginTop: 4 },
})

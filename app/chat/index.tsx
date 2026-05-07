import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, ActivityIndicator,
  Modal, Image, RefreshControl,
} from 'react-native'
import { router } from 'expo-router'
import { useState, useEffect } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { useCallback } from 'react'
import { useAuthStore } from '../../stores/useAuthStore'
import { supabase } from '../../services/supabase'
import { getConversations, Conversation } from '../../services/messageService'

const CATEGORY_EMOJI: Record<string, string> = {
  'Âm nhạc': '🎵', 'Ẩm thực': '🍜', 'Thể thao': '🏃',
  'Nghệ thuật': '🎨', 'Công nghệ': '💻', 'Du lịch': '✈️',
  'Văn hóa': '🎭', 'Khác': '🎪',
}

export default function ChatListScreen() {
  const user = useAuthStore((s) => s.user)
  const [activeTab, setActiveTab] = useState<'dm' | 'group'>('dm')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [eventChats, setEventChats] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [newDMModal, setNewDMModal] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  useFocusEffect(
    useCallback(() => {
      if (user) load()
    }, [user])
  )

  const load = async () => {
    if (!user) return
    await Promise.all([
      loadConversations(),
      loadEventChats(),
    ])
    setLoading(false)
    setRefreshing(false)
  }

  const loadConversations = async () => {
    if (!user) return
    const data = await getConversations(user.id).catch(() => [] as Conversation[])
    setConversations(data)
  }

  const loadEventChats = async () => {
    if (!user) return
    try {
      const [{ data: created }, { data: joined }] = await Promise.all([
        supabase
          .from('events')
          .select('id, title, category, creator_id')
          .eq('creator_id', user.id)
          .order('created_at', { ascending: false })
          .limit(30),
        supabase
          .from('event_attendees')
          .select('event_id, events!inner(id, title, category, creator_id)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(30),
      ])

      const map = new Map<string, any>()
      ;(created ?? []).forEach(e => map.set(e.id, e))
      ;(joined ?? []).forEach((r: any) => {
        const e = r.events
        if (e && !map.has(e.id)) map.set(e.id, e)
      })
      setEventChats(Array.from(map.values()))
    } catch { /* ignore */ }
  }

  // User search for new DM
  useEffect(() => {
    if (userSearch.trim().length < 2) {
      setSearchResults([])
      setSearchLoading(false)
      return
    }
    setSearchLoading(true)
    const timer = setTimeout(async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id, name, avatar_url')
          .ilike('name', `%${userSearch.trim()}%`)
          .neq('id', user?.id ?? '')
          .limit(10)
        setSearchResults(data ?? [])
      } catch {
        setSearchResults([])
      } finally {
        setSearchLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [userSearch])

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime()
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    if (mins < 1) return 'Vừa xong'
    if (mins < 60) return `${mins}p`
    if (hours < 24) return `${hours}g`
    return `${days}n`
  }

  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0)

  return (
    <View style={s.screen}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerTop}>
          <View style={s.titleRow}>
            <Text style={s.title}>Tin nhắn</Text>
            {totalUnread > 0 && (
              <View style={s.unreadBadge}>
                <Text style={s.unreadText}>{totalUnread > 99 ? '99+' : totalUnread}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity style={s.newBtn} onPress={() => setNewDMModal(true)}>
            <Text style={s.newBtnIcon}>✏️</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={s.tabs}>
          <TouchableOpacity
            style={[s.tab, activeTab === 'dm' && s.tabActive]}
            onPress={() => setActiveTab('dm')}
          >
            <Text style={[s.tabText, activeTab === 'dm' && s.tabTextActive]}>
              💬 Tin nhắn
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tab, activeTab === 'group' && s.tabActive]}
            onPress={() => setActiveTab('group')}
          >
            <Text style={[s.tabText, activeTab === 'group' && s.tabTextActive]}>
              🎪 Nhóm sự kiện
            </Text>
            {eventChats.length > 0 && (
              <View style={s.tabCountBadge}>
                <Text style={s.tabCountText}>{eventChats.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color="#2563EB" size="large" /></View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} />
          }
        >
          {/* DM Tab */}
          {activeTab === 'dm' && (
            <View style={s.list}>
              {conversations.length === 0 ? (
                <View style={s.emptyBox}>
                  <Text style={s.emptyIcon}>💬</Text>
                  <Text style={s.emptyTitle}>Chưa có tin nhắn nào</Text>
                  <Text style={s.emptyDesc}>Nhấn ✏️ để bắt đầu cuộc trò chuyện mới</Text>
                  <TouchableOpacity style={s.emptyBtn} onPress={() => setNewDMModal(true)}>
                    <Text style={s.emptyBtnText}>+ Tin nhắn mới</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                conversations.map(conv => (
                  <TouchableOpacity
                    key={conv.userId}
                    style={s.chatItem}
                    onPress={() => router.push(`/dm/${conv.userId}` as any)}
                  >
                    <View style={s.avatarWrap}>
                      {conv.avatar_url
                        ? <Image source={{ uri: conv.avatar_url }} style={s.avatarImg} />
                        : (
                          <View style={s.avatarCircle}>
                            <Text style={s.avatarEmoji}>👤</Text>
                          </View>
                        )
                      }
                    </View>
                    <View style={s.chatContent}>
                      <View style={s.chatTop}>
                        <Text style={[s.chatName, conv.unread > 0 && s.chatNameBold]}>
                          {conv.name}
                        </Text>
                        <Text style={[s.chatTime, conv.unread > 0 && s.chatTimeUnread]}>
                          {timeAgo(conv.lastTime)}
                        </Text>
                      </View>
                      <View style={s.chatBottom}>
                        <Text
                          style={[s.chatLastMsg, conv.unread > 0 && s.chatLastMsgBold]}
                          numberOfLines={1}
                        >
                          {conv.lastMessage === '[Đã gửi một ảnh]' ? '📷 Ảnh' : conv.lastMessage}
                        </Text>
                        {conv.unread > 0 && (
                          <View style={s.unreadCount}>
                            <Text style={s.unreadCountText}>
                              {conv.unread > 99 ? '99+' : conv.unread}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}

          {/* Group Chat Tab */}
          {activeTab === 'group' && (
            <View style={s.list}>
              {eventChats.length === 0 ? (
                <View style={s.emptyBox}>
                  <Text style={s.emptyIcon}>🎪</Text>
                  <Text style={s.emptyTitle}>Chưa có nhóm chat nào</Text>
                  <Text style={s.emptyDesc}>
                    Tham gia hoặc tổ chức sự kiện để có nhóm chat thảo luận
                  </Text>
                  <TouchableOpacity
                    style={s.emptyBtn}
                    onPress={() => router.push('/(tabs)/events' as any)}
                  >
                    <Text style={s.emptyBtnText}>Khám phá sự kiện</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                eventChats.map(event => {
                  const isCreator = event.creator_id === user?.id
                  const emoji = CATEGORY_EMOJI[event.category] ?? '🎪'
                  return (
                    <TouchableOpacity
                      key={event.id}
                      style={s.chatItem}
                      onPress={() => router.push(`/event/group-chat/${event.id}` as any)}
                    >
                      <View style={s.groupAvatarWrap}>
                        <View style={s.groupAvatar}>
                          <Text style={s.groupAvatarEmoji}>{emoji}</Text>
                        </View>
                        {isCreator && (
                          <View style={s.creatorBadge}>
                            <Text style={s.creatorBadgeText}>👑</Text>
                          </View>
                        )}
                      </View>
                      <View style={s.chatContent}>
                        <View style={s.chatTop}>
                          <Text style={s.chatName} numberOfLines={1}>{event.title}</Text>
                          <Text style={s.eventCategoryTag}>{event.category}</Text>
                        </View>
                        <View style={s.chatBottom}>
                          <Text style={s.chatLastMsg}>
                            {isCreator ? '👑 Trưởng nhóm · ' : ''}Chat nhóm sự kiện
                          </Text>
                          <View style={s.joinChatBtn}>
                            <Text style={s.joinChatBtnText}>Vào chat →</Text>
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  )
                })
              )}
            </View>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      {/* New DM Modal */}
      <Modal visible={newDMModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Tin nhắn mới</Text>
              <TouchableOpacity onPress={() => { setNewDMModal(false); setUserSearch(''); setSearchResults([]) }}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={s.searchBox}>
              <Text style={s.searchIcon}>🔍</Text>
              <TextInput
                style={s.searchInput}
                placeholder="Tìm người dùng theo tên..."
                placeholderTextColor="#94A3B8"
                value={userSearch}
                onChangeText={setUserSearch}
                autoFocus
              />
              {searchLoading && <ActivityIndicator color="#2563EB" size="small" />}
            </View>

            <ScrollView style={s.searchResults} keyboardShouldPersistTaps="handled">
              {userSearch.trim().length >= 2 && searchResults.length === 0 && !searchLoading && (
                <View style={s.noResults}>
                  <Text style={s.noResultsText}>Không tìm thấy người dùng</Text>
                </View>
              )}
              {searchResults.map(u => (
                <TouchableOpacity
                  key={u.id}
                  style={s.userResult}
                  onPress={() => {
                    setNewDMModal(false)
                    setUserSearch('')
                    setSearchResults([])
                    router.push(`/dm/${u.id}` as any)
                  }}
                >
                  <View style={s.userResultAvatar}>
                    {u.avatar_url
                      ? <Image source={{ uri: u.avatar_url }} style={s.userResultAvatarImg} />
                      : <Text style={s.userResultAvatarEmoji}>👤</Text>
                    }
                  </View>
                  <Text style={s.userResultName}>{u.name}</Text>
                  <Text style={s.userResultArrow}>→</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    backgroundColor: '#fff',
    paddingTop: 52,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 4,
  },
  headerTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 26, fontWeight: '900', color: '#0F172A' },
  unreadBadge: {
    backgroundColor: '#EF4444', paddingHorizontal: 8,
    paddingVertical: 2, borderRadius: 10,
  },
  unreadText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  newBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center',
  },
  newBtnIcon: { fontSize: 18 },
  tabs: {
    flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 0, gap: 8,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, borderBottomWidth: 2.5, borderBottomColor: 'transparent', gap: 4,
  },
  tabActive: { borderBottomColor: '#2563EB' },
  tabText: { fontSize: 13, color: '#94A3B8', fontWeight: '600' },
  tabTextActive: { color: '#2563EB', fontWeight: '800' },
  tabCountBadge: {
    backgroundColor: '#F97316', width: 18, height: 18,
    borderRadius: 9, justifyContent: 'center', alignItems: 'center',
  },
  tabCountText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  list: { padding: 12, gap: 4 },

  // Chat Item
  chatItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 16,
    padding: 12, gap: 12, marginBottom: 6,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  avatarWrap: { position: 'relative' },
  avatarImg: { width: 50, height: 50, borderRadius: 15 },
  avatarCircle: {
    width: 50, height: 50, borderRadius: 15,
    backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center',
  },
  avatarEmoji: { fontSize: 22 },
  groupAvatarWrap: { position: 'relative' },
  groupAvatar: {
    width: 50, height: 50, borderRadius: 15,
    backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center',
  },
  groupAvatarEmoji: { fontSize: 24 },
  creatorBadge: {
    position: 'absolute', top: -4, right: -4,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  creatorBadgeText: { fontSize: 11 },
  chatContent: { flex: 1 },
  chatTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  chatName: { fontSize: 14, color: '#0F172A', fontWeight: '500', flex: 1, marginRight: 8 },
  chatNameBold: { fontWeight: '800' },
  chatTime: { fontSize: 11, color: '#94A3B8' },
  chatTimeUnread: { color: '#2563EB', fontWeight: '700' },
  eventCategoryTag: { fontSize: 10, color: '#64748B', backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  chatBottom: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chatLastMsg: { flex: 1, fontSize: 13, color: '#94A3B8' },
  chatLastMsgBold: { color: '#374151', fontWeight: '600' },
  unreadCount: {
    backgroundColor: '#2563EB', minWidth: 20, height: 20,
    borderRadius: 10, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6,
  },
  unreadCountText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  joinChatBtn: {
    backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  joinChatBtnText: { color: '#2563EB', fontSize: 11, fontWeight: '700' },

  // Empty State
  emptyBox: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32, gap: 10 },
  emptyIcon: { fontSize: 52 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  emptyDesc: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    backgroundColor: '#2563EB', paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: 14, marginTop: 6,
  },
  emptyBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // New DM Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 20, paddingBottom: 40, maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  modalClose: { fontSize: 20, color: '#94A3B8', fontWeight: '700', padding: 4 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F1F5F9', marginHorizontal: 16,
    borderRadius: 14, paddingHorizontal: 12,
    marginBottom: 8, gap: 8,
    borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: '#0F172A' },
  searchResults: { paddingHorizontal: 16, maxHeight: 300 },
  noResults: { paddingVertical: 24, alignItems: 'center' },
  noResultsText: { color: '#94A3B8', fontSize: 14 },
  userResult: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  userResultAvatar: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden',
  },
  userResultAvatarImg: { width: 44, height: 44, borderRadius: 14 },
  userResultAvatarEmoji: { fontSize: 20 },
  userResultName: { flex: 1, fontSize: 15, fontWeight: '600', color: '#0F172A' },
  userResultArrow: { color: '#2563EB', fontSize: 16, fontWeight: '700' },
})

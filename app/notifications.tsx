import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { useState, useEffect } from 'react'
import { useAuthStore } from '../stores/useAuthStore'
import { supabase } from '../services/supabase'

const TABS = ['Tất cả', 'Sự kiện', 'Ưu đãi', 'Cảnh báo', 'Tin nhắn']

const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  event:   { icon: '🎪', color: '#2563EB', bg: '#EFF6FF' },
  offer:   { icon: '🎁', color: '#F97316', bg: '#FFF7ED' },
  alert:   { icon: '⚠️', color: '#EF4444', bg: '#FEF2F2' },
  message: { icon: '💬', color: '#8B5CF6', bg: '#F5F3FF' },
}

export default function NotificationsScreen() {
  const user = useAuthStore((s) => s.user)
  const [activeTab, setActiveTab] = useState('Tất cả')
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    loadNotifications()
  }, [user])

  const loadNotifications = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(30)
    setNotifications(data ?? [])
    setLoading(false)
  }

  const markAllRead = async () => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user!.id)
      .eq('is_read', false)
    setNotifications(ns => ns.map(n => ({ ...n, is_read: true })))
  }

  const markRead = async (id: string) => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
    setNotifications(ns => ns.map(n =>
      n.id === id ? { ...n, is_read: true } : n
    ))
  }

  const deleteNotif = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id)
    setNotifications(ns => ns.filter(n => n.id !== id))
  }

  const deleteAll = async () => {
    await supabase.from('notifications').delete().eq('user_id', user!.id)
    setNotifications([])
  }

  const filtered = notifications.filter(n => {
    if (activeTab === 'Tất cả') return true
    if (activeTab === 'Sự kiện') return n.type === 'event'
    if (activeTab === 'Ưu đãi') return n.type === 'offer'
    if (activeTab === 'Cảnh báo') return n.type === 'alert'
    if (activeTab === 'Tin nhắn') return n.type === 'message'
    return true
  })

  const unreadCount = notifications.filter(n => !n.is_read).length

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
          <Text style={s.backBtn}>←</Text>
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.title}>Thông báo</Text>
          {unreadCount > 0 && (
            <View style={s.unreadBadge}>
              <Text style={s.unreadText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        <View style={s.headerActions}>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={markAllRead}>
              <Text style={s.readAllBtn}>Đọc tất cả</Text>
            </TouchableOpacity>
          )}
          {notifications.length > 0 && (
            <TouchableOpacity onPress={deleteAll}>
              <Text style={s.deleteAllBtn}>Xóa tất cả</Text>
            </TouchableOpacity>
          )}
        </View>
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
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color="#2563EB" size="large" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={s.center}>
          <Text style={{ fontSize: 52 }}>🔔</Text>
          <Text style={s.emptyTitle}>Không có thông báo</Text>
          <Text style={s.emptyDesc}>Thông báo mới sẽ hiện ở đây</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={s.list}>
            {filtered.map(n => {
              const config = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.event
              return (
                <TouchableOpacity
                  key={n.id}
                  style={[s.notifItem, !n.is_read && s.notifUnread]}
                  onPress={() => {
                    markRead(n.id)
                    // Navigate nếu có target
                    if (n.target_id && n.target_type === 'event') {
                      router.push(`/event/${n.target_id}`)
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <View style={[s.notifIcon, { backgroundColor: config.bg }]}>
                    <Text style={s.notifEmoji}>{config.icon}</Text>
                  </View>

                  <View style={s.notifContent}>
                    <View style={s.notifTop}>
                      <Text style={s.notifTitle} numberOfLines={1}>
                        {n.title}
                      </Text>
                      {!n.is_read && <View style={s.notifDot} />}
                    </View>
                    <Text style={s.notifMessage} numberOfLines={2}>
                      {n.message}
                    </Text>
                    <Text style={s.notifTime}>{timeAgo(n.created_at)}</Text>
                  </View>

                  <TouchableOpacity
                    style={s.deleteBtn}
                    onPress={() => deleteNotif(n.id)}
                  >
                    <Text style={s.deleteBtnText}>✕</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              )
            })}
          </View>
        </ScrollView>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.06,
    shadowRadius: 8, elevation: 4,
  },
  backBtn: { fontSize: 22, color: '#2563EB', fontWeight: '700', width: 36 },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
  unreadBadge: {
    backgroundColor: '#EF4444', width: 22, height: 22,
    borderRadius: 11, justifyContent: 'center', alignItems: 'center',
  },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  readAllBtn: { color: '#2563EB', fontSize: 13, fontWeight: '600' },
  headerActions: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  deleteAllBtn: { color: '#EF4444', fontSize: 13, fontWeight: '600' },
  tabBar: { backgroundColor: '#fff', maxHeight: 52 },
  tabList: { paddingHorizontal: 16, gap: 8, paddingVertical: 10 },
  tab: {
    paddingHorizontal: 16, paddingVertical: 6,
    borderRadius: 20, backgroundColor: '#F1F5F9',
  },
  tabActive: { backgroundColor: '#2563EB' },
  tabText: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  center: { flex: 1, alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  emptyDesc: { fontSize: 14, color: '#64748B' },
  list: { padding: 16, gap: 10 },
  notifItem: {
    flexDirection: 'row', gap: 12,
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.05,
    shadowRadius: 6, elevation: 2,
  },
  notifUnread: {
    borderLeftWidth: 3, borderLeftColor: '#2563EB',
    backgroundColor: '#FAFCFF',
  },
  notifIcon: {
    width: 48, height: 48, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  notifEmoji: { fontSize: 22 },
  notifContent: { flex: 1 },
  notifTop: {
    flexDirection: 'row', alignItems: 'center',
    gap: 6, marginBottom: 4,
  },
  notifTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A', flex: 1 },
  notifDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#2563EB', flexShrink: 0,
  },
  notifMessage: { fontSize: 13, color: '#64748B', lineHeight: 18, marginBottom: 6 },
  notifTime: { fontSize: 11, color: '#94A3B8' },
  deleteBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center', alignItems: 'center',
    alignSelf: 'center',
  },
  deleteBtnText: { color: '#94A3B8', fontSize: 12, fontWeight: '700' },
})
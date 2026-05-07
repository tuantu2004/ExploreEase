import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, KeyboardAvoidingView,
  Platform, ActivityIndicator, Alert, Image,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useState, useRef, useEffect } from 'react'
import * as Location from 'expo-location'
import * as ImagePicker from 'expo-image-picker'
import { useAuthStore } from '../../../stores/useAuthStore'
import { supabase } from '../../../services/supabase'
import {
  getEventMessages, sendEventMessage, pinEventMessage,
  subscribeToEventMessages, EventMessage, uploadChatImage,
} from '../../../services/messageService'

export default function EventGroupChatScreen() {
  const { id: eventId } = useLocalSearchParams<{ id: string }>()
  const me = useAuthStore((s) => s.user)
  const [event, setEvent] = useState<any>(null)
  const [messages, setMessages] = useState<EventMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showActions, setShowActions] = useState(false)
  const scrollRef = useRef<ScrollView>(null)
  const isCreator = event?.creator_id === me?.id

  useEffect(() => {
    if (!eventId) return
    loadEvent()
    loadMessages()
    const channel = subscribeToEventMessages(eventId, (msg) => {
      setMessages(prev => [...prev, msg])
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
    })
    return () => { supabase.removeChannel(channel) }
  }, [eventId])

  const loadEvent = async () => {
    const { data } = await supabase
      .from('events')
      .select('id, title, creator_id, category')
      .eq('id', eventId)
      .single()
    setEvent(data)
  }

  const loadMessages = async () => {
    if (!eventId) return
    try {
      const msgs = await getEventMessages(eventId)
      setMessages(msgs)
    } catch { /* ignore */ } finally {
      setLoading(false)
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100)
    }
  }

  const handleSend = async () => {
    if (!me || !eventId || !input.trim() || sending) return
    const text = input.trim()
    setInput('')
    setSending(true)
    try {
      const msg = await sendEventMessage(eventId, me.id, text)
      setMessages(prev => [...prev, msg])
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
    } catch { /* ignore */ } finally {
      setSending(false)
    }
  }

  const handleSendLocation = async () => {
    if (!me || !eventId) return
    setShowActions(false)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Không có quyền', 'Vui lòng cấp quyền truy cập vị trí trong cài đặt.')
        return
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      const [geo] = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      }).catch(() => [null])
      const label = geo
        ? [geo.street, geo.district, geo.city].filter(Boolean).join(', ')
        : `${loc.coords.latitude.toFixed(4)}°N, ${loc.coords.longitude.toFixed(4)}°E`
      const content = `📍 ${label}`
      const msg = await sendEventMessage(
        eventId, me.id, content,
        { lat: loc.coords.latitude, lng: loc.coords.longitude, label },
      )
      setMessages(prev => [...prev, msg])
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
    } catch {
      Alert.alert('Lỗi', 'Không thể lấy vị trí hiện tại.')
    }
  }

  const handleSendImage = async () => {
    if (!me || !eventId) return
    setShowActions(false)
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Không có quyền', 'Vui lòng cấp quyền truy cập thư viện ảnh.')
        return
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: false,
      })
      if (result.canceled || !result.assets[0]) return
      setUploading(true)
      const imageUrl = await uploadChatImage(result.assets[0].uri)
      if (!imageUrl) {
        Alert.alert('Lỗi', 'Không thể tải ảnh lên. Vui lòng thử lại.')
        return
      }
      const msg = await sendEventMessage(eventId, me.id, '[Đã gửi một ảnh]', undefined, imageUrl)
      setMessages(prev => [...prev, msg])
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
    } catch {
      Alert.alert('Lỗi', 'Không thể gửi ảnh.')
    } finally {
      setUploading(false)
    }
  }

  const handlePin = async (msgId: string, currentPinned: boolean) => {
    if (!isCreator) return
    try {
      await pinEventMessage(msgId, !currentPinned)
      setMessages(prev =>
        prev.map(m => m.id === msgId ? { ...m, is_pinned: !currentPinned } : m)
      )
    } catch { /* ignore */ }
  }

  const fmt = (date: string) =>
    new Date(date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

  const pinnedMsg = messages.find(m => m.is_pinned)

  const CATEGORY_EMOJI: Record<string, string> = {
    'Âm nhạc': '🎵', 'Ẩm thực': '🍜', 'Thể thao': '🏃',
    'Nghệ thuật': '🎨', 'Công nghệ': '💻', 'Du lịch': '✈️',
  }

  return (
    <KeyboardAvoidingView
      style={s.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={s.headerAvatar}>
          <Text style={s.headerAvatarEmoji}>
            {CATEGORY_EMOJI[event?.category] ?? '🎪'}
          </Text>
        </View>
        <View style={s.headerInfo}>
          <Text style={s.headerName} numberOfLines={1}>
            {event?.title ?? 'Nhóm sự kiện'}
          </Text>
          <View style={s.headerOnlineRow}>
            <View style={s.onlineDot} />
            <Text style={s.headerSub}>Nhóm chat · Đang hoạt động</Text>
          </View>
        </View>
      </View>

      {/* Pinned Message */}
      {pinnedMsg && (
        <View style={s.pinnedBar}>
          <Text style={s.pinnedIcon}>📌</Text>
          <Text style={s.pinnedText} numberOfLines={1}>{pinnedMsg.content}</Text>
        </View>
      )}

      {/* E2E Notice */}
      <View style={s.e2eBar}>
        <Text style={s.e2eText}>🔒 Mã hóa đầu cuối · Chat nhóm sự kiện</Text>
      </View>

      {/* Messages */}
      {loading ? (
        <View style={s.center}><ActivityIndicator color="#2563EB" /></View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={s.messages}
          contentContainerStyle={s.messagesList}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 && (
            <View style={s.emptyMsg}>
              <Text style={s.emptyIcon}>💬</Text>
              <Text style={s.emptyTitle}>Chưa có tin nhắn nào</Text>
              <Text style={s.emptyDesc}>Hãy bắt đầu thảo luận về sự kiện!</Text>
            </View>
          )}
          {messages.map((msg) => {
            const isMe = msg.sender_id === me?.id
            const senderName = msg.profiles?.name ?? 'Ẩn danh'
            const showText = msg.content && msg.content !== '[Đã gửi một ảnh]'
            return (
              <TouchableOpacity
                key={msg.id}
                activeOpacity={isCreator ? 0.7 : 1}
                onLongPress={() => {
                  if (!isCreator) return
                  Alert.alert(
                    'Ghim tin nhắn',
                    msg.is_pinned ? 'Bỏ ghim tin nhắn này?' : 'Ghim tin nhắn này?',
                    [
                      { text: 'Hủy', style: 'cancel' },
                      { text: msg.is_pinned ? 'Bỏ ghim' : 'Ghim', onPress: () => handlePin(msg.id, msg.is_pinned) },
                    ]
                  )
                }}
              >
                <View style={[s.msgRow, isMe && s.msgRowMe]}>
                  {!isMe && (
                    <View style={s.msgAvatar}>
                      <Text style={s.msgAvatarText}>👤</Text>
                    </View>
                  )}
                  <View style={s.msgGroup}>
                    {!isMe && <Text style={s.senderName}>{senderName}</Text>}
                    <View style={[
                      s.bubble, isMe ? s.bubbleMe : s.bubbleOther,
                      msg.is_pinned && s.bubblePinned,
                    ]}>
                      {msg.is_pinned && <Text style={s.pinnedTag}>📌 Đã ghim</Text>}
                      {msg.image_url && (
                        <Image
                          source={{ uri: msg.image_url }}
                          style={s.msgImage}
                          resizeMode="cover"
                        />
                      )}
                      {showText && (
                        <Text style={[s.bubbleText, isMe ? s.bubbleTextMe : s.bubbleTextOther]}>
                          {msg.content}
                        </Text>
                      )}
                      <Text style={[s.bubbleTime, isMe ? s.bubbleTimeMe : s.bubbleTimeOther]}>
                        {fmt(msg.created_at)}
                      </Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      )}

      {/* Upload indicator */}
      {uploading && (
        <View style={s.uploadBar}>
          <ActivityIndicator color="#2563EB" size="small" />
          <Text style={s.uploadText}>Đang tải ảnh lên...</Text>
        </View>
      )}

      {/* Quick Actions */}
      {showActions && (
        <View style={s.actionsPanel}>
          <TouchableOpacity style={s.actionItem} onPress={handleSendLocation}>
            <View style={s.actionIcon}><Text style={{ fontSize: 22 }}>📍</Text></View>
            <Text style={s.actionLabel}>Vị trí</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionItem} onPress={handleSendImage}>
            <View style={s.actionIcon}><Text style={{ fontSize: 22 }}>🖼️</Text></View>
            <Text style={s.actionLabel}>Ảnh</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionItem} onPress={() => router.push(`/event/${eventId}`)}>
            <View style={s.actionIcon}><Text style={{ fontSize: 22 }}>📅</Text></View>
            <Text style={s.actionLabel}>Sự kiện</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Input */}
      <View style={s.inputBar}>
        <TouchableOpacity
          style={[s.actionBtn, showActions && s.actionBtnActive]}
          onPress={() => setShowActions(!showActions)}
        >
          <Text style={s.actionBtnText}>{showActions ? '✕' : '+'}</Text>
        </TouchableOpacity>
        <View style={s.inputBox}>
          <TextInput
            style={s.input}
            placeholder="Nhắn với nhóm..."
            placeholderTextColor="#94A3B8"
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
          />
        </View>
        <TouchableOpacity
          style={[s.sendBtn, (!input.trim() || sending) && s.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!input.trim() || sending}
        >
          {sending
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.sendIcon}>↑</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 52, paddingHorizontal: 12, paddingBottom: 12,
    backgroundColor: '#fff', gap: 10,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 4,
  },
  backIcon: { fontSize: 22, color: '#2563EB', fontWeight: '700', width: 28 },
  headerAvatar: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: '#EFF6FF',
    justifyContent: 'center', alignItems: 'center',
  },
  headerAvatarEmoji: { fontSize: 20 },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  headerOnlineRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E' },
  headerSub: { fontSize: 11, color: '#64748B' },
  pinnedBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF7ED', paddingHorizontal: 16, paddingVertical: 8, gap: 8,
    borderBottomWidth: 1, borderBottomColor: '#FED7AA',
  },
  pinnedIcon: { fontSize: 14 },
  pinnedText: { flex: 1, fontSize: 12, color: '#B45309', fontWeight: '500' },
  e2eBar: { paddingVertical: 5, alignItems: 'center', backgroundColor: '#F8FAFC' },
  e2eText: { fontSize: 11, color: '#94A3B8' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  messages: { flex: 1 },
  messagesList: { padding: 16, gap: 6 },
  emptyMsg: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  emptyDesc: { fontSize: 13, color: '#64748B' },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 2 },
  msgRowMe: { flexDirection: 'row-reverse' },
  msgAvatar: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: '#EFF6FF',
    justifyContent: 'center', alignItems: 'center',
  },
  msgAvatarText: { fontSize: 14 },
  msgGroup: { flex: 1, maxWidth: '75%' },
  senderName: { fontSize: 11, color: '#64748B', fontWeight: '600', marginBottom: 2, marginLeft: 4 },
  bubble: { borderRadius: 18, padding: 10, overflow: 'hidden' },
  bubbleMe: { backgroundColor: '#2563EB', borderBottomRightRadius: 4, alignSelf: 'flex-end' },
  bubbleOther: { backgroundColor: '#fff', borderBottomLeftRadius: 4 },
  bubblePinned: { borderWidth: 2, borderColor: '#F97316' },
  pinnedTag: { fontSize: 10, color: '#F97316', fontWeight: '700', marginBottom: 4 },
  msgImage: { width: 200, height: 150, borderRadius: 10, marginBottom: 4 },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  bubbleTextMe: { color: '#fff' },
  bubbleTextOther: { color: '#0F172A' },
  bubbleTime: { fontSize: 10, marginTop: 4 },
  bubbleTimeMe: { color: 'rgba(255,255,255,0.6)', textAlign: 'right' },
  bubbleTimeOther: { color: '#94A3B8' },
  uploadBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#EFF6FF', paddingHorizontal: 16, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: '#BFDBFE',
  },
  uploadText: { fontSize: 12, color: '#2563EB', fontWeight: '600' },
  actionsPanel: {
    flexDirection: 'row', backgroundColor: '#fff',
    paddingVertical: 12, paddingHorizontal: 20, gap: 24,
    borderTopWidth: 1, borderTopColor: '#F1F5F9',
  },
  actionItem: { alignItems: 'center', gap: 4 },
  actionIcon: {
    width: 52, height: 52, borderRadius: 16, backgroundColor: '#F1F5F9',
    justifyContent: 'center', alignItems: 'center',
  },
  actionLabel: { fontSize: 11, color: '#64748B', fontWeight: '500' },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end',
    backgroundColor: '#fff', paddingHorizontal: 12,
    paddingVertical: 10, gap: 8,
    borderTopWidth: 1, borderTopColor: '#F1F5F9',
  },
  actionBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: '#F1F5F9',
    justifyContent: 'center', alignItems: 'center',
  },
  actionBtnActive: { backgroundColor: '#EF4444' },
  actionBtnText: { fontSize: 20, color: '#64748B', fontWeight: '700' },
  inputBox: {
    flex: 1, backgroundColor: '#F1F5F9', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  input: { fontSize: 14, color: '#0F172A', maxHeight: 100 },
  sendBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: '#2563EB',
    justifyContent: 'center', alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#93C5FD' },
  sendIcon: { color: '#fff', fontSize: 18, fontWeight: '900' },
})

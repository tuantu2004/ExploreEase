import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, KeyboardAvoidingView,
  Platform, ActivityIndicator, Alert, Image,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useState, useRef, useEffect } from 'react'
import * as Location from 'expo-location'
import * as ImagePicker from 'expo-image-picker'
import { useAuthStore } from '../../stores/useAuthStore'
import { supabase } from '../../services/supabase'
import {
  getMessages, sendMessage, markMessagesRead,
  subscribeToMessages, Message, uploadChatImage,
} from '../../services/messageService'

export default function DMScreen() {
  const { id: otherId } = useLocalSearchParams<{ id: string }>()
  const me = useAuthStore((s) => s.user)
  const [otherUser, setOtherUser] = useState<{ name: string; avatar_url?: string } | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showActions, setShowActions] = useState(false)
  const scrollRef = useRef<ScrollView>(null)

  useEffect(() => {
    if (!me || !otherId) return
    loadProfile()
    loadMessages()
    const channel = subscribeToMessages(me.id, otherId, (msg) => {
      setMessages(prev => [...prev, msg])
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
    })
    return () => { supabase.removeChannel(channel) }
  }, [me, otherId])

  const loadProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('name, avatar_url')
      .eq('id', otherId)
      .single()
    setOtherUser(data)
  }

  const loadMessages = async () => {
    if (!me || !otherId) return
    try {
      const msgs = await getMessages(me.id, otherId)
      setMessages(msgs)
      await markMessagesRead(me.id, otherId)
    } catch { /* ignore */ } finally {
      setLoading(false)
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100)
    }
  }

  const handleSend = async () => {
    if (!me || !otherId || !input.trim() || sending) return
    const text = input.trim()
    setInput('')
    setSending(true)
    try {
      const msg = await sendMessage(me.id, otherId, text)
      setMessages(prev => [...prev, msg])
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
    } catch { /* ignore */ } finally {
      setSending(false)
    }
  }

  const handleSendImage = async () => {
    if (!me || !otherId) return
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
      const msg = await sendMessage(me.id, otherId, '[Đã gửi một ảnh]', imageUrl)
      setMessages(prev => [...prev, msg])
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
    } catch {
      Alert.alert('Lỗi', 'Không thể gửi ảnh.')
    } finally {
      setUploading(false)
    }
  }

  const handleSendLocation = async () => {
    if (!me || !otherId) return
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
      const content = `📍 ${label}\n${loc.coords.latitude.toFixed(4)}°N, ${loc.coords.longitude.toFixed(4)}°E`
      const msg = await sendMessage(me.id, otherId, content)
      setMessages(prev => [...prev, msg])
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
    } catch {
      Alert.alert('Lỗi', 'Không thể lấy vị trí hiện tại.')
    }
  }

  const fmt = (date: string) =>
    new Date(date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

  return (
    <KeyboardAvoidingView
      style={s.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={s.avatarCircle}>
          {otherUser?.avatar_url
            ? <Image source={{ uri: otherUser.avatar_url }} style={s.avatarImg} />
            : <Text style={s.avatarEmoji}>👤</Text>
          }
        </View>
        <View style={s.headerInfo}>
          <Text style={s.headerName}>{otherUser?.name ?? '...'}</Text>
          <Text style={s.headerSub}>Tin nhắn trực tiếp</Text>
        </View>
        <TouchableOpacity
          style={s.profileBtn}
          onPress={() => router.push(`/user/${otherId}`)}
        >
          <Text style={s.profileBtnText}>Hồ sơ</Text>
        </TouchableOpacity>
      </View>

      {/* E2E Notice */}
      <View style={s.e2eNotice}>
        <Text style={s.e2eText}>🔒 Tin nhắn được mã hóa đầu cuối</Text>
      </View>

      {/* Messages */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color="#2563EB" />
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={s.messages}
          contentContainerStyle={s.messagesList}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 && (
            <View style={s.emptyMsg}>
              <Text style={s.emptyMsgIcon}>💬</Text>
              <Text style={s.emptyMsgText}>Hãy bắt đầu cuộc trò chuyện!</Text>
            </View>
          )}
          {messages.map((msg) => {
            const isMe = msg.sender_id === me?.id
            const showText = msg.content && msg.content !== '[Đã gửi một ảnh]'
            return (
              <View key={msg.id} style={[s.msgRow, isMe && s.msgRowMe]}>
                {!isMe && (
                  <View style={s.msgAvatar}>
                    {otherUser?.avatar_url
                      ? <Image source={{ uri: otherUser.avatar_url }} style={s.msgAvatarImg} />
                      : <Text style={s.msgAvatarText}>👤</Text>
                    }
                  </View>
                )}
                <View style={[s.bubble, isMe ? s.bubbleMe : s.bubbleOther]}>
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
                  <View style={s.bubbleMeta}>
                    <Text style={[s.bubbleTime, isMe ? s.bubbleTimeMe : s.bubbleTimeOther]}>
                      {fmt(msg.created_at)}
                    </Text>
                    {isMe && (
                      <Text style={s.readTick}>{msg.is_read ? '✓✓' : '✓'}</Text>
                    )}
                  </View>
                </View>
              </View>
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

      {/* Quick Actions panel */}
      {showActions && (
        <View style={s.actionsPanel}>
          <TouchableOpacity style={s.actionItem} onPress={handleSendImage}>
            <View style={s.actionIcon}><Text style={{ fontSize: 22 }}>🖼️</Text></View>
            <Text style={s.actionLabel}>Ảnh</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionItem} onPress={handleSendLocation}>
            <View style={s.actionIcon}><Text style={{ fontSize: 22 }}>📍</Text></View>
            <Text style={s.actionLabel}>Vị trí</Text>
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
            placeholder="Nhập tin nhắn..."
            placeholderTextColor="#94A3B8"
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
            onSubmitEditing={handleSend}
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
  backBtn: { padding: 4 },
  backIcon: { fontSize: 22, color: '#2563EB', fontWeight: '700' },
  avatarCircle: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: 38, height: 38, borderRadius: 19 },
  avatarEmoji: { fontSize: 18 },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  headerSub: { fontSize: 11, color: '#94A3B8' },
  profileBtn: {
    backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8,
  },
  profileBtnText: { color: '#2563EB', fontSize: 12, fontWeight: '700' },
  e2eNotice: { paddingVertical: 6, alignItems: 'center', backgroundColor: '#F8FAFC' },
  e2eText: { fontSize: 11, color: '#94A3B8' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  messages: { flex: 1 },
  messagesList: { padding: 16, gap: 8, paddingBottom: 8 },
  emptyMsg: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyMsgIcon: { fontSize: 48 },
  emptyMsgText: { fontSize: 14, color: '#94A3B8' },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  msgRowMe: { flexDirection: 'row-reverse' },
  msgAvatar: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden',
  },
  msgAvatarImg: { width: 30, height: 30, borderRadius: 15 },
  msgAvatarText: { fontSize: 14 },
  bubble: { maxWidth: '75%', borderRadius: 18, padding: 10, overflow: 'hidden' },
  bubbleMe: { backgroundColor: '#2563EB', borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: '#fff', borderBottomLeftRadius: 4 },
  msgImage: { width: 200, height: 150, borderRadius: 10, marginBottom: 4 },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  bubbleTextMe: { color: '#fff' },
  bubbleTextOther: { color: '#0F172A' },
  bubbleMeta: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'flex-end', gap: 4, marginTop: 4,
  },
  bubbleTime: { fontSize: 10 },
  bubbleTimeMe: { color: 'rgba(255,255,255,0.7)' },
  bubbleTimeOther: { color: '#94A3B8' },
  readTick: { fontSize: 10, color: 'rgba(255,255,255,0.7)' },
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

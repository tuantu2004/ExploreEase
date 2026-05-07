import { supabase } from './supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

export interface Message {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  image_url?: string
  is_read: boolean
  created_at: string
  profiles?: { name: string; avatar_url?: string }
}

export interface EventMessage {
  id: string
  event_id: string
  sender_id: string
  content: string
  image_url?: string
  location_data?: { lat: number; lng: number; label: string }
  is_pinned: boolean
  created_at: string
  profiles?: { name: string; avatar_url?: string }
}

export interface Conversation {
  userId: string
  name: string
  avatar_url?: string
  lastMessage: string
  lastTime: string
  unread: number
}

export async function uploadChatImage(uri: string): Promise<string | null> {
  try {
    const response = await fetch(uri)
    const blob = await response.blob()
    const ext = uri.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'jpg'
    const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg'
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExt}`
    const { data, error } = await supabase.storage
      .from('chat-images')
      .upload(path, blob, { contentType: `image/${safeExt === 'jpg' ? 'jpeg' : safeExt}` })
    if (error || !data) return null
    return supabase.storage.from('chat-images').getPublicUrl(data.path).data.publicUrl
  } catch {
    return null
  }
}

// ── 1-1 Direct Messages ─────────────────────────────────────────────────────

export async function getMessages(myId: string, otherId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*, profiles!messages_sender_id_fkey(name, avatar_url)')
    .or(`and(sender_id.eq.${myId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${myId})`)
    .order('created_at', { ascending: true })
    .limit(60)
  if (error) throw error
  return (data ?? []) as Message[]
}

export async function sendMessage(
  senderId: string,
  receiverId: string,
  content: string,
  imageUrl?: string
): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .insert({ sender_id: senderId, receiver_id: receiverId, content, image_url: imageUrl ?? null })
    .select('*, profiles!messages_sender_id_fkey(name, avatar_url)')
    .single()
  if (error) throw error
  return data as Message
}

export async function markMessagesRead(myId: string, senderId: string) {
  await supabase
    .from('messages')
    .update({ is_read: true })
    .eq('sender_id', senderId)
    .eq('receiver_id', myId)
    .eq('is_read', false)
}

export function subscribeToMessages(
  myId: string,
  otherId: string,
  onNew: (msg: Message) => void
): RealtimeChannel {
  return supabase
    .channel(`dm:${[myId, otherId].sort().join('-')}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${myId}`,
      },
      async (payload) => {
        if (payload.new.sender_id !== otherId) return
        const { data } = await supabase
          .from('profiles')
          .select('name, avatar_url')
          .eq('id', payload.new.sender_id)
          .single()
        onNew({ ...payload.new, profiles: data ?? undefined } as Message)
      }
    )
    .subscribe()
}

export async function getConversations(myId: string): Promise<Conversation[]> {
  const { data: sent } = await supabase
    .from('messages')
    .select('receiver_id, content, created_at, is_read')
    .eq('sender_id', myId)
    .order('created_at', { ascending: false })

  const { data: received } = await supabase
    .from('messages')
    .select('sender_id, content, created_at, is_read')
    .eq('receiver_id', myId)
    .order('created_at', { ascending: false })

  const map = new Map<string, { content: string; time: string; unread: number }>()
  ;(sent ?? []).forEach(m => {
    if (!map.has(m.receiver_id)) {
      map.set(m.receiver_id, { content: m.content, time: m.created_at, unread: 0 })
    }
  })
  ;(received ?? []).forEach(m => {
    const existing = map.get(m.sender_id)
    const isNewer = !existing || m.created_at > existing.time
    map.set(m.sender_id, {
      content: isNewer ? m.content : existing!.content,
      time: isNewer ? m.created_at : existing!.time,
      unread: (existing?.unread ?? 0) + (!m.is_read ? 1 : 0),
    })
  })

  if (map.size === 0) return []

  const userIds = Array.from(map.keys())
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, avatar_url')
    .in('id', userIds)

  return userIds
    .map(uid => {
      const info = map.get(uid)!
      const profile = profiles?.find(p => p.id === uid)
      return {
        userId: uid,
        name: profile?.name ?? 'Người dùng',
        avatar_url: profile?.avatar_url,
        lastMessage: info.content,
        lastTime: info.time,
        unread: info.unread,
      }
    })
    .sort((a, b) => b.lastTime.localeCompare(a.lastTime))
}

// ── Event Group Messages ─────────────────────────────────────────────────────

export async function getEventMessages(eventId: string): Promise<EventMessage[]> {
  const { data, error } = await supabase
    .from('event_messages')
    .select('*, profiles!event_messages_sender_id_fkey(name, avatar_url)')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true })
    .limit(80)
  if (error) throw error
  return (data ?? []) as EventMessage[]
}

export async function sendEventMessage(
  eventId: string,
  senderId: string,
  content: string,
  locationData?: EventMessage['location_data'],
  imageUrl?: string
): Promise<EventMessage> {
  const { data, error } = await supabase
    .from('event_messages')
    .insert({
      event_id: eventId,
      sender_id: senderId,
      content,
      location_data: locationData ?? null,
      image_url: imageUrl ?? null,
    })
    .select('*, profiles!event_messages_sender_id_fkey(name, avatar_url)')
    .single()
  if (error) throw error
  return data as EventMessage
}

export async function pinEventMessage(messageId: string, pinned: boolean) {
  const { error } = await supabase
    .from('event_messages')
    .update({ is_pinned: pinned })
    .eq('id', messageId)
  if (error) throw error
}

export function subscribeToEventMessages(
  eventId: string,
  onNew: (msg: EventMessage) => void
): RealtimeChannel {
  return supabase
    .channel(`event-chat-${eventId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'event_messages',
        filter: `event_id=eq.${eventId}`,
      },
      async (payload) => {
        const { data } = await supabase
          .from('profiles')
          .select('name, avatar_url')
          .eq('id', payload.new.sender_id)
          .single()
        onNew({ ...payload.new, profiles: data ?? undefined } as EventMessage)
      }
    )
    .subscribe()
}

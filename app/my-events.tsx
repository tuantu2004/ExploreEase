import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { useAuthStore } from '../stores/useAuthStore'
import { supabase } from '../services/supabase'

interface EventItem {
  id: string
  title: string
  location: string
  category: string
  start_date: string
  end_date: string
  status?: string
  image?: string
}

export default function MyEventsScreen() {
  const user = useAuthStore((s) => s.user)
  const [createdEvents, setCreatedEvents] = useState<EventItem[]>([])
  const [joinedEvents, setJoinedEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setCreatedEvents([])
      setJoinedEvents([])
      setLoading(false)
      return
    }
    loadEvents()
  }, [user])

  const loadEvents = async () => {
    setLoading(true)
    try {
      const [{ data: ownData, error: ownError }, { data: attendeeRows, error: attendeeError }] = await Promise.all([
        supabase
          .from('events')
          .select('*')
          .eq('creator_id', user!.id)
          .order('start_date', { ascending: true }),
        supabase
          .from('event_attendees')
          .select('event_id')
          .eq('user_id', user!.id),
      ])

      if (ownError) throw ownError
      if (attendeeError) throw attendeeError

      const created = ownData ?? []
      const eventIds = (attendeeRows ?? [])
        .map((item: any) => item.event_id)
        .filter((value: string | null): value is string => !!value)

      let joined: EventItem[] = []
      if (eventIds.length > 0) {
        const { data: joinedData, error: joinedError } = await supabase
          .from('events')
          .select('*')
          .in('id', eventIds)
          .order('start_date', { ascending: true })

        if (joinedError) throw joinedError
        joined = joinedData ?? []
      }

      const createdIds = new Set(created.map((item: EventItem) => item.id))
      setCreatedEvents(created)
      setJoinedEvents(joined.filter((item) => !createdIds.has(item.id)))
    } catch (error) {
      console.error('Load events error:', error)
    } finally {
      setLoading(false)
    }
  }

  const renderEvent = (event: EventItem) => (
    <TouchableOpacity
      key={event.id}
      style={s.card}
      onPress={() => router.push(`/event/${event.id}`)}
      activeOpacity={0.8}
    >
      <Text style={s.cardTitle}>{event.title}</Text>
      <Text style={s.cardMeta}>{event.category} · {event.location}</Text>
      <Text style={s.cardTime}>{new Date(event.start_date).toLocaleDateString('vi-VN')} - {new Date(event.end_date).toLocaleDateString('vi-VN')}</Text>
    </TouchableOpacity>
  )

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>Sự kiện của tôi</Text>
        <View style={{ width: 32 }} />
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <Text style={s.sectionTitle}>Sự kiện đã tạo</Text>
          {createdEvents.length === 0 ? (
            <View style={s.emptyBlock}>
              <Text style={s.emptyText}>Bạn chưa tạo sự kiện nào.</Text>
            </View>
          ) : createdEvents.map(renderEvent)}

          <Text style={s.sectionTitle}>Sự kiện đã tham gia</Text>
          {joinedEvents.length === 0 ? (
            <View style={s.emptyBlock}>
              <Text style={s.emptyText}>Bạn chưa tham gia sự kiện nào.</Text>
            </View>
          ) : joinedEvents.map(renderEvent)}
        </ScrollView>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 4,
  },
  backBtn: { fontSize: 22, color: '#2563EB', fontWeight: '700', width: 32 },
  title: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  sectionTitle: { marginTop: 8, marginBottom: 8, fontSize: 16, fontWeight: '800', color: '#0F172A' },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  cardMeta: { marginTop: 6, fontSize: 13, color: '#475569' },
  cardTime: { marginTop: 8, fontSize: 12, color: '#94A3B8' },
  emptyBlock: {
    backgroundColor: '#fff', borderRadius: 16, padding: 18,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 2,
  },
  emptyText: { fontSize: 14, color: '#64748B' },
})
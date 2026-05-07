import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import { useAuthStore } from '../../stores/useAuthStore'
import { supabase } from '../../services/supabase'

export default function TabsLayout() {
  const user = useAuthStore((s) => s.user)
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false)
      setUnread(count ?? 0)
    }
    load()
    const interval = setInterval(load, 15000)
    return () => clearInterval(interval)
  }, [user])

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#F1F5F9',
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ color }) => {
          const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
            index: 'compass-outline',
            map: 'map-outline',
            events: 'calendar-outline',
            plan: 'document-text-outline',
            profile: 'person-outline',
          }
          return (
            <Ionicons
              name={icons[route.name] ?? 'compass-outline'}
              size={22}
              color={color}
            />
          )
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Khám phá' }} />
      <Tabs.Screen name="map" options={{ title: 'Bản đồ' }} />
      <Tabs.Screen name="events" options={{ title: 'Sự kiện' }} />
      <Tabs.Screen name="plan" options={{ title: 'Kế hoạch' }} />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Hồ sơ',
          tabBarBadge: unread > 0 ? unread : undefined,
          tabBarBadgeStyle: { backgroundColor: '#EF4444', fontSize: 10 },
        }}
      />
    </Tabs>
  )
}

import { useEffect, useRef } from 'react'
import { Stack, router } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '../stores/useAuthStore'
import { getProfile } from '../services/authService'
import { supabase } from '../services/supabase'
import OfflineBanner from '../components/ui/OfflineBanner'
import NotificationToast from '../components/ui/NotificationToast'
import * as Notifications from 'expo-notifications'
import { setupPushForUser, sendLoginNotification } from '../services/notificationService'
import { Platform } from 'react-native'

const queryClient = new QueryClient()

function RootLayoutNav() {
  const { setUser } = useAuthStore()
  const handled = useRef(false)
  const navigated = useRef(false)
  const lastActivity = useRef(Date.now())
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const resetTimeout = () => {
    lastActivity.current = Date.now()
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(async () => {
      await supabase.auth.signOut()
    }, 30 * 60 * 1000) // 30 phút
  }

  useEffect(() => {
    resetTimeout()
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  // Xử lý tap notification để điều hướng (web xin quyền khi user click login)
  useEffect(() => {
    if (Platform.OS === 'web') return
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as any
      if (data?.type === 'event' && data?.targetId) {
        router.push(`/event/${data.targetId}`)
      } else if (data?.type === 'place' && data?.targetId) {
        router.push(`/place/${data.targetId}`)
      }
    })
    return () => sub.remove()
  }, [])

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔥 Auth event:', event, session?.user?.email)

        // Chỉ xử lý INITIAL_SESSION 1 lần
        if (event === 'INITIAL_SESSION') {
          if (handled.current) return
          handled.current = true

          if (session?.user) {
            try {
              const profile = await getProfile(session.user.id)
              setUser(profile)
            } catch {
              try {
                await supabase.from('profiles').insert({
                  id: session.user.id,
                  name: session.user.user_metadata?.full_name
                    ?? session.user.email?.split('@')[0]
                    ?? 'User',
                })
                const profile = await getProfile(session.user.id)
                setUser(profile)
              } catch {
                setUser({
                  id: session.user.id,
                  email: session.user.email,
                  name: session.user.user_metadata?.full_name ?? 'User',
                  role: 'user',
                  travel_style: 'solo',
                  is_verified: true,
                  created_at: new Date().toISOString(),
                } as any)
              }
            }
            setupPushForUser(session.user.id)
            sendLoginNotification(
              session.user.user_metadata?.full_name
                ?? session.user.email?.split('@')[0]
                ?? 'bạn'
            )
            if (!navigated.current) {
              navigated.current = true
              router.replace('/(tabs)')
            }
          } else {
            if (!navigated.current) {
              navigated.current = true
              router.replace('/(auth)/login')
            }
          }
          return
        }

        // SIGNED_IN chỉ xử lý sau INITIAL_SESSION
        if (event === 'SIGNED_IN' && handled.current) {
          if (!session?.user) return
          let userName = session.user.user_metadata?.full_name ?? 'bạn'
          try {
            const profile = await getProfile(session.user.id)
            setUser(profile)
            userName = profile.name ?? userName
          } catch {
            setUser({
              id: session.user.id,
              email: session.user.email,
              name: session.user.user_metadata?.full_name ?? 'User',
              role: 'user',
              travel_style: 'solo',
              is_verified: true,
              created_at: new Date().toISOString(),
            } as any)
          }
          setupPushForUser(session.user.id)
          sendLoginNotification(userName)
          if (!navigated.current) {
            navigated.current = true
            router.replace('/(tabs)')
          }
          return
        }

        if (event === 'SIGNED_OUT') {
          handled.current = false
          navigated.current = false
          setUser(null)
          router.replace('/(auth)/login')
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  return (
    <>
      <OfflineBanner />
      <Stack screenOptions={{ headerShown: false }}>

        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="place/[id]" />
        <Stack.Screen name="event/[id]" />
        <Stack.Screen name="event/create" />
        <Stack.Screen name="chat" />
        <Stack.Screen name="search" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="profile/edit" />
        <Stack.Screen name="bookmarks" />
        <Stack.Screen name="my-events" />
        <Stack.Screen name="history" />
        <Stack.Screen name="security" />
        <Stack.Screen name="plan/[id]" />
        <Stack.Screen name="social" />
        <Stack.Screen name="user/[id]" />
        <Stack.Screen name="dm/[id]" />
        <Stack.Screen name="event/group-chat/[id]" />
      </Stack>
      <NotificationToast />
    </>
  )
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <RootLayoutNav />
    </QueryClientProvider>
  )
}
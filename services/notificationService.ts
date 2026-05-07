import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { supabase } from './supabase'
import { useToastStore } from '../stores/useToastStore'
import type { ToastType } from '../stores/useToastStore'

// Hiện in-app toast từ bất kỳ đâu (kể cả ngoài component)
function showToast(title: string, body: string, type: ToastType = 'info') {
  useToastStore.getState().show(title, body, type)
}

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  })
}

// Giữ lại để không break login.tsx import cũ
export async function requestWebNotificationPermission(): Promise<boolean> {
  return true
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') {
    // Trên web: chỉ xin quyền browser notification, không có Expo token
    await requestWebNotificationPermission()
    return null
  }
  try {
    const { status: existing } = await Notifications.getPermissionsAsync()
    let status = existing

    if (existing !== 'granted') {
      const res = await Notifications.requestPermissionsAsync()
      status = res.status
    }

    if (status !== 'granted') return null

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('exploreease', {
        name: 'ExploreEase',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2563EB',
      })
    }

    const { data: tokenData } = await Notifications.getExpoPushTokenAsync()
    return tokenData ?? null
  } catch {
    return null
  }
}

export async function savePushToken(userId: string, token: string): Promise<void> {
  try {
    await supabase.from('push_tokens').upsert(
      {
        user_id: userId,
        token,
        platform: Platform.OS,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,token' }
    )
  } catch (e) {
    console.error('savePushToken error:', e)
  }
}

export async function setupPushForUser(userId: string): Promise<void> {
  const token = await registerForPushNotifications()
  if (token) await savePushToken(userId, token)
}

async function callExpoPush(
  tokens: string[],
  title: string,
  body: string,
  data?: object,
): Promise<void> {
  if (tokens.length === 0) return
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        tokens.map(token => ({
          to: token,
          title,
          body,
          data: data ?? {},
          sound: 'default',
          badge: 1,
        }))
      ),
    })
  } catch (e) {
    console.error('callExpoPush error:', e)
  }
}

export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  data?: object,
): Promise<void> {
  const isError = title.includes('❌') || title.includes('không')
  showToast(title, body, isError ? 'error' : 'success')
  if (Platform.OS === 'web') return
  try {
    const { data: rows } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', userId)
    const tokens = (rows ?? []).map((r: any) => r.token as string)
    await callExpoPush(tokens, title, body, data)
  } catch (e) {
    console.error('sendPushToUser error:', e)
  }
}

export async function sendPushToAdmins(
  title: string,
  body: string,
  data?: object,
): Promise<void> {
  showToast(title, body, 'warning')
  if (Platform.OS === 'web') return
  try {
    const { data: admins } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
    if (!admins || admins.length === 0) return

    const adminIds = admins.map((a: any) => a.id as string)
    const { data: rows } = await supabase
      .from('push_tokens')
      .select('token')
      .in('user_id', adminIds)

    const tokens = (rows ?? []).map((r: any) => r.token as string)
    await callExpoPush(tokens, title, body, data)
  } catch (e) {
    console.error('sendPushToAdmins error:', e)
  }
}

export async function sendLoginNotification(userName: string): Promise<void> {
  const title = '👋 Đăng nhập thành công!'
  const body = `Chào mừng trở lại, ${userName}! Khám phá địa điểm & sự kiện mới ngay nhé.`

  // In-app toast — hoạt động trên cả web lẫn native
  showToast(title, body, 'success')

  // Native: thêm system notification
  if (Platform.OS !== 'web') {
    try {
      await Notifications.scheduleNotificationAsync({
        content: { title, body, data: { type: 'login' }, sound: true },
        trigger: null,
      })
    } catch (e) {
      console.error('sendLoginNotification error:', e)
    }
  }
}

export async function scheduleEventReminder(event: {
  id: string
  title: string
  start_date: string
  location: string
}) {
  if (Platform.OS === 'web') return
  try {
    const startMs = new Date(event.start_date).getTime()
    const now = Date.now()
    await cancelEventReminder(event.id)

    const reminders = [
      {
        id: `event_1d_${event.id}`,
        offset: 24 * 3600 * 1000,
        title: '📅 Nhắc nhở sự kiện',
        body: `"${event.title}" diễn ra vào ngày mai tại ${event.location}`,
      },
      {
        id: `event_1h_${event.id}`,
        offset: 3600 * 1000,
        title: '⏰ Sắp bắt đầu!',
        body: `"${event.title}" bắt đầu sau 1 giờ. Đừng bỏ lỡ!`,
      },
      {
        id: `event_10m_${event.id}`,
        offset: 10 * 60 * 1000,
        title: '🎪 Bắt đầu ngay!',
        body: `"${event.title}" sẽ bắt đầu sau 10 phút!`,
      },
    ]

    for (const r of reminders) {
      const fireAt = startMs - r.offset
      if (fireAt <= now) continue
      await Notifications.scheduleNotificationAsync({
        identifier: r.id,
        content: {
          title: r.title,
          body: r.body,
          data: { type: 'event', targetId: event.id },
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(fireAt),
        },
      })
    }
  } catch (e) {
    console.error('scheduleEventReminder:', e)
  }
}

export async function cancelEventReminder(eventId: string) {
  if (Platform.OS === 'web') return
  const ids = [`event_1d_${eventId}`, `event_1h_${eventId}`, `event_10m_${eventId}`]
  await Promise.allSettled(ids.map(id => Notifications.cancelScheduledNotificationAsync(id)))
}

const notifiedNearby = new Set<string>()

export async function checkAndNotifyNearby(
  places: Array<{ id: string; name: string; category: string; lat?: number; lng?: number }>,
  userLat: number,
  userLng: number,
) {
  if (Platform.OS === 'web') return
  const NEARBY_KM = 0.5

  for (const place of places) {
    if (!place.lat || !place.lng || notifiedNearby.has(place.id)) continue
    const dist = haversineKm(userLat, userLng, place.lat, place.lng)
    if (dist > NEARBY_KM) continue

    notifiedNearby.add(place.id)
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `📍 Gần bạn: ${place.name}`,
        body: `${place.category} • Cách ${Math.round(dist * 1000)}m`,
        data: { type: 'place', targetId: place.id },
      },
      trigger: null,
    })
  }
}

export function clearNearbyCache() {
  notifiedNearby.clear()
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

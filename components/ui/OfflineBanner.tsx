import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native'
import { useEffect, useRef } from 'react'
import { useOffline } from '../../hooks/useOffline'

export default function OfflineBanner() {
  const { isOnline } = useOffline()
  const slideAnim = useRef(new Animated.Value(-60)).current
  const wasOnline = useRef(true)

  useEffect(() => {
    if (!isOnline) {
      // Slide down khi offline
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
      }).start()
    } else if (wasOnline.current === false) {
      // Slide up khi online trở lại
      Animated.timing(slideAnim, {
        toValue: -60,
        duration: 300,
        useNativeDriver: true,
      }).start()
    }
    wasOnline.current = isOnline
  }, [isOnline])

  if (isOnline) return null

  return (
    <Animated.View
      style={[s.banner, { transform: [{ translateY: slideAnim }] }]}
    >
      <Text style={s.icon}>📡</Text>
      <View style={{ flex: 1 }}>
        <Text style={s.title}>Đang ở chế độ offline</Text>
        <Text style={s.desc}>Hiển thị dữ liệu đã lưu</Text>
      </View>
      <View style={s.badge}>
        <Text style={s.badgeText}>OFFLINE</Text>
      </View>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 9999,
    backgroundColor: '#1E293B',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingTop: 50,
    gap: 10,
  },
  icon: { fontSize: 20 },
  title: { color: '#fff', fontSize: 13, fontWeight: '700' },
  desc: { color: '#94A3B8', fontSize: 11, marginTop: 1 },
  badge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
})
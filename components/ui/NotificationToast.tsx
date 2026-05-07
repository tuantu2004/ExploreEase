import { useEffect, useRef } from 'react'
import {
  Animated, View, Text, TouchableOpacity,
  StyleSheet, Platform, Dimensions,
} from 'react-native'
import { useToastStore, Toast, ToastType } from '../../stores/useToastStore'

const SCREEN_WIDTH = Dimensions.get('window').width

function getColors(type: ToastType) {
  switch (type) {
    case 'success': return { bg: '#ECFDF5', border: '#10B981', icon: '✅', text: '#065F46' }
    case 'error':   return { bg: '#FEF2F2', border: '#EF4444', icon: '❌', text: '#7F1D1D' }
    case 'warning': return { bg: '#FFFBEB', border: '#F59E0B', icon: '⚠️', text: '#78350F' }
    default:        return { bg: '#EFF6FF', border: '#2563EB', icon: '🔔', text: '#1E3A5F' }
  }
}

function ToastItem({ toast }: { toast: Toast }) {
  const hide = useToastStore(s => s.hide)
  const translateY = useRef(new Animated.Value(-120)).current
  const opacity = useRef(new Animated.Value(0)).current
  const colors = getColors(toast.type)

  useEffect(() => {
    // Trượt xuống + fade in
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start()

    // Auto hide: fade out trước 4.5s
    const timer = setTimeout(() => dismiss(), 4000)
    return () => clearTimeout(timer)
  }, [])

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -120,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => hide(toast.id))
  }

  return (
    <Animated.View
      style={[
        s.toast,
        { backgroundColor: colors.bg, borderLeftColor: colors.border },
        { transform: [{ translateY }], opacity },
      ]}
    >
      <Text style={s.icon}>{colors.icon}</Text>
      <View style={s.textBox}>
        <Text style={[s.title, { color: colors.text }]} numberOfLines={1}>
          {toast.title}
        </Text>
        <Text style={[s.body, { color: colors.text }]} numberOfLines={2}>
          {toast.body}
        </Text>
      </View>
      <TouchableOpacity onPress={dismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={[s.close, { color: colors.border }]}>✕</Text>
      </TouchableOpacity>
    </Animated.View>
  )
}

export default function NotificationToast() {
  const toasts = useToastStore(s => s.toasts)
  if (toasts.length === 0) return null

  return (
    <View style={s.container} pointerEvents="box-none">
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </View>
  )
}

const TOP_OFFSET = Platform.OS === 'ios' ? 52 : Platform.OS === 'web' ? 16 : 40

const s = StyleSheet.create({
  container: {
    position: 'absolute',
    top: TOP_OFFSET,
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    pointerEvents: 'box-none' as any,
  },
  toast: {
    width: '100%',
    maxWidth: 480,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderLeftWidth: 4,
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  icon: { fontSize: 22 },
  textBox: { flex: 1, gap: 2 },
  title: { fontSize: 14, fontWeight: '800', lineHeight: 18 },
  body:  { fontSize: 13, fontWeight: '400', lineHeight: 17, opacity: 0.85 },
  close: { fontSize: 16, fontWeight: '700' },
})

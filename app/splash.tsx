import { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'
import { router } from 'expo-router'
import { Colors, Typography } from '../constants/theme'

export default function SplashScreen() {
  const opacity = useRef(new Animated.Value(0)).current
  const scale = useRef(new Animated.Value(0.8)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }),
    ]).start()

    const timer = setTimeout(() => router.replace('/onboarding'), 2500)
    return () => clearTimeout(timer)
  }, [])

  return (
    <View style={s.screen}>
      <Animated.View style={[s.content, { opacity, transform: [{ scale }] }]}>
        <View style={s.logoBox}>
          <Text style={s.logoEmoji}>✈️</Text>
        </View>
        <Text style={s.appName}>ExploreEase</Text>
        <Text style={s.slogan}>Khám phá thế giới thông minh hơn</Text>
      </Animated.View>

      <View style={s.bottom}>
        <Text style={s.version}>v1.0.0</Text>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: { alignItems: 'center' },
  logoBox: {
    width: 100,
    height: 100,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  logoEmoji: { fontSize: 52 },
  appName: {
    ...Typography.displaySmall,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -1,
  },
  slogan: {
    ...Typography.bodyLarge,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 8,
    textAlign: 'center',
  },
  bottom: { position: 'absolute', bottom: 40 },
  version: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
})

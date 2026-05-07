import { useEffect, useRef } from 'react'
import { View, Text, Animated, StyleSheet } from 'react-native'
import { storage } from '../services/storage'
import { router } from 'expo-router'
import { supabase } from '../services/supabase'
import { Colors, Typography, Spacing, Radius, Shadow } from '../constants/theme'

const C = Colors.light

export default function SplashScreen() {
  const logoScale = useRef(new Animated.Value(0.5)).current
  const logoOpacity = useRef(new Animated.Value(0)).current
  const textOpacity = useRef(new Animated.Value(0)).current
  const dotsOpacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    // Logo entrance
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, tension: 60, friction: 7, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
      Animated.timing(textOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(dotsOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start()

    // After animation, check where to navigate
    const timeout = setTimeout(async () => {
      const onboardingDone = await storage.getItem('onboarding_done')
      if (!onboardingDone) {
        router.replace('/onboarding' as any)
        return
      }
      // Auth state handled by _layout.tsx INITIAL_SESSION event
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        router.replace('/(tabs)')
      } else {
        router.replace('/(auth)/login')
      }
    }, 1800)

    return () => clearTimeout(timeout)
  }, [])

  return (
    <View style={s.container}>
      {/* Background decoration */}
      <View style={s.circle1} />
      <View style={s.circle2} />

      {/* Logo */}
      <Animated.View style={[s.logoWrap, { transform: [{ scale: logoScale }], opacity: logoOpacity }]}>
        <Text style={s.logoIcon}>✈️</Text>
      </Animated.View>

      {/* App name */}
      <Animated.View style={{ opacity: textOpacity, alignItems: 'center' }}>
        <Text style={s.appName}>ExploreEase</Text>
        <Text style={s.tagline}>Smart Travel Assistant</Text>
      </Animated.View>

      {/* Loading dots */}
      <Animated.View style={[s.dots, { opacity: dotsOpacity }]}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[s.dot, i === 1 && s.dotMid]} />
        ))}
      </Animated.View>
    </View>
  )
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.primary,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  circle1: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(255,255,255,0.06)',
    top: -100,
    right: -100,
  },
  circle2: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(255,255,255,0.04)',
    bottom: -80,
    left: -80,
  },
  logoWrap: {
    width: 110,
    height: 110,
    borderRadius: Radius['3xl'],
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadow.xl,
  },
  logoIcon: { fontSize: 56 },
  appName: {
    ...Typography.headlineMedium,
    color: '#fff',
    letterSpacing: -0.5,
  },
  tagline: {
    ...Typography.bodyMedium,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '500',
    marginTop: 4,
  },
  dots: {
    position: 'absolute',
    bottom: 60,
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dotMid: { backgroundColor: 'rgba(255,255,255,0.8)' },
})

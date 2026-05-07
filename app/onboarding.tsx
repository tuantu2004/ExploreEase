import { useRef, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, FlatList, Animated,
} from 'react-native'
import { router } from 'expo-router'
import { storage } from '../services/storage'
import { Colors, Typography, Spacing, Radius, Shadow } from '../constants/theme'

const { width } = Dimensions.get('window')
const C = Colors.light

const SLIDES = [
  {
    id: '1',
    emoji: '🗺️',
    title: 'Khám phá địa điểm',
    subtitle: 'Hàng nghìn điểm đến hấp dẫn chờ bạn tìm hiểu – từ ẩm thực đến văn hóa, thiên nhiên.',
    bg: C.primaryContainer,
    accent: C.primary,
  },
  {
    id: '2',
    emoji: '✨',
    title: 'Cá nhân hóa trải nghiệm',
    subtitle: 'AI của chúng tôi học sở thích của bạn để gợi ý những địa điểm phù hợp nhất.',
    bg: C.secondaryContainer,
    accent: C.secondary,
  },
  {
    id: '3',
    emoji: '📅',
    title: 'Lập kế hoạch thông minh',
    subtitle: 'Tạo lịch trình du lịch hoàn hảo chỉ trong vài giây với trợ lý AI thông minh.',
    bg: '#EDE9FE',
    accent: '#7C3AED',
  },
]

export default function OnboardingScreen() {
  const [current, setCurrent] = useState(0)
  const flatRef = useRef<FlatList>(null)
  const dotAnim = useRef(SLIDES.map(() => new Animated.Value(0))).current

  const goTo = (index: number) => {
    flatRef.current?.scrollToIndex({ index, animated: true })
    setCurrent(index)
  }

  const handleNext = () => {
    if (current < SLIDES.length - 1) {
      goTo(current + 1)
    } else {
      finish()
    }
  }

  const finish = async () => {
    await storage.setItem('onboarding_done', 'true')
    router.replace('/(auth)/login')
  }

  return (
    <View style={s.container}>
      <FlatList
        ref={flatRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <View style={[s.slide, { backgroundColor: item.bg }]}>
            {/* Decorative circles */}
            <View style={[s.circle1, { backgroundColor: item.accent + '18' }]} />
            <View style={[s.circle2, { backgroundColor: item.accent + '10' }]} />

            <View style={[s.emojiWrap, { backgroundColor: item.accent + '20' }]}>
              <Text style={s.emoji}>{item.emoji}</Text>
            </View>

            <Text style={[s.title, { color: C.onBackground }]}>{item.title}</Text>
            <Text style={s.subtitle}>{item.subtitle}</Text>
          </View>
        )}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / width)
          setCurrent(idx)
        }}
      />

      {/* Bottom Controls */}
      <View style={s.controls}>
        {/* Dots */}
        <View style={s.dots}>
          {SLIDES.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => goTo(i)}>
              <View
                style={[
                  s.dot,
                  i === current ? s.dotActive : s.dotInactive,
                  i === current && { backgroundColor: SLIDES[current].accent },
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Next / Get Started */}
        <TouchableOpacity
          style={[s.btn, { backgroundColor: SLIDES[current].accent, ...Shadow.colored(SLIDES[current].accent) }]}
          onPress={handleNext}
          activeOpacity={0.85}
        >
          <Text style={s.btnText}>
            {current === SLIDES.length - 1 ? 'Bắt đầu ngay 🚀' : 'Tiếp theo →'}
          </Text>
        </TouchableOpacity>

        {/* Skip */}
        {current < SLIDES.length - 1 && (
          <TouchableOpacity onPress={finish} style={s.skipBtn}>
            <Text style={s.skipText}>Bỏ qua</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  slide: {
    width,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing['2xl'],
    paddingTop: 80,
    overflow: 'hidden',
  },
  circle1: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    top: -80,
    right: -80,
  },
  circle2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    bottom: 60,
    left: -60,
  },
  emojiWrap: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing['3xl'],
  },
  emoji: { fontSize: 72 },
  title: {
    ...Typography.headlineMedium,
    textAlign: 'center',
    marginBottom: Spacing.base,
  },
  subtitle: {
    ...Typography.bodyLarge,
    color: C.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 26,
  },

  controls: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: 48,
    paddingTop: Spacing.xl,
    backgroundColor: '#fff',
    alignItems: 'center',
    gap: Spacing.base,
  },
  dots: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  dot: {
    height: 8,
    borderRadius: Radius.full,
    transition: 'all 0.3s',
  },
  dotActive: { width: 28 },
  dotInactive: { width: 8, backgroundColor: C.outline },

  btn: {
    width: '100%',
    paddingVertical: Spacing.base,
    borderRadius: Radius.xl,
    alignItems: 'center',
  },
  btnText: {
    ...Typography.labelLarge,
    color: '#fff',
    fontSize: 16,
  },
  skipBtn: { paddingVertical: Spacing.sm },
  skipText: {
    ...Typography.bodyMedium,
    color: C.onSurfaceVariant,
  },
})

import { useEffect, useRef } from 'react'
import { Animated, ViewStyle } from 'react-native'

interface Props {
  width?: number | string
  height?: number
  borderRadius?: number
  style?: ViewStyle
}

export default function Shimmer({ width = '100%', height = 16, borderRadius = 8, style }: Props) {
  const anim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 800, useNativeDriver: true }),
      ])
    ).start()
  }, [])

  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] })

  return (
    <Animated.View style={[
      { width: width as any, height, borderRadius, backgroundColor: '#E2E8F0', opacity },
      style,
    ]} />
  )
}

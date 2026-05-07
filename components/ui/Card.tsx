import { View, StyleSheet, ViewStyle } from 'react-native'
import { Colors, Radius, Shadow } from '../../constants/theme'

const C = Colors.light

interface Props {
  children: React.ReactNode
  style?: ViewStyle
  variant?: 'elevated' | 'filled' | 'outlined'
}

export default function Card({ children, style, variant = 'elevated' }: Props) {
  return (
    <View style={[
      s.base,
      variant === 'elevated' && s.elevated,
      variant === 'filled' && s.filled,
      variant === 'outlined' && s.outlined,
      style,
    ]}>
      {children}
    </View>
  )
}

const s = StyleSheet.create({
  base: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: C.surface,
  },
  elevated: { ...Shadow.md },
  filled: { backgroundColor: C.surfaceVariant },
  outlined: {
    borderWidth: 1,
    borderColor: C.outline,
  },
})

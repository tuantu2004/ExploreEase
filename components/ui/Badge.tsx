import { View, Text, StyleSheet, ViewStyle } from 'react-native'
import { Colors, Radius } from '../../constants/theme'

interface Props {
  label: string
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'neutral'
  size?: 'sm' | 'md'
  style?: ViewStyle
}

const COLORS = {
  primary: { bg: Colors.light.primaryContainer, text: Colors.light.primary },
  secondary: { bg: Colors.light.secondaryContainer, text: Colors.light.secondary },
  success: { bg: Colors.light.successContainer, text: Colors.light.success },
  warning: { bg: Colors.light.warningContainer, text: Colors.light.warning },
  error: { bg: Colors.light.errorContainer, text: Colors.light.error },
  neutral: { bg: Colors.light.surfaceVariant, text: Colors.light.onSurfaceVariant },
}

export default function Badge({ label, variant = 'primary', size = 'md', style }: Props) {
  return (
    <View style={[
      s.base,
      size === 'sm' && s.sm,
      { backgroundColor: COLORS[variant].bg },
      style,
    ]}>
      <Text style={[
        s.text,
        size === 'sm' && s.textSm,
        { color: COLORS[variant].text },
      ]}>
        {label}
      </Text>
    </View>
  )
}

const s = StyleSheet.create({
  base: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
  },
  sm: { paddingHorizontal: 8, paddingVertical: 2 },
  text: { fontSize: 12, fontWeight: '600' },
  textSm: { fontSize: 11 },
})

import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native'
import { Colors, Radius, Spacing } from '../../constants/theme'

interface Props {
  label: string
  selected?: boolean
  onPress?: () => void
  style?: ViewStyle
}

export default function Chip({ label, selected = false, onPress, style }: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        s.base,
        selected ? s.selected : s.unselected,
        style,
      ]}
    >
      <Text style={[s.text, selected ? s.textSelected : s.textUnselected]}>
        {label}
      </Text>
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  base: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  selected: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  unselected: {
    backgroundColor: Colors.light.surface,
    borderColor: Colors.light.outline,
  },
  text: { fontSize: 13, fontWeight: '500' },
  textSelected: { color: Colors.light.onPrimary },
  textUnselected: { color: Colors.light.onSurfaceVariant },
})

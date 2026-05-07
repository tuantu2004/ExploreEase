import { View, Text, StyleSheet } from 'react-native'
import { Colors } from '../../constants/theme'

interface Props {
  value: number
  count?: number
  size?: 'sm' | 'md' | 'lg'
  showCount?: boolean
}

export default function Rating({ value, count, size = 'md', showCount = true }: Props) {
  const fontSize = { sm: 12, md: 14, lg: 18 }[size]

  return (
    <View style={s.row}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Text
          key={star}
          style={{ fontSize, color: star <= Math.round(value) ? Colors.light.warning : Colors.light.outline }}
        >
          ★
        </Text>
      ))}
      <Text style={[s.value, { fontSize }]}>{value.toFixed(1)}</Text>
      {showCount && count !== undefined && (
        <Text style={[s.count, { fontSize: fontSize - 2 }]}>
          ({count.toLocaleString()})
        </Text>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  value: { fontWeight: '600', color: Colors.light.onSurface, marginLeft: 4 },
  count: { color: Colors.light.placeholder },
})

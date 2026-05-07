import { View, Text, StyleSheet } from 'react-native'

interface Props {
  visible: boolean
}

export default function CacheBadge({ visible }: Props) {
  if (!visible) return null
  return (
    <View style={s.badge}>
      <Text style={s.icon}>💾</Text>
      <Text style={s.text}>Dữ liệu đã lưu</Text>
    </View>
  )
}

const s = StyleSheet.create({
  badge: {
    flexDirection: 'row', alignItems: 'center',
    gap: 4, backgroundColor: '#FFF7ED',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8, alignSelf: 'flex-start',
    borderWidth: 1, borderColor: '#FED7AA',
    marginHorizontal: 16, marginBottom: 8,
  },
  icon: { fontSize: 12 },
  text: { fontSize: 11, color: '#B45309', fontWeight: '600' },
})
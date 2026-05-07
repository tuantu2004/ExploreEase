import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native'

interface MapPickerProps {
  coords: { lat: number; lng: number } | null
  formLocation: string
  mapRegion?: any
  onRegionChange?: (region: any) => void
  onPress?: (event: any) => void
  title?: string
  description?: string
}

export default function MapPickerWeb({ coords, formLocation }: MapPickerProps) {
  const openOsm = async () => {
    const url = `https://www.openstreetmap.org/search?query=${encodeURIComponent(formLocation || 'Việt Nam')}`
    await Linking.openURL(url)
  }

  return (
    <View style={s.container}>
      <View style={s.messageBox}>
        <Text style={s.title}>Bản đồ chỉ khả dụng trên web bằng trình duyệt</Text>
        <Text style={s.text}>
          Trên web, bạn có thể mở OpenStreetMap để tìm và xác định vị trí.
          Sau đó chọn "Xác nhận" để lưu tọa độ.
        </Text>
        <TouchableOpacity style={s.button} onPress={openOsm}>
          <Text style={s.buttonText}>Mở OpenStreetMap</Text>
        </TouchableOpacity>
        {coords ? (
          <Text style={s.coords}>Vị trí hiện tại: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</Text>
        ) : (
          <Text style={s.note}>Nhập địa điểm rồi bấm Xác định để lấy tọa độ.</Text>
        )}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  messageBox: {
    width: '100%', backgroundColor: '#fff', borderRadius: 18,
    padding: 20, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000',
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 5,
  },
  title: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 12 },
  text: { fontSize: 14, color: '#475569', marginBottom: 16, lineHeight: 20 },
  button: {
    backgroundColor: '#2563EB', paddingVertical: 12, borderRadius: 12,
    alignItems: 'center', marginBottom: 12,
  },
  buttonText: { color: '#fff', fontWeight: '700' },
  coords: { fontSize: 13, color: '#16A34A', marginTop: 8 },
  note: { fontSize: 13, color: '#64748B', marginTop: 8 },
})
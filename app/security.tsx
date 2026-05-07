import { View, TouchableOpacity, Text, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import SecuritySettingsScreen from '@/components/security/SecuritySettingsScreen'

export default function SecurityPage() {
  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={s.title}>Bảo mật & Quyền riêng tư</Text>
        <View style={s.spacer} />
      </View>
      <SecuritySettingsScreen />
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 52,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: { padding: 4 },
  backIcon: { fontSize: 32, color: '#0F172A', lineHeight: 36 },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: '#0F172A' },
  spacer: { width: 36 },
})

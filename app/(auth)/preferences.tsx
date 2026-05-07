import {
  View, Text, TouchableOpacity,
  ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { useState } from 'react'
import { useAuthStore } from '../../stores/useAuthStore'
import { supabase } from '../../services/supabase'

const INTERESTS = [
  { id: 'Ẩm thực', label: 'Ẩm thực', icon: '🍜', desc: 'Khám phá ẩm thực địa phương', color: '#FFF7ED', accent: '#F97316' },
  { id: 'Văn hóa', label: 'Văn hóa', icon: '🏛️', desc: 'Lịch sử, nghệ thuật, di sản', color: '#F5F3FF', accent: '#8B5CF6' },
  { id: 'Mua sắm', label: 'Mua sắm', icon: '🛍️', desc: 'Chợ, trung tâm thương mại', color: '#FDF2F8', accent: '#EC4899' },
  { id: 'Thiên nhiên', label: 'Thiên nhiên', icon: '🌿', desc: 'Công viên, núi, biển', color: '#F0FDF4', accent: '#22C55E' },
  { id: 'Phiêu lưu', label: 'Phiêu lưu', icon: '🧗', desc: 'Thể thao, mạo hiểm', color: '#FEF2F2', accent: '#EF4444' },
  { id: 'Về đêm', label: 'Về đêm', icon: '🌙', desc: 'Bar, live music, nightlife', color: '#EFF6FF', accent: '#2563EB' },
]

const TRAVEL_STYLES = [
  { id: 'solo', label: 'Solo', icon: '🎒', desc: 'Tự do, khám phá một mình' },
  { id: 'couple', label: 'Cặp đôi', icon: '💑', desc: 'Lãng mạn, thư giãn' },
  { id: 'family', label: 'Gia đình', icon: '👨‍👩‍👧', desc: 'Vui vẻ, an toàn cho trẻ' },
  { id: 'group', label: 'Nhóm bạn', icon: '👥', desc: 'Náo nhiệt, sôi động' },
]

export default function PreferencesScreen() {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const [selectedInterests, setSelectedInterests] = useState<string[]>([])
  const [travelStyle, setTravelStyle] = useState('solo')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(1)

  const toggleInterest = (id: string) => {
    setSelectedInterests(prev =>
      prev.includes(id)
        ? prev.filter(i => i !== id)
        : [...prev, id]
    )
  }

  const handleSave = async () => {
    if (!user) return
    if (selectedInterests.length === 0) return

    setLoading(true)
    try {
      await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          interests: selectedInterests,
        }, { onConflict: 'user_id' })

      await supabase
        .from('profiles')
        .update({ travel_style: travelStyle })
        .eq('id', user.id)

      setUser({ ...user, travel_style: travelStyle as any })
      router.replace('/(tabs)')
    } catch (e: any) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={s.screen}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.progressRow}>
          {[1, 2].map((i) => (
            <View
              key={i}
              style={[s.progressBar, step >= i && s.progressBarActive]}
            />
          ))}
        </View>
        <Text style={s.stepText}>Bước {step}/2</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.content}
      >
        {step === 1 ? (
          <>
            {/* Step 1 — Interests */}
            <Text style={s.title}>Bạn thích gì? 🎯</Text>
            <Text style={s.subtitle}>
              Chọn ít nhất 1 sở thích để nhận gợi ý phù hợp
            </Text>

            <View style={s.grid}>
              {INTERESTS.map((interest) => {
                const active = selectedInterests.includes(interest.id)
                return (
                  <TouchableOpacity
                    key={interest.id}
                    style={[
                      s.interestCard,
                      { backgroundColor: active ? interest.accent : '#fff' },
                      active && s.interestCardActive,
                    ]}
                    onPress={() => toggleInterest(interest.id)}
                  >
                    <Text style={s.interestEmoji}>{interest.icon}</Text>
                    <Text style={[
                      s.interestLabel,
                      active && s.interestLabelActive,
                    ]}>
                      {interest.label}
                    </Text>
                    <Text style={[
                      s.interestDesc,
                      active && s.interestDescActive,
                    ]}>
                      {interest.desc}
                    </Text>
                    {active && (
                      <View style={s.checkBadge}>
                        <Text style={s.checkText}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )
              })}
            </View>

            <TouchableOpacity
              style={[
                s.nextBtn,
                selectedInterests.length === 0 && s.nextBtnDisabled,
              ]}
              onPress={() => setStep(2)}
              disabled={selectedInterests.length === 0}
            >
              <Text style={s.nextBtnText}>
                Tiếp theo ({selectedInterests.length} đã chọn) →
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {/* Step 2 — Travel Style */}
            <Text style={s.title}>Phong cách du lịch 🗺️</Text>
            <Text style={s.subtitle}>
              Thường đi du lịch với ai?
            </Text>

            <View style={s.styleGrid}>
              {TRAVEL_STYLES.map((style) => (
                <TouchableOpacity
                  key={style.id}
                  style={[
                    s.styleCard,
                    travelStyle === style.id && s.styleCardActive,
                  ]}
                  onPress={() => setTravelStyle(style.id)}
                >
                  <Text style={s.styleEmoji}>{style.icon}</Text>
                  <View style={s.styleInfo}>
                    <Text style={[
                      s.styleLabel,
                      travelStyle === style.id && s.styleLabelActive,
                    ]}>
                      {style.label}
                    </Text>
                    <Text style={[
                      s.styleDesc,
                      travelStyle === style.id && s.styleDescActive,
                    ]}>
                      {style.desc}
                    </Text>
                  </View>
                  {travelStyle === style.id && (
                    <View style={s.styleCheck}>
                      <Text style={s.checkText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <View style={s.btnRow}>
              <TouchableOpacity
                style={s.backBtn}
                onPress={() => setStep(1)}
              >
                <Text style={s.backBtnText}>← Quay lại</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.saveBtn, loading && s.saveBtnDisabled]}
                onPress={handleSave}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={s.saveBtnText}>Bắt đầu khám phá 🚀</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },

  // Header
  header: {
    paddingTop: 52, paddingHorizontal: 24,
    paddingBottom: 16, backgroundColor: '#fff',
  },
  progressRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  progressBar: {
    flex: 1, height: 4, borderRadius: 2,
    backgroundColor: '#E2E8F0',
  },
  progressBarActive: { backgroundColor: '#2563EB' },
  stepText: { fontSize: 12, color: '#94A3B8' },

  // Content
  content: { padding: 24, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '900', color: '#0F172A', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#64748B', marginBottom: 24, lineHeight: 22 },

  // Interest Grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  interestCard: {
    width: '47%', borderRadius: 16, padding: 16,
    borderWidth: 2, borderColor: '#E2E8F0',
    shadowColor: '#000', shadowOpacity: 0.05,
    shadowRadius: 6, elevation: 2,
    position: 'relative',
  },
  interestCardActive: { borderColor: 'transparent' },
  interestEmoji: { fontSize: 32, marginBottom: 8 },
  interestLabel: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  interestLabelActive: { color: '#fff' },
  interestDesc: { fontSize: 12, color: '#64748B' },
  interestDescActive: { color: 'rgba(255,255,255,0.8)' },
  checkBadge: {
    position: 'absolute', top: 10, right: 10,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center', alignItems: 'center',
  },
  checkText: { color: '#fff', fontSize: 12, fontWeight: '900' },

  // Travel Style Grid
  styleGrid: { gap: 12, marginBottom: 24 },
  styleCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 16,
    padding: 16, borderWidth: 2, borderColor: '#E2E8F0',
    gap: 14, position: 'relative',
    shadowColor: '#000', shadowOpacity: 0.05,
    shadowRadius: 6, elevation: 2,
  },
  styleCardActive: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  styleEmoji: { fontSize: 32 },
  styleInfo: { flex: 1 },
  styleLabel: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  styleLabelActive: { color: '#1D4ED8' },
  styleDesc: { fontSize: 13, color: '#64748B', marginTop: 2 },
  styleDescActive: { color: '#3B82F6' },
  styleCheck: {
    position: 'absolute', right: 16,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#2563EB',
    justifyContent: 'center', alignItems: 'center',
  },

  // Buttons
  nextBtn: {
    backgroundColor: '#2563EB', borderRadius: 16,
    paddingVertical: 16, alignItems: 'center',
    shadowColor: '#2563EB', shadowOpacity: 0.4,
    shadowRadius: 10, elevation: 5,
  },
  nextBtnDisabled: { backgroundColor: '#93C5FD', shadowOpacity: 0 },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  btnRow: { flexDirection: 'row', gap: 12 },
  backBtn: {
    backgroundColor: '#F1F5F9', borderRadius: 16,
    paddingVertical: 16, paddingHorizontal: 20,
    alignItems: 'center',
  },
  backBtnText: { color: '#64748B', fontSize: 15, fontWeight: '600' },
  saveBtn: {
    flex: 1, backgroundColor: '#2563EB',
    borderRadius: 16, paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#2563EB', shadowOpacity: 0.4,
    shadowRadius: 10, elevation: 5,
  },
  saveBtnDisabled: { backgroundColor: '#93C5FD', shadowOpacity: 0 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
})

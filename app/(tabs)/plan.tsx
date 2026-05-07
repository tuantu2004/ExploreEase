import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, ActivityIndicator, Alert,
  Modal, KeyboardAvoidingView, Platform,
} from 'react-native'
import { router } from 'expo-router'
import { useState, useEffect, useCallback } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { getSuggestions, getDayItinerary } from '../../services/gemini'
import { useAuthStore } from '../../stores/useAuthStore'
import { supabase } from '../../services/supabase'
import {
  TravelPlan, getPlans, savePlan, deletePlan, createPlan, sharePlan,
} from '../../services/planService'

const MOODS = [
  { id: 'relax', label: 'Thư giãn', icon: '😌' },
  { id: 'explore', label: 'Khám phá', icon: '🗺️' },
  { id: 'food', label: 'Ẩm thực', icon: '🍜' },
  { id: 'culture', label: 'Văn hóa', icon: '🏛️' },
  { id: 'adventure', label: 'Phiêu lưu', icon: '🧗' },
  { id: 'shopping', label: 'Mua sắm', icon: '🛍️' },
]

const DURATIONS = ['2 giờ', '4 giờ', 'Nửa ngày', 'Cả ngày']
const BUDGETS = ['Tiết kiệm', 'Vừa phải', 'Thoải mái', 'Cao cấp']

interface ItineraryItem {
  time: string
  place: string
  activity: string
  duration: string
  cost: string
}

export default function PlanScreen() {
  const user = useAuthStore((s) => s.user)
  const [activeMood, setActiveMood] = useState('')
  const [activeDuration, setActiveDuration] = useState('')
  const [activeBudget, setActiveBudget] = useState('')
  const [location, setLocation] = useState('TP. Hồ Chí Minh')
  const [loading, setLoading] = useState(false)
  const [itinerary, setItinerary] = useState<ItineraryItem[]>([])
  const [myTrips, setMyTrips] = useState<any[]>([])
  const [savedPlans, setSavedPlans] = useState<TravelPlan[]>([])

  // Create plan modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newPlanTitle, setNewPlanTitle] = useState('')
  const [newPlanDays, setNewPlanDays] = useState('3')
  const [newPlanStart, setNewPlanStart] = useState(
    new Date().toISOString().split('T')[0]
  )

  // Reload saved plans when tab is focused
  useFocusEffect(
    useCallback(() => {
      loadSavedPlans()
    }, [])
  )

  useEffect(() => {
    if (!user) return
    const loadTrips = async () => {
      const { data } = await supabase
        .from('event_attendees')
        .select(`event_id, events (id, title, category, start_date, location, price)`)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)
      if (data) {
        setMyTrips(data.map((r: any) => r.events).filter(Boolean))
      }
    }
    loadTrips()
  }, [user])

  const loadSavedPlans = async () => {
    const plans = await getPlans()
    setSavedPlans(plans)
  }

  const handleGenerate = async () => {
    if (!activeMood || !activeDuration) {
      Alert.alert('Thiếu thông tin', 'Vui lòng chọn tâm trạng và thời gian')
      return
    }
    setLoading(true)
    try {
      const result = await getDayItinerary({
        location,
        duration: activeDuration,
        mood: MOODS.find(m => m.id === activeMood)?.label ?? activeMood,
        budget: activeBudget || 'Vừa phải',
      })
      setItinerary(result.itinerary ?? [])
    } catch {
      Alert.alert('Lỗi', 'Không thể kết nối AI. Thử lại sau!')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveItinerary = async () => {
    if (itinerary.length === 0) return
    const title = `${location} – ${activeDuration}`
    const plan = createPlan(title, 1, new Date())
    plan.days[0].items = itinerary.map((item, i) => ({
      id: `ai-${i}`,
      type: 'place' as const,
      title: item.place,
      note: item.activity,
      time: item.time,
      duration: item.duration,
      cost: item.cost,
    }))
    await savePlan(plan)
    setSavedPlans(await getPlans())
    Alert.alert('Đã lưu ✅', 'Lịch trình đã được lưu vào kế hoạch của bạn!')
  }

  const handleShareItinerary = async () => {
    if (itinerary.length === 0) return
    const lines = [`📋 Lịch trình: ${location} (${activeDuration})`, '']
    itinerary.forEach(item => {
      lines.push(`[${item.time}] 📍 ${item.place}`)
      lines.push(`  ${item.activity}`)
      lines.push(`  ⏱️ ${item.duration} · 💰 ${item.cost}`)
      lines.push('')
    })
    lines.push('Tạo bởi ExploreEase 🗺️')
    const { Share } = require('react-native')
    try { await Share.share({ message: lines.join('\n') }) } catch { /* cancelled */ }
  }

  const handleCreatePlan = async () => {
    const title = newPlanTitle.trim()
    if (!title) { Alert.alert('Lỗi', 'Vui lòng nhập tên kế hoạch'); return }
    const days = parseInt(newPlanDays) || 1
    const startDate = new Date(newPlanStart + 'T00:00:00')
    const plan = createPlan(title, days, startDate)
    await savePlan(plan)
    setSavedPlans(await getPlans())
    setShowCreateModal(false)
    setNewPlanTitle('')
    setNewPlanDays('3')
    router.push(`/plan/${plan.id}`)
  }

  const handleDeletePlan = (planId: string, planTitle: string) => {
    Alert.alert(
      'Xóa kế hoạch',
      `Xóa "${planTitle}"?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa', style: 'destructive',
          onPress: async () => {
            await deletePlan(planId)
            setSavedPlans(await getPlans())
          },
        },
      ]
    )
  }

  return (
    <ScrollView style={s.screen} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerTop}>
          <View>
            <Text style={s.greeting}>Lập kế hoạch</Text>
            <Text style={s.title}>Du lịch thông minh 🗺️</Text>
          </View>
          <TouchableOpacity style={s.addBtn} onPress={() => setShowCreateModal(true)}>
            <Text style={s.addBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Saved Plans */}
      {savedPlans.length > 0 && (
        <View style={s.plansSection}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>📋 Kế hoạch của tôi</Text>
            <TouchableOpacity onPress={() => setShowCreateModal(true)}>
              <Text style={s.sectionAction}>+ Tạo mới</Text>
            </TouchableOpacity>
          </View>
          {savedPlans.map((plan, i) => {
            const colors = [
              { bg: '#EFF6FF', accent: '#2563EB' },
              { bg: '#FFF7ED', accent: '#F97316' },
              { bg: '#F0FDF4', accent: '#16A34A' },
              { bg: '#FDF4FF', accent: '#9333EA' },
            ]
            const c = colors[i % colors.length]
            const totalItems = plan.days.reduce((sum, d) => sum + d.items.length, 0)
            const startDate = plan.days[0]?.date
              ? new Date(plan.days[0].date + 'T00:00:00').toLocaleDateString('vi-VN', {
                  day: '2-digit', month: '2-digit',
                })
              : ''
            const endDate = plan.days[plan.days.length - 1]?.date
              ? new Date(plan.days[plan.days.length - 1].date + 'T00:00:00').toLocaleDateString('vi-VN', {
                  day: '2-digit', month: '2-digit',
                })
              : ''
            return (
              <TouchableOpacity
                key={plan.id}
                style={[s.planCard, { backgroundColor: c.bg }]}
                onPress={() => router.push(`/plan/${plan.id}`)}
                onLongPress={() => handleDeletePlan(plan.id, plan.title)}
              >
                <View style={s.planCardLeft}>
                  <View style={[s.planCardIcon, { backgroundColor: c.accent }]}>
                    <Text style={s.planCardIconText}>🗺️</Text>
                  </View>
                  <View style={s.planCardInfo}>
                    <Text style={[s.planCardTitle, { color: c.accent }]} numberOfLines={1}>
                      {plan.title}
                    </Text>
                    <Text style={s.planCardMeta}>
                      {plan.days.length} ngày · {totalItems} địa điểm
                    </Text>
                    {startDate ? (
                      <Text style={s.planCardDates}>
                        {startDate}{plan.days.length > 1 ? ` – ${endDate}` : ''}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <View style={s.planCardActions}>
                  <TouchableOpacity
                    style={s.planShareBtn}
                    onPress={async () => { try { await sharePlan(plan) } catch {} }}
                  >
                    <Text style={[s.planShareBtnText, { color: c.accent }]}>↗</Text>
                  </TouchableOpacity>
                  <Text style={[s.planCardArrow, { color: c.accent }]}>›</Text>
                </View>
              </TouchableOpacity>
            )
          })}
        </View>
      )}

      {savedPlans.length === 0 && (
        <TouchableOpacity style={s.emptyPlansCard} onPress={() => setShowCreateModal(true)}>
          <Text style={s.emptyPlansIcon}>📋</Text>
          <Text style={s.emptyPlansTitle}>Chưa có kế hoạch nào</Text>
          <Text style={s.emptyPlansDesc}>Nhấn + để tạo kế hoạch du lịch đầu tiên</Text>
          <View style={s.emptyPlansBtn}>
            <Text style={s.emptyPlansBtnText}>+ Tạo kế hoạch</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* AI Planner */}
      <View style={s.aiSection}>
        <View style={s.aiHeader}>
          <View style={s.aiBadge}>
            <Text style={s.aiBadgeText}>✨ AI</Text>
          </View>
          <Text style={s.aiTitle}>Tạo lịch trình tự động</Text>
        </View>

        <View style={s.locationField}>
          <Text style={s.fieldLabel}>📍 Điểm đến</Text>
          <TextInput
            style={s.locationInput}
            value={location}
            onChangeText={setLocation}
            placeholder="Nhập địa điểm..."
            placeholderTextColor="#94A3B8"
          />
        </View>

        <Text style={s.fieldLabel}>😊 Tâm trạng hôm nay</Text>
        <View style={s.moodGrid}>
          {MOODS.map((mood) => (
            <TouchableOpacity
              key={mood.id}
              style={[s.moodChip, activeMood === mood.id && s.moodChipActive]}
              onPress={() => setActiveMood(mood.id)}
            >
              <Text style={s.moodEmoji}>{mood.icon}</Text>
              <Text style={[s.moodLabel, activeMood === mood.id && s.moodLabelActive]}>
                {mood.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.fieldLabel}>⏰ Thời gian rảnh</Text>
        <View style={s.chipRow}>
          {DURATIONS.map((d) => (
            <TouchableOpacity
              key={d}
              style={[s.chip, activeDuration === d && s.chipActive]}
              onPress={() => setActiveDuration(d)}
            >
              <Text style={[s.chipText, activeDuration === d && s.chipTextActive]}>{d}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.fieldLabel}>💰 Ngân sách</Text>
        <View style={s.chipRow}>
          {BUDGETS.map((b) => (
            <TouchableOpacity
              key={b}
              style={[s.chip, activeBudget === b && s.chipActive]}
              onPress={() => setActiveBudget(b)}
            >
              <Text style={[s.chipText, activeBudget === b && s.chipTextActive]}>{b}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[s.generateBtn, loading && s.generateBtnDisabled]}
          onPress={handleGenerate}
          disabled={loading}
        >
          {loading ? (
            <View style={s.generateLoading}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={s.generateBtnText}>AI đang lên kế hoạch...</Text>
            </View>
          ) : (
            <Text style={s.generateBtnText}>⚡ Tạo lịch trình ngay</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* AI Result */}
      {itinerary.length > 0 && (
        <View style={s.itinerarySection}>
          <View style={s.itineraryHeader}>
            <Text style={s.itineraryTitle}>📋 Lịch trình gợi ý</Text>
            <TouchableOpacity style={s.saveBtn} onPress={handleSaveItinerary}>
              <Text style={s.saveBtnText}>💾 Lưu</Text>
            </TouchableOpacity>
          </View>

          {itinerary.map((item, i) => (
            <View key={i} style={s.timelineItem}>
              <View style={s.timelineLeft}>
                <Text style={s.timelineTime}>{item.time}</Text>
                {i < itinerary.length - 1 && <View style={s.timelineLine} />}
              </View>
              <View style={s.timelineContent}>
                <Text style={s.timelinePlace}>{item.place}</Text>
                <Text style={s.timelineActivity}>{item.activity}</Text>
                <View style={s.timelineMeta}>
                  <View style={s.timelineMetaItem}>
                    <Text style={s.timelineMetaIcon}>⏱️</Text>
                    <Text style={s.timelineMetaText}>{item.duration}</Text>
                  </View>
                  <View style={s.timelineMetaItem}>
                    <Text style={s.timelineMetaIcon}>💰</Text>
                    <Text style={s.timelineMetaText}>{item.cost}</Text>
                  </View>
                </View>
              </View>
            </View>
          ))}

          <TouchableOpacity style={s.shareBtn} onPress={handleShareItinerary}>
            <Text style={s.shareBtnText}>↗ Chia sẻ lịch trình</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* My Event Registrations */}
      <View style={s.tripsSection}>
        <View style={s.tripsSectionHeader}>
          <Text style={s.tripsSectionTitle}>✈️ Sự kiện đã đăng ký</Text>
        </View>

        {myTrips.length === 0 ? (
          <View style={s.emptyTrips}>
            <Text style={s.emptyTripsIcon}>✈️</Text>
            <Text style={s.emptyTripsText}>
              Chưa có sự kiện nào. Đăng ký tham gia để lưu lại!
            </Text>
          </View>
        ) : (
          myTrips.map((trip, idx) => {
            const colors = [
              { color: '#EFF6FF', accent: '#2563EB', icon: '🎪' },
              { color: '#FFF7ED', accent: '#F97316', icon: '🎵' },
              { color: '#F0FDF4', accent: '#16A34A', icon: '🎨' },
            ]
            const c = colors[idx % colors.length]
            return (
              <TouchableOpacity
                key={trip.id}
                style={[s.tripCard, { backgroundColor: c.color }]}
                onPress={() => router.push(`/event/${trip.id}`)}
              >
                <View style={s.tripCardLeft}>
                  <Text style={s.tripCardIcon}>{c.icon}</Text>
                  <View>
                    <Text style={[s.tripCardTitle, { color: c.accent }]}>
                      {trip.title}
                    </Text>
                    <Text style={s.tripCardMeta}>
                      {trip.category} · {trip.location}
                    </Text>
                    <Text style={[s.tripCardDates, { color: c.accent }]}>
                      {new Date(trip.start_date).toLocaleDateString('vi-VN', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        timeZone: 'Asia/Ho_Chi_Minh',
                      })}
                    </Text>
                  </View>
                </View>
                <Text style={[s.tripCardArrow, { color: c.accent }]}>›</Text>
              </TouchableOpacity>
            )
          })
        )}
      </View>

      {/* Travel Tips */}
      <View style={s.tipsSection}>
        <Text style={s.tipsSectionTitle}>💡 Mẹo du lịch</Text>
        <View style={s.tipsCard}>
          {[
            'Đặt khách sạn sớm để có giá tốt',
            'Kiểm tra thời tiết trước khi đi',
            'Lưu offline bản đồ địa điểm',
            'Mang theo tiền mặt cho chợ địa phương',
          ].map((tip, i) => (
            <View key={i} style={[s.tipItem, i < 3 && s.tipBorder]}>
              <Text style={s.tipIcon}>✓</Text>
              <Text style={s.tipText}>{tip}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ height: 32 }} />

      {/* Create Plan Modal */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={s.modalOverlay}
        >
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>Tạo kế hoạch mới</Text>

            <Text style={s.modalLabel}>Tên kế hoạch</Text>
            <TextInput
              style={s.modalInput}
              placeholder="VD: Sài Gòn cuối tuần"
              placeholderTextColor="#94A3B8"
              value={newPlanTitle}
              onChangeText={setNewPlanTitle}
              autoFocus
            />

            <Text style={s.modalLabel}>Số ngày</Text>
            <View style={s.daysRow}>
              {['1', '2', '3', '4', '5', '7'].map(d => (
                <TouchableOpacity
                  key={d}
                  style={[s.dayChip, newPlanDays === d && s.dayChipActive]}
                  onPress={() => setNewPlanDays(d)}
                >
                  <Text style={[s.dayChipText, newPlanDays === d && s.dayChipTextActive]}>
                    {d}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.modalLabel}>Ngày bắt đầu</Text>
            <TextInput
              style={s.modalInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#94A3B8"
              value={newPlanStart}
              onChangeText={setNewPlanStart}
            />

            <View style={s.modalBtns}>
              <TouchableOpacity
                style={s.modalCancelBtn}
                onPress={() => { setShowCreateModal(false); setNewPlanTitle('') }}
              >
                <Text style={s.modalCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalSaveBtn} onPress={handleCreatePlan}>
                <Text style={s.modalSaveText}>Tạo kế hoạch</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },

  header: {
    backgroundColor: '#fff', paddingTop: 52,
    paddingHorizontal: 16, paddingBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.06,
    shadowRadius: 8, elevation: 4,
  },
  headerTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  greeting: { fontSize: 13, color: '#94A3B8' },
  title: { fontSize: 24, fontWeight: '900', color: '#0F172A' },
  addBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#2563EB',
    justifyContent: 'center', alignItems: 'center',
  },
  addBtnText: { color: '#fff', fontSize: 24, fontWeight: '300', lineHeight: 28 },

  // Saved Plans Section
  plansSection: { paddingHorizontal: 16, marginTop: 16, marginBottom: 4 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  sectionAction: { fontSize: 13, color: '#2563EB', fontWeight: '700' },
  planCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 16, padding: 14, marginBottom: 10,
  },
  planCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  planCardIcon: {
    width: 44, height: 44, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  planCardIconText: { fontSize: 20 },
  planCardInfo: { flex: 1 },
  planCardTitle: { fontSize: 15, fontWeight: '800' },
  planCardMeta: { fontSize: 12, color: '#64748B', marginTop: 2 },
  planCardDates: { fontSize: 12, fontWeight: '600', color: '#94A3B8', marginTop: 1 },
  planCardActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  planShareBtn: {
    width: 28, height: 28, justifyContent: 'center', alignItems: 'center',
  },
  planShareBtnText: { fontSize: 16, fontWeight: '700' },
  planCardArrow: { fontSize: 24 },

  emptyPlansCard: {
    margin: 16, backgroundColor: '#fff', borderRadius: 20, padding: 28,
    alignItems: 'center', gap: 8,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    borderWidth: 2, borderColor: '#EFF6FF', borderStyle: 'dashed',
  },
  emptyPlansIcon: { fontSize: 40 },
  emptyPlansTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  emptyPlansDesc: { fontSize: 13, color: '#64748B', textAlign: 'center' },
  emptyPlansBtn: {
    marginTop: 8, backgroundColor: '#2563EB',
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12,
  },
  emptyPlansBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // AI Section
  aiSection: {
    margin: 16, backgroundColor: '#fff',
    borderRadius: 20, padding: 20,
    shadowColor: '#000', shadowOpacity: 0.08,
    shadowRadius: 12, elevation: 4,
  },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  aiBadge: {
    backgroundColor: '#2563EB', paddingHorizontal: 10,
    paddingVertical: 4, borderRadius: 8,
  },
  aiBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  aiTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },

  locationField: { marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 10 },
  locationInput: {
    backgroundColor: '#F8FAFC', borderRadius: 12,
    borderWidth: 1.5, borderColor: '#E2E8F0',
    padding: 12, fontSize: 14, color: '#0F172A',
  },

  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  moodChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 20, backgroundColor: '#F8FAFC',
    borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  moodChipActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  moodEmoji: { fontSize: 16 },
  moodLabel: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  moodLabelActive: { color: '#2563EB' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, backgroundColor: '#F8FAFC',
    borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  chipActive: { backgroundColor: '#F97316', borderColor: '#F97316' },
  chipText: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  chipTextActive: { color: '#fff' },

  generateBtn: {
    backgroundColor: '#2563EB', borderRadius: 16,
    paddingVertical: 16, alignItems: 'center',
    shadowColor: '#2563EB', shadowOpacity: 0.4,
    shadowRadius: 10, elevation: 5,
  },
  generateBtnDisabled: { backgroundColor: '#93C5FD', shadowOpacity: 0 },
  generateLoading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  generateBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  itinerarySection: {
    marginHorizontal: 16, marginBottom: 20,
    backgroundColor: '#fff', borderRadius: 20, padding: 20,
    shadowColor: '#000', shadowOpacity: 0.08,
    shadowRadius: 12, elevation: 4,
  },
  itineraryHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  itineraryTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  saveBtn: {
    backgroundColor: '#EFF6FF', paddingHorizontal: 12,
    paddingVertical: 6, borderRadius: 8,
  },
  saveBtnText: { color: '#2563EB', fontSize: 13, fontWeight: '700' },

  timelineItem: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  timelineLeft: { alignItems: 'center', width: 52 },
  timelineTime: {
    fontSize: 12, fontWeight: '700', color: '#2563EB',
    backgroundColor: '#EFF6FF', paddingHorizontal: 6,
    paddingVertical: 3, borderRadius: 6, textAlign: 'center',
  },
  timelineLine: {
    width: 2, flex: 1, backgroundColor: '#E2E8F0',
    marginTop: 4, marginBottom: 4, minHeight: 20,
  },
  timelineContent: {
    flex: 1, backgroundColor: '#F8FAFC',
    borderRadius: 12, padding: 12, marginBottom: 8,
  },
  timelinePlace: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 2 },
  timelineActivity: { fontSize: 13, color: '#64748B', marginBottom: 8 },
  timelineMeta: { flexDirection: 'row', gap: 16 },
  timelineMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timelineMetaIcon: { fontSize: 12 },
  timelineMetaText: { fontSize: 11, color: '#94A3B8' },

  shareBtn: {
    backgroundColor: '#F8FAFC', borderRadius: 12,
    paddingVertical: 12, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#E2E8F0', marginTop: 4,
  },
  shareBtnText: { color: '#2563EB', fontSize: 14, fontWeight: '700' },

  tripsSection: { paddingHorizontal: 16, marginBottom: 20 },
  tripsSectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  tripsSectionTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  tripCard: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16, padding: 16, marginBottom: 10,
  },
  tripCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tripCardIcon: { fontSize: 32 },
  tripCardTitle: { fontSize: 15, fontWeight: '800' },
  tripCardMeta: { fontSize: 12, color: '#64748B', marginTop: 2 },
  tripCardDates: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  tripCardArrow: { fontSize: 24 },
  emptyTrips: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyTripsIcon: { fontSize: 40 },
  emptyTripsText: { fontSize: 14, color: '#64748B', textAlign: 'center' },

  tipsSection: { paddingHorizontal: 16, marginBottom: 16 },
  tipsSectionTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 12 },
  tipsCard: {
    backgroundColor: '#fff', borderRadius: 16,
    shadowColor: '#000', shadowOpacity: 0.05,
    shadowRadius: 8, elevation: 2,
  },
  tipItem: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, gap: 12,
  },
  tipBorder: { borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  tipIcon: { color: '#16A34A', fontSize: 16, fontWeight: '800' },
  tipText: { fontSize: 14, color: '#374151', flex: 1 },

  // Create Plan Modal
  modalOverlay: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingTop: 16,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#E2E8F0', alignSelf: 'center', marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A', marginBottom: 16 },
  modalLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 },
  modalInput: {
    backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1.5,
    borderColor: '#E2E8F0', padding: 12, fontSize: 14, color: '#0F172A',
    marginBottom: 16,
  },
  daysRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  dayChip: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: '#F1F5F9',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  dayChipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  dayChipText: { fontSize: 15, fontWeight: '700', color: '#64748B' },
  dayChipTextActive: { color: '#fff' },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
  modalCancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    backgroundColor: '#F1F5F9', alignItems: 'center',
  },
  modalCancelText: { fontSize: 15, color: '#64748B', fontWeight: '600' },
  modalSaveBtn: {
    flex: 2, paddingVertical: 14, borderRadius: 14,
    backgroundColor: '#2563EB', alignItems: 'center',
  },
  modalSaveText: { fontSize: 15, color: '#fff', fontWeight: '800' },
})

import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, Modal, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, FlatList,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useState, useEffect, useCallback } from 'react'
import {
  TravelPlan, PlanItem, getPlanById, savePlan, optimizeRoute, sharePlan,
} from '../../services/planService'
import { supabase } from '../../services/supabase'

export default function PlanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [plan, setPlan] = useState<TravelPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeDay, setActiveDay] = useState(0)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [timeText, setTimeText] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [optimizing, setOptimizing] = useState(false)

  useEffect(() => {
    loadPlan()
  }, [id])

  const loadPlan = async () => {
    if (!id) return
    const p = await getPlanById(id)
    setPlan(p)
    setLoading(false)
  }

  const persist = useCallback(async (updated: TravelPlan) => {
    setPlan(updated)
    await savePlan(updated)
  }, [])

  // Search places and events
  useEffect(() => {
    if (searchQuery.trim().length < 2) { setSearchResults([]); setSearchLoading(false); return }
    setSearchLoading(true)
    const timer = setTimeout(async () => {
      try {
        const [{ data: places }, { data: events }] = await Promise.all([
          supabase
            .from('places')
            .select('id, name, address, lat, lng, category')
            .ilike('name', `%${searchQuery}%`)
            .limit(5),
          supabase
            .from('events')
            .select('id, title, location, lat, lng, category, start_date')
            .ilike('title', `%${searchQuery}%`)
            .eq('is_approved', true)
            .limit(5),
        ])
        const combined = [
          ...(places ?? []).map(p => ({ ...p, _type: 'place', _label: p.name, _sub: p.address })),
          ...(events ?? []).map(e => ({
            ...e, _type: 'event', _label: e.title,
            _sub: `${e.location} · ${new Date(e.start_date).toLocaleDateString('vi-VN')}`,
          })),
        ]
        setSearchResults(combined)
      } catch {
        setSearchResults([])
      } finally {
        setSearchLoading(false)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const addItemToDay = async (result: any) => {
    if (!plan) return
    const item: PlanItem = {
      id: Date.now().toString(),
      type: result._type,
      title: result._label,
      address: result._sub,
      lat: result.lat,
      lng: result.lng,
    }
    const updated: TravelPlan = {
      ...plan,
      days: plan.days.map((day, i) =>
        i === activeDay ? { ...day, items: [...day.items, item] } : day
      ),
    }
    await persist(updated)
    setShowAddModal(false)
    setSearchQuery('')
    setSearchResults([])
  }

  const addNoteToDay = async () => {
    if (!plan || !noteText.trim()) return
    const item: PlanItem = {
      id: Date.now().toString(),
      type: 'note',
      title: noteText.trim(),
    }
    const updated: TravelPlan = {
      ...plan,
      days: plan.days.map((day, i) =>
        i === activeDay ? { ...day, items: [...day.items, item] } : day
      ),
    }
    await persist(updated)
    setNoteText('')
    setShowNoteModal(false)
  }

  const updateItemTime = async (itemId: string, time: string, note: string) => {
    if (!plan) return
    const updated: TravelPlan = {
      ...plan,
      days: plan.days.map((day, i) =>
        i === activeDay
          ? {
              ...day,
              items: day.items.map(item =>
                item.id === itemId ? { ...item, time, note } : item
              ),
            }
          : day
      ),
    }
    await persist(updated)
    setEditingItemId(null)
  }

  const removeItem = async (itemId: string) => {
    if (!plan) return
    const updated: TravelPlan = {
      ...plan,
      days: plan.days.map((day, i) =>
        i === activeDay
          ? { ...day, items: day.items.filter(item => item.id !== itemId) }
          : day
      ),
    }
    await persist(updated)
  }

  const crossAlert = (title: string, msg: string) => {
    if (typeof window !== 'undefined' && typeof (window as any).alert === 'function') {
      ;(window as any).alert(`${title}\n${msg}`)
    } else {
      Alert.alert(title, msg)
    }
  }

  const handleOptimize = async () => {
    if (!plan) return
    const day = plan.days[activeDay]
    if (day.items.length < 2) {
      crossAlert('Gợi ý tuyến đường', 'Cần ít nhất 2 địa điểm để tối ưu tuyến đường.')
      return
    }
    const withCoords = day.items.filter(i => i.lat != null && i.lng != null)
    if (withCoords.length < 2) {
      crossAlert(
        'Không đủ dữ liệu vị trí',
        'Các địa điểm được thêm từ tìm kiếm mới có tọa độ GPS để tối ưu tuyến đường. Hãy thêm địa điểm/sự kiện từ thanh tìm kiếm.'
      )
      return
    }
    setOptimizing(true)
    await new Promise(r => setTimeout(r, 600))
    const optimized = optimizeRoute(day.items)
    const updated: TravelPlan = {
      ...plan,
      days: plan.days.map((d, i) =>
        i === activeDay ? { ...d, items: optimized } : d
      ),
    }
    await persist(updated)
    setOptimizing(false)
    crossAlert('Tối ưu hoàn tất ✅', 'Thứ tự địa điểm đã được sắp xếp theo tuyến đường ngắn nhất!')
  }

  const handleShare = async () => {
    if (!plan) return
    try { await sharePlan(plan) } catch { /* user cancelled */ }
  }

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator color="#2563EB" size="large" />
      </View>
    )
  }

  if (!plan) {
    return (
      <View style={s.centered}>
        <Text style={s.errorText}>Không tìm thấy kế hoạch.</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.backLink}>← Quay lại</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const currentDay = plan.days[activeDay]
  const totalItems = plan.days.reduce((sum, d) => sum + d.items.length, 0)

  return (
    <View style={s.screen}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backBtnText}>←</Text>
        </TouchableOpacity>
        <View style={s.headerMid}>
          <Text style={s.headerTitle} numberOfLines={1}>{plan.title}</Text>
          <Text style={s.headerMeta}>{plan.days.length} ngày · {totalItems} địa điểm</Text>
        </View>
        <TouchableOpacity onPress={handleShare} style={s.shareHeaderBtn}>
          <Text style={s.shareHeaderBtnText}>↗</Text>
        </TouchableOpacity>
      </View>

      {/* Day Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.dayTabBar}
        contentContainerStyle={s.dayTabList}
      >
        {plan.days.map((day, i) => {
          const d = new Date(day.date + 'T00:00:00')
          return (
            <TouchableOpacity
              key={i}
              style={[s.dayTab, activeDay === i && s.dayTabActive]}
              onPress={() => setActiveDay(i)}
            >
              <Text style={[s.dayTabNum, activeDay === i && s.dayTabNumActive]}>
                Ngày {i + 1}
              </Text>
              <Text style={[s.dayTabDate, activeDay === i && s.dayTabDateActive]}>
                {d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
              </Text>
              {day.items.length > 0 && (
                <View style={[s.dayTabBadge, activeDay === i && s.dayTabBadgeActive]}>
                  <Text style={[s.dayTabBadgeText, activeDay === i && s.dayTabBadgeTextActive]}>
                    {day.items.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {/* Optimize + Add buttons */}
      <View style={s.actionBar}>
        <TouchableOpacity
          style={s.optimizeBtn}
          onPress={handleOptimize}
          disabled={optimizing}
        >
          {optimizing
            ? <ActivityIndicator color="#2563EB" size="small" />
            : <Text style={s.optimizeBtnText}>🗺️ Tối ưu tuyến đường</Text>
          }
        </TouchableOpacity>
        <TouchableOpacity style={s.addNoteBtn} onPress={() => setShowNoteModal(true)}>
          <Text style={s.addNoteBtnText}>📝 Ghi chú</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.addItemBtn} onPress={() => setShowAddModal(true)}>
          <Text style={s.addItemBtnText}>+ Thêm</Text>
        </TouchableOpacity>
      </View>

      {/* Day Items */}
      <ScrollView style={s.body} showsVerticalScrollIndicator={false}>
        {currentDay.items.length === 0 ? (
          <View style={s.emptyDay}>
            <Text style={s.emptyDayIcon}>📅</Text>
            <Text style={s.emptyDayTitle}>Chưa có địa điểm</Text>
            <Text style={s.emptyDayDesc}>Nhấn "+ Thêm" để bổ sung địa điểm hoặc sự kiện</Text>
          </View>
        ) : (
          <View style={s.timeline}>
            {currentDay.items.map((item, idx) => (
              <View key={item.id} style={s.timelineRow}>
                <View style={s.timelineLeft}>
                  <View style={[s.timelineDot, item.type === 'note' && s.timelineDotNote]}>
                    <Text style={s.timelineDotIcon}>
                      {item.type === 'place' ? '📍' : item.type === 'event' ? '🎪' : '📝'}
                    </Text>
                  </View>
                  {idx < currentDay.items.length - 1 && <View style={s.timelineConnector} />}
                </View>

                <View style={s.timelineCard}>
                  {editingItemId === item.id ? (
                    <EditItemForm
                      item={item}
                      onSave={(time, note) => updateItemTime(item.id, time, note)}
                      onCancel={() => setEditingItemId(null)}
                    />
                  ) : (
                    <>
                      <View style={s.cardTop}>
                        <View style={s.cardInfo}>
                          {item.time && (
                            <Text style={s.cardTime}>{item.time}</Text>
                          )}
                          <Text style={s.cardTitle}>{item.title}</Text>
                          {item.address && (
                            <Text style={s.cardAddress}>{item.address}</Text>
                          )}
                          {item.note && (
                            <Text style={s.cardNote}>💬 {item.note}</Text>
                          )}
                        </View>
                        <View style={s.cardActions}>
                          <TouchableOpacity
                            style={s.editBtn}
                            onPress={() => setEditingItemId(item.id)}
                          >
                            <Text style={s.editBtnText}>✏️</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={s.removeBtn}
                            onPress={() => removeItem(item.id)}
                          >
                            <Text style={s.removeBtnText}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </>
                  )}
                </View>
              </View>
            ))}
            <View style={{ height: 24 }} />
          </View>
        )}
      </ScrollView>

      {/* Add Place/Event Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={s.modalOverlay}
        >
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>Thêm địa điểm / sự kiện</Text>
            <TextInput
              style={s.searchInput}
              placeholder="Tìm kiếm địa điểm, sự kiện..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {searchLoading && (
              <ActivityIndicator color="#2563EB" style={{ marginTop: 12 }} />
            )}
            {searchResults.length > 0 && (
              <FlatList
                data={searchResults}
                keyExtractor={(item, i) => `${item._type}-${item.id}-${i}`}
                style={s.searchList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={s.searchResultItem}
                    onPress={() => addItemToDay(item)}
                  >
                    <Text style={s.searchResultIcon}>
                      {item._type === 'place' ? '📍' : '🎪'}
                    </Text>
                    <View style={s.searchResultInfo}>
                      <Text style={s.searchResultTitle}>{item._label}</Text>
                      <Text style={s.searchResultSub} numberOfLines={1}>{item._sub}</Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}
            {searchQuery.length >= 2 && !searchLoading && searchResults.length === 0 && (
              <Text style={s.noResults}>Không tìm thấy kết quả</Text>
            )}
            <TouchableOpacity
              style={s.modalCancelBtn}
              onPress={() => { setShowAddModal(false); setSearchQuery(''); setSearchResults([]) }}
            >
              <Text style={s.modalCancelText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add Note Modal */}
      <Modal visible={showNoteModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={s.modalOverlay}
        >
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>Thêm ghi chú</Text>
            <TextInput
              style={[s.searchInput, s.noteInput]}
              placeholder="Nhập ghi chú cho ngày này..."
              placeholderTextColor="#94A3B8"
              value={noteText}
              onChangeText={setNoteText}
              multiline
              numberOfLines={4}
              autoFocus
            />
            <View style={s.modalBtns}>
              <TouchableOpacity
                style={s.modalCancelBtn}
                onPress={() => { setShowNoteModal(false); setNoteText('') }}
              >
                <Text style={s.modalCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalSaveBtn, !noteText.trim() && s.modalSaveBtnDisabled]}
                onPress={addNoteToDay}
                disabled={!noteText.trim()}
              >
                <Text style={s.modalSaveText}>Lưu</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

function EditItemForm({
  item, onSave, onCancel,
}: {
  item: PlanItem
  onSave: (time: string, note: string) => void
  onCancel: () => void
}) {
  const [time, setTime] = useState(item.time ?? '')
  const [note, setNote] = useState(item.note ?? '')
  return (
    <View style={s.editForm}>
      <Text style={s.editFormTitle}>{item.title}</Text>
      <TextInput
        style={s.editInput}
        placeholder="Thời gian (vd: 08:00)"
        placeholderTextColor="#94A3B8"
        value={time}
        onChangeText={setTime}
      />
      <TextInput
        style={[s.editInput, s.editNoteInput]}
        placeholder="Ghi chú..."
        placeholderTextColor="#94A3B8"
        value={note}
        onChangeText={setNote}
        multiline
      />
      <View style={s.editFormActions}>
        <TouchableOpacity style={s.editCancelBtn} onPress={onCancel}>
          <Text style={s.editCancelText}>Hủy</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.editSaveBtn} onPress={() => onSave(time, note)}>
          <Text style={s.editSaveText}>Lưu</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  errorText: { fontSize: 16, color: '#64748B' },
  backLink: { fontSize: 15, color: '#2563EB', fontWeight: '700' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 4,
    gap: 12,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  backBtnText: { fontSize: 22, color: '#2563EB', fontWeight: '700' },
  headerMid: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
  headerMeta: { fontSize: 12, color: '#94A3B8', marginTop: 1 },
  shareHeaderBtn: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: '#EFF6FF',
    justifyContent: 'center', alignItems: 'center',
  },
  shareHeaderBtnText: { fontSize: 16, color: '#2563EB', fontWeight: '700' },

  dayTabBar: { backgroundColor: '#fff', maxHeight: 70 },
  dayTabList: { paddingHorizontal: 16, gap: 8, paddingVertical: 10 },
  dayTab: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 14, backgroundColor: '#F1F5F9',
    alignItems: 'center', minWidth: 72, position: 'relative',
  },
  dayTabActive: { backgroundColor: '#2563EB' },
  dayTabNum: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  dayTabNumActive: { color: '#fff' },
  dayTabDate: { fontSize: 13, fontWeight: '800', color: '#0F172A', marginTop: 1 },
  dayTabDateActive: { color: '#fff' },
  dayTabBadge: {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: '#E2E8F0', borderRadius: 8,
    minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 3,
  },
  dayTabBadgeActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  dayTabBadgeText: { fontSize: 9, color: '#64748B', fontWeight: '700' },
  dayTabBadgeTextActive: { color: '#fff' },

  actionBar: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  optimizeBtn: {
    flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#EFF6FF', borderRadius: 10, paddingVertical: 8,
    borderWidth: 1.5, borderColor: '#BFDBFE',
  },
  optimizeBtnText: { fontSize: 12, color: '#2563EB', fontWeight: '700' },
  addNoteBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: '#FFFBEB', borderRadius: 10,
    borderWidth: 1.5, borderColor: '#FDE68A',
    justifyContent: 'center', alignItems: 'center',
  },
  addNoteBtnText: { fontSize: 12, color: '#D97706', fontWeight: '700' },
  addItemBtn: {
    paddingHorizontal: 18, paddingVertical: 8,
    backgroundColor: '#2563EB', borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  addItemBtnText: { fontSize: 13, color: '#fff', fontWeight: '800' },

  body: { flex: 1 },
  emptyDay: { alignItems: 'center', paddingTop: 64, gap: 10, paddingHorizontal: 32 },
  emptyDayIcon: { fontSize: 52 },
  emptyDayTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  emptyDayDesc: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20 },

  timeline: { padding: 16 },
  timelineRow: { flexDirection: 'row', gap: 12 },
  timelineLeft: { alignItems: 'center', width: 32 },
  timelineDot: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center',
  },
  timelineDotNote: { backgroundColor: '#FFFBEB' },
  timelineDotIcon: { fontSize: 14 },
  timelineConnector: {
    width: 2, flex: 1, backgroundColor: '#E2E8F0', minHeight: 16,
    marginVertical: 2,
  },
  timelineCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 12,
    marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  cardTop: { flexDirection: 'row', gap: 8 },
  cardInfo: { flex: 1 },
  cardTime: { fontSize: 11, color: '#2563EB', fontWeight: '700', marginBottom: 2 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  cardAddress: { fontSize: 12, color: '#64748B', marginTop: 2 },
  cardNote: { fontSize: 12, color: '#F97316', marginTop: 4 },
  cardActions: { flexDirection: 'row', gap: 4 },
  editBtn: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: '#F8FAFC',
    justifyContent: 'center', alignItems: 'center',
  },
  editBtnText: { fontSize: 13 },
  removeBtn: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: '#FEF2F2',
    justifyContent: 'center', alignItems: 'center',
  },
  removeBtnText: { fontSize: 11, color: '#EF4444', fontWeight: '700' },

  editForm: { gap: 8 },
  editFormTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A', marginBottom: 4 },
  editInput: {
    backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1.5,
    borderColor: '#E2E8F0', padding: 10, fontSize: 13, color: '#0F172A',
  },
  editNoteInput: { minHeight: 56, textAlignVertical: 'top' },
  editFormActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  editCancelBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 10,
    backgroundColor: '#F1F5F9', alignItems: 'center',
  },
  editCancelText: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  editSaveBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 10,
    backgroundColor: '#2563EB', alignItems: 'center',
  },
  editSaveText: { fontSize: 13, color: '#fff', fontWeight: '700' },

  modalOverlay: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingTop: 16, maxHeight: '80%',
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#E2E8F0', alignSelf: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A', marginBottom: 16 },
  searchInput: {
    backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1.5,
    borderColor: '#E2E8F0', padding: 12, fontSize: 14, color: '#0F172A',
  },
  noteInput: { minHeight: 80, textAlignVertical: 'top' },
  searchList: { maxHeight: 280, marginTop: 12 },
  searchResultItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  searchResultIcon: { fontSize: 20 },
  searchResultInfo: { flex: 1 },
  searchResultTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  searchResultSub: { fontSize: 12, color: '#64748B', marginTop: 1 },
  noResults: { textAlign: 'center', color: '#94A3B8', marginTop: 20, fontSize: 14 },
  modalCancelBtn: {
    marginTop: 12, paddingVertical: 12, borderRadius: 12,
    backgroundColor: '#F1F5F9', alignItems: 'center', flex: 1,
  },
  modalCancelText: { fontSize: 14, color: '#64748B', fontWeight: '600' },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 12 },
  modalSaveBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    backgroundColor: '#2563EB', alignItems: 'center',
  },
  modalSaveBtnDisabled: { backgroundColor: '#93C5FD' },
  modalSaveText: { fontSize: 14, color: '#fff', fontWeight: '700' },
})

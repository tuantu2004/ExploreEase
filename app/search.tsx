import {
  View, Text, TextInput, ScrollView,
  TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { useState, useEffect, useRef } from 'react'
import { getPlaces, Place } from '../services/placeService'
import { getEvents, Event } from '../services/eventService'
import { useLocation } from '../hooks/useLocation'
import { calculateDistance, formatDistance } from '../utils/distance'
import { useAuthStore } from '../stores/useAuthStore'
import { useVoiceSearch } from '../hooks/useVoiceSearch'
import { getDayItinerary } from '../services/gemini'
import { getPlacesSimilarToLiked } from '../services/personalizationService'

const FILTERS = ['Tất cả', 'Địa điểm', 'Sự kiện']
const CATEGORIES = ['Tất cả', 'Ẩm thực', 'Văn hóa', 'Mua sắm', 'Thiên nhiên', 'Phiêu lưu']
const SORTS = [
  { id: 'relevant', label: '🎯 Liên quan' },
  { id: 'rating',   label: '⭐ Đánh giá cao' },
  { id: 'az',       label: '🔤 A–Z' },
  { id: 'distance', label: '📍 Gần nhất' },
]
const PRICE_FILTERS = ['Tất cả', 'Miễn phí', 'Rẻ', 'Vừa', 'Cao cấp']
const RATING_FILTERS = ['Tất cả', '4.5+', '4.0+', '3.5+']

const MOODS = [
  { id: 'all',       label: 'Tất cả',      category: '' },
  { id: 'relax',     label: '😌 Thư giãn',  category: 'Thiên nhiên' },
  { id: 'adventure', label: '🧗 Phiêu lưu', category: 'Phiêu lưu' },
  { id: 'food',      label: '🍜 Ẩm thực',  category: 'Ẩm thực' },
  { id: 'culture',   label: '🏛️ Văn hóa',  category: 'Văn hóa' },
  { id: 'shopping',  label: '🛍️ Mua sắm',  category: 'Mua sắm' },
]
const DURATIONS = ['Tất cả', '1 giờ', '2 giờ', '4 giờ', 'Cả ngày']
const DISTANCES = ['Tất cả', '1 km', '5 km', '10 km', '20 km']

const QUICK_SEARCHES = [
  '🍜 Phở Sài Gòn', '🏛️ Bảo tàng',
  '🌿 Công viên', '🎵 Concert',
  '🛍️ Chợ đêm', '☕ Cà phê',
]

const CAT_EMOJI: Record<string, string> = {
  'Ẩm thực': '🍜', 'Văn hóa': '🏛️',
  'Mua sắm': '🛍️', 'Thiên nhiên': '🌿', 'Phiêu lưu': '🧗',
}

export default function SearchScreen() {
  const user = useAuthStore(s => s.user)
  const { location } = useLocation()

  const [query, setQuery]                     = useState('')
  const [filter, setFilter]                   = useState('Tất cả')
  const [activeCategory, setActiveCategory]   = useState('Tất cả')
  const [activeSort, setActiveSort]           = useState('relevant')
  const [activePrice, setActivePrice]         = useState('Tất cả')
  const [activeRating, setActiveRating]       = useState('Tất cả')
  const [activeMood, setActiveMood]           = useState('all')
  const [activeDistance, setActiveDistance]   = useState('Tất cả')
  const [activeDuration, setActiveDuration]   = useState('Tất cả')
  const [showAdvanced, setShowAdvanced]       = useState(false)

  const [places, setPlaces]   = useState<Place[]>([])
  const [events, setEvents]   = useState<Event[]>([])
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions]     = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [history, setHistory] = useState<string[]>([])

  // 13.2 AI similar
  const [aiSimilar, setAiSimilar]           = useState<Place[]>([])
  const [aiSimilarNames, setAiSimilarNames] = useState<string[]>([])
  const [aiSimilarLoading, setAiSimilarLoading] = useState(false)

  // 13.3 Itinerary
  const [itinerary, setItinerary]           = useState<any[]>([])
  const [itineraryLoading, setItineraryLoading] = useState(false)
  const [showItinerary, setShowItinerary]   = useState(false)

  const inputRef = useRef<TextInput>(null)

  // 13.1 Voice search
  const { isRecording, isTranscribing, startRecording, stopRecording } = useVoiceSearch(
    (text) => { setQuery(text); setShowSuggestions(false) }
  )

  useEffect(() => {
    inputRef.current?.focus()
    loadHistory()
  }, [])

  // 13.2 Load similar places when query is empty
  useEffect(() => {
    if (query || !user) { setAiSimilar([]); return }
    const load = async () => {
      setAiSimilarLoading(true)
      try {
        const { places: sim, basedOn } = await getPlacesSimilarToLiked(user.id, location)
        setAiSimilar(sim)
        setAiSimilarNames(basedOn)
      } catch { setAiSimilar([]) }
      finally { setAiSimilarLoading(false) }
    }
    load()
  }, [user?.id, query])

  const loadHistory = async () => {
    const { getRecentSearches } = await import('../services/cacheService')
    setHistory(await getRecentSearches())
  }

  // Auto-suggest
  useEffect(() => {
    if (!query.trim() || query.length < 2) { setSuggestions([]); setShowSuggestions(false); return }
    const t = setTimeout(async () => {
      const data = await getPlaces({ search: query, limit: 5 })
      setSuggestions(data.map(p => p.name))
      setShowSuggestions(true)
    }, 200)
    return () => clearTimeout(t)
  }, [query])

  // Auto-search on filter/query change
  useEffect(() => {
    if (!query.trim()) { setPlaces([]); setEvents([]); return }
    const t = setTimeout(() => doSearch(), 400)
    return () => clearTimeout(t)
  }, [query, filter, activeCategory, activeSort, activePrice, activeRating, activeMood, activeDistance])

  const doSearch = async () => {
    if (!query.trim()) return
    setLoading(true)
    setShowSuggestions(false)
    try {
      const [placesRaw, eventsRaw] = await Promise.all([
        filter !== 'Sự kiện' ? getPlaces({ search: query, limit: 50 }) : Promise.resolve([]),
        filter !== 'Địa điểm' ? getEvents({ search: query, limit: 20 }) : Promise.resolve([]),
      ])

      let fp = placesRaw as Place[]

      if (activeCategory !== 'Tất cả') fp = fp.filter(p => p.category === activeCategory)

      // 13.3 Mood → category override
      if (activeMood !== 'all') {
        const moodCat = MOODS.find(m => m.id === activeMood)?.category
        if (moodCat) fp = fp.filter(p => p.category === moodCat)
      }

      if (activePrice !== 'Tất cả') {
        fp = fp.filter(p => {
          if (activePrice === 'Miễn phí') return p.price_range === 'free'
          if (activePrice === 'Rẻ') return p.price_range === 'cheap'
          if (activePrice === 'Vừa') return p.price_range === 'medium'
          if (activePrice === 'Cao cấp') return p.price_range === 'expensive'
          return true
        })
      }

      if (activeRating !== 'Tất cả') {
        fp = fp.filter(p => p.rating >= parseFloat(activeRating.replace('+', '')))
      }

      // 13.3 Distance filter
      if (activeDistance !== 'Tất cả' && location) {
        const maxKm = parseInt(activeDistance.replace(' km', ''))
        fp = fp.filter(p => {
          const d = calculateDistance(location, { latitude: p.lat || 0, longitude: p.lng || 0 })
          return d <= maxKm
        })
      }

      fp.sort((a, b) => {
        if (activeSort === 'rating') return b.rating - a.rating
        if (activeSort === 'az') return a.name.localeCompare(b.name, 'vi')
        if (activeSort === 'distance' && location) {
          return calculateDistance(location, { latitude: a.lat||0, longitude: a.lng||0 })
               - calculateDistance(location, { latitude: b.lat||0, longitude: b.lng||0 })
        }
        const matchA = a.name.toLowerCase().includes(query.toLowerCase()) ? 1 : 0
        const matchB = b.name.toLowerCase().includes(query.toLowerCase()) ? 1 : 0
        return (matchB - matchA) || (b.rating - a.rating)
      })

      setPlaces(fp)
      setEvents(eventsRaw)

      const { saveRecentSearch } = await import('../services/cacheService')
      await saveRecentSearch(query.trim())
      loadHistory()
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // 13.3 Generate itinerary with Groq
  const handleGenerateItinerary = async () => {
    setItineraryLoading(true)
    setShowItinerary(true)
    try {
      const moodLabel = MOODS.find(m => m.id === activeMood)?.label.replace(/[^\w\s]/gu, '').trim() || 'Thoải mái'
      const result = await getDayItinerary({
        location: 'Việt Nam',
        duration: activeDuration !== 'Tất cả' ? activeDuration : '4 giờ',
        mood: moodLabel,
        budget: activePrice !== 'Tất cả' ? activePrice : 'Trung bình',
      })
      setItinerary(result.itinerary ?? [])
    } catch { setItinerary([]) }
    finally { setItineraryLoading(false) }
  }

  const totalResults = places.length + events.length

  const getOpenStatus = (hours?: string) => {
    if (!hours) return null
    const match = hours.match(/(\d+):(\d+)\s*-\s*(\d+):(\d+)/)
    if (!match) return null
    const h = new Date().getHours()
    const isOpen = h >= parseInt(match[1]) && h < parseInt(match[3])
    return { isOpen, label: isOpen ? 'Đang mở' : 'Đã đóng' }
  }

  return (
    <View style={s.screen}>
      {/* ─── Header ─── */}
      <View style={s.header}>
        <View style={s.searchRow}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={s.backBtn}>←</Text>
          </TouchableOpacity>

          <View style={s.searchBox}>
            <Text style={s.searchIcon}>🔍</Text>
            <TextInput
              ref={inputRef}
              style={s.searchInput}
              placeholder={isTranscribing ? 'Đang nhận dạng giọng nói...' : 'Tìm địa điểm, sự kiện...'}
              placeholderTextColor="#94A3B8"
              value={query}
              onChangeText={t => { setQuery(t); setShowItinerary(false) }}
              returnKeyType="search"
              onSubmitEditing={doSearch}
              editable={!isTranscribing}
            />
            {query ? (
              <TouchableOpacity onPress={() => { setQuery(''); setSuggestions([]); setShowSuggestions(false) }}>
                <Text style={s.clearBtn}>✕</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* 13.1 Voice button */}
          <TouchableOpacity
            style={[s.micBtn, isRecording && s.micBtnActive]}
            onPress={isRecording ? stopRecording : startRecording}
            disabled={isTranscribing}
          >
            {isTranscribing
              ? <ActivityIndicator size="small" color="#2563EB" />
              : <Text style={s.micIcon}>{isRecording ? '⏹' : '🎤'}</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.filterToggle, showAdvanced && s.filterToggleActive]}
            onPress={() => setShowAdvanced(!showAdvanced)}
          >
            <Text style={s.filterToggleIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {isRecording && (
          <View style={s.recordingBar}>
            <View style={s.recordingDot} />
            <Text style={s.recordingText}>Đang ghi âm... Nhấn ⏹ để dừng</Text>
          </View>
        )}

        {/* Type filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
          {FILTERS.map(f => (
            <TouchableOpacity key={f} style={[s.filterTab, filter===f && s.filterTabActive]} onPress={() => setFilter(f)}>
              <Text style={[s.filterTabText, filter===f && s.filterTabTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Advanced filters */}
        {showAdvanced && (
          <View style={s.advancedBox}>
            <Text style={s.advLabel}>Danh mục</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
              {CATEGORIES.map(c => (
                <TouchableOpacity key={c} style={[s.advChip, activeCategory===c && s.advChipBlue]} onPress={() => setActiveCategory(c)}>
                  <Text style={[s.advChipText, activeCategory===c && s.advChipTextW]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={s.advLabel}>Sắp xếp</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
              {SORTS.map(so => (
                <TouchableOpacity key={so.id} style={[s.advChip, activeSort===so.id && s.advChipOrange]} onPress={() => setActiveSort(so.id)}>
                  <Text style={[s.advChipText, activeSort===so.id && s.advChipTextW]}>{so.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={s.advLabel}>Giá</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
              {PRICE_FILTERS.map(p => (
                <TouchableOpacity key={p} style={[s.advChip, activePrice===p && s.advChipGreen]} onPress={() => setActivePrice(p)}>
                  <Text style={[s.advChipText, activePrice===p && s.advChipTextW]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={s.advLabel}>Đánh giá tối thiểu</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
              {RATING_FILTERS.map(r => (
                <TouchableOpacity key={r} style={[s.advChip, activeRating===r && s.advChipYellow]} onPress={() => setActiveRating(r)}>
                  <Text style={[s.advChipText, activeRating===r && s.advChipTextW]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* 13.3 Mood */}
            <Text style={s.advLabel}>Tâm trạng</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
              {MOODS.map(m => (
                <TouchableOpacity key={m.id} style={[s.advChip, activeMood===m.id && s.advChipPurple]} onPress={() => setActiveMood(m.id)}>
                  <Text style={[s.advChipText, activeMood===m.id && s.advChipTextW]}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* 13.3 Distance */}
            <Text style={s.advLabel}>Khoảng cách</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
              {DISTANCES.map(d => (
                <TouchableOpacity key={d} style={[s.advChip, activeDistance===d && s.advChipBlue]} onPress={() => setActiveDistance(d)}>
                  <Text style={[s.advChipText, activeDistance===d && s.advChipTextW]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* 13.3 Free time + itinerary */}
            <Text style={s.advLabel}>Thời gian rảnh</Text>
            <View style={s.durationRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.chipRow, { flex: 1 }]}>
                {DURATIONS.map(d => (
                  <TouchableOpacity key={d} style={[s.advChip, activeDuration===d && s.advChipOrange]} onPress={() => setActiveDuration(d)}>
                    <Text style={[s.advChipText, activeDuration===d && s.advChipTextW]}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity
                style={[s.itineraryBtn, itineraryLoading && { opacity: 0.6 }]}
                onPress={handleGenerateItinerary}
                disabled={itineraryLoading}
              >
                {itineraryLoading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={s.itineraryBtnText}>🗺️ Lịch trình</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <View style={s.suggestBox}>
          {suggestions.map(name => (
            <TouchableOpacity key={name} style={s.suggestItem} onPress={() => { setQuery(name); setShowSuggestions(false); inputRef.current?.blur() }}>
              <Text style={s.suggestIcon}>🔍</Text>
              <Text style={s.suggestText}>{name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* 13.3 AI Itinerary result */}
        {showItinerary && (
          <View style={s.itineraryCard}>
            <Text style={s.itineraryTitle}>
              🗺️ Lịch trình {activeDuration !== 'Tất cả' ? activeDuration : '4 giờ'}
              {activeMood !== 'all' ? ` · ${MOODS.find(m=>m.id===activeMood)?.label}` : ''}
            </Text>
            {itineraryLoading ? (
              <View style={{ alignItems: 'center', padding: 16 }}>
                <ActivityIndicator color="#2563EB" />
                <Text style={{ color: '#64748B', marginTop: 8 }}>Groq đang tạo lịch trình...</Text>
              </View>
            ) : itinerary.length === 0 ? (
              <Text style={s.itineraryEmpty}>Không thể tạo lịch trình. Thử lại sau.</Text>
            ) : (
              itinerary.map((item, i) => (
                <View key={i} style={s.itineraryItem}>
                  <View style={s.itineraryTimeBox}>
                    <Text style={s.itineraryTime}>{item.time}</Text>
                  </View>
                  <View style={[s.itineraryLineBox, i < itinerary.length - 1 && s.itineraryLineActive]} />
                  <View style={s.itineraryContent}>
                    <Text style={s.itineraryPlace}>{item.place}</Text>
                    <Text style={s.itineraryActivity}>{item.activity}</Text>
                    <Text style={s.itineraryMeta}>{item.duration} · {item.cost}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {!query ? (
          <View style={s.emptyState}>
            {/* History */}
            {history.length > 0 && (
              <View style={s.section}>
                <View style={s.sectionHeader}>
                  <Text style={s.sectionTitle}>🕐 Gần đây</Text>
                  <TouchableOpacity onPress={() => setHistory([])}>
                    <Text style={s.clearHistory}>Xoá</Text>
                  </TouchableOpacity>
                </View>
                {history.slice(0, 5).map(h => (
                  <TouchableOpacity key={h} style={s.historyItem} onPress={() => setQuery(h)}>
                    <Text style={s.historyIcon}>🕐</Text>
                    <Text style={s.historyText}>{h}</Text>
                    <Text style={s.historyArrow}>↗</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* 13.2 AI Similar section */}
            {user && (aiSimilarLoading || aiSimilar.length > 0) && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>🤖 Dựa trên sở thích của bạn</Text>
                {aiSimilarNames.length > 0 && (
                  <Text style={s.sectionSub}>Tương tự: {aiSimilarNames.join(', ')}</Text>
                )}
                {aiSimilarLoading ? (
                  <ActivityIndicator color="#2563EB" style={{ marginTop: 8 }} />
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 8 }}>
                    {aiSimilar.map(p => (
                      <TouchableOpacity key={p.id} style={s.simCard} onPress={() => router.push(`/place/${p.id}`)}>
                        <Text style={s.simEmoji}>{CAT_EMOJI[p.category] ?? '🗺️'}</Text>
                        <Text style={s.simName} numberOfLines={2}>{p.name}</Text>
                        <Text style={s.simCat}>{p.category}</Text>
                        <Text style={s.simRating}>⭐ {p.rating}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}

            {/* Quick Search */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>🔥 Phổ biến</Text>
              <View style={s.quickGrid}>
                {QUICK_SEARCHES.map(q => (
                  <TouchableOpacity key={q} style={s.quickChip} onPress={() => setQuery(q.split(' ').slice(1).join(' '))}>
                    <Text style={s.quickChipText}>{q}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        ) : loading ? (
          <View style={s.center}>
            <ActivityIndicator color="#2563EB" size="large" />
            <Text style={s.loadingText}>Đang tìm kiếm...</Text>
          </View>
        ) : totalResults === 0 ? (
          <View style={s.center}>
            <Text style={{ fontSize: 48 }}>🔍</Text>
            <Text style={s.noResultTitle}>Không tìm thấy kết quả</Text>
            <Text style={s.noResultDesc}>Thử thay đổi bộ lọc hoặc từ khoá</Text>
          </View>
        ) : (
          <View style={s.results}>
            <Text style={s.resultCount}>{totalResults} kết quả</Text>

            {places.length > 0 && (
              <View>
                {filter === 'Tất cả' && <Text style={s.sectionLabel}>📍 Địa điểm ({places.length})</Text>}
                {places.map(place => {
                  const openStatus = getOpenStatus(place.opening_hours)
                  const dist = location
                    ? formatDistance(calculateDistance(location, { latitude: place.lat||0, longitude: place.lng||0 }))
                    : null
                  return (
                    <TouchableOpacity key={place.id} style={s.resultCard} onPress={() => router.push(`/place/${place.id}`)}>
                      <View style={s.resultIcon}>
                        <Text style={{ fontSize: 24 }}>{CAT_EMOJI[place.category] ?? '🗺️'}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.resultName}>{place.name}</Text>
                        <View style={s.resultMetaRow}>
                          <Text style={s.resultCategory}>{place.category}</Text>
                          {openStatus && (
                            <View style={[s.openBadge, { backgroundColor: openStatus.isOpen ? '#F0FDF4' : '#FEF2F2' }]}>
                              <Text style={[s.openBadgeText, { color: openStatus.isOpen ? '#16A34A' : '#EF4444' }]}>
                                {openStatus.label}
                              </Text>
                            </View>
                          )}
                        </View>
                        <View style={s.resultBottom}>
                          <Text style={s.resultRating}>⭐ {place.rating}</Text>
                          {dist && <Text style={s.resultDist}>📍 {dist}</Text>}
                          {place.price_range && (
                            <Text style={s.resultPrice}>
                              {place.price_range==='free' ? '🎁 Miễn phí' :
                               place.price_range==='cheap' ? '💰 Rẻ' :
                               place.price_range==='medium' ? '💰💰 Vừa' : '💰💰💰 Cao cấp'}
                            </Text>
                          )}
                        </View>
                      </View>
                      <Text style={s.resultArrow}>›</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            )}

            {events.length > 0 && (
              <View>
                {filter === 'Tất cả' && <Text style={s.sectionLabel}>🎪 Sự kiện ({events.length})</Text>}
                {events.map(event => (
                  <TouchableOpacity key={event.id} style={s.resultCard} onPress={() => router.push(`/event/${event.id}`)}>
                    <View style={[s.resultIcon, { backgroundColor: '#FFF7ED' }]}>
                      <Text style={{ fontSize: 24 }}>🎪</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.resultName}>{event.title}</Text>
                      <Text style={s.resultCategory}>{event.category}</Text>
                      <View style={s.resultBottom}>
                        <Text style={s.resultRating}>
                          📅 {new Date(event.start_date).toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit', timeZone:'Asia/Ho_Chi_Minh' })}
                        </Text>
                        <Text style={s.resultPrice}>
                          {event.price === 0 ? '🎁 Miễn phí' : event.price.toLocaleString('vi-VN') + 'đ'}
                        </Text>
                      </View>
                    </View>
                    <Text style={s.resultArrow}>›</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    backgroundColor: '#fff', paddingTop: 52,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 4, zIndex: 100,
  },
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, gap: 8, marginBottom: 10,
  },
  backBtn: { fontSize: 22, color: '#2563EB', fontWeight: '700' },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F1F5F9', borderRadius: 14,
    paddingHorizontal: 12, gap: 8,
    borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: '#0F172A' },
  clearBtn: { color: '#94A3B8', fontSize: 16, padding: 4 },

  // 13.1 Voice
  micBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#EFF6FF', borderWidth: 1.5, borderColor: '#BFDBFE',
    justifyContent: 'center', alignItems: 'center',
  },
  micBtnActive: { backgroundColor: '#EF4444', borderColor: '#EF4444' },
  micIcon: { fontSize: 18 },
  recordingBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', paddingHorizontal: 16, paddingVertical: 6,
  },
  recordingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
  recordingText: { fontSize: 12, color: '#EF4444', fontWeight: '600' },

  filterToggle: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#F1F5F9', borderWidth: 1.5, borderColor: '#E2E8F0',
    justifyContent: 'center', alignItems: 'center',
  },
  filterToggleActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  filterToggleIcon: { fontSize: 16 },

  filterRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 10 },
  filterTab: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F1F5F9' },
  filterTabActive: { backgroundColor: '#2563EB' },
  filterTabText: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  filterTabTextActive: { color: '#fff' },

  advancedBox: { paddingHorizontal: 16, paddingBottom: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 10 },
  advLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '700', marginBottom: 6, textTransform: 'uppercase', marginTop: 8 },
  chipRow: { gap: 6, paddingBottom: 4 },
  advChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  advChipBlue:   { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  advChipOrange: { backgroundColor: '#F97316', borderColor: '#F97316' },
  advChipGreen:  { backgroundColor: '#16A34A', borderColor: '#16A34A' },
  advChipYellow: { backgroundColor: '#F59E0B', borderColor: '#F59E0B' },
  advChipPurple: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  advChipText: { fontSize: 12, color: '#475569', fontWeight: '600' },
  advChipTextW: { color: '#fff' },

  // 13.3 Duration row
  durationRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itineraryBtn: {
    backgroundColor: '#2563EB', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 8,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  itineraryBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // 13.3 Itinerary card
  itineraryCard: {
    margin: 16, backgroundColor: '#fff', borderRadius: 16,
    padding: 16, shadowColor: '#2563EB', shadowOpacity: 0.08,
    shadowRadius: 12, elevation: 4,
    borderLeftWidth: 4, borderLeftColor: '#2563EB',
  },
  itineraryTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 12 },
  itineraryEmpty: { color: '#94A3B8', textAlign: 'center', padding: 16 },
  itineraryItem: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  itineraryTimeBox: {
    width: 52, alignItems: 'center',
    backgroundColor: '#EFF6FF', borderRadius: 8, paddingVertical: 4,
  },
  itineraryTime: { fontSize: 11, fontWeight: '700', color: '#2563EB' },
  itineraryLineBox: { width: 2, backgroundColor: 'transparent', marginTop: 4 },
  itineraryLineActive: { backgroundColor: '#E2E8F0' },
  itineraryContent: { flex: 1 },
  itineraryPlace: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  itineraryActivity: { fontSize: 13, color: '#475569', marginTop: 2 },
  itineraryMeta: { fontSize: 11, color: '#94A3B8', marginTop: 2 },

  // Suggestions
  suggestBox: {
    position: 'absolute', top: 140, left: 16, right: 16,
    backgroundColor: '#fff', borderRadius: 14, zIndex: 999,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, elevation: 8,
    overflow: 'hidden',
  },
  suggestItem: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  suggestIcon: { fontSize: 14 },
  suggestText: { fontSize: 14, color: '#0F172A' },

  // Empty state
  emptyState: { padding: 16 },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  sectionSub: { fontSize: 12, color: '#94A3B8', marginTop: 2, marginBottom: 4 },
  clearHistory: { fontSize: 13, color: '#EF4444', fontWeight: '600' },
  historyItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 12, padding: 12, marginBottom: 8, gap: 10,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  historyIcon: { fontSize: 14 },
  historyText: { flex: 1, fontSize: 14, color: '#374151' },
  historyArrow: { color: '#CBD5E1', fontSize: 14 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickChip: {
    backgroundColor: '#fff', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  quickChipText: { fontSize: 13, color: '#374151', fontWeight: '500' },

  // 13.2 AI Similar
  simCard: {
    width: 130, backgroundColor: '#fff', borderRadius: 14, padding: 12,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    gap: 4,
  },
  simEmoji: { fontSize: 28 },
  simName: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  simCat: { fontSize: 11, color: '#2563EB', fontWeight: '600' },
  simRating: { fontSize: 11, color: '#F59E0B', fontWeight: '600' },

  // Loading / empty
  center: { alignItems: 'center', paddingTop: 60, gap: 8 },
  loadingText: { color: '#64748B', fontSize: 14 },
  noResultTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  noResultDesc: { fontSize: 14, color: '#64748B' },

  // Results
  results: { padding: 16 },
  resultCount: { fontSize: 12, color: '#64748B', marginBottom: 12 },
  sectionLabel: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 10, marginTop: 4 },
  resultCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 14, padding: 12, marginBottom: 8, gap: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  resultIcon: { width: 52, height: 52, borderRadius: 12, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  resultName: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 2 },
  resultMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  resultCategory: { fontSize: 12, color: '#2563EB', fontWeight: '600' },
  openBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  openBadgeText: { fontSize: 10, fontWeight: '700' },
  resultBottom: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  resultRating: { fontSize: 11, color: '#F59E0B', fontWeight: '600' },
  resultDist: { fontSize: 11, color: '#2563EB', fontWeight: '600' },
  resultPrice: { fontSize: 11, color: '#64748B' },
  resultArrow: { fontSize: 20, color: '#CBD5E1' },
})

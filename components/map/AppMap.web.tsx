import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert, TextInput, ActivityIndicator,
} from 'react-native'
import { useState, useEffect, useRef } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { getPlaces, Place } from '../../services/placeService'
import { getEvents, Event } from '../../services/eventService'
import { useLocation } from '../../hooks/useLocation'
import {
  calculateDistance, formatDistance, sortByDistance,
} from '../../utils/distance'
import { Coordinates } from '../../services/locationService'
import { supabase } from '../../services/supabase'
import { useAuthStore } from '../../stores/useAuthStore'

function formatDuration(seconds: number) {
  const m = Math.round(seconds / 60)
  return m < 60 ? `${m} phút` : `${Math.floor(m / 60)}h ${m % 60}p`
}

interface SearchResult {
  place_id: string
  display_name: string
  lat: string
  lon: string
}

export default function AppMapWeb() {
  const user = useAuthStore(s => s.user)
  const params = useLocalSearchParams<{
    lat?: string; lng?: string; name?: string; placeId?: string
  }>()
  const [places, setPlaces] = useState<Place[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [showEvents, setShowEvents] = useState(true)
  const [showPlaces, setShowPlaces] = useState(true)
  const [joinedEvents, setJoinedEvents] = useState<Set<string>>(new Set())
  const [joinLoading, setJoinLoading] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Place | null>(null)
  const [activeCategory, setActiveCategory] = useState('Tất cả')
  const [route, setRoute] = useState<[number, number][]>([])
  const [routeInfo, setRouteInfo] = useState<{ distance: number; duration: number } | null>(null)
  const [loadingRoute, setLoadingRoute] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [eventRoute, setEventRoute] = useState<[number, number][]>([])
  const [eventRouteInfo, setEventRouteInfo] = useState<{ distance: number; duration: number } | null>(null)
  const [loadingEventRoute, setLoadingEventRoute] = useState(false)

  // Search states
  const [searchText, setSearchText] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [mapRef, setMapRef] = useState<any>(null)
  const searchTimer = useRef<any>(null)
  const [searchMarker, setSearchMarker] = useState<{ lat: number; lng: number; name: string } | null>(null)

  const {
    location, loading, permissionGranted,
    requestPermission, startTracking,
  } = useLocation()

  useEffect(() => {
    if (!params.lat || !params.lng || !mapRef) return
    const lat = parseFloat(params.lat)
    const lng = parseFloat(params.lng)
    mapRef.setView([lat, lng], 16)
    if (params.placeId) {
      const target = places.find(p => p.id === params.placeId)
      if (target) setSelected(target)
    }
  }, [params.lat, params.lng, mapRef, places])

  useEffect(() => {
    const loadData = async () => {
      const placesData = await getPlaces({ limit: 50 })
      setPlaces(location
        ? sortByDistance(placesData, { latitude: location.latitude, longitude: location.longitude })
        : placesData
      )
      const eventsData = await getEvents({ limit: 50 })
      setEvents(eventsData.filter(e => e.lat && e.lng))
    }

    loadData()
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [location])

  useEffect(() => {
    if (!user) return
    supabase
      .from('event_attendees')
      .select('event_id')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (data) setJoinedEvents(new Set(data.map((r: any) => r.event_id)))
      })
  }, [user])

  const handleJoinFromMap = async (event: Event) => {
    if (!user) {
      Alert.alert('Cần đăng nhập', 'Vui lòng đăng nhập để tham gia sự kiện')
      return
    }
    const isJoined = joinedEvents.has(event.id)
    setJoinLoading(prev => new Set(prev).add(event.id))
    try {
      if (isJoined) {
        await supabase.from('event_attendees').delete()
          .eq('event_id', event.id).eq('user_id', user.id)
        setJoinedEvents(prev => { const n = new Set(prev); n.delete(event.id); return n })
        setEvents(prev => prev.map(e =>
          e.id === event.id ? { ...e, attendee_count: Math.max(0, e.attendee_count - 1) } : e
        ))
      } else {
        await supabase.from('event_attendees').insert({ event_id: event.id, user_id: user.id })
        setJoinedEvents(prev => new Set(prev).add(event.id))
        setEvents(prev => prev.map(e =>
          e.id === event.id ? { ...e, attendee_count: e.attendee_count + 1 } : e
        ))
        Alert.alert('✅ Đã đăng ký!', event.title)
      }
    } catch (e: any) {
      Alert.alert('Lỗi', e.message)
    } finally {
      setJoinLoading(prev => { const n = new Set(prev); n.delete(event.id); return n })
    }
  }


  const filtered = activeCategory === 'Tất cả'
    ? places
    : places.filter(p => p.category === activeCategory)

  // Tìm kiếm địa điểm với Nominatim
  const handleSearch = async (text: string) => {
    setSearchText(text)
    if (!text.trim()) {
      setSearchResults([])
      setShowResults(false)
      setSearchMarker(null)
      return
    }

    // Debounce 400ms
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?` +
          `q=${encodeURIComponent(text + ' Vietnam')}&` +
          `format=json&limit=5&countrycodes=vn`,
          { headers: { 'User-Agent': 'ExploreEase/1.0' } }
        )
        const data = await res.json()
        setSearchResults(data)
        setShowResults(true)
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 400)
  }

  const handleSelectResult = (result: SearchResult) => {
    const lat = parseFloat(result.lat)
    const lng = parseFloat(result.lon)
    const name = result.display_name.split(',')[0]
    setSearchMarker({ lat, lng, name })
    if (mapRef) {
      mapRef.setView([lat, lng], 16)
    }
    setSearchText(name)
    setShowResults(false)
    setSearchResults([])
  }

  const handleRequestLocation = async () => {
    const granted = await requestPermission()
    if (granted) {
      await startTracking()
      if (mapRef && location) {
        mapRef.setView([location.latitude, location.longitude], 15)
      }
    } else {
      Alert.alert('Quyền bị từ chối', 'Vui lòng cấp quyền vị trí trong cài đặt')
    }
  }

  const distText = (place: Place) => {
    const user = location ?? { latitude: 10.8231, longitude: 106.6297 }
    return formatDistance(calculateDistance(user, { latitude: place.lat || 0, longitude: place.lng || 0 }))
  }

  const fetchOSRMRoute = async (from: Coordinates, to: Coordinates) => {
    setLoadingRoute(true)
    try {
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/` +
        `${from.longitude},${from.latitude};${to.longitude},${to.latitude}` +
        `?overview=full&geometries=geojson`
      )
      const data = await res.json()
      if (data.routes?.[0]) {
        const coords: [number, number][] = data.routes[0].geometry.coordinates.map(
          ([lng, lat]: [number, number]) => [lat, lng] as [number, number]
        )
        setRoute(coords)
        setRouteInfo({ distance: data.routes[0].distance, duration: data.routes[0].duration })
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể tải tuyến đường')
    } finally {
      setLoadingRoute(false)
    }
  }

  const handleDirections = async (place: Place) => {
    if (!location) {
      Alert.alert('Cần vị trí', 'Vui lòng bật GPS để sử dụng chỉ đường')
      return
    }
    await fetchOSRMRoute(
      { latitude: location.latitude, longitude: location.longitude },
      { latitude: place.lat || 0, longitude: place.lng || 0 },
    )
  }

  const clearRoute = () => { setRoute([]); setRouteInfo(null) }

  const handleEventDirections = async (event: Event) => {
    if (!location) {
      Alert.alert('Cần GPS', 'Vui lòng bật vị trí để sử dụng chỉ đường')
      return
    }
    if (!event.lat || !event.lng) {
      Alert.alert('Lỗi', 'Sự kiện chưa có tọa độ')
      return
    }
    setLoadingEventRoute(true)
    clearRoute()
    try {
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/` +
        `${location.longitude},${location.latitude};${event.lng},${event.lat}` +
        `?overview=full&geometries=geojson`
      )
      const data = await res.json()
      if (data.routes?.[0]) {
        const coords: [number, number][] = data.routes[0].geometry.coordinates.map(
          ([lng, lat]: [number, number]) => [lat, lng] as [number, number]
        )
        setEventRoute(coords)
        setEventRouteInfo({ distance: data.routes[0].distance, duration: data.routes[0].duration })
        mapRef?.fitBounds([
          [location.latitude, location.longitude],
          [event.lat, event.lng],
        ], { padding: [50, 50] })
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể tải tuyến đường')
    } finally {
      setLoadingEventRoute(false)
    }
  }

  const clearEventRoute = () => { setEventRoute([]); setEventRouteInfo(null) }

  const {
    MapContainer, TileLayer, Marker, Popup, Circle,
    Polyline: LeafletPolyline, useMap,
  } = require('react-leaflet')
  const L = require('leaflet')

  // Component để control map ref
  function MapController() {
    const map = useMap()
    useEffect(() => { setMapRef(map) }, [map])
    return null
  }

  const makeIcon = (color: string, size = 32) => new L.Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(
      `<svg width="${size}" height="${size}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">` +
      `<circle cx="16" cy="16" r="12" fill="${color}" opacity="0.15"/>` +
      `<circle cx="16" cy="16" r="7" fill="${color}"/>` +
      `<circle cx="16" cy="16" r="3" fill="#fff"/></svg>`
    )}`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  })

  const userCoords: [number, number] = location
    ? [location.latitude, location.longitude]
    : [10.8231, 106.6297]

  return (
    <View style={s.screen}>
      {/* Search Bar */}
      <View style={s.searchContainer}>
        <View style={s.searchBar}>
          {searching
            ? <ActivityIndicator size="small" color="#2563EB" />
            : <Text style={s.searchIcon}>🔍</Text>
          }
          <TextInput
            style={s.searchInput}
            placeholder="Tìm địa điểm, địa chỉ..."
            placeholderTextColor="#94A3B8"
            value={searchText}
            onChangeText={handleSearch}
            onFocus={() => searchResults.length > 0 && setShowResults(true)}
          />
          {searchText ? (
            <TouchableOpacity
              style={s.clearBtn}
              onPress={() => {
                setSearchText('')
                setSearchResults([])
                setShowResults(false)
                setSearchMarker(null)
              }}
            >
              <Text style={s.clearText}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Search Results Dropdown */}
        {showResults && searchResults.length > 0 && (
          <View style={s.resultsBox}>
            {searchResults.map((result) => (
              <TouchableOpacity
                key={result.place_id}
                style={s.resultItem}
                onPress={() => handleSelectResult(result)}
              >
                <Text style={s.resultIcon}>📍</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.resultName} numberOfLines={1}>
                    {result.display_name.split(',')[0]}
                  </Text>
                  <Text style={s.resultAddr} numberOfLines={1}>
                    {result.display_name.split(',').slice(1, 3).join(',')}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Category Chips */}
      <View style={s.chipsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.chipsList}
        >
          {['Tất cả', 'Ẩm thực', 'Văn hóa', 'Mua sắm', 'Thiên nhiên', 'Phiêu lưu'].map(cat => (
            <TouchableOpacity
              key={cat}
              style={[s.chip, activeCategory === cat && s.chipActive]}
              onPress={() => setActiveCategory(cat)}
            >
              <Text style={[s.chipText, activeCategory === cat && s.chipTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Map */}
      <div style={{ flex: 1, height: '100%' }}>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <style>{`
          .leaflet-container { z-index: 0; }
          .leaflet-control-zoom {
            display: none !important;
          }
          .leaflet-popup-content-wrapper {
            border-radius: 12px !important;
            box-shadow: 0 4px 16px rgba(0,0,0,0.12) !important;
            padding: 4px !important;
          }
          .leaflet-popup-tip { display: none !important; }
          .leaflet-attribution-flag { display: none !important; }
          .leaflet-control-attribution {
            font-size: 9px !important;
            opacity: 0.6 !important;
          }
        `}</style>
        <MapContainer
          center={userCoords}
          zoom={13}
          style={{ height: '100vh', width: '100%' }}
          zoomControl={false}
        >
          <MapController />
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="© OpenStreetMap"
          />

          {location && (
            <>
              <Marker position={userCoords} icon={makeIcon('#2563EB', 28)}>
                <Popup>📍 Vị trí của bạn</Popup>
              </Marker>
              <Circle
                center={userCoords}
                radius={location.accuracy ?? 100}
                pathOptions={{ color: '#3B82F6', fillOpacity: 0.08, weight: 1 }}
              />
            </>
          )}

          {route.length > 0 && (
            <LeafletPolyline
              positions={route}
              pathOptions={{ color: '#2563EB', weight: 5, opacity: 0.85, lineJoin: 'round' }}
            />
          )}

          {eventRoute.length > 0 && (
            <LeafletPolyline
              positions={eventRoute}
              pathOptions={{ color: '#F97316', weight: 5, opacity: 0.85, lineJoin: 'round', dashArray: '10, 5' }}
            />
          )}

          {/* Search Result Marker */}
          {searchMarker && (() => {
            const searchIcon = new L.DivIcon({
              html: `
                <div style="position:relative;width:44px;height:50px;display:flex;align-items:center;justify-content:center;">
                  <div style="width:36px;height:36px;background:#2563EB;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 4px 12px rgba(37,99,235,0.45);border:3px solid #fff;"></div>
                  <span style="position:absolute;top:4px;font-size:16px;">🔍</span>
                </div>
              `,
              className: '',
              iconSize: [44, 50],
              iconAnchor: [22, 50],
              popupAnchor: [0, -52],
            })
            return (
              <Marker position={[searchMarker.lat, searchMarker.lng]} icon={searchIcon}>
                <Popup>
                  <div style={{ fontFamily: 'system-ui', padding: '6px 10px', minWidth: 160 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#0F172A', marginBottom: 4 }}>
                      🔍 {searchMarker.name}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>
                      {searchMarker.lat.toFixed(4)}°N, {searchMarker.lng.toFixed(4)}°E
                    </div>
                  </div>
                </Popup>
              </Marker>
            )
          })()}

          {showPlaces && filtered.map(place =>
            place.lat && place.lng ? (
              <Marker
                key={place.id}
                position={[place.lat, place.lng]}
                icon={makeIcon(selected?.id === place.id ? '#7C3AED' : '#EF4444', selected?.id === place.id ? 38 : 28)}
                eventHandlers={{ click: () => { setSelected(place); clearRoute() } }}
              >
                <Popup>
                  <div style={{ fontFamily: 'system-ui', padding: '4px 8px', minWidth: 140 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#0F172A', marginBottom: 3 }}>
                      {place.name}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>
                      ⭐ {place.rating} · {place.category}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ) : null
          )}

          {showEvents && events.map(event => {
            if (!event.lat || !event.lng) return null
            const isJoined = joinedEvents.has(event.id)
            const isLoading = joinLoading.has(event.id)
            const eventIcon = new L.DivIcon({
              html: `<div style="width:36px;height:36px;background:${isJoined ? '#2563EB' : event.price === 0 ? '#16A34A' : '#F97316'};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.25);cursor:pointer;">🎪</div>`,
              className: '',
              iconSize: [36, 36],
              iconAnchor: [18, 18],
              popupAnchor: [0, -20],
            })
            return (
              <Marker
                key={'event-' + event.id}
                position={[event.lat, event.lng]}
                icon={eventIcon}
                eventHandlers={{
                  click: () => {
                    setSelectedEvent(event)
                    setSelected(null)
                    clearRoute()
                  },
                }}
              >
                <Popup>
                  <div style={{ fontFamily: 'system-ui', padding: '8px 10px', minWidth: 200 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: event.price === 0 ? '#16A34A' : '#F97316', textTransform: 'uppercase', marginBottom: 4 }}>
                      🎪 {new Date(event.start_date) > new Date() ? 'Sắp diễn ra' : 'Đang diễn ra'}
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: '#0F172A', marginBottom: 6 }}>
                      {event.title}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748B', marginBottom: 4 }}>
                      📅 {new Date(event.start_date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748B', marginBottom: 8 }}>
                      📍 {event.location}
                    </div>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 8 }}>
                      👥 {event.attendee_count} người tham gia
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => handleJoinFromMap(event)}
                        disabled={isLoading}
                        style={{ flex: 1, padding: '7px 10px', background: isJoined ? '#EFF6FF' : '#2563EB', color: isJoined ? '#2563EB' : '#fff', border: isJoined ? '1.5px solid #2563EB' : 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: isLoading ? 0.6 : 1 }}
                      >
                        {isLoading ? '...' : isJoined ? '✓ Đã tham gia' : '+ Tham gia'}
                      </button>
                      <button
                        onClick={() => router.push(`/event/${event.id}`)}
                        style={{ flex: 1, padding: '7px 10px', background: '#F8FAFC', color: '#374151', border: '1.5px solid #E2E8F0', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                      >
                        Chi tiết →
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            )
          })}
        </MapContainer>
      </div>

      {/* FAB Buttons — right side */}
      <View style={s.fabRight}>
        {/* My Location */}
        <TouchableOpacity
          style={[s.fab, permissionGranted && location && s.fabActive]}
          onPress={handleRequestLocation}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator size="small" color="#2563EB" />
            : <Text style={s.fabIcon}>{permissionGranted && location ? '🎯' : '📡'}</Text>
          }
        </TouchableOpacity>

        {/* Toggle Places */}
        <TouchableOpacity
          style={[s.fab, showPlaces && s.fabActive]}
          onPress={() => setShowPlaces(v => !v)}
        >
          <Text style={s.fabIcon}>📍</Text>
        </TouchableOpacity>

        {/* Toggle Events */}
        <TouchableOpacity
          style={[s.fab, showEvents && s.fabActive]}
          onPress={() => setShowEvents(v => !v)}
        >
          <Text style={s.fabIcon}>🎪</Text>
        </TouchableOpacity>

        {/* Zoom In */}
        <TouchableOpacity
          style={s.fab}
          onPress={() => mapRef?.zoomIn()}
        >
          <Text style={s.fabZoom}>+</Text>
        </TouchableOpacity>

        {/* Zoom Out */}
        <TouchableOpacity
          style={s.fab}
          onPress={() => mapRef?.zoomOut()}
        >
          <Text style={s.fabZoom}>−</Text>
        </TouchableOpacity>
      </View>

      {/* Map Legend */}
      <View style={s.legend}>
        <TouchableOpacity
          style={[s.legendItem, !showPlaces && s.legendItemOff]}
          onPress={() => setShowPlaces(v => !v)}
        >
          <View style={[s.legendDot, { backgroundColor: '#EF4444' }]} />
          <Text style={s.legendText}>Địa điểm</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.legendItem, !showEvents && s.legendItemOff]}
          onPress={() => setShowEvents(v => !v)}
        >
          <View style={[s.legendDot, { backgroundColor: '#16A34A' }]} />
          <Text style={s.legendText}>Sự kiện</Text>
        </TouchableOpacity>
      </View>

      {/* Event Bottom Sheet */}
      {selectedEvent && (
        <View style={s.sheet}>
          <View style={s.sheetHandle} />
          <View style={s.sheetRow}>
            <View style={[s.sheetIconBox, { backgroundColor: '#FFF7ED' }]}>
              <Text style={{ fontSize: 26 }}>🎪</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.sheetName}>{selectedEvent.title}</Text>
              <Text style={[s.sheetCat, { color: '#F97316' }]}>{selectedEvent.category}</Text>
              <View style={s.sheetMeta}>
                <Text style={{ fontSize: 11, color: new Date(selectedEvent.start_date) > new Date() ? '#2563EB' : '#16A34A', fontWeight: '700' }}>
                  {new Date(selectedEvent.start_date) > new Date() ? '⏰ Sắp diễn ra' : '🟢 Đang diễn ra'}
                </Text>
                <Text style={{ fontSize: 11, color: selectedEvent.price === 0 ? '#16A34A' : '#F97316', fontWeight: '700' }}>
                  {selectedEvent.price === 0 ? '🎁 Miễn phí' : selectedEvent.price.toLocaleString('vi-VN') + 'đ'}
                </Text>
              </View>
              <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                {'📅 ' + new Date(selectedEvent.start_date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }) +
                 ' · ' + new Date(selectedEvent.start_date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })}
              </Text>
              {eventRouteInfo && (
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                  <Text style={s.sheetDist}>🛣️ {formatDistance(eventRouteInfo.distance / 1000)}</Text>
                  <Text style={s.sheetDur}>⏱️ {formatDuration(eventRouteInfo.duration)}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity style={s.closeBtn} onPress={() => { setSelectedEvent(null); clearEventRoute() }}>
              <Text style={s.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={s.sheetBtns}>
            <TouchableOpacity
              style={[s.btnSecondary, loadingEventRoute && { opacity: 0.5 }, eventRoute.length > 0 && { backgroundColor: '#FFF7ED', borderColor: '#F97316' }]}
              onPress={() => eventRoute.length > 0 ? clearEventRoute() : handleEventDirections(selectedEvent)}
              disabled={loadingEventRoute}
            >
              {loadingEventRoute
                ? <ActivityIndicator size="small" color="#F97316" />
                : <Text style={[s.btnSecondaryText, eventRoute.length > 0 && { color: '#F97316' }]}>
                    {eventRoute.length > 0 ? '✕ Xóa đường' : '🧭 Chỉ đường'}
                  </Text>
              }
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.btnPrimary, { backgroundColor: '#F97316' }]}
              onPress={() => router.push(`/event/${selectedEvent.id}`)}
            >
              <Text style={s.btnPrimaryText}>Xem chi tiết →</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Place Bottom Sheet */}
      {selected && (
        <View style={s.sheet}>
          <View style={s.sheetHandle} />
          <View style={s.sheetRow}>
            <View style={s.sheetIconBox}>
              <Text style={{ fontSize: 26 }}>
                {selected.category === 'Ẩm thực' ? '🍜' :
                 selected.category === 'Văn hóa' ? '🏛️' :
                 selected.category === 'Mua sắm' ? '🛍️' :
                 selected.category === 'Thiên nhiên' ? '🌿' : '🗺️'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.sheetName}>{selected.name}</Text>
              <Text style={s.sheetCat}>{selected.category}</Text>
              <View style={s.sheetMeta}>
                <Text style={s.sheetRating}>⭐ {selected.rating}/5</Text>
                {routeInfo
                  ? <>
                      <Text style={s.sheetDist}>🛣️ {formatDistance(routeInfo.distance / 1000)}</Text>
                      <Text style={s.sheetDur}>⏱️ {formatDuration(routeInfo.duration)}</Text>
                    </>
                  : location && <Text style={s.sheetDist}>📍 {distText(selected)}</Text>
                }
              </View>
            </View>
            <TouchableOpacity
              style={s.closeBtn}
              onPress={() => { setSelected(null); clearRoute() }}
            >
              <Text style={s.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={s.sheetBtns}>
            <TouchableOpacity
              style={[s.btnSecondary, loadingRoute && { opacity: 0.5 }]}
              onPress={() => handleDirections(selected)}
              disabled={loadingRoute}
            >
              {loadingRoute
                ? <ActivityIndicator size="small" color="#2563EB" />
                : <Text style={s.btnSecondaryText}>🧭 Chỉ đường</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity
              style={s.btnPrimary}
              onPress={() => router.push(`/place/${selected.id}`)}
            >
              <Text style={s.btnPrimaryText}>Xem chi tiết →</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },

  // Search
  searchContainer: {
    position: 'absolute',
    top: 44, left: 12, right: 12,
    zIndex: 1000,
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 12,
    gap: 10,
    shadowColor: '#000', shadowOpacity: 0.12,
    shadowRadius: 10, elevation: 6,
    borderWidth: 1, borderColor: '#F1F5F9',
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, fontSize: 14, color: '#0F172A' },
  clearBtn: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center', alignItems: 'center',
  },
  clearText: { fontSize: 10, color: '#64748B', fontWeight: '800' },

  // Results dropdown
  resultsBox: {
    backgroundColor: '#fff', borderRadius: 14,
    marginTop: 6,
    shadowColor: '#000', shadowOpacity: 0.12,
    shadowRadius: 10, elevation: 6,
    overflow: 'hidden',
    borderWidth: 1, borderColor: '#F1F5F9',
  },
  resultItem: {
    flexDirection: 'row', alignItems: 'center',
    padding: 12, gap: 10,
    borderBottomWidth: 1, borderBottomColor: '#F8FAFC',
  },
  resultIcon: { fontSize: 16 },
  resultName: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  resultAddr: { fontSize: 11, color: '#94A3B8', marginTop: 1 },

  // Category chips — dưới search
  chipsContainer: {
    position: 'absolute',
    top: 106, left: 0, right: 0,
    zIndex: 999,
  },
  chipsList: { paddingHorizontal: 12, gap: 8 },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7,
    shadowColor: '#000', shadowOpacity: 0.08,
    shadowRadius: 4, elevation: 3,
    borderWidth: 1, borderColor: '#F1F5F9',
  },
  chipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipText: { fontSize: 12, color: '#374151', fontWeight: '600' },
  chipTextActive: { color: '#fff' },

  // FAB — right side, dưới chips
  fabRight: {
    position: 'absolute',
    right: 12, bottom: 200,
    zIndex: 999, gap: 8,
  },
  fab: {
    width: 44, height: 44, borderRadius: 13,
    backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.1,
    shadowRadius: 6, elevation: 4,
    borderWidth: 1, borderColor: '#F1F5F9',
  },
  fabActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  fabIcon: { fontSize: 18 },
  fabZoom: { fontSize: 22, color: '#374151', fontWeight: '700', lineHeight: 26 },

  // Bottom Sheet
  sheet: {
    position: 'absolute',
    bottom: 16, left: 12, right: 12,
    zIndex: 1000,
    backgroundColor: '#fff', borderRadius: 22,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.15,
    shadowRadius: 16, elevation: 10,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center', marginBottom: 12,
  },
  sheetRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, marginBottom: 12,
  },
  sheetIconBox: {
    width: 50, height: 50, borderRadius: 14,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center', alignItems: 'center',
  },
  sheetName: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 2 },
  sheetCat: { fontSize: 11, color: '#2563EB', fontWeight: '700' },
  sheetMeta: { flexDirection: 'row', gap: 10, marginTop: 4, flexWrap: 'wrap' },
  sheetRating: { fontSize: 12, color: '#F59E0B', fontWeight: '600' },
  sheetDist: { fontSize: 12, color: '#2563EB', fontWeight: '700' },
  sheetDur: { fontSize: 12, color: '#64748B' },
  closeBtn: {
    width: 30, height: 30, borderRadius: 9,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center', alignItems: 'center',
  },
  closeText: { fontSize: 12, color: '#64748B', fontWeight: '700' },
  sheetBtns: { flexDirection: 'row', gap: 8 },
  btnSecondary: {
    flex: 1, borderRadius: 12, paddingVertical: 13,
    borderWidth: 1.5, borderColor: '#2563EB',
    alignItems: 'center', justifyContent: 'center',
    minHeight: 44,
  },
  btnSecondaryText: { color: '#2563EB', fontSize: 13, fontWeight: '700' },
  btnPrimary: {
    flex: 1.2, backgroundColor: '#2563EB',
    borderRadius: 12, paddingVertical: 13,
    alignItems: 'center', minHeight: 44,
    shadowColor: '#2563EB', shadowOpacity: 0.3,
    shadowRadius: 6, elevation: 4,
  },
  btnPrimaryText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  // Legend
  legend: {
    position: 'absolute',
    bottom: 90, left: 12,
    zIndex: 999,
    flexDirection: 'row', gap: 8,
  },
  legendItem: {
    flexDirection: 'row', alignItems: 'center',
    gap: 6, backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#000', shadowOpacity: 0.08,
    shadowRadius: 4, elevation: 3,
  },
  legendItemOff: { opacity: 0.5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, color: '#374151', fontWeight: '600' },
})
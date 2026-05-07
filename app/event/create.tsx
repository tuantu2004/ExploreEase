import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, ActivityIndicator, Alert, Platform, Modal, Image,
} from 'react-native'
import { router } from 'expo-router'
import { useState } from 'react'
import MapPicker from '@/components/map/MapPicker'
import * as ImagePicker from 'expo-image-picker'
import { useAuthStore } from '../../stores/useAuthStore'
import { supabase } from '../../services/supabase'
import { sendPushToAdmins } from '../../services/notificationService'

const CATEGORIES = ['Âm nhạc', 'Ẩm thực', 'Thể thao', 'Văn hóa', 'Nghệ thuật', 'Khác']

// Mini Calendar Component
function CalendarPicker({
  value, onChange, label
}: {
  value: Date | null
  onChange: (date: Date) => void
  label: string
}) {
  const [showCal, setShowCal] = useState(false)
  const [viewMonth, setViewMonth] = useState(new Date())
  const [selectedHour, setSelectedHour] = useState(value?.getHours() ?? 8)
  const [selectedMin, setSelectedMin] = useState(value?.getMinutes() ?? 0)

  const today = new Date()
  const year = viewMonth.getFullYear()
  const month = viewMonth.getMonth()

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay = new Date(year, month, 1).getDay()
  const days: (number | null)[] = []

  for (let i = 0; i < firstDay; i++) days.push(null)
  for (let i = 1; i <= daysInMonth; i++) days.push(i)

  const MONTHS = [
    'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4',
    'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8',
    'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
  ]
  const DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

  const handleSelectDay = (day: number) => {
    const selected = new Date(year, month, day, selectedHour, selectedMin)
    onChange(selected)
  }

  const handleConfirm = () => {
    if (value) {
      const updated = new Date(value)
      updated.setHours(selectedHour, selectedMin, 0, 0)
      onChange(updated)
    }
    setShowCal(false)
  }

  const isSelected = (day: number) => {
    if (!value) return false
    return value.getDate() === day &&
      value.getMonth() === month &&
      value.getFullYear() === year
  }

  const isPast = (day: number) => {
    const d = new Date(year, month, day)
    d.setHours(0,0,0,0)
    today.setHours(0,0,0,0)
    return d < today
  }

  return (
    <View>
      <Text style={cal.label}>{label}</Text>

      {/* Display Button */}
      <TouchableOpacity
        style={cal.displayBtn}
        onPress={() => setShowCal(!showCal)}
      >
        <Text style={cal.calIcon}>📅</Text>
        <Text style={[cal.displayText, !value && cal.placeholder]}>
          {value
            ? value.toLocaleDateString('vi-VN', {
                weekday: 'short', day: '2-digit',
                month: '2-digit', year: 'numeric',
              }) + ' ' + value.toLocaleTimeString('vi-VN', {
                hour: '2-digit', minute: '2-digit',
              })
            : 'Chọn ngày & giờ...'
          }
        </Text>
        <Text style={cal.chevron}>{showCal ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {showCal && (
        <View style={cal.calBox}>
          {/* Month Navigation */}
          <View style={cal.monthNav}>
            <TouchableOpacity
              style={cal.navBtn}
              onPress={() => setViewMonth(new Date(year, month - 1, 1))}
            >
              <Text style={cal.navBtnText}>‹</Text>
            </TouchableOpacity>
            <Text style={cal.monthTitle}>
              {MONTHS[month]} {year}
            </Text>
            <TouchableOpacity
              style={cal.navBtn}
              onPress={() => setViewMonth(new Date(year, month + 1, 1))}
            >
              <Text style={cal.navBtnText}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Day Headers */}
          <View style={cal.dayHeaders}>
            {DAYS.map(d => (
              <Text key={d} style={cal.dayHeader}>{d}</Text>
            ))}
          </View>

          {/* Days Grid */}
          <View style={cal.daysGrid}>
            {days.map((day, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  cal.dayCell,
                  day && isSelected(day) && cal.dayCellSelected,
                  day && isPast(day) && cal.dayCellPast,
                  !day && cal.dayCellEmpty,
                ]}
                onPress={() => day && !isPast(day) && handleSelectDay(day)}
                disabled={!day || isPast(day)}
              >
                {day ? (
                  <Text style={[
                    cal.dayText,
                    isSelected(day) && cal.dayTextSelected,
                    isPast(day) && cal.dayTextPast,
                  ]}>
                    {day}
                  </Text>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>

          {/* Time Picker */}
          <View style={cal.timePicker}>
            <Text style={cal.timeLabel}>🕐 Giờ bắt đầu</Text>
            <View style={cal.timeRow}>
              {/* Hour */}
              <View style={cal.timeGroup}>
                <TouchableOpacity
                  style={cal.timeBtn}
                  onPress={() => setSelectedHour(h => h < 23 ? h + 1 : 0)}
                >
                  <Text style={cal.timeBtnText}>▲</Text>
                </TouchableOpacity>
                <Text style={cal.timeValue}>
                  {selectedHour.toString().padStart(2, '0')}
                </Text>
                <TouchableOpacity
                  style={cal.timeBtn}
                  onPress={() => setSelectedHour(h => h > 0 ? h - 1 : 23)}
                >
                  <Text style={cal.timeBtnText}>▼</Text>
                </TouchableOpacity>
              </View>

              <Text style={cal.timeSep}>:</Text>

              {/* Minute */}
              <View style={cal.timeGroup}>
                <TouchableOpacity
                  style={cal.timeBtn}
                  onPress={() => setSelectedMin(m => m < 45 ? m + 15 : 0)}
                >
                  <Text style={cal.timeBtnText}>▲</Text>
                </TouchableOpacity>
                <Text style={cal.timeValue}>
                  {selectedMin.toString().padStart(2, '0')}
                </Text>
                <TouchableOpacity
                  style={cal.timeBtn}
                  onPress={() => setSelectedMin(m => m > 0 ? m - 15 : 45)}
                >
                  <Text style={cal.timeBtnText}>▼</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Confirm Button */}
          <TouchableOpacity style={cal.confirmBtn} onPress={handleConfirm}>
            <Text style={cal.confirmBtnText}>✓ Xác nhận</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

export default function CreateEventScreen() {
  const user = useAuthStore((s) => s.user)
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [geocoding, setGeocoding] = useState(false)
  const [showMapPicker, setShowMapPicker] = useState(false)
  const [mapRegion, setMapRegion] = useState({
    latitude: 10.8231,
    longitude: 106.6297,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  })
  const [selectedImage, setSelectedImage] = useState<{ uri: string; base64: string; mimeType: string } | null>(null)
  const [pickingImage, setPickingImage] = useState(false)
  const [form, setForm] = useState({
    title: '',
    category: '',
    description: '',
    location: '',
    price: '0',
    max_attendees: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.title.trim()) e.title = 'Vui lòng nhập tiêu đề'
    if (!form.category) e.category = 'Vui lòng chọn danh mục'
    if (!form.location.trim()) e.location = 'Vui lòng nhập địa điểm'
    if (!startDate) e.start_date = 'Vui lòng chọn ngày bắt đầu'
    if (startDate && startDate < new Date()) e.start_date = 'Ngày phải trong tương lai'
    if (!endDate) e.end_date = 'Vui lòng chọn ngày kết thúc'
    if (startDate && endDate && endDate <= startDate) {
      e.end_date = 'Ngày kết thúc phải sau ngày bắt đầu'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const geocodeLocation = async (address: string) => {
    setGeocoding(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address + ' Vietnam')}&format=json&limit=1`,
        { headers: { 'User-Agent': 'ExploreEase/1.0' } }
      )
      const data = await res.json()
      if (data[0]) {
        const locationCoords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
        setCoords(locationCoords)
        return locationCoords
      }
      return null
    } catch {
      return null
    } finally {
      setGeocoding(false)
    }
  }

  const openMapPicker = async () => {
    setShowMapPicker(true)

    if (!form.location.trim()) {
      return
    }

    const locationCoords = await geocodeLocation(form.location)
    if (locationCoords) {
      setMapRegion({
        latitude: locationCoords.lat,
        longitude: locationCoords.lng,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      })
    } else {
      Alert.alert('Không tìm thấy địa chỉ', 'Vui lòng chọn vị trí trên bản đồ.')
    }
  }

  const handleMapPress = (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate
    setCoords({ lat: latitude, lng: longitude })
  }

  const confirmMapLocation = () => {
    if (!coords) {
      Alert.alert('Chưa chọn vị trí', 'Vui lòng chạm vào bản đồ để chọn vị trí.')
      return
    }
    setShowMapPicker(false)
  }

  const handlePickImage = async () => {
    try {
      setPickingImage(true)
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Cần quyền truy cập', 'Vui lòng cho phép truy cập thư viện ảnh')
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.6,
        base64: true,
      })

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0]
        setSelectedImage({
          uri: asset.uri,
          base64: asset.base64 ?? '',
          mimeType: asset.mimeType ?? 'image/jpeg',
        })
      }
    } catch (e: any) {
      Alert.alert('Lỗi', e.message)
    } finally {
      setPickingImage(false)
    }
  }

  const uploadEventImage = async (asset: any): Promise<string | null> => {
    try {
      const fileExt = asset.mimeType?.split('/')[1] ?? 'jpg'
      const fileName = `${user!.id}/${Date.now()}.${fileExt}`

      let uploadData: Uint8Array | Blob
      if (Platform.OS === 'web') {
        const res = await fetch(asset.uri)
        uploadData = await res.blob()
      } else {
        if (!asset.base64) return null
        const byteCharacters = atob(asset.base64)
        const byteArray = new Uint8Array(byteCharacters.length)
        for (let i = 0; i < byteCharacters.length; i++) {
          byteArray[i] = byteCharacters.charCodeAt(i)
        }
        uploadData = byteArray
      }

      const uploadPromise = supabase.storage
        .from('events')
        .upload(fileName, uploadData, {
          upsert: true,
          contentType: asset.mimeType ?? 'image/jpeg',
        })

      const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: new Error('Upload timeout') }), 10000)
      )

      const { error } = await Promise.race([uploadPromise, timeoutPromise])
      if (error) throw error

      const { data } = supabase.storage.from('events').getPublicUrl(fileName)
      return data.publicUrl
    } catch (e: any) {
      console.error('Upload error:', e)
      // Bucket chưa tạo → trên web asset.uri là data URL, dùng thẳng làm fallback
      if (Platform.OS === 'web' && asset.uri) return asset.uri
      if (asset.base64) return `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`
      return null
    }
  }

  const handleSubmit = async () => {
    if (!validate() || !user) return
    if (submitted) return  // ← chặn bấm 2 lần
    setSubmitted(true)
    setLoading(true)
    try {
      // Upload image if selected
      let imageUrl: string | null = null
      if (selectedImage) {
        imageUrl = await uploadEventImage(selectedImage)
      }

    let finalCoords = coords
    if (!finalCoords && form.location.trim()) {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(form.location + ' Vietnam')}&format=json&limit=1`,
          { headers: { 'User-Agent': 'ExploreEase/1.0' } }
        )
        const data = await res.json()
        if (data[0]) {
          finalCoords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
        }
      } catch {}
    }

    const insertData: any = {
      title: form.title.trim(),
      category: form.category,
      description: form.description.trim() || null,
      location: form.location.trim(),
      start_date: startDate!.toISOString(),
      end_date: endDate ? endDate.toISOString() : startDate!.toISOString(),
      price: parseInt(form.price) || 0,
      status: 'upcoming',
      is_approved: false,
      attendee_count: 0,
      creator_id: user.id,
      image: imageUrl,
    }

    if (form.max_attendees) insertData.max_attendees = parseInt(form.max_attendees)
    if (finalCoords) { insertData.lat = finalCoords.lat; insertData.lng = finalCoords.lng }

    const { data: newEvent, error } = await supabase
      .from('events')
      .insert(insertData)
      .select()
      .single()

    if (error) throw error

    // 1. Thông báo cho chính user: đang chờ duyệt
    await supabase.from('notifications').insert({
      user_id: user.id,
      type: 'event',
      title: '⏳ Sự kiện đang chờ xét duyệt',
      message: `"${form.title.trim()}" đã được gửi. Admin sẽ xét duyệt sớm nhất có thể.`,
      target_id: newEvent.id,
      target_type: 'event',
      is_read: false,
    })

    // 2. Thông báo cho tất cả admin
    const { data: admins } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin')

    if (admins && admins.length > 0) {
      await supabase.from('notifications').insert(
        admins.map((admin: any) => ({
          user_id: admin.id,
          type: 'alert',
          title: '📋 Có sự kiện mới cần xét duyệt',
          message: `"${form.title.trim()}" do ${user.name} gửi đang chờ phê duyệt`,
          target_id: newEvent.id,
          target_type: 'event',
          is_read: false,
        }))
      )
    }

    // Gửi push notification cho admin
    sendPushToAdmins(
      '📋 Có sự kiện mới cần xét duyệt',
      `"${form.title.trim()}" do ${user.name} gửi đang chờ phê duyệt`,
      { type: 'event', targetId: newEvent.id }
    )

    Alert.alert(
      '✅ Đã gửi thành công!',
      'Sự kiện đang chờ admin xét duyệt.\nBạn sẽ nhận thông báo khi được duyệt.',
      [{ text: 'OK', onPress: () => router.back() }]
    )
  } catch (e: any) {
    console.error('Insert error:', e)
    setSubmitted(false)  // ← cho phép thử lại nếu lỗi
    Alert.alert('Lỗi', e.message ?? 'Không thể tạo sự kiện')
  } finally {
    setLoading(false)
  }
}

  return (
    <View style={s.screen}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.cancelBtn}>✕</Text>
        </TouchableOpacity>
        <Text style={s.title}>Tạo sự kiện</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Notice */}
        <View style={s.notice}>
          <Text style={s.noticeIcon}>ℹ️</Text>
          <Text style={s.noticeText}>
            Sự kiện sẽ được admin duyệt trước khi hiển thị công khai
          </Text>
        </View>

        {/* Title */}
        <View style={s.field}>
          <Text style={s.label}>Tên sự kiện *</Text>
          <TextInput
            style={[s.input, errors.title && s.inputError]}
            placeholder="VD: Đêm nhạc Jazz Sài Gòn"
            placeholderTextColor="#94A3B8"
            value={form.title}
            onChangeText={v => setForm(f => ({ ...f, title: v }))}
          />
          {errors.title && <Text style={s.error}>⚠ {errors.title}</Text>}
        </View>

        {/* Description */}
        <View style={s.field}>
          <Text style={s.label}>Mô tả</Text>
          <TextInput
            style={[s.input, s.inputMulti]}
            placeholder="Mô tả chi tiết về sự kiện..."
            placeholderTextColor="#94A3B8"
            multiline numberOfLines={4}
            value={form.description}
            onChangeText={v => setForm(f => ({ ...f, description: v }))}
          />
        </View>

        {/* Event Image */}
        <View style={s.field}>
          <Text style={s.label}>Ảnh sự kiện</Text>
          {selectedImage ? (
            <View style={s.imagePreviewContainer}>
              <Image source={{ uri: selectedImage.uri }} style={s.imagePreview} />
              <TouchableOpacity
                style={s.removeImageBtn}
                onPress={() => setSelectedImage(null)}
              >
                <Text style={s.removeImageBtnText}>✕ Xóa</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={s.pickImageBtn}
              onPress={handlePickImage}
              disabled={pickingImage}
            >
              {pickingImage ? (
                <ActivityIndicator color="#2563EB" size="small" />
              ) : (
                <>
                  <Text style={s.pickImageIcon}>📷</Text>
                  <Text style={s.pickImageText}>Chọn ảnh cho sự kiện</Text>
                  <Text style={s.pickImageSubtext}>(Tùy chọn - khuyến nghị 16:9)</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Start Date — Calendar Picker */}
        <View style={s.field}>
          <CalendarPicker
            label="Ngày & Giờ bắt đầu *"
            value={startDate}
            onChange={setStartDate}
          />
          {errors.start_date && <Text style={s.error}>⚠ {errors.start_date}</Text>}
        </View>

        {/* End Date */}
        <View style={s.field}>
          <CalendarPicker
            label="Ngày & Giờ kết thúc *"
            value={endDate}
            onChange={setEndDate}
          />
          {errors.end_date && <Text style={s.error}>⚠ {errors.end_date}</Text>}
        </View>

        {/* Location */}
        <View style={s.field}>
          <Text style={s.label}>Địa điểm *</Text>
          <View style={s.locationRow}>
            <TextInput
              style={[s.input, { flex: 1 }, errors.location && s.inputError]}
              placeholder="VD: Công viên 23/9, Quận 1"
              placeholderTextColor="#94A3B8"
              value={form.location}
              onChangeText={v => {
                setForm(f => ({ ...f, location: v }))
                setCoords(null)
              }}
            />
            <TouchableOpacity
              style={[s.geocodeBtn, coords && s.geocodeBtnDone]}
              onPress={openMapPicker}
              disabled={geocoding}
            >
              {geocoding ? (
                <ActivityIndicator size="small" color="#2563EB" />
              ) : (
                <Text style={s.geocodeBtnText}>
                  {coords ? '✅' : '📍 Xác định'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
          {errors.location && <Text style={s.error}>⚠ {errors.location}</Text>}
          {coords && (
            <View style={s.coordsBadge}>
              <Text style={s.coordsText}>
                ✅ {coords.lat.toFixed(4)}°N, {coords.lng.toFixed(4)}°E
              </Text>
            </View>
          )}
        </View>

        <Modal visible={showMapPicker} animationType="slide" transparent>
          <View style={s.mapModalOverlay}>
            <View style={s.mapModalSheet}>
              <View style={s.mapHeader}>
                <TouchableOpacity onPress={() => setShowMapPicker(false)}>
                  <Text style={s.mapHeaderAction}>Huỷ</Text>
                </TouchableOpacity>
                <Text style={s.mapHeaderTitle}>Chọn vị trí trên bản đồ</Text>
                <TouchableOpacity onPress={confirmMapLocation}>
                  <Text style={s.mapHeaderAction}>Xác nhận</Text>
                </TouchableOpacity>
              </View>
              <MapPicker
                mapRegion={mapRegion}
                onRegionChange={setMapRegion}
                onPress={handleMapPress}
                coords={coords}
                title="Vị trí sự kiện"
                description={form.location || 'Địa điểm đã chọn'}
                formLocation={form.location}
              />
              <View style={s.mapHint}>
                <Text style={s.mapHintText}>Chạm vào bản đồ để đặt ghim vị trí sự kiện.</Text>
              </View>
            </View>
          </View>
        </Modal>

        {/* Category */}
        <View style={s.field}>
          <Text style={s.label}>Danh mục *</Text>
          <View style={s.catGrid}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[s.catChip, form.category === cat && s.catChipActive]}
                onPress={() => setForm(f => ({ ...f, category: cat }))}
              >
                <Text style={[s.catChipText, form.category === cat && s.catChipTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {errors.category && <Text style={s.error}>⚠ {errors.category}</Text>}
        </View>

        {/* Price + Capacity */}
        <View style={s.twoCol}>
          <View style={[s.field, { flex: 1 }]}>
            <Text style={s.label}>Phí vào cửa (đ)</Text>
            <TextInput
              style={s.input}
              placeholder="0 = miễn phí"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              value={form.price === '0' ? '' : form.price}
              onChangeText={v => setForm(f => ({ ...f, price: v || '0' }))}
            />
          </View>
          <View style={[s.field, { flex: 1 }]}>
            <Text style={s.label}>Sức chứa</Text>
            <TextInput
              style={s.input}
              placeholder="VD: 500"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              value={form.max_attendees}
              onChangeText={v => setForm(f => ({ ...f, max_attendees: v }))}
            />
          </View>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[s.submitBtn, (loading || submitted) && s.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={loading || submitted}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.submitBtnText}>⊕ Tạo sự kiện</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

// Calendar styles
const cal = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 },
  displayBtn: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#E2E8F0',
    borderRadius: 12, padding: 14, gap: 10,
    backgroundColor: '#fff',
  },
  calIcon: { fontSize: 18 },
  displayText: { flex: 1, fontSize: 14, color: '#0F172A', fontWeight: '500' },
  placeholder: { color: '#94A3B8', fontWeight: '400' },
  chevron: { color: '#94A3B8', fontSize: 12 },
  calBox: {
    backgroundColor: '#fff', borderRadius: 16,
    padding: 16, marginTop: 8,
    shadowColor: '#000', shadowOpacity: 0.1,
    shadowRadius: 12, elevation: 6,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  monthNav: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 12,
  },
  navBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center', alignItems: 'center',
  },
  navBtnText: { fontSize: 20, color: '#374151', fontWeight: '700' },
  monthTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  dayHeaders: {
    flexDirection: 'row', marginBottom: 6,
  },
  dayHeader: {
    flex: 1, textAlign: 'center',
    fontSize: 11, color: '#94A3B8', fontWeight: '700',
  },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
  dayCell: {
    width: `${100 / 7}%` as any,
    aspectRatio: 1,
    justifyContent: 'center', alignItems: 'center',
    borderRadius: 8,
  },
  dayCellSelected: { backgroundColor: '#2563EB' },
  dayCellPast: { opacity: 0.3 },
  dayCellEmpty: {},
  dayText: { fontSize: 14, color: '#0F172A', fontWeight: '500' },
  dayTextSelected: { color: '#fff', fontWeight: '800' },
  dayTextPast: { color: '#94A3B8' },
  timePicker: {
    borderTopWidth: 1, borderTopColor: '#F1F5F9',
    paddingTop: 12, marginBottom: 12,
  },
  timeLabel: { fontSize: 13, color: '#64748B', fontWeight: '600', marginBottom: 10, textAlign: 'center' },
  timeRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
  },
  timeGroup: { alignItems: 'center', gap: 4 },
  timeBtn: {
    width: 36, height: 30, borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center', alignItems: 'center',
  },
  timeBtnText: { color: '#374151', fontSize: 14, fontWeight: '700' },
  timeValue: {
    fontSize: 28, fontWeight: '900', color: '#0F172A',
    width: 52, textAlign: 'center',
  },
  timeSep: { fontSize: 28, fontWeight: '900', color: '#0F172A', marginTop: -8 },
  confirmBtn: {
    backgroundColor: '#2563EB', borderRadius: 12,
    paddingVertical: 12, alignItems: 'center',
  },
  confirmBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
})

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 52, paddingHorizontal: 16, paddingBottom: 16,
    backgroundColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.06,
    shadowRadius: 8, elevation: 4,
  },
  cancelBtn: { fontSize: 20, color: '#64748B', fontWeight: '700', padding: 4 },
  title: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  content: { padding: 16, gap: 4 },
  notice: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: '#EFF6FF', borderRadius: 12,
    padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: '#BFDBFE',
  },
  noticeIcon: { fontSize: 16 },
  noticeText: { flex: 1, fontSize: 13, color: '#1D4ED8', lineHeight: 18 },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 },
  input: {
    borderWidth: 1.5, borderColor: '#E2E8F0',
    borderRadius: 12, padding: 14,
    fontSize: 14, color: '#0F172A', backgroundColor: '#fff',
  },
  inputMulti: { height: 100, textAlignVertical: 'top' },
  inputError: { borderColor: '#EF4444' },
  error: { color: '#EF4444', fontSize: 12, marginTop: 4 },
  locationRow: { flexDirection: 'row', gap: 8 },
  geocodeBtn: {
    backgroundColor: '#EFF6FF', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 14,
    borderWidth: 1.5, borderColor: '#2563EB',
    justifyContent: 'center', alignItems: 'center',
    minWidth: 80,
  },
  geocodeBtnDone: { backgroundColor: '#F0FDF4', borderColor: '#16A34A' },
  geocodeBtnText: { color: '#2563EB', fontSize: 12, fontWeight: '700' },
  coordsBadge: {
    backgroundColor: '#F0FDF4', borderRadius: 8,
    padding: 8, marginTop: 6,
    borderWidth: 1, borderColor: '#BBF7D0',
  },
  coordsText: { fontSize: 12, color: '#16A34A', fontWeight: '600' },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 10, backgroundColor: '#F1F5F9',
    borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  catChipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  catChipText: { fontSize: 13, color: '#475569', fontWeight: '600' },
  catChipTextActive: { color: '#fff' },
  twoCol: { flexDirection: 'row', gap: 12 },
  submitBtn: {
    backgroundColor: '#2563EB', borderRadius: 16,
    paddingVertical: 16, alignItems: 'center',
    marginTop: 8, marginBottom: 40,
    shadowColor: '#2563EB', shadowOpacity: 0.4,
    shadowRadius: 12, elevation: 6,
  },
  submitBtnDisabled: { backgroundColor: '#93C5FD', shadowOpacity: 0 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  mapModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  mapModalSheet: {
    backgroundColor: '#fff',
    borderRadius: 24,
    overflow: 'hidden',
    maxHeight: '90%',
    minHeight: '70%',
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  mapHeaderAction: { fontSize: 14, fontWeight: '700', color: '#2563EB' },
  mapHeaderTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  mapPicker: { width: '100%', height: 360 },
  mapHint: { padding: 14, backgroundColor: '#F8FAFC' },
  mapHintText: { fontSize: 13, color: '#475569', textAlign: 'center' },

  // Image Upload
  imagePreviewContainer: { position: 'relative', marginTop: 8 },
  imagePreview: { width: '100%', height: 200, borderRadius: 12 },
  removeImageBtn: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0',
  },
  removeImageBtnText: { color: '#EF4444', fontSize: 13, fontWeight: '600' },
  pickImageBtn: {
    backgroundColor: '#F0FDF4', borderRadius: 12,
    paddingVertical: 32, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#BBDB3D', borderStyle: 'dashed',
    marginTop: 8,
  },
  pickImageIcon: { fontSize: 36, marginBottom: 8 },
  pickImageText: { fontSize: 14, fontWeight: '600', color: '#16A34A', marginBottom: 4 },
  pickImageSubtext: { fontSize: 12, color: '#86EFAC' },
})
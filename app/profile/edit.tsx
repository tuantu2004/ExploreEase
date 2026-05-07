import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, ActivityIndicator, Alert,
} from 'react-native'
import { router } from 'expo-router'
import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { updateProfile } from '../../services/authService'
import { useAuthStore } from '../../stores/useAuthStore'
import * as ImagePicker from 'expo-image-picker'
import { Image } from 'react-native'

const TRAVEL_STYLES = [
  { id: 'solo', label: 'Solo', icon: '🎒' },
  { id: 'couple', label: 'Cặp đôi', icon: '💑' },
  { id: 'family', label: 'Gia đình', icon: '👨‍👩‍👧' },
  { id: 'group', label: 'Nhóm bạn', icon: '👥' },
]

const INTERESTS = [
  { id: 'Ẩm thực', label: 'Ẩm thực', icon: '🍜' },
  { id: 'Văn hóa', label: 'Văn hóa', icon: '🏛️' },
  { id: 'Mua sắm', label: 'Mua sắm', icon: '🛍️' },
  { id: 'Thiên nhiên', label: 'Thiên nhiên', icon: '🌿' },
  { id: 'Phiêu lưu', label: 'Phiêu lưu', icon: '🧗' },
  { id: 'Về đêm', label: 'Về đêm', icon: '🌙' },
]

const GENDERS = [
  { id: 'male', label: 'Nam', icon: '👨' },
  { id: 'female', label: 'Nữ', icon: '👩' },
  { id: 'other', label: 'Khác', icon: '🧑' },
]

export default function EditProfileScreen() {
  const { user, setUser, refreshUser } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url ?? '')
  const [form, setForm] = useState({
    name: user?.name ?? '',
    age: user?.age?.toString() ?? '',
    gender: user?.gender ?? '',
    travel_style: user?.travel_style ?? 'solo',
  })
  const [selectedInterests, setSelectedInterests] = useState<string[]>([])

  // Load interests từ DB
  useEffect(() => {
    const loadInterests = async () => {
      if (!user) return
      const { data, error } = await supabase
        .from('user_preferences')
        .select('interests')
        .eq('user_id', user.id)
        .limit(1)
      if (error) {
        console.error('Load interests error:', error)
        return
      }
      const row = Array.isArray(data) ? data[0] : data
      if (row?.interests) {
        setSelectedInterests(row.interests)
      }
    }
    loadInterests()
  }, [user?.id])

  const toggleInterest = (id: string) => {
    setSelectedInterests(prev =>
      prev.includes(id)
        ? prev.filter(i => i !== id)
        : [...prev, id]
    )
  }

  const handlePickAvatar = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Cần quyền truy cập', 'Vui lòng cho phép truy cập thư viện ảnh')
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true, // ← lấy base64 thay vì blob
      })

      if (result.canceled || !result.assets[0]) return

      setAvatarLoading(true)
      const asset = result.assets[0]

      // Dùng base64 thay vì fetch blob — hoạt động cả web lẫn native
      if (!asset.base64) {
        Alert.alert('Lỗi', 'Không thể đọc ảnh')
        return
      }

      const fileExt = asset.mimeType?.split('/')[1] ?? 'jpg'
      const fileName = `${user!.id}/avatar.${fileExt}`

      // Convert base64 → ArrayBuffer
      const base64Str = asset.base64
      const byteCharacters = atob(base64Str)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)

      // Upload lên Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, byteArray, {
          upsert: true,
          contentType: asset.mimeType ?? 'image/jpeg',
        })

      if (uploadError) throw uploadError

      // Lấy public URL
      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)

      const publicUrl = `${data.publicUrl}?t=${Date.now()}`

      // Cập nhật DB
      await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user!.id)

      // Cập nhật state
      setAvatarUrl(publicUrl)
      setUser({ ...user!, avatar_url: publicUrl })
      Alert.alert('✅ Thành công', 'Ảnh đại diện đã được cập nhật!')

    } catch (e: any) {
      console.error('Avatar upload error:', e)
      Alert.alert('Lỗi', e.message ?? 'Không thể cập nhật ảnh')
    } finally {
      setAvatarLoading(false)
    }
  }

  const handleSave = async () => {
    if (!user) return
    if (!form.name.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập tên')
      return
    }
    setLoading(true)
    try {
      await updateProfile(user.id, {
        name: form.name.trim(),
        age: form.age ? parseInt(form.age) : undefined,
        gender: form.gender ? (form.gender as 'male' | 'female' | 'other') : undefined,
        travel_style: form.travel_style as any,
      })

      const { data: existing, error: existingError } = await supabase
        .from('user_preferences')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
      if (existingError) {
        throw existingError
      }
      const existingRow = Array.isArray(existing) ? existing[0] : existing

      if (existingRow?.id) {
        const { error: updateError } = await supabase
          .from('user_preferences')
          .update({ interests: selectedInterests })
          .eq('id', existingRow.id)
        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('user_preferences')
          .insert({
            user_id: user.id,
            interests: selectedInterests,
          })
        if (insertError) throw insertError
      }

      await refreshUser()

      router.back()

      // Hiện toast nhỏ sau khi back
      setTimeout(() => {
        Alert.alert('✅ Đã lưu', 'Hồ sơ đã được cập nhật!')
      }, 300)

    } catch (e: any) {
      Alert.alert('Lỗi', e.message ?? 'Không thể cập nhật hồ sơ')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={s.screen}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.cancelBtn}>Huỷ</Text>
        </TouchableOpacity>
        <Text style={s.title}>Chỉnh sửa hồ sơ</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#2563EB" size="small" />
            : <Text style={s.saveBtn}>Lưu</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.content}
      >
        {/* Avatar */}
        <View style={s.avatarSection}>
          <TouchableOpacity
            style={s.avatarWrapper}
            onPress={handlePickAvatar}
            disabled={avatarLoading}
          >
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={s.avatarImage}
              />
            ) : (
              <View style={s.avatar}>
                <Text style={s.avatarText}>
                  {form.name[0]?.toUpperCase() ?? 'U'}
                </Text>
              </View>
            )}

            {/* Camera overlay */}
            <View style={s.cameraOverlay}>
              {avatarLoading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.cameraIcon}>📷</Text>
              }
            </View>
          </TouchableOpacity>

          <Text style={s.changeAvatarHint}>
            Nhấn để đổi ảnh đại diện
          </Text>
        </View>

        {/* Basic Info */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Thông tin cơ bản</Text>
          <View style={s.card}>
            <View style={s.field}>
              <Text style={s.label}>Họ tên *</Text>
              <TextInput
                style={s.input}
                value={form.name}
                onChangeText={v => setForm(f => ({ ...f, name: v }))}
                placeholder="Nhập họ tên..."
                placeholderTextColor="#94A3B8"
              />
            </View>
            <View style={s.divider} />
            <View style={s.field}>
              <Text style={s.label}>Tuổi</Text>
              <TextInput
                style={s.input}
                value={form.age}
                onChangeText={v => setForm(f => ({ ...f, age: v }))}
                placeholder="Nhập tuổi..."
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                maxLength={3}
              />
            </View>
          </View>
        </View>

        {/* Gender */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Giới tính (tùy chọn)</Text>
          <View style={s.chipRow}>
            {GENDERS.map((g) => (
              <TouchableOpacity
                key={g.id}
                style={[s.chip, form.gender === g.id && s.chipActive]}
                onPress={() => setForm(f => ({
                  ...f,
                  gender: f.gender === g.id ? '' : g.id,
                }))}
              >
                <Text style={s.chipIcon}>{g.icon}</Text>
                <Text style={[s.chipText, form.gender === g.id && s.chipTextActive]}>
                  {g.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Travel Style */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Phong cách du lịch</Text>
          <View style={s.chipRow}>
            {TRAVEL_STYLES.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[s.chip, form.travel_style === t.id && s.chipActive]}
                onPress={() => setForm(f => ({ ...f, travel_style: t.id as 'solo' | 'couple' | 'family' | 'group' }))}
              >
                <Text style={s.chipIcon}>{t.icon}</Text>
                <Text style={[s.chipText, form.travel_style === t.id && s.chipTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Interests */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Sở thích</Text>
          <Text style={s.sectionDesc}>Chọn những gì bạn thích</Text>
          <View style={s.interestGrid}>
            {INTERESTS.map((interest) => {
              const active = selectedInterests.includes(interest.id)
              return (
                <TouchableOpacity
                  key={interest.id}
                  style={[s.interestItem, active && s.interestItemActive]}
                  onPress={() => toggleInterest(interest.id)}
                >
                  <Text style={s.interestIcon}>{interest.icon}</Text>
                  <Text style={[
                    s.interestLabel,
                    active && s.interestLabelActive,
                  ]}>
                    {interest.label}
                  </Text>
                  {active && <Text style={s.interestCheck}>✓</Text>}
                </TouchableOpacity>
              )
            })}
          </View>
        </View>

        {/* GDPR Section */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>🔒 Quyền riêng tư & GDPR</Text>
          <View style={s.card}>
            <TouchableOpacity style={s.gdprItem}>
              <Text style={s.gdprIcon}>📥</Text>
              <Text style={s.gdprText}>Tải xuống dữ liệu của tôi</Text>
              <Text style={s.gdprArrow}>›</Text>
            </TouchableOpacity>
            <View style={s.divider} />
            <TouchableOpacity
              style={s.gdprItem}
              onPress={() => Alert.alert(
                '⚠️ Xoá tài khoản',
                'Tất cả dữ liệu của bạn sẽ bị xoá vĩnh viễn. Bạn có chắc?',
                [
                  { text: 'Huỷ', style: 'cancel' },
                  { text: 'Xoá', style: 'destructive', onPress: () => {} },
                ]
              )}
            >
              <Text style={s.gdprIcon}>🗑️</Text>
              <Text style={[s.gdprText, { color: '#EF4444' }]}>
                Xoá tài khoản
              </Text>
              <Text style={s.gdprArrow}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

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
  cancelBtn: { color: '#64748B', fontSize: 15 },
  title: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  saveBtn: { color: '#2563EB', fontSize: 15, fontWeight: '800' },
  content: { padding: 16 },

  // Avatar
  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatarWrapper: { position: 'relative', marginBottom: 8 },
  avatar: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: '#2563EB',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#2563EB', shadowOpacity: 0.4,
    shadowRadius: 12, elevation: 8,
  },
  avatarImage: {
    width: 88, height: 88, borderRadius: 44,
    borderWidth: 3, borderColor: '#EFF6FF',
  },
  avatarText: { color: '#fff', fontSize: 36, fontWeight: '900' },
  cameraOverlay: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#2563EB',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  cameraIcon: { fontSize: 14 },
  changeAvatarHint: { fontSize: 12, color: '#94A3B8', marginBottom: 16 },

  // Sections
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  sectionDesc: { fontSize: 12, color: '#94A3B8', marginBottom: 10 },

  // Card
  card: {
    backgroundColor: '#fff', borderRadius: 16,
    shadowColor: '#000', shadowOpacity: 0.05,
    shadowRadius: 8, elevation: 2,
  },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginHorizontal: 16 },

  // Fields
  field: { padding: 14 },
  label: { fontSize: 12, color: '#94A3B8', fontWeight: '600', marginBottom: 6 },
  input: { fontSize: 15, color: '#0F172A', padding: 0 },

  // Chips
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 14, backgroundColor: '#fff',
    borderWidth: 1.5, borderColor: '#E2E8F0',
    shadowColor: '#000', shadowOpacity: 0.04,
    shadowRadius: 4, elevation: 1,
  },
  chipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipIcon: { fontSize: 16 },
  chipText: { fontSize: 13, color: '#475569', fontWeight: '600' },
  chipTextActive: { color: '#fff' },

  // Interests
  interestGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  interestItem: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 14, backgroundColor: '#fff',
    borderWidth: 1.5, borderColor: '#E2E8F0',
    shadowColor: '#000', shadowOpacity: 0.04,
    shadowRadius: 4, elevation: 1,
  },
  interestItemActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  interestIcon: { fontSize: 18 },
  interestLabel: { fontSize: 13, color: '#475569', fontWeight: '600' },
  interestLabelActive: { color: '#2563EB' },
  interestCheck: { color: '#2563EB', fontSize: 14, fontWeight: '800' },

  // GDPR
  gdprItem: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, gap: 12,
  },
  gdprIcon: { fontSize: 20 },
  gdprText: { flex: 1, fontSize: 14, color: '#0F172A', fontWeight: '500' },
  gdprArrow: { fontSize: 20, color: '#CBD5E1' },
})
import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
  TouchableOpacity,
  StyleSheet,
} from 'react-native'
import {
  enableBiometric,
  disableBiometric,
  isBiometricEnabled,
  isBiometricAvailable,
} from '@/services/biometricService'
import {
  exportUserDataAsJSON,
  exportUserDataAsCSV,
  deleteAllUserData,
  getGDPRComplianceStatus,
} from '@/services/gdprService'
import { useAuthStore } from '@/stores/useAuthStore'

/* ─── tiny helpers ─────────────────────────────────────────────────────────── */

function SectionHeader({ icon, label, color }: { icon: string; label: string; color: string }) {
  return (
    <View style={s.sectionHeader}>
      <View style={[s.sectionIconBox, { backgroundColor: color + '18' }]}>
        <Text style={s.sectionIcon}>{icon}</Text>
      </View>
      <Text style={s.sectionTitle}>{label}</Text>
    </View>
  )
}

function InfoBanner({ icon, text, bg, textColor }: { icon: string; text: string; bg: string; textColor: string }) {
  return (
    <View style={[s.banner, { backgroundColor: bg }]}>
      <Text style={s.bannerIcon}>{icon}</Text>
      <Text style={[s.bannerText, { color: textColor }]}>{text}</Text>
    </View>
  )
}

function ExportBtn({ icon, label, onPress, disabled }: { icon: string; label: string; onPress: () => void; disabled: boolean }) {
  return (
    <TouchableOpacity
      style={[s.exportBtn, disabled && s.disabledBtn]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
    >
      <Text style={s.exportBtnIcon}>{icon}</Text>
      <Text style={s.exportBtnLabel}>{label}</Text>
      <Text style={s.exportBtnArrow}>↓</Text>
    </TouchableOpacity>
  )
}

/* ─── main screen ──────────────────────────────────────────────────────────── */

export default function SecuritySettingsScreen() {
  const { user } = useAuthStore()
  const [biometricEnabled, setBiometricEnabled] = useState(false)
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [initialising, setInitialising] = useState(true)
  const [gdprStatus, setGdprStatus] = useState<any>(null)

  useEffect(() => {
    initializeSettings()
  }, [user?.id])

  const initializeSettings = async () => {
    if (!user?.id) { setInitialising(false); return }
    try {
      const [bioEnabled, bioAvailable, status] = await Promise.all([
        isBiometricEnabled(),
        isBiometricAvailable(),
        getGDPRComplianceStatus(user.id),
      ])
      setBiometricEnabled(bioEnabled)
      setBiometricAvailable(bioAvailable)
      setGdprStatus(status)
    } catch (e) {
      console.error('Failed to initialize security settings:', e)
    } finally {
      setInitialising(false)
    }
  }

  const handleToggleBiometric = async (value: boolean) => {
    try {
      setIsLoading(true)
      if (value) {
        const ok = await enableBiometric()
        if (ok) {
          setBiometricEnabled(true)
          Alert.alert('✅ Thành công', 'Xác thực sinh trắc học đã được bật')
        } else {
          Alert.alert('Lỗi', 'Không thể bật sinh trắc học. Kiểm tra thiết bị của bạn.')
        }
      } else {
        await disableBiometric()
        setBiometricEnabled(false)
        Alert.alert('✅ Thành công', 'Xác thực sinh trắc học đã tắt')
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể thay đổi cài đặt sinh trắc học')
    } finally {
      setIsLoading(false)
    }
  }

  const handleExportData = async (format: 'json' | 'csv') => {
    if (!user?.id) return
    try {
      setIsLoading(true)
      const data = format === 'json'
        ? await exportUserDataAsJSON(user.id)
        : await exportUserDataAsCSV(user.id)

      if (typeof window !== 'undefined') {
        const blob = new Blob([data], {
          type: format === 'json' ? 'application/json' : 'text/csv',
        })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `exploreease_data.${format}`
        link.click()
      }
      Alert.alert('✅ Xuất dữ liệu thành công', `File .${format.toUpperCase()} đã được tải xuống`)
    } catch {
      Alert.alert('Lỗi', 'Không thể xuất dữ liệu')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteAllData = () => {
    Alert.alert(
      '⚠️ Xoá toàn bộ dữ liệu',
      'Hành động này không thể hoàn tác. Hồ sơ, đánh giá, địa điểm đã lưu và lịch sử chat sẽ bị xoá vĩnh viễn.',
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Xoá vĩnh viễn',
          style: 'destructive',
          onPress: async () => {
            if (!user?.id) return
            try {
              setIsLoading(true)
              await deleteAllUserData(user.id)
              Alert.alert('Đã xoá', 'Tất cả dữ liệu đã được xoá. Vui lòng đăng xuất và đăng nhập lại.')
            } catch {
              Alert.alert('Lỗi', 'Không thể xoá dữ liệu')
            } finally {
              setIsLoading(false)
            }
          },
        },
      ]
    )
  }

  if (initialising) {
    return (
      <View style={s.loadingWrap}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={s.loadingText}>Đang tải...</Text>
      </View>
    )
  }

  return (
    <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>

      {/* ── Biometric ─────────────────────────────── */}
      <View style={s.card}>
        <SectionHeader icon="🔐" label="Xác thực sinh trắc học" color="#2563EB" />

        <InfoBanner
          icon={biometricAvailable ? '📱' : '⚠️'}
          text={biometricAvailable
            ? 'Thiết bị của bạn hỗ trợ xác thực sinh trắc học'
            : 'Thiết bị này không hỗ trợ sinh trắc học'}
          bg={biometricAvailable ? '#EFF6FF' : '#FFF7ED'}
          textColor={biometricAvailable ? '#1D4ED8' : '#C2410C'}
        />

        <View style={s.row}>
          <View style={s.rowLeft}>
            <Text style={s.rowLabel}>Khoá bằng sinh trắc học</Text>
            <Text style={s.rowSub}>Dùng vân tay hoặc Face ID để truy cập</Text>
          </View>
          <Switch
            disabled={!biometricAvailable || isLoading}
            value={biometricEnabled}
            onValueChange={handleToggleBiometric}
            trackColor={{ false: '#E2E8F0', true: '#2563EB' }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* ── Encryption ────────────────────────────── */}
      <View style={s.card}>
        <SectionHeader icon="🛡️" label="Mã hoá dữ liệu" color="#059669" />

        <View style={s.encryptionBadge}>
          <View style={s.encryptionIconWrap}>
            <Text style={s.encryptionIcon}>🔒</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.encryptionTitle}>AES End-to-End Encryption</Text>
            <Text style={s.encryptionSub}>Mọi dữ liệu nhạy cảm đều được mã hoá trước khi lưu trữ</Text>
          </View>
          <View style={s.activeBadge}>
            <Text style={s.activeBadgeText}>Đang hoạt động</Text>
          </View>
        </View>
      </View>

      {/* ── GDPR ──────────────────────────────────── */}
      <View style={s.card}>
        <SectionHeader icon="📋" label="Quản lý dữ liệu (GDPR)" color="#7C3AED" />

        {gdprStatus?.dataAvailable && (
          <InfoBanner
            icon="📦"
            text="Bạn có dữ liệu có thể xuất"
            bg="#F5F3FF"
            textColor="#6D28D9"
          />
        )}

        <Text style={s.subLabel}>Tải xuống dữ liệu của bạn</Text>
        <Text style={s.subDesc}>Bao gồm: hồ sơ, sở thích, địa điểm đã lưu, đánh giá và lịch sử chat</Text>

        <View style={s.exportRow}>
          <ExportBtn icon="{ }" label="JSON" onPress={() => handleExportData('json')} disabled={isLoading} />
          <ExportBtn icon="📊" label="CSV" onPress={() => handleExportData('csv')} disabled={isLoading} />
        </View>

        <View style={s.privacyBox}>
          <Text style={s.privacyTitle}>Quyền của bạn theo GDPR</Text>
          {[
            '• Truy cập và tải xuống dữ liệu cá nhân',
            '• Yêu cầu xoá dữ liệu',
            '• Biết dữ liệu của bạn được sử dụng như thế nào',
          ].map(line => (
            <Text key={line} style={s.privacyLine}>{line}</Text>
          ))}
        </View>
      </View>

      {/* ── Danger Zone ───────────────────────────── */}
      <View style={[s.card, s.dangerCard]}>
        <SectionHeader icon="⚠️" label="Vùng nguy hiểm" color="#DC2626" />

        <View style={s.dangerInfo}>
          <Text style={s.dangerInfoText}>
            Xoá toàn bộ tài khoản và dữ liệu liên quan khỏi hệ thống của chúng tôi vĩnh viễn.
          </Text>
        </View>

        <TouchableOpacity
          style={[s.deleteBtn, isLoading && s.disabledBtn]}
          onPress={handleDeleteAllData}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading
            ? <ActivityIndicator color="#fff" size="small" />
            : <>
                <Text style={s.deleteBtnIcon}>🗑️</Text>
                <Text style={s.deleteBtnLabel}>Xoá toàn bộ dữ liệu của tôi</Text>
              </>
          }
        </TouchableOpacity>
      </View>

      {/* ── Security Tips ─────────────────────────── */}
      <View style={s.card}>
        <SectionHeader icon="💡" label="Mẹo bảo mật" color="#D97706" />
        {[
          { icon: '🔑', tip: 'Dùng mật khẩu mạnh và duy nhất cho tài khoản' },
          { icon: '🤳', tip: 'Bật sinh trắc học để truy cập nhanh và an toàn' },
          { icon: '🔄', tip: 'Thường xuyên xem lại cài đặt quyền riêng tư' },
          { icon: '🚫', tip: 'Không chia sẻ thông tin đăng nhập với bất kỳ ai' },
        ].map(({ icon, tip }) => (
          <View key={tip} style={s.tipRow}>
            <Text style={s.tipIcon}>{icon}</Text>
            <Text style={s.tipText}>{tip}</Text>
          </View>
        ))}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

/* ─── styles ───────────────────────────────────────────────────────────────── */

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#F1F5F9' },
  content: { padding: 16, paddingTop: 12 },

  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: '#64748B' },

  /* card */
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  dangerCard: {
    borderWidth: 1.5,
    borderColor: '#FEE2E2',
  },

  /* section header */
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  sectionIconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  sectionIcon: { fontSize: 18 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },

  /* banner */
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 12, marginBottom: 14 },
  bannerIcon: { fontSize: 16 },
  bannerText: { flex: 1, fontSize: 13, fontWeight: '500', lineHeight: 18 },

  /* biometric row */
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowLeft: { flex: 1 },
  rowLabel: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  rowSub: { fontSize: 12, color: '#64748B', marginTop: 2 },

  /* encryption */
  encryptionBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F0FDF4', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#BBF7D0',
  },
  encryptionIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#D1FAE5', justifyContent: 'center', alignItems: 'center',
  },
  encryptionIcon: { fontSize: 22 },
  encryptionTitle: { fontSize: 14, fontWeight: '700', color: '#065F46' },
  encryptionSub: { fontSize: 12, color: '#047857', marginTop: 2, lineHeight: 16 },
  activeBadge: {
    backgroundColor: '#059669', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  activeBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  /* export */
  subLabel: { fontSize: 13, fontWeight: '700', color: '#1E293B', marginBottom: 4 },
  subDesc: { fontSize: 12, color: '#64748B', marginBottom: 12, lineHeight: 17 },
  exportRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  exportBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: '#2563EB', borderRadius: 14,
    paddingVertical: 13,
  },
  exportBtnIcon: { fontSize: 16, color: '#fff' },
  exportBtnLabel: { fontSize: 14, fontWeight: '700', color: '#fff' },
  exportBtnArrow: { fontSize: 14, color: '#93C5FD', fontWeight: '700' },

  /* privacy box */
  privacyBox: {
    backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  privacyTitle: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 },
  privacyLine: { fontSize: 12, color: '#64748B', lineHeight: 20 },

  /* danger */
  dangerInfo: {
    backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12, marginBottom: 14,
  },
  dangerInfoText: { fontSize: 13, color: '#B91C1C', lineHeight: 18 },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#DC2626', borderRadius: 14, paddingVertical: 15,
  },
  deleteBtnIcon: { fontSize: 18 },
  deleteBtnLabel: { fontSize: 15, fontWeight: '700', color: '#fff' },

  /* tips */
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  tipIcon: { fontSize: 18, marginTop: 1 },
  tipText: { flex: 1, fontSize: 13, color: '#475569', lineHeight: 19 },

  /* misc */
  disabledBtn: { opacity: 0.5 },
})

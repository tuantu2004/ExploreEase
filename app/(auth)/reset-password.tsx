import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  ScrollView, Platform,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { updatePassword } from '../../services/authService'
import { Colors, Typography, Spacing, Radius, Shadow } from '../../constants/theme'

const C = Colors.light

function getStrength(pw: string): { level: number; label: string; color: string } {
  if (pw.length === 0) return { level: 0, label: '', color: '#E2E8F0' }
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  if (score <= 1) return { level: 1, label: 'Yếu', color: '#EF4444' }
  if (score === 2) return { level: 2, label: 'Trung bình', color: '#F97316' }
  if (score === 3) return { level: 3, label: 'Khá mạnh', color: '#3B82F6' }
  return { level: 4, label: 'Mạnh', color: '#10B981' }
}

export default function ResetPasswordScreen() {
  const { email } = useLocalSearchParams<{ email: string }>()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const strength = getStrength(password)
  const passwordsMatch = password === confirm && confirm.length > 0
  const canSubmit = password.length >= 6 && passwordsMatch && !loading

  const handleReset = async () => {
    if (!canSubmit) return
    if (password.length < 6) {
      setError('Mật khẩu phải ít nhất 6 ký tự')
      return
    }
    if (!passwordsMatch) {
      setError('Mật khẩu xác nhận không khớp')
      return
    }
    setLoading(true)
    setError('')
    try {
      await updatePassword(password)
      setDone(true)
    } catch (e: any) {
      setError(e.message ?? 'Không thể đổi mật khẩu. Thử lại.')
    } finally {
      setLoading(false)
    }
  }

  // Màn hình thành công
  if (done) {
    return (
      <View style={s.successScreen}>
        <View style={s.successIconWrap}>
          <Text style={s.successIcon}>✅</Text>
        </View>
        <Text style={s.successTitle}>Đổi mật khẩu thành công!</Text>
        <Text style={s.successSub}>
          Mật khẩu của bạn đã được cập nhật.{'\n'}Vui lòng đăng nhập lại.
        </Text>
        <TouchableOpacity
          style={s.successBtn}
          onPress={() => router.replace('/(auth)/login')}
          activeOpacity={0.85}
        >
          <Text style={s.successBtnText}>Đến trang đăng nhập →</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={s.screen}
        contentContainerStyle={s.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back */}
        <TouchableOpacity style={s.back} onPress={() => router.back()}>
          <Text style={s.backIcon}>←</Text>
        </TouchableOpacity>

        {/* Hero */}
        <View style={s.hero}>
          <View style={s.iconWrap}>
            <Text style={s.heroIcon}>🔑</Text>
          </View>
          <Text style={s.title}>Đặt mật khẩu mới</Text>
          <Text style={s.subtitle}>
            Tạo mật khẩu mới cho tài khoản{'\n'}
            <Text style={s.emailText}>{email}</Text>
          </Text>
        </View>

        {/* Password */}
        <View style={s.fieldGroup}>
          <Text style={s.label}>Mật khẩu mới</Text>
          <View style={[s.inputWrap, password.length > 0 ? s.inputActive : {}]}>
            <Text style={s.inputIcon}>🔒</Text>
            <TextInput
              style={s.input}
              placeholder="Tối thiểu 6 ký tự"
              placeholderTextColor={C.placeholder}
              secureTextEntry={!showPw}
              value={password}
              onChangeText={v => { setPassword(v); setError('') }}
            />
            <TouchableOpacity onPress={() => setShowPw(!showPw)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={s.eyeIcon}>{showPw ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          {/* Strength bar */}
          {password.length > 0 && (
            <View style={s.strengthRow}>
              {[1, 2, 3, 4].map(i => (
                <View
                  key={i}
                  style={[
                    s.strengthBar,
                    { backgroundColor: i <= strength.level ? strength.color : '#E2E8F0' },
                  ]}
                />
              ))}
              <Text style={[s.strengthLabel, { color: strength.color }]}>
                {strength.label}
              </Text>
            </View>
          )}
        </View>

        {/* Confirm Password */}
        <View style={s.fieldGroup}>
          <Text style={s.label}>Xác nhận mật khẩu</Text>
          <View style={[
            s.inputWrap,
            confirm.length > 0 && passwordsMatch ? s.inputValid : {},
            confirm.length > 0 && !passwordsMatch ? s.inputError : {},
          ]}>
            <Text style={s.inputIcon}>🔒</Text>
            <TextInput
              style={s.input}
              placeholder="Nhập lại mật khẩu"
              placeholderTextColor={C.placeholder}
              secureTextEntry={!showConfirm}
              value={confirm}
              onChangeText={v => { setConfirm(v); setError('') }}
              onSubmitEditing={handleReset}
              returnKeyType="done"
            />
            <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={s.eyeIcon}>{showConfirm ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>
          {confirm.length > 0 && !passwordsMatch && (
            <Text style={s.errorText}>⚠ Mật khẩu không khớp</Text>
          )}
          {confirm.length > 0 && passwordsMatch && (
            <Text style={s.matchText}>✓ Mật khẩu khớp</Text>
          )}
        </View>

        {/* Requirements */}
        <View style={s.reqBox}>
          <Text style={s.reqTitle}>Yêu cầu mật khẩu:</Text>
          {[
            { text: 'Ít nhất 6 ký tự', ok: password.length >= 6 },
            { text: 'Chứa chữ hoa (khuyến nghị)', ok: /[A-Z]/.test(password) },
            { text: 'Chứa số (khuyến nghị)', ok: /[0-9]/.test(password) },
          ].map(req => (
            <View key={req.text} style={s.reqRow}>
              <Text style={{ color: req.ok ? '#10B981' : '#94A3B8', fontSize: 13 }}>
                {req.ok ? '✓' : '○'} {req.text}
              </Text>
            </View>
          ))}
        </View>

        {error ? (
          <View style={s.errorBanner}>
            <Text style={s.errorBannerText}>⚠️ {error}</Text>
          </View>
        ) : null}

        {/* Submit */}
        <TouchableOpacity
          style={[s.btn, !canSubmit && s.btnDisabled]}
          onPress={handleReset}
          disabled={!canSubmit}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.btnText}>Đặt mật khẩu mới</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.background },
  container: { paddingHorizontal: Spacing.xl, paddingTop: 60, paddingBottom: Spacing.xl },

  back: {
    width: 40, height: 40, borderRadius: Radius.md,
    backgroundColor: C.surface,
    justifyContent: 'center', alignItems: 'center',
    ...Shadow.sm, marginBottom: Spacing['2xl'],
  },
  backIcon: { fontSize: 18, color: C.onSurface },

  hero: { alignItems: 'center', marginBottom: Spacing['3xl'] },
  iconWrap: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: C.primaryContainer,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  heroIcon: { fontSize: 52 },
  title: { ...Typography.headlineSmall, color: C.onBackground, marginBottom: Spacing.sm },
  subtitle: {
    ...Typography.bodyMedium, color: C.onSurfaceVariant,
    textAlign: 'center', lineHeight: 22,
  },
  emailText: { ...Typography.titleSmall, color: C.primary },

  fieldGroup: { marginBottom: Spacing.lg },
  label: { ...Typography.labelMedium, color: C.onSurface, marginBottom: Spacing.sm },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: C.outline,
    borderRadius: Radius.lg, backgroundColor: C.surfaceVariant,
    paddingHorizontal: Spacing.base,
  },
  inputActive: { borderColor: C.primary },
  inputValid: { borderColor: '#10B981', backgroundColor: '#F0FDF4' },
  inputError: { borderColor: C.error, backgroundColor: C.errorContainer },
  inputIcon: { fontSize: 18, marginRight: Spacing.sm },
  input: { flex: 1, paddingVertical: Spacing.base, fontSize: 15, color: C.onSurface },
  eyeIcon: { fontSize: 18 },
  errorText: { ...Typography.bodySmall, color: C.error, marginTop: 4 },
  matchText: { ...Typography.bodySmall, color: '#10B981', marginTop: 4 },

  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: 12, fontWeight: '600', minWidth: 60, textAlign: 'right' },

  reqBox: {
    backgroundColor: C.surfaceVariant, borderRadius: Radius.lg,
    padding: Spacing.base, marginBottom: Spacing.lg, gap: 4,
  },
  reqTitle: { ...Typography.labelSmall, color: C.onSurfaceVariant, marginBottom: 4 },
  reqRow: {},

  errorBanner: {
    backgroundColor: C.errorContainer, borderRadius: Radius.md,
    padding: Spacing.base, marginBottom: Spacing.base,
    borderWidth: 1, borderColor: '#FECACA',
  },
  errorBannerText: { ...Typography.bodySmall, color: C.error },

  btn: {
    backgroundColor: C.primary, borderRadius: Radius.xl,
    paddingVertical: Spacing.base + 2, alignItems: 'center',
    ...Shadow.colored(C.primary),
  },
  btnDisabled: { opacity: 0.5, shadowOpacity: 0 },
  btnText: { ...Typography.labelLarge, color: '#fff', fontSize: 16 },

  // Success screen
  successScreen: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    padding: Spacing.xl, backgroundColor: C.background, gap: Spacing.lg,
  },
  successIconWrap: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center', alignItems: 'center',
  },
  successIcon: { fontSize: 60 },
  successTitle: { ...Typography.headlineSmall, color: C.onBackground, textAlign: 'center' },
  successSub: { ...Typography.bodyMedium, color: C.onSurfaceVariant, textAlign: 'center', lineHeight: 22 },
  successBtn: {
    backgroundColor: C.primary, borderRadius: Radius.xl,
    paddingVertical: Spacing.base + 2, paddingHorizontal: Spacing['2xl'],
    ...Shadow.colored(C.primary),
  },
  successBtnText: { ...Typography.labelLarge, color: '#fff', fontSize: 16 },
})

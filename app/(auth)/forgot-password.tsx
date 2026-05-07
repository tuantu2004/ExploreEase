import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  ScrollView, Platform,
} from 'react-native'
import { router } from 'expo-router'
import { sendPasswordResetOtp } from '../../services/authService'
import { Colors, Typography, Spacing, Radius, Shadow } from '../../constants/theme'

const C = Colors.light

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  const handleSend = async () => {
    if (!isValid || loading) return
    setLoading(true)
    setError('')
    try {
      await sendPasswordResetOtp(email.trim().toLowerCase())
      router.push({
        pathname: '/(auth)/reset-otp',
        params: { email: email.trim().toLowerCase() },
      })
    } catch (e: any) {
      setError(e.message ?? 'Không thể gửi mã OTP. Kiểm tra lại email.')
    } finally {
      setLoading(false)
    }
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
            <Text style={s.heroIcon}>🔐</Text>
          </View>
          <Text style={s.title}>Quên mật khẩu?</Text>
          <Text style={s.subtitle}>
            Nhập email đã đăng ký. Chúng tôi sẽ gửi{'\n'}
            mã OTP 6 chữ số để xác nhận.
          </Text>
        </View>

        {/* Email Input */}
        <View style={s.fieldGroup}>
          <Text style={s.label}>Địa chỉ email</Text>
          <View style={[s.inputWrap, error ? s.inputError : isValid && email ? s.inputValid : {}]}>
            <Text style={s.inputIcon}>📧</Text>
            <TextInput
              style={s.input}
              placeholder="example@email.com"
              placeholderTextColor={C.placeholder}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              value={email}
              onChangeText={v => { setEmail(v); setError('') }}
              onSubmitEditing={handleSend}
              returnKeyType="send"
            />
            {isValid && email ? <Text style={s.checkIcon}>✓</Text> : null}
          </View>
          {error ? <Text style={s.errorText}>⚠ {error}</Text> : null}
        </View>

        {/* Send Button */}
        <TouchableOpacity
          style={[s.btn, (!isValid || loading) && s.btnDisabled]}
          onPress={handleSend}
          disabled={!isValid || loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.btnText}>Gửi mã OTP</Text>
          }
        </TouchableOpacity>

        {/* Info box */}
        <View style={s.infoBox}>
          <Text style={s.infoIcon}>💡</Text>
          <Text style={s.infoText}>
            Mã OTP có hiệu lực trong 10 phút. Kiểm tra cả hộp thư rác nếu không nhận được.
          </Text>
        </View>

        {/* Back to login */}
        <View style={s.loginRow}>
          <Text style={s.loginGray}>Nhớ mật khẩu rồi? </Text>
          <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
            <Text style={s.loginLink}>Đăng nhập →</Text>
          </TouchableOpacity>
        </View>
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

  fieldGroup: { marginBottom: Spacing.xl },
  label: { ...Typography.labelMedium, color: C.onSurface, marginBottom: Spacing.sm },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: C.outline,
    borderRadius: Radius.lg, backgroundColor: C.surfaceVariant,
    paddingHorizontal: Spacing.base,
  },
  inputValid: { borderColor: '#10B981', backgroundColor: '#F0FDF4' },
  inputError: { borderColor: C.error, backgroundColor: C.errorContainer },
  inputIcon: { fontSize: 18, marginRight: Spacing.sm },
  input: { flex: 1, paddingVertical: Spacing.base, fontSize: 15, color: C.onSurface },
  checkIcon: { fontSize: 16, color: '#10B981', fontWeight: '700' },
  errorText: { ...Typography.bodySmall, color: C.error, marginTop: 4 },

  btn: {
    backgroundColor: C.primary, borderRadius: Radius.xl,
    paddingVertical: Spacing.base + 2, alignItems: 'center',
    marginBottom: Spacing.xl,
    ...Shadow.colored(C.primary),
  },
  btnDisabled: { opacity: 0.5, shadowOpacity: 0 },
  btnText: { ...Typography.labelLarge, color: '#fff', fontSize: 16 },

  infoBox: {
    flexDirection: 'row', gap: Spacing.sm,
    backgroundColor: '#EFF6FF', borderRadius: Radius.lg,
    padding: Spacing.base, marginBottom: Spacing.xl,
    borderWidth: 1, borderColor: '#BFDBFE',
  },
  infoIcon: { fontSize: 16 },
  infoText: { flex: 1, ...Typography.bodySmall, color: '#1E40AF', lineHeight: 18 },

  loginRow: { flexDirection: 'row', justifyContent: 'center' },
  loginGray: { ...Typography.bodyMedium, color: C.onSurfaceVariant },
  loginLink: { ...Typography.bodyMedium, fontWeight: '700', color: C.primary },
})

import { useRef, useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Animated, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { verifyPasswordResetOtp, sendPasswordResetOtp } from '../../services/authService'
import { Colors, Typography, Spacing, Radius, Shadow } from '../../constants/theme'

const C = Colors.light
const OTP_LENGTH = 6

export default function ResetOtpScreen() {
  const { email } = useLocalSearchParams<{ email: string }>()
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resendTimer, setResendTimer] = useState(60)
  const [resendLoading, setResendLoading] = useState(false)
  const [shake] = useState(new Animated.Value(0))
  const inputs = useRef<(TextInput | null)[]>([])

  useEffect(() => {
    const t = setInterval(() => setResendTimer(v => (v > 0 ? v - 1 : 0)), 1000)
    return () => clearInterval(t)
  }, [])

  const shakeError = () => {
    Animated.sequence([
      Animated.timing(shake, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start()
  }

  const handleChange = (val: string, idx: number) => {
    if (!/^\d*$/.test(val)) return
    const next = [...otp]
    next[idx] = val.slice(-1)
    setOtp(next)
    setError('')
    if (val && idx < OTP_LENGTH - 1) inputs.current[idx + 1]?.focus()
  }

  const handleKeyPress = (key: string, idx: number) => {
    if (key === 'Backspace' && !otp[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus()
    }
  }

  const handleVerify = async () => {
    const code = otp.join('')
    if (code.length < OTP_LENGTH) {
      setError('Vui lòng nhập đủ 6 chữ số')
      shakeError()
      return
    }
    setLoading(true)
    try {
      await verifyPasswordResetOtp(email!, code)
      router.replace({
        pathname: '/(auth)/reset-password',
        params: { email: email! },
      })
    } catch (e: any) {
      setError(e.message || 'Mã OTP không hợp lệ hoặc đã hết hạn')
      shakeError()
      setOtp(Array(OTP_LENGTH).fill(''))
      setTimeout(() => inputs.current[0]?.focus(), 100)
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendTimer > 0 || resendLoading) return
    setResendLoading(true)
    try {
      await sendPasswordResetOtp(email!)
      setResendTimer(60)
      setOtp(Array(OTP_LENGTH).fill(''))
      setError('')
      setTimeout(() => inputs.current[0]?.focus(), 100)
    } catch (e: any) {
      setError(e.message || 'Không thể gửi lại mã')
    } finally {
      setResendLoading(false)
    }
  }

  const isComplete = otp.every(d => d !== '')

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
            <Text style={s.heroIcon}>📩</Text>
          </View>
          <Text style={s.title}>Nhập mã xác nhận</Text>
          <Text style={s.subtitle}>
            Mã OTP 6 chữ số đã được gửi tới{'\n'}
            <Text style={s.emailText}>{email}</Text>
          </Text>
        </View>

        {/* OTP Inputs */}
        <Animated.View style={[s.otpRow, { transform: [{ translateX: shake }] }]}>
          {otp.map((digit, i) => (
            <TextInput
              key={i}
              ref={r => { inputs.current[i] = r }}
              style={[
                s.otpBox,
                digit ? s.otpBoxFilled : {},
                error ? s.otpBoxError : {},
              ]}
              value={digit}
              onChangeText={v => handleChange(v, i)}
              onKeyPress={({ nativeEvent: { key } }) => handleKeyPress(key, i)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
              textAlign="center"
            />
          ))}
        </Animated.View>

        {error ? <Text style={s.error}>⚠️ {error}</Text> : null}

        {/* Verify Button */}
        <TouchableOpacity
          style={[s.btn, (!isComplete || loading) && s.btnDisabled]}
          onPress={handleVerify}
          disabled={!isComplete || loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.btnText}>Xác nhận mã OTP</Text>
          }
        </TouchableOpacity>

        {/* Resend */}
        <View style={s.resendRow}>
          <Text style={s.resendLabel}>Không nhận được mã? </Text>
          <TouchableOpacity onPress={handleResend} disabled={resendTimer > 0 || resendLoading}>
            {resendLoading
              ? <ActivityIndicator size="small" color={C.primary} />
              : <Text style={[s.resendLink, resendTimer > 0 && s.resendDisabled]}>
                  {resendTimer > 0 ? `Gửi lại (${resendTimer}s)` : 'Gửi lại'}
                </Text>
            }
          </TouchableOpacity>
        </View>

        {/* Info */}
        <View style={s.infoBox}>
          <Text style={s.infoIcon}>⏱</Text>
          <Text style={s.infoText}>Mã OTP có hiệu lực trong 10 phút. Kiểm tra thư mục Spam nếu không thấy.</Text>
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
  emailText: { ...Typography.titleSmall, color: C.primary },

  otpRow: {
    flexDirection: 'row', gap: Spacing.md,
    justifyContent: 'center', marginBottom: Spacing.base,
  },
  otpBox: {
    width: 48, height: 56, borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: C.outline,
    backgroundColor: C.surface,
    fontSize: 22, fontWeight: '700', color: C.onSurface,
    ...Shadow.sm,
  },
  otpBoxFilled: {
    borderColor: C.primary,
    backgroundColor: C.primaryContainer,
    color: C.primary,
  },
  otpBoxError: { borderColor: C.error, backgroundColor: C.errorContainer },

  error: {
    ...Typography.bodySmall, color: C.error,
    textAlign: 'center', marginBottom: Spacing.base,
  },

  btn: {
    backgroundColor: C.primary, borderRadius: Radius.xl,
    paddingVertical: Spacing.base + 2, alignItems: 'center',
    marginTop: Spacing.xl, marginBottom: Spacing.lg,
    ...Shadow.colored(C.primary),
  },
  btnDisabled: { opacity: 0.5, shadowOpacity: 0 },
  btnText: { ...Typography.labelLarge, color: '#fff', fontSize: 16 },

  resendRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: Spacing.xl },
  resendLabel: { ...Typography.bodyMedium, color: C.onSurfaceVariant },
  resendLink: { ...Typography.labelLarge, color: C.primary },
  resendDisabled: { color: C.disabled },

  infoBox: {
    flexDirection: 'row', gap: Spacing.sm,
    backgroundColor: '#FFFBEB', borderRadius: Radius.lg,
    padding: Spacing.base, borderWidth: 1, borderColor: '#FDE68A',
  },
  infoIcon: { fontSize: 16 },
  infoText: { flex: 1, ...Typography.bodySmall, color: '#78350F', lineHeight: 18 },
})

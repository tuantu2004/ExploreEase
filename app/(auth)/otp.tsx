import { useRef, useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Animated, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { supabase } from '../../services/supabase'
import { Colors, Typography, Spacing, Radius, Shadow } from '../../constants/theme'

const C = Colors.light
const OTP_LENGTH = 6

export default function OTPScreen() {
  const { email } = useLocalSearchParams<{ email: string }>()
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resendTimer, setResendTimer] = useState(60)
  const [shake] = useState(new Animated.Value(0))
  const inputs = useRef<(TextInput | null)[]>([])

  useEffect(() => {
    const t = setInterval(() => {
      setResendTimer((v) => (v > 0 ? v - 1 : 0))
    }, 1000)
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
      const { error: err } = await supabase.auth.verifyOtp({
        email: email!,
        token: code,
        type: 'email',
      })
      if (err) throw err
      router.replace('/(auth)/preferences')
    } catch (e: any) {
      setError(e.message || 'Mã OTP không hợp lệ')
      shakeError()
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendTimer > 0) return
    setResendTimer(60)
    await supabase.auth.resend({ type: 'signup', email: email! })
  }

  const isComplete = otp.every((d) => d !== '')

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
            <Text style={s.icon}>📧</Text>
          </View>
          <Text style={s.title}>Xác minh email</Text>
          <Text style={s.subtitle}>
            Chúng tôi đã gửi mã 6 chữ số tới{'\n'}
            <Text style={s.emailText}>{email}</Text>
          </Text>
        </View>

        {/* OTP Input */}
        <Animated.View style={[s.otpRow, { transform: [{ translateX: shake }] }]}>
          {otp.map((digit, i) => (
            <TextInput
              key={i}
              ref={(r) => { inputs.current[i] = r }}
              style={[
                s.otpBox,
                digit ? s.otpBoxFilled : {},
                error ? s.otpBoxError : {},
              ]}
              value={digit}
              onChangeText={(v) => handleChange(v, i)}
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
            : <Text style={s.btnText}>Xác minh</Text>
          }
        </TouchableOpacity>

        {/* Resend */}
        <View style={s.resendRow}>
          <Text style={s.resendLabel}>Không nhận được mã? </Text>
          <TouchableOpacity onPress={handleResend} disabled={resendTimer > 0}>
            <Text style={[s.resendLink, resendTimer > 0 && s.resendDisabled]}>
              {resendTimer > 0 ? `Gửi lại (${resendTimer}s)` : 'Gửi lại'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.background,
  },
  container: {
    paddingHorizontal: Spacing.xl,
    paddingTop: 60,
    paddingBottom: Spacing.xl,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: C.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadow.sm,
    marginBottom: Spacing['2xl'],
  },
  backIcon: { fontSize: 18, color: C.onSurface },

  hero: { alignItems: 'center', marginBottom: Spacing['3xl'] },
  iconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: C.primaryContainer,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  icon: { fontSize: 52 },
  title: {
    ...Typography.headlineSmall,
    color: C.onBackground,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.bodyMedium,
    color: C.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 22,
  },
  emailText: {
    ...Typography.titleSmall,
    color: C.primary,
  },

  otpRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    justifyContent: 'center',
    marginBottom: Spacing.base,
  },
  otpBox: {
    width: 48,
    height: 56,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: C.outline,
    backgroundColor: C.surface,
    fontSize: 22,
    fontWeight: '700',
    color: C.onSurface,
    ...Shadow.sm,
  },
  otpBoxFilled: {
    borderColor: C.primary,
    backgroundColor: C.primaryContainer,
    color: C.primary,
  },
  otpBoxError: {
    borderColor: C.error,
    backgroundColor: C.errorContainer,
  },

  error: {
    ...Typography.bodySmall,
    color: C.error,
    textAlign: 'center',
    marginBottom: Spacing.base,
  },

  btn: {
    backgroundColor: C.primary,
    borderRadius: Radius.xl,
    paddingVertical: Spacing.base + 2,
    alignItems: 'center',
    marginTop: Spacing.xl,
    ...Shadow.colored(C.primary),
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { ...Typography.labelLarge, color: '#fff', fontSize: 16 },

  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  resendLabel: { ...Typography.bodyMedium, color: C.onSurfaceVariant },
  resendLink: { ...Typography.labelLarge, color: C.primary },
  resendDisabled: { color: C.disabled },
})

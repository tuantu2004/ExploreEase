import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, TextInput,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useState, useRef, useEffect } from 'react'
import { supabase } from '../../services/supabase'

export default function VerifyOTPScreen() {
  const { email } = useLocalSearchParams<{ email: string }>()
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(60)
  const inputs = useRef<TextInput[]>([])

  useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  const handleChange = (text: string, index: number) => {
    const newOtp = [...otp]
    newOtp[index] = text.slice(-1)
    setOtp(newOtp)
    setError('')
    if (text && index < 5) {
      inputs.current[index + 1]?.focus()
    }
  }

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus()
    }
  }

  const handleVerify = async () => {
    const code = otp.join('')
    if (code.length !== 6) {
      setError('Vui lòng nhập đủ 6 số')
      return
    }
    setLoading(true)
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email!,
        token: code,
        type: 'email',
      })
      if (verifyError) throw verifyError
      router.replace('/(auth)/preferences')
    } catch (e: any) {
      setError('Mã OTP không đúng hoặc đã hết hạn')
      setOtp(['', '', '', '', '', ''])
      inputs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResending(true)
    try {
      await supabase.auth.resend({
        type: 'signup',
        email: email!,
      })
      setCountdown(60)
      setError('')
    } catch {
      setError('Không thể gửi lại. Thử sau!')
    } finally {
      setResending(false)
    }
  }

  const isComplete = otp.every(d => d !== '')

  return (
    <View style={s.screen}>
      {/* Back */}
      <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
        <Text style={s.backText}>←</Text>
      </TouchableOpacity>

      {/* Icon */}
      <View style={s.iconBox}>
        <Text style={s.icon}>📧</Text>
      </View>

      <Text style={s.title}>Xác minh email</Text>

      <Text style={s.subtitle}>
        {'Chúng tôi đã gửi mã 6 số đến'}
      </Text>
      <Text style={s.emailText}>{email}</Text>

      {/* OTP Input */}
      <View style={s.otpRow}>
        {otp.map((digit, i) => (
          <TextInput
            key={i}
            ref={ref => { if (ref) inputs.current[i] = ref }}
            style={[
              s.otpInput,
              digit ? s.otpInputFilled : null,
              error ? s.otpInputError : null,
            ]}
            value={digit}
            onChangeText={text => handleChange(text, i)}
            onKeyPress={e => handleKeyPress(e, i)}
            keyboardType="numeric"
            maxLength={1}
            selectTextOnFocus
            autoFocus={i === 0}
          />
        ))}
      </View>

      {/* Error */}
      {error ? (
        <View style={s.errorBox}>
          <Text style={s.errorText}>{'⚠️ ' + error}</Text>
        </View>
      ) : null}

      {/* Verify Button */}
      <TouchableOpacity
        style={[s.verifyBtn, (!isComplete || loading) && s.verifyBtnDisabled]}
        onPress={handleVerify}
        disabled={!isComplete || loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={s.verifyBtnText}>Xác minh ✅</Text>
        )}
      </TouchableOpacity>

      {/* Resend */}
      <View style={s.resendRow}>
        <Text style={s.resendGray}>Không nhận được mã?</Text>
        {countdown > 0 ? (
          <Text style={s.resendTimer}>
            {' Gửi lại (' + countdown + 's)'}
          </Text>
        ) : (
          <TouchableOpacity
            onPress={handleResend}
            disabled={resending}
            style={s.resendBtn}
          >
            {resending ? (
              <ActivityIndicator size="small" color="#2563EB" />
            ) : (
              <Text style={s.resendLink}>Gửi lại</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      <Text style={s.note}>
        Kiểm tra thư mục Spam nếu không thấy email
      </Text>
    </View>
  )
}

const s = StyleSheet.create({
  screen: {
    flex: 1, backgroundColor: '#F8FAFC',
    padding: 24, paddingTop: 60,
    alignItems: 'center',
  },
  backBtn: {
    position: 'absolute', top: 52, left: 20,
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center', alignItems: 'center',
  },
  backText: { fontSize: 20, color: '#0F172A', fontWeight: '700' },
  iconBox: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center', alignItems: 'center',
    marginTop: 40, marginBottom: 24,
  },
  icon: { fontSize: 40 },
  title: {
    fontSize: 28, fontWeight: '900',
    color: '#0F172A', marginBottom: 8,
  },
  subtitle: {
    fontSize: 15, color: '#64748B',
    textAlign: 'center', marginBottom: 4,
  },
  emailText: {
    fontSize: 15, color: '#2563EB',
    fontWeight: '700', marginBottom: 32,
  },
  otpRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  otpInput: {
    width: 48, height: 56, borderRadius: 14,
    borderWidth: 2, borderColor: '#E2E8F0',
    backgroundColor: '#fff', textAlign: 'center',
    fontSize: 22, fontWeight: '800', color: '#0F172A',
  },
  otpInputFilled: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  otpInputError: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  errorBox: {
    backgroundColor: '#FEF2F2', borderRadius: 12,
    padding: 12, marginBottom: 16, width: '100%',
    borderWidth: 1, borderColor: '#FECACA',
  },
  errorText: { color: '#DC2626', fontSize: 13, textAlign: 'center' },
  verifyBtn: {
    width: '100%', backgroundColor: '#2563EB',
    borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', marginBottom: 20,
    shadowColor: '#2563EB', shadowOpacity: 0.4,
    shadowRadius: 10, elevation: 5,
  },
  verifyBtnDisabled: { backgroundColor: '#93C5FD', shadowOpacity: 0 },
  verifyBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  resendRow: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 16, gap: 4,
  },
  resendGray: { color: '#64748B', fontSize: 14 },
  resendTimer: { color: '#94A3B8', fontSize: 14, fontWeight: '600' },
  resendBtn: { paddingHorizontal: 4 },
  resendLink: { color: '#2563EB', fontSize: 14, fontWeight: '700' },
  note: { fontSize: 12, color: '#94A3B8', textAlign: 'center' },
})
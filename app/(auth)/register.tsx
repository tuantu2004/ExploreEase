import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { router } from 'expo-router'
import { register } from '../../services/authService'
import { Colors, Typography, Spacing, Radius, Shadow } from '../../constants/theme'

const C = Colors.light

const schema = z.object({
  name: z.string().min(2, 'Tên ít nhất 2 ký tự'),
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(8, 'Mật khẩu ít nhất 8 ký tự'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Mật khẩu không khớp',
  path: ['confirmPassword'],
})
type FormData = z.infer<typeof schema>

const FIELDS = [
  { name: 'name', label: 'Họ và tên', placeholder: 'Nguyễn Văn A', secure: false, keyboard: 'default' },
  { name: 'email', label: 'Email', placeholder: 'example@email.com', secure: false, keyboard: 'email-address' },
  { name: 'password', label: 'Mật khẩu', placeholder: '••••••••', secure: true, keyboard: 'default' },
  { name: 'confirmPassword', label: 'Xác nhận mật khẩu', placeholder: '••••••••', secure: true, keyboard: 'default' },
] as const

export default function RegisterScreen() {
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState<Record<string, boolean>>({})
  const { control, handleSubmit, formState: { errors, isSubmitting }, watch } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  })
  const watchPassword = watch('password')

  const getPasswordStrength = (pass: string) => {
    if (!pass) return { level: 0, label: '', color: '#E2E8F0' }
    let score = 0
    if (pass.length >= 8) score++
    if (/[A-Z]/.test(pass)) score++
    if (/[0-9]/.test(pass)) score++
    if (/[^A-Za-z0-9]/.test(pass)) score++

    if (score <= 1) return { level: 1, label: 'Yếu', color: '#EF4444' }
    if (score === 2) return { level: 2, label: 'Trung bình', color: '#F59E0B' }
    if (score === 3) return { level: 3, label: 'Mạnh', color: '#22C55E' }
    return { level: 4, label: 'Rất mạnh', color: '#2563EB' }
  }

  const onSubmit = async (data: FormData) => {
    try {
      setError('')
      await register(data)
      router.push({
        pathname: '/(auth)/verify-otp',
        params: { email: data.email },
      })
    } catch (e: any) {
      setError(e.message || 'Đăng ký thất bại')
    }
  }

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.container}
      keyboardShouldPersistTaps="handled"
    >
      {/* Back */}
      <TouchableOpacity onPress={() => router.back()} style={s.back}>
        <Text style={s.backIcon}>←</Text>
      </TouchableOpacity>

      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Tạo tài khoản</Text>
        <Text style={s.subtitle}>Tham gia ExploreEase – khám phá thế giới theo cách của bạn 🌍</Text>
      </View>

      {/* Form Card */}
      <View style={s.card}>
        {error ? (
          <View style={s.errorBox}>
            <Text style={s.errorText}>⚠️ {error}</Text>
          </View>
        ) : null}

        {FIELDS.map((field) => {
          const hasError = !!(errors as any)[field.name]
          const isSecure = field.secure && !showPass[field.name]
          return (
            <View key={field.name}>
              <Text style={s.label}>{field.label}</Text>
              <Controller
                control={control}
                name={field.name as keyof FormData}
                render={({ field: { onChange, value } }) => (
                  <View style={[s.inputWrap, hasError && s.inputWrapError]}>
                    <TextInput
                      style={s.input}
                      placeholder={field.placeholder}
                      placeholderTextColor={C.placeholder}
                      secureTextEntry={isSecure}
                      autoCapitalize="none"
                      keyboardType={field.keyboard as any}
                      value={value}
                      onChangeText={onChange}
                    />
                    {field.secure && (
                      <TouchableOpacity
                        style={s.eye}
                        onPress={() => setShowPass((p) => ({ ...p, [field.name]: !p[field.name] }))}
                      >
                        <Text style={s.eyeIcon}>{showPass[field.name] ? '🙈' : '👁️'}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              />
              {hasError && (
                <Text style={s.fieldError}>{(errors as any)[field.name]?.message}</Text>
              )}
              {field.name === 'password' && watchPassword && (
                <View style={s.strengthBox}>
                  <View style={s.strengthBars}>
                    {[1, 2, 3, 4].map((i) => (
                      <View
                        key={i}
                        style={[
                          s.strengthBar,
                          i <= getPasswordStrength(watchPassword).level && {
                            backgroundColor: getPasswordStrength(watchPassword).color,
                          },
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={[
                    s.strengthLabel,
                    { color: getPasswordStrength(watchPassword).color },
                  ]}>
                    {getPasswordStrength(watchPassword).label}
                  </Text>
                </View>
              )}
            </View>
          )
        })}

        {/* Terms */}
        <View style={s.termsRow}>
          <Text style={s.termsText}>
            Bằng cách đăng ký, bạn đồng ý với{' '}
            <Text style={s.termsLink}>Điều khoản dịch vụ</Text>
            {' '}và{' '}
            <Text style={s.termsLink}>Chính sách bảo mật</Text>
          </Text>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[s.btn, isSubmitting && s.btnDisabled]}
          onPress={handleSubmit(onSubmit)}
          disabled={isSubmitting}
          activeOpacity={0.85}
        >
          {isSubmitting
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.btnText}>Tạo tài khoản</Text>
          }
        </TouchableOpacity>

        <View style={s.row}>
          <Text style={s.grayText}>Đã có tài khoản? </Text>
          <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
            <Text style={s.link}>Đăng nhập</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Progress indicator */}
      <View style={s.steps}>
        {['Thông tin', 'Xác minh', 'Sở thích'].map((step, i) => (
          <View key={step} style={s.step}>
            <View style={[s.stepDot, i === 0 && s.stepDotActive]}>
              <Text style={[s.stepNum, i === 0 && s.stepNumActive]}>{i + 1}</Text>
            </View>
            <Text style={[s.stepLabel, i === 0 && s.stepLabelActive]}>{step}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.background },
  container: { flexGrow: 1, padding: Spacing.xl, paddingTop: 56 },

  back: {
    width: 40, height: 40,
    borderRadius: Radius.md,
    backgroundColor: C.surface,
    justifyContent: 'center', alignItems: 'center',
    ...Shadow.sm,
    marginBottom: Spacing.xl,
  },
  backIcon: { fontSize: 18, color: C.onSurface },

  header: { marginBottom: Spacing.xl },
  title: { ...Typography.headlineMedium, color: C.onBackground, marginBottom: Spacing.sm },
  subtitle: { ...Typography.bodyMedium, color: C.onSurfaceVariant, lineHeight: 22 },

  card: {
    backgroundColor: C.surface,
    borderRadius: Radius['3xl'],
    padding: Spacing.xl,
    ...Shadow.lg,
    marginBottom: Spacing.xl,
  },
  errorBox: {
    backgroundColor: C.errorContainer,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.base,
  },
  errorText: { ...Typography.bodySmall, color: C.error },

  label: { ...Typography.labelMedium, color: C.onSurface, marginTop: Spacing.md, marginBottom: Spacing.sm },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: C.outline,
    borderRadius: Radius.lg,
    backgroundColor: C.surfaceVariant,
    marginBottom: 4,
  },
  inputWrapError: { borderColor: C.error },
  input: { flex: 1, padding: Spacing.base, fontSize: 15, color: C.onSurface },
  eye: { padding: Spacing.base },
  eyeIcon: { fontSize: 18 },
  fieldError: { ...Typography.bodySmall, color: C.error, marginBottom: Spacing.sm },

  termsRow: { marginTop: Spacing.base, marginBottom: Spacing.lg },
  termsText: { ...Typography.bodySmall, color: C.onSurfaceVariant, lineHeight: 18 },
  termsLink: { color: C.primary, fontWeight: '600' },

  btn: {
    backgroundColor: C.primary,
    borderRadius: Radius.xl,
    paddingVertical: Spacing.base + 2,
    alignItems: 'center',
    marginBottom: Spacing.lg,
    ...Shadow.colored(C.primary),
  },
  btnDisabled: { opacity: 0.55 },
  btnText: { ...Typography.labelLarge, color: '#fff', fontSize: 16 },

  row: { flexDirection: 'row', justifyContent: 'center' },
  grayText: { ...Typography.bodyMedium, color: C.onSurfaceVariant },
  link: { ...Typography.bodyMedium, fontWeight: '700', color: C.primary },

  steps: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing['2xl'],
    paddingVertical: Spacing.base,
  },
  step: { alignItems: 'center', gap: Spacing.xs },
  stepDot: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: C.surfaceVariant,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: C.outline,
  },
  stepDotActive: { backgroundColor: C.primary, borderColor: C.primary },
  stepNum: { ...Typography.labelMedium, color: C.onSurfaceVariant },
  stepNumActive: { color: '#fff' },
  stepLabel: { ...Typography.labelSmall, color: C.onSurfaceVariant },
  stepLabelActive: { color: C.primary },

  strengthBox: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, marginTop: 6, marginBottom: 4,
  },
  strengthBars: { flexDirection: 'row', gap: 4, flex: 1 },
  strengthBar: {
    flex: 1, height: 4, borderRadius: 2,
    backgroundColor: '#E2E8F0',
  },
  strengthLabel: { fontSize: 11, fontWeight: '700', minWidth: 60 },
})

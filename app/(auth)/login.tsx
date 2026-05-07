import { zodResolver } from '@hookform/resolvers/zod'
import { router } from 'expo-router'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import {
    ActivityIndicator,
    KeyboardAvoidingView, Platform,
    ScrollView, StyleSheet,
    Text, TextInput, TouchableOpacity,
    View,
} from 'react-native'
import { z } from 'zod'
import { Colors, Radius, Shadow, Spacing, Typography } from '../../constants/theme'
import { login, loginWithGoogle } from '../../services/authService'
import { requestWebNotificationPermission } from '../../services/notificationService'

const C = Colors.light

const schema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu ít nhất 6 ký tự'),
})
type FormData = z.infer<typeof schema>

export default function LoginScreen() {
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const { control, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  const email = watch('email')
  const password = watch('password')
  const canSubmit = email.length > 0 && password.length > 0

  const onSubmit = async (data: FormData) => {
    try {
      setError('')
      // Xin quyền notification ngay trong user gesture (Chrome yêu cầu)
      requestWebNotificationPermission()
      await login(data)
      // Navigation handled by _layout.tsx onAuthStateChange (SIGNED_IN)
    } catch (e: any) {
      setError(e.message || 'Đăng nhập thất bại')
    }
  }

  const handleGoogle = async () => {
    try {
      setGoogleLoading(true)
      setError('')
      await loginWithGoogle()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setGoogleLoading(false)
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
        {/* Header */}
        <View style={s.header}>
          <View style={s.logoBox}>
            <Text style={s.logoEmoji}>✈️</Text>
          </View>
          <Text style={s.appName}>ExploreEase</Text>
          <Text style={s.heroSubtitle}>Khám phá sự kiện và địa điểm phù hợp với bạn hôm nay.</Text>
        </View>

        {/* Form Card */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Đăng nhập</Text>
          <Text style={s.cardSubtitle}>Tiếp tục hành trình của bạn với một trải nghiệm an toàn và nhanh chóng.</Text>

          {error ? (
            <View style={s.errorBanner}>
              <Text style={s.errorIcon}>⚠️</Text>
              <Text style={s.errorText}>{error}</Text>
              <TouchableOpacity onPress={() => setError('')}>
                <Text style={s.errorClose}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Email */}
          <View style={s.fieldGroup}>
            <Text style={s.label}>Email</Text>
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, value, onBlur } }) => (
                <View style={[s.inputWrapper, errors.email && s.inputError]}>
                  <Text style={s.inputIcon}>📧</Text>
                  <TextInput
                    style={s.input}
                    placeholder="example@email.com"
                    placeholderTextColor={C.placeholder}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                  />
                </View>
              )}
            />
            {errors.email && <Text style={s.fieldError}>⚠ {errors.email.message}</Text>}
          </View>

          {/* Password */}
          <View style={s.fieldGroup}>
            <Text style={s.label}>Mật khẩu</Text>
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, value, onBlur } }) => (
                <View style={[s.inputWrapper, errors.password && s.inputError]}>
                  <Text style={s.inputIcon}>🔒</Text>
                  <TextInput
                    style={s.input}
                    placeholder="••••••••"
                    placeholderTextColor={C.placeholder}
                    secureTextEntry={!showPass}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                  />
                  <TouchableOpacity onPress={() => setShowPass(!showPass)} style={s.eyeBtn}>
                    <Text style={s.eyeIcon}>{showPass ? '🙈' : '👁️'}</Text>
                  </TouchableOpacity>
                </View>
              )}
            />
            {errors.password && <Text style={s.fieldError}>⚠ {errors.password.message}</Text>}
          </View>

          {/* Forgot */}
          <TouchableOpacity style={s.forgotBtn} onPress={() => router.push('/(auth)/forgot-password')}>
            <Text style={s.forgotText}>Quên mật khẩu?</Text>
          </TouchableOpacity>

          {/* Login Button */}
          <TouchableOpacity
            style={[s.loginBtn, (!canSubmit || isSubmitting) && s.loginBtnDisabled]}
            onPress={handleSubmit(onSubmit)}
            disabled={!canSubmit || isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.loginBtnText}>Đăng nhập</Text>
            }
          </TouchableOpacity>

          {/* Divider */}
          <View style={s.divider}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>hoặc tiếp tục với</Text>
            <View style={s.dividerLine} />
          </View>

          {/* Google */}
          <TouchableOpacity style={s.googleBtn} onPress={handleGoogle} disabled={googleLoading} activeOpacity={0.85}>
            {googleLoading
              ? <ActivityIndicator color={C.primary} size="small" />
              : <>
                  <Text style={s.googleLetter}>G</Text>
                  <Text style={s.googleText}>Tiếp tục với Google</Text>
                </>
            }
          </TouchableOpacity>
          <Text style={s.supportText}>Đăng nhập an toàn bằng Google hoặc email để truy cập hàng trăm sự kiện và địa điểm.</Text>
        </View>

        {/* Register Link */}
        <View style={s.registerRow}>
          <Text style={s.registerGray}>Chưa có tài khoản? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
            <Text style={s.registerLink}>Đăng ký ngay →</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.background },
  container: { flexGrow: 1, padding: Spacing.xl, paddingTop: Spacing['2xl'], paddingBottom: Spacing['2xl'] },

  header: { alignItems: 'center', marginBottom: Spacing['2xl'] },
  logoBox: {
    width: 88, height: 88, borderRadius: Radius['2xl'],
    backgroundColor: C.primary,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: Spacing.base,
    ...Shadow.colored(C.primary),
  },
  logoEmoji: { fontSize: 44 },
  appName: { ...Typography.headlineMedium, color: C.onBackground, letterSpacing: -0.5 },
  heroSubtitle: { ...Typography.bodyLarge, color: C.onSurfaceVariant, marginTop: Spacing.sm, textAlign: 'center', maxWidth: 320 },

  card: {
    backgroundColor: C.surface, borderRadius: Radius['3xl'], padding: Spacing['2xl'],
    ...Shadow.lg,
  },
  cardTitle: { ...Typography.headlineSmall, color: C.onBackground, marginBottom: Spacing.sm },
  cardSubtitle: { ...Typography.bodyMedium, color: C.onSurfaceVariant, marginBottom: Spacing.lg },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.errorContainer, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.base, gap: Spacing.sm,
    borderWidth: 1, borderColor: '#FECACA',
  },
  errorIcon: { fontSize: 16 },
  errorText: { flex: 1, ...Typography.bodySmall, color: C.error },
  errorClose: { color: C.error, fontSize: 16, fontWeight: '700' },

  fieldGroup: { marginBottom: Spacing.base },
  label: { ...Typography.labelMedium, color: C.onSurface, marginBottom: Spacing.sm },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: C.outline,
    borderRadius: Radius.lg, backgroundColor: C.surface,
    paddingHorizontal: Spacing.base,
  },
  inputError: { borderColor: C.error, backgroundColor: C.errorContainer },
  inputIcon: { fontSize: 18, marginRight: Spacing.sm },
  input: { flex: 1, paddingVertical: Spacing.base, fontSize: 15, color: C.onSurface },
  eyeBtn: { padding: Spacing.sm },
  eyeIcon: { fontSize: 18 },
  fieldError: { ...Typography.bodySmall, color: C.error, marginTop: 6 },

  forgotBtn: { alignItems: 'flex-end', marginBottom: Spacing.lg },
  forgotText: { ...Typography.labelMedium, color: C.primary },

  loginBtn: {
    backgroundColor: C.primary, borderRadius: Radius.xl,
    paddingVertical: Spacing.base + 4, alignItems: 'center',
    ...Shadow.colored(C.primary),
  },
  loginBtnDisabled: { backgroundColor: C.disabled, opacity: 0.9, shadowOpacity: 0 },
  loginBtnText: { ...Typography.labelLarge, color: '#fff', fontSize: 16 },

  divider: {
    flexDirection: 'row', alignItems: 'center',
    marginVertical: Spacing.lg, gap: Spacing.md,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.outlineVariant },
  dividerText: { ...Typography.bodySmall, color: C.onSurfaceVariant, textTransform: 'uppercase' },

  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, borderWidth: 1.5, borderColor: C.outline,
    borderRadius: Radius.xl, paddingVertical: Spacing.base,
    backgroundColor: C.surface,
  },
  googleLetter: { fontSize: 20, fontWeight: '900', color: '#4285F4' },
  googleText: { ...Typography.titleSmall, color: C.onSurface },

  supportText: { ...Typography.bodySmall, color: C.onSurfaceVariant, textAlign: 'center', marginTop: Spacing.md },

  registerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.lg },
  registerGray: { ...Typography.bodyMedium, color: C.onSurfaceVariant },
  registerLink: { ...Typography.bodyMedium, fontWeight: '700', color: C.primary },
})

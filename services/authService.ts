import { supabase } from './supabase'
import { LoginForm, RegisterForm, User } from '../types/auth'
import {
  encryptAndStore,
  retrieveAndDecrypt,
  getOrCreateEncryptionKey,
} from './encryptionService'
import {
  authenticateWithBiometric,
  isBiometricEnabled,
  requireBiometricWithTimeout,
} from './biometricService'
import { storage } from './storage'

// Đăng ký
export async function register(form: RegisterForm) {
  const { data, error } = await supabase.auth.signUp({
    email: form.email,
    password: form.password,
    options: {
      data: { name: form.name },
    },
  })
  if (error) throw error

  // Encrypt and store sensitive registration data
  if (data.user) {
    await encryptAndStore(`user_profile_${data.user.id}`, {
      email: form.email,
      name: form.name,
      registeredAt: new Date().toISOString(),
    })
  }

  return data
}

// Đăng nhập email
export async function login(form: LoginForm) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: form.email,
    password: form.password,
  })
  if (error) throw error

  // Store encrypted session token
  if (data.session?.access_token) {
    await encryptAndStore('session_token', {
      token: data.session.access_token,
      expiresAt: data.session.expires_at,
      loginTime: new Date().toISOString(),
    })
  }

  return data
}

// Đăng nhập với Biometric
export async function loginWithBiometric(): Promise<boolean> {
  try {
    const biometricEnabled = await isBiometricEnabled()
    if (!biometricEnabled) {
      throw new Error('Biometric authentication is not enabled')
    }

    const authenticated = await authenticateWithBiometric(
      'Authenticate to access ExploreEase'
    )
    return authenticated
  } catch (error) {
    console.error('Biometric login failed:', error)
    return false
  }
}


// Đăng xuất Google
export async function loginWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: 'http://localhost:8081',
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  })
  if (error) throw error
  return data
}

// Đăng xuất — không chờ network (tránh treo khi offline)
export async function logout() {
  try {
    await storage.removeItem('session_token')
    await storage.removeItem('user_session')
  } catch {}
  // Fire-and-forget: không block UI kể cả khi mất mạng
  supabase.auth.signOut().catch(() => {})
}


// Lấy session hiện tại
export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

// Lấy profile
export async function getProfile(userId: string): Promise<User> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, user_preferences(*)')
    .eq('id', userId)
    .single()
  if (error) throw error

  // Verify biometric if required
  const biometricEnabled = await isBiometricEnabled()
  if (biometricEnabled) {
    const biometricAuth = await requireBiometricWithTimeout(30)
    if (!biometricAuth) {
      throw new Error('Biometric authentication required for profile access')
    }
  }

  return data
}

// Cập nhật profile
export async function updateProfile(userId: string, updates: Partial<User>) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error

  // Encrypt and store updated profile locally
  await encryptAndStore(`user_profile_${userId}`, {
    ...updates,
    updatedAt: new Date().toISOString(),
  })

  return data
}

// Gửi OTP 6 số qua email để reset mật khẩu
export async function sendPasswordResetOtp(email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  })
  if (error) throw error
}

// Xác nhận OTP reset mật khẩu (tạo session tạm)
export async function verifyPasswordResetOtp(email: string, token: string) {
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  })
  if (error) throw error
}

// Đổi mật khẩu mới (cần session từ verifyPasswordResetOtp)
export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
  // Đăng xuất session tạm sau khi đổi mật khẩu thành công
  await supabase.auth.signOut()
}

// Get stored encrypted profile
export async function getEncryptedProfile(userId: string) {
  return await retrieveAndDecrypt(`user_profile_${userId}`)
}

// Verify session security
export async function verifySessionSecurity(): Promise<boolean> {
  try {
    const biometricRequired = await isBiometricEnabled()
    if (biometricRequired) {
      return await requireBiometricWithTimeout(30)
    }
    return true
  } catch (error) {
    console.error('Session security verification failed:', error)
    return false
  }
}
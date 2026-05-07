export interface User {
  id: string
  email: string
  name: string
  age?: number
  gender?: 'male' | 'female' | 'other'
  avatar_url?: string
  travel_style: 'solo' | 'couple' | 'family' | 'group'
  role: 'user' | 'admin'
  is_verified: boolean
  created_at: string
  user_preferences?: {
    interests: string[]
    language: string
    notifications_enabled: boolean
  }[]
}

export interface UserPreference {
  id: string
  user_id: string
  interests: string[]
  language: string
  notifications_enabled: boolean
}

export interface LoginForm {
  email: string
  password: string
}

export interface RegisterForm {
  name: string
  email: string
  password: string
  confirmPassword: string
}
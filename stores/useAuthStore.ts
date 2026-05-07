import { create } from 'zustand'
import { User } from '@/types/auth'
import { supabase } from '@/services/supabase'
import { setCache, getCache, CACHE_KEYS } from '@/services/cacheService'
import { isOnline } from '@/services/offlineService'

interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  logout: () => void
  refreshUser: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  setUser: (user) => {
    if (user) setCache(CACHE_KEYS.PROFILE, user).catch(() => {})
    set({ user, isAuthenticated: !!user, isLoading: false })
  },

  setLoading: (isLoading) => set({ isLoading }),

  logout: () =>
    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    }),

  refreshUser: async () => {
    const { user } = get()
    if (!user) return
    const online = await isOnline()
    if (!online) {
      const cached = await getCache<User>(CACHE_KEYS.PROFILE, Infinity)
      if (cached) set({ user: { ...user, ...cached } })
      return
    }
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*, user_preferences(*)')
        .eq('id', user.id)
        .single()
      if (data) {
        const updated = { ...user, ...data }
        set({ user: updated })
        await setCache(CACHE_KEYS.PROFILE, updated)
      }
    } catch (e) {
      console.error('Refresh user error:', e)
    }
  },
}))

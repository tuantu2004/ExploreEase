import { createClient } from '@supabase/supabase-js'
import { Platform } from 'react-native'
import { storage } from './storage'
import * as ExpoCrypto from 'expo-crypto'

// Polyfill crypto.getRandomValues for React Native (needed by Supabase internals)
if (typeof globalThis.crypto === 'undefined') {
  (globalThis as any).crypto = {}
}
if (!globalThis.crypto.getRandomValues) {
  (globalThis.crypto as any).getRandomValues = ExpoCrypto.getRandomValues
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
    // PKCE requires crypto.subtle (only available on web/newer Android)
    // Use implicit flow on native to avoid the WebCrypto warning
    flowType: Platform.OS === 'web' ? 'pkce' : 'implicit',
  },
})
